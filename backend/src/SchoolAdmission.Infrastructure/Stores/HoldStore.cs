using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Infrastructure.Stores;

public class HoldStore : IHoldStore
{
    private readonly AppDbContext _dbContext;
    private readonly ILogger<HoldStore>? _logger;

    public HoldStore(AppDbContext dbContext, ILogger<HoldStore>? logger = null)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<HoldResponse> CreateHoldAsync(Guid classId, string studentId, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        const int maxAttempts = 2;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

            try
            {
                // Step 1: Validate class existence (and fetch class name for response / 404 if not found)
                string className;
                await using (var checkClassCmd = connection.CreateCommand())
                {
                    checkClassCmd.Transaction = tx;
                    checkClassCmd.CommandText = "SELECT name FROM classes WHERE id = @id;";
                    AddParameter(checkClassCmd, "@id", classId);

                    var result = await checkClassCmd.ExecuteScalarAsync(cancellationToken);
                    if (result == null || result is DBNull)
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new NotFoundException($"Class with id '{classId}' was not found.");
                    }

                    className = (string)result;
                }

                // Step 2: Reclaim expired HELD rows of THIS class.
                // Decrement held_seats by exactly the number reclaimed for this class.
                int reclaimedCount = 0;
                await using (var reclaimCmd = connection.CreateCommand())
                {
                    reclaimCmd.Transaction = tx;
                    reclaimCmd.CommandText = @"
                        WITH expired AS (
                            UPDATE reservations
                            SET status = 'EXPIRED', expired_at = clock_timestamp()
                            WHERE class_id = @id 
                              AND status = 'HELD' 
                              AND expires_at <= clock_timestamp()
                            RETURNING id
                        )
                        SELECT COUNT(*)::int AS cnt
                        FROM expired;
                    ";
                    AddParameter(reclaimCmd, "@id", classId);

                    var scalar = await reclaimCmd.ExecuteScalarAsync(cancellationToken);
                    if (scalar != null && scalar is not DBNull)
                    {
                        reclaimedCount = Convert.ToInt32(scalar);
                    }
                }

                if (reclaimedCount > 0)
                {
                    await using var updateClassCmd = connection.CreateCommand();
                    updateClassCmd.Transaction = tx;
                    updateClassCmd.CommandText = @"
                        UPDATE classes
                        SET held_seats = held_seats - @cnt
                        WHERE id = @id;
                    ";
                    AddParameter(updateClassCmd, "@cnt", reclaimedCount);
                    AddParameter(updateClassCmd, "@id", classId);
                    await updateClassCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                // Step 3: Pre-check, before taking a seat:
                // If the student has a CONFIRMED row or an unexpired HELD row in THIS class,
                // return 409 ALREADY_APPLIED_IN_CLASS.
                await using (var preCheckCmd = connection.CreateCommand())
                {
                    preCheckCmd.Transaction = tx;
                    preCheckCmd.CommandText = @"
                        SELECT 1
                        FROM reservations
                        WHERE class_id = @id
                          AND student_id = @studentId 
                          AND (status = 'CONFIRMED' OR (status = 'HELD' AND expires_at > clock_timestamp()))
                        LIMIT 1;
                    ";
                    AddParameter(preCheckCmd, "@id", classId);
                    AddParameter(preCheckCmd, "@studentId", studentId);

                    var exists = await preCheckCmd.ExecuteScalarAsync(cancellationToken);
                    if (exists != null && exists is not DBNull)
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new ConflictException(
                            "ALREADY_APPLIED_IN_CLASS",
                            "Student already has an active or confirmed application for this class."
                        );
                    }
                }

                // Step 4: Conditional seat UPDATE (atomic seat acquisition)
                await using (var seatUpdateCmd = connection.CreateCommand())
                {
                    seatUpdateCmd.Transaction = tx;
                    seatUpdateCmd.CommandText = @"
                        UPDATE classes
                        SET held_seats = held_seats + 1
                        WHERE id = @id AND (held_seats + confirmed_seats) < total_seats;
                    ";
                    AddParameter(seatUpdateCmd, "@id", classId);

                    var rowsAffected = await seatUpdateCmd.ExecuteNonQueryAsync(cancellationToken);
                    if (rowsAffected == 0)
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new ConflictException("NO_SEATS_AVAILABLE", "No seats available in this class.");
                    }
                }

                // Step 5: INSERT the reservation record
                // On SQLSTATE 23505 (unique index race on class_id, student_id), roll back and return ALREADY_APPLIED_IN_CLASS (never a 500).
                string holdId;
                string createdAt;
                string expiresAt;
                string serverTime;

                await using (var insertCmd = connection.CreateCommand())
                {
                    insertCmd.Transaction = tx;
                    insertCmd.CommandText = @"
                        INSERT INTO reservations (
                            id, class_id, student_id, status, created_at, expires_at
                        )
                        SELECT 
                            gen_random_uuid(),
                            @id,
                            @studentId,
                            'HELD',
                            ts,
                            ts + make_interval(secs => @holdDurationSeconds)
                        FROM (SELECT date_trunc('second', clock_timestamp()) AS ts) t
                        RETURNING id, created_at, expires_at, date_trunc('second', clock_timestamp()) AS server_time;
                    ";
                    AddParameter(insertCmd, "@id", classId);
                    AddParameter(insertCmd, "@studentId", studentId);
                    AddParameter(insertCmd, "@holdDurationSeconds", holdDurationSeconds);

                    try
                    {
                        await using var reader = await insertCmd.ExecuteReaderAsync(cancellationToken);
                        if (!await reader.ReadAsync(cancellationToken))
                        {
                            throw new InvalidOperationException("Failed to insert reservation record.");
                        }

                        holdId = reader.GetGuid(0).ToString();
                        createdAt = reader.GetFieldValue<DateTimeOffset>(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
                        expiresAt = reader.GetFieldValue<DateTimeOffset>(2).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
                        serverTime = reader.GetFieldValue<DateTimeOffset>(3).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
                    }
                    catch (PostgresException ex) when (ex.SqlState == "23505")
                    {
                        await tx.RollbackAsync(cancellationToken);
                        throw new ConflictException(
                            "ALREADY_APPLIED_IN_CLASS",
                            "Student already has an active or confirmed application for this class."
                        );
                    }
                }

                // Step 6: Commit transaction and return 201 response
                await tx.CommitAsync(cancellationToken);

                return new HoldResponse(
                    HoldId: holdId,
                    ClassId: classId.ToString(),
                    StudentId: studentId,
                    Status: "HELD",
                    ExpiresAt: expiresAt,
                    ClassName: className,
                    CreatedAt: createdAt,
                    ServerTime: serverTime
                );
            }
            catch (PostgresException ex) when (ex.SqlState == "40P01" || ex.SqlState == "40001")
            {
                try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }

                if (attempt < maxAttempts)
                {
                    _logger?.LogWarning("Postgres transient failure ({SqlState}) during create-hold for student {StudentId}. Retrying transaction once.", ex.SqlState, studentId);
                    await Task.Delay(Random.Shared.Next(10, 40), cancellationToken);
                    continue;
                }

                _logger?.LogError(ex, "Postgres deadlock or serialization failure ({SqlState}) after retry during create-hold for student {StudentId}.", ex.SqlState, studentId);
                throw new InternalErrorException("A database deadlock or serialization error occurred. Please try again.");
            }
            catch
            {
                try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
                throw;
            }
        }

        throw new InternalErrorException("Unexpected failure executing create-hold transaction.");
    }


    public async Task<HoldDetailsResponse?> GetHoldByIdAsync(Guid holdId, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                r.id AS hold_id,
                r.class_id,
                CASE 
                    WHEN r.status = 'HELD' AND r.expires_at <= now() THEN 'EXPIRED'
                    ELSE r.status
                END AS effective_status,
                r.expires_at,
                c.name AS class_name,
                r.created_at,
                r.confirmed_at,
                now() AS server_time
            FROM reservations r
            JOIN classes c ON r.class_id = c.id
            WHERE r.id = @id;
        ";
        AddParameter(cmd, "@id", holdId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0).ToString();
            var classId = reader.GetGuid(1).ToString();
            var status = reader.GetString(2);
            var expiresAt = reader.GetFieldValue<DateTimeOffset>(3).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            var className = reader.GetString(4);
            var createdAt = reader.GetFieldValue<DateTimeOffset>(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            string? confirmedAt = reader.IsDBNull(6)
                ? null
                : reader.GetFieldValue<DateTimeOffset>(6).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            var serverTime = reader.GetFieldValue<DateTimeOffset>(7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");

            return new HoldDetailsResponse(
                HoldId: id,
                ClassId: classId,
                Status: status,
                ExpiresAt: expiresAt,
                ClassName: className,
                CreatedAt: createdAt,
                ConfirmedAt: confirmedAt,
                ServerTime: serverTime
            );
        }

        return null;
    }

    public async Task<ConfirmHoldResponse> ConfirmHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        try
        {
            // 1. Attempt atomic confirm
            Guid? classId = null;
            DateTimeOffset? confirmedAt = null;

            await using (var confirmCmd = connection.CreateCommand())
            {
                confirmCmd.Transaction = tx;
                confirmCmd.CommandText = @"
                    UPDATE reservations
                    SET status = 'CONFIRMED', confirmed_at = clock_timestamp()
                    WHERE id = @id 
                      AND student_id = @studentId 
                      AND status = 'HELD' 
                      AND expires_at > clock_timestamp()
                    RETURNING class_id, confirmed_at;
                ";
                AddParameter(confirmCmd, "@id", holdId);
                AddParameter(confirmCmd, "@studentId", studentId);

                await using var reader = await confirmCmd.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                {
                    classId = reader.GetGuid(0);
                    confirmedAt = reader.GetFieldValue<DateTimeOffset>(1);
                }
            }

            if (classId.HasValue && confirmedAt.HasValue)
            {
                // Move one seat from held to confirmed in the same transaction
                await using (var updateSeatCmd = connection.CreateCommand())
                {
                    updateSeatCmd.Transaction = tx;
                    updateSeatCmd.CommandText = @"
                        UPDATE classes
                        SET held_seats = held_seats - 1, confirmed_seats = confirmed_seats + 1
                        WHERE id = @classId;
                    ";
                    AddParameter(updateSeatCmd, "@classId", classId.Value);
                    await updateSeatCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                await tx.CommitAsync(cancellationToken);

                return new ConfirmHoldResponse(
                    HoldId: holdId.ToString(),
                    Status: "CONFIRMED",
                    ClassId: classId.Value.ToString(),
                    ConfirmedAt: confirmedAt.Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
                );
            }

            // 2. If no row updated, inspect the reservation state
            string? currentStatus = null;
            bool isExpired = false;
            Guid? existingClassId = null;
            DateTimeOffset? existingConfirmedAt = null;

            await using (var inspectCmd = connection.CreateCommand())
            {
                inspectCmd.Transaction = tx;
                inspectCmd.CommandText = @"
                    SELECT status, (expires_at <= clock_timestamp()) AS is_expired, class_id, confirmed_at
                    FROM reservations
                    WHERE id = @id AND student_id = @studentId;
                ";
                AddParameter(inspectCmd, "@id", holdId);
                AddParameter(inspectCmd, "@studentId", studentId);

                await using var inspectReader = await inspectCmd.ExecuteReaderAsync(cancellationToken);
                if (await inspectReader.ReadAsync(cancellationToken))
                {
                    currentStatus = inspectReader.GetString(0);
                    isExpired = inspectReader.GetBoolean(1);
                    existingClassId = inspectReader.GetGuid(2);
                    if (!inspectReader.IsDBNull(3))
                    {
                        existingConfirmedAt = inspectReader.GetFieldValue<DateTimeOffset>(3);
                    }
                }
            }

            await tx.RollbackAsync(cancellationToken);

            if (currentStatus == null)
            {
                // Hold not found or someone else's hold
                throw new NotFoundException($"Hold with id '{holdId}' was not found.");
            }

            if (currentStatus == "CONFIRMED")
            {
                // Own CONFIRMED -> Idempotent 200, counters untouched
                return new ConfirmHoldResponse(
                    HoldId: holdId.ToString(),
                    Status: "CONFIRMED",
                    ClassId: existingClassId!.Value.ToString(),
                    ConfirmedAt: existingConfirmedAt.HasValue
                        ? existingConfirmedAt.Value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
                        : DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                );
            }

            if (isExpired)
            {
                throw new ConflictException("HOLD_EXPIRED", "The hold has expired and cannot be confirmed.");
            }

            if (currentStatus == "CANCELLED")
            {
                throw new ConflictException("HOLD_NOT_ACTIVE", "The hold was cancelled and cannot be confirmed.");
            }

            throw new ConflictException("HOLD_NOT_ACTIVE", "The hold is not active and cannot be confirmed.");
        }
        catch
        {
            try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task CancelHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        try
        {
            // 1. Attempt atomic cancel
            Guid? classId = null;

            await using (var cancelCmd = connection.CreateCommand())
            {
                cancelCmd.Transaction = tx;
                cancelCmd.CommandText = @"
                    UPDATE reservations
                    SET status = 'CANCELLED', cancelled_at = clock_timestamp()
                    WHERE id = @id 
                      AND student_id = @studentId 
                      AND status = 'HELD' 
                      AND expires_at > clock_timestamp()
                    RETURNING class_id;
                ";
                AddParameter(cancelCmd, "@id", holdId);
                AddParameter(cancelCmd, "@studentId", studentId);

                await using var reader = await cancelCmd.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                {
                    classId = reader.GetGuid(0);
                }
            }

            if (classId.HasValue)
            {
                // Decrement held_seats in the same transaction
                await using (var updateSeatCmd = connection.CreateCommand())
                {
                    updateSeatCmd.Transaction = tx;
                    updateSeatCmd.CommandText = @"
                        UPDATE classes
                        SET held_seats = held_seats - 1
                        WHERE id = @classId;
                    ";
                    AddParameter(updateSeatCmd, "@classId", classId.Value);
                    await updateSeatCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                await tx.CommitAsync(cancellationToken);
                return;
            }

            // 2. If no row updated, inspect the reservation state
            string? currentStatus = null;
            bool isExpired = false;

            await using (var inspectCmd = connection.CreateCommand())
            {
                inspectCmd.Transaction = tx;
                inspectCmd.CommandText = @"
                    SELECT status, (expires_at <= clock_timestamp()) AS is_expired
                    FROM reservations
                    WHERE id = @id AND student_id = @studentId;
                ";
                AddParameter(inspectCmd, "@id", holdId);
                AddParameter(inspectCmd, "@studentId", studentId);

                await using var inspectReader = await inspectCmd.ExecuteReaderAsync(cancellationToken);
                if (await inspectReader.ReadAsync(cancellationToken))
                {
                    currentStatus = inspectReader.GetString(0);
                    isExpired = inspectReader.GetBoolean(1);
                }
            }

            await tx.RollbackAsync(cancellationToken);

            if (currentStatus == null)
            {
                // Hold not found or someone else's hold
                throw new NotFoundException($"Hold with id '{holdId}' was not found.");
            }

            if (currentStatus == "CANCELLED")
            {
                // Own CANCELLED again -> Idempotent 204
                return;
            }

            if (currentStatus == "CONFIRMED")
            {
                throw new ConflictException("HOLD_ALREADY_CONFIRMED", "The hold has already been confirmed and cannot be cancelled.");
            }

            if (isExpired)
            {
                throw new ConflictException("HOLD_EXPIRED", "The hold has expired and cannot be cancelled.");
            }

            throw new ConflictException("HOLD_NOT_ACTIVE", "The hold is not active and cannot be cancelled.");
        }
        catch
        {
            try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
            throw;
        }
    }

    public async Task<IReadOnlyList<StudentHoldResponse>> GetHoldsByStudentIdAsync(string studentId, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                r.id AS hold_id,
                r.class_id,
                c.name AS class_name,
                CASE 
                    WHEN r.status = 'HELD' AND r.expires_at <= now() THEN 'EXPIRED'
                    ELSE r.status
                END AS effective_status,
                r.expires_at,
                r.created_at,
                r.confirmed_at,
                now() AS server_time
            FROM reservations r
            JOIN classes c ON r.class_id = c.id
            WHERE r.student_id = @studentId
            ORDER BY r.created_at DESC, r.id DESC;
        ";
        AddParameter(cmd, "@studentId", studentId);

        var list = new List<StudentHoldResponse>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0).ToString();
            var classId = reader.GetGuid(1).ToString();
            var className = reader.GetString(2);
            var status = reader.GetString(3);
            var expiresAt = reader.GetFieldValue<DateTimeOffset>(4).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            var createdAt = reader.GetFieldValue<DateTimeOffset>(5).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            string? confirmedAt = reader.IsDBNull(6)
                ? null
                : reader.GetFieldValue<DateTimeOffset>(6).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");
            var serverTime = reader.GetFieldValue<DateTimeOffset>(7).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ");

            list.Add(new StudentHoldResponse(
                HoldId: id,
                ClassId: classId,
                ClassName: className,
                Status: status,
                ExpiresAt: expiresAt,
                CreatedAt: createdAt,
                ConfirmedAt: confirmedAt,
                ServerTime: serverTime
            ));
        }

        return list;
    }

    private static void AddParameter(DbCommand cmd, string name, object? value)
    {
        var param = cmd.CreateParameter();
        param.ParameterName = name;
        param.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(param);
    }
}
