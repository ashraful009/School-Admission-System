using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Infrastructure.Stores;

public class HoldStore : IHoldStore
{
    private readonly AppDbContext _dbContext;

    public HoldStore(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<HoldResponse> CreateHoldAsync(Guid classId, string studentId, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        try
        {
            // Step 1: Validate class existence (and fetch class name for response)
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

            // Step 2: Reclaim expired HELD rows of this class in one statement using clock_timestamp() (D11)
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
                    UPDATE classes
                    SET held_seats = held_seats - (SELECT COUNT(*) FROM expired)
                    WHERE id = @id AND (SELECT COUNT(*) FROM expired) > 0;
                ";
                AddParameter(reclaimCmd, "@id", classId);
                await reclaimCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            // Step 3: Pre-check (D13) - verify if the student already has an active HELD or CONFIRMED hold in this class.
            // Checking before grabbing a seat ensures that a student who already applied receives 409 ALREADY_APPLIED_IN_CLASS
            // even if the class is completely full.
            await using (var preCheckCmd = connection.CreateCommand())
            {
                preCheckCmd.Transaction = tx;
                preCheckCmd.CommandText = @"
                    SELECT 1 FROM reservations 
                    WHERE class_id = @id 
                      AND student_id = @studentId 
                      AND status IN ('HELD', 'CONFIRMED')
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
            //
            // Why conditional UPDATE instead of SELECT ... FOR UPDATE:
            // SELECT ... FOR UPDATE acquires an explicit row lock, forces all competing transactions
            // to wait, reads the current count into application memory, and then requires a second UPDATE statement.
            // Under high concurrency, this causes severe lock contention, increases transaction latency, and risks
            // retry storms and deadlocks.
            // In contrast, an atomic conditional UPDATE (`WHERE id = @id AND (held_seats + confirmed_seats) < total_seats`)
            // delegates capacity evaluation directly to PostgreSQL's row-level lock. Under READ COMMITTED isolation,
            // competing transactions wait for the locked row, and upon waking, PostgreSQL automatically re-evaluates
            // the WHERE clause against the newly committed row state. If total capacity is reached, 0 rows are affected
            // immediately with zero application-level locking overhead, guaranteeing no overselling and maximum throughput.
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
            // Expiry is calculated using clock_timestamp() truncated to second precision (D11).
            // A race condition where two simultaneous requests for the same student pass Step 3 is caught here
            // by the partial unique index `ux_reservations_active_per_class`, which raises SQLSTATE 23505.
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
        catch
        {
            try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
            throw;
        }
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
