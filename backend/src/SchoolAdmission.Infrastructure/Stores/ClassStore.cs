using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Infrastructure.Stores;

public class ClassStore : IClassStore
{
    private readonly AppDbContext _dbContext;

    public ClassStore(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<ClassCreatedResponse> CreateClassAsync(string name, int totalSeats, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO classes (name, total_seats, held_seats, confirmed_seats, created_at)
            VALUES (@name, @total_seats, 0, 0, now())
            RETURNING id, name, total_seats;
        ";

        AddParameter(cmd, "@name", name);
        AddParameter(cmd, "@total_seats", totalSeats);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0);
            var returnedName = reader.GetString(1);
            var returnedTotal = reader.GetInt32(2);

            return new ClassCreatedResponse(id.ToString(), returnedName, returnedTotal);
        }

        throw new InvalidOperationException("Failed to insert class.");
    }

    public async Task<IReadOnlyList<ClassResponse>> GetAllClassesAsync(int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                c.id,
                c.name,
                c.total_seats,
                GREATEST(0, c.held_seats - COALESCE(e.expired_held_count, 0)) AS effective_held_seats,
                c.confirmed_seats,
                (c.total_seats - GREATEST(0, c.held_seats - COALESCE(e.expired_held_count, 0)) - c.confirmed_seats) AS available_seats
            FROM classes c
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS expired_held_count
                FROM reservations
                WHERE status = 'HELD' AND expires_at <= now()
                GROUP BY class_id
            ) e ON c.id = e.class_id
            ORDER BY c.created_at ASC, c.id ASC;
        ";

        var list = new List<ClassResponse>();
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetGuid(0).ToString();
            var name = reader.GetString(1);
            var totalSeats = reader.GetInt32(2);
            var heldSeats = Convert.ToInt32(reader.GetValue(3));
            var confirmedSeats = reader.GetInt32(4);
            var availableSeats = Convert.ToInt32(reader.GetValue(5));

            list.Add(new ClassResponse(
                id,
                name,
                totalSeats,
                heldSeats,
                confirmedSeats,
                availableSeats,
                holdDurationSeconds
            ));
        }

        return list;
    }

    public async Task<ClassResponse?> GetClassByIdAsync(Guid id, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                c.id,
                c.name,
                c.total_seats,
                GREATEST(0, c.held_seats - COALESCE(e.expired_held_count, 0)) AS effective_held_seats,
                c.confirmed_seats,
                (c.total_seats - GREATEST(0, c.held_seats - COALESCE(e.expired_held_count, 0)) - c.confirmed_seats) AS available_seats
            FROM classes c
            LEFT JOIN (
                SELECT class_id, COUNT(*) AS expired_held_count
                FROM reservations
                WHERE status = 'HELD' AND expires_at <= now()
                GROUP BY class_id
            ) e ON c.id = e.class_id
            WHERE c.id = @id;
        ";

        AddParameter(cmd, "@id", id);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var classId = reader.GetGuid(0).ToString();
            var name = reader.GetString(1);
            var totalSeats = reader.GetInt32(2);
            var heldSeats = Convert.ToInt32(reader.GetValue(3));
            var confirmedSeats = reader.GetInt32(4);
            var availableSeats = Convert.ToInt32(reader.GetValue(5));

            return new ClassResponse(
                classId,
                name,
                totalSeats,
                heldSeats,
                confirmedSeats,
                availableSeats,
                holdDurationSeconds
            );
        }

        return null;
    }

    public async Task<ClassResponse> UpdateClassAsync(Guid id, string name, int newTotalSeats, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var connection = _dbContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        try
        {
            // Step 1: Reclaim expired HELD rows of this class
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
                    WHERE id = @id;
                ";
                AddParameter(reclaimCmd, "@id", id);
                await reclaimCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            // Step 2: Attempt conditional update
            Guid returnedId = Guid.Empty;
            string returnedName = string.Empty;
            int returnedTotal = 0;
            int returnedHeld = 0;
            int returnedConfirmed = 0;
            bool updated = false;

            await using (var updateCmd = connection.CreateCommand())
            {
                updateCmd.Transaction = tx;
                updateCmd.CommandText = @"
                    UPDATE classes
                    SET name = @name, total_seats = @newTotal
                    WHERE id = @id AND (held_seats + confirmed_seats) <= @newTotal
                    RETURNING id, name, total_seats, held_seats, confirmed_seats;
                ";
                AddParameter(updateCmd, "@id", id);
                AddParameter(updateCmd, "@name", name);
                AddParameter(updateCmd, "@newTotal", newTotalSeats);

                await using (var reader = await updateCmd.ExecuteReaderAsync(cancellationToken))
                {
                    if (await reader.ReadAsync(cancellationToken))
                    {
                        returnedId = reader.GetGuid(0);
                        returnedName = reader.GetString(1);
                        returnedTotal = reader.GetInt32(2);
                        returnedHeld = reader.GetInt32(3);
                        returnedConfirmed = reader.GetInt32(4);
                        updated = true;
                    }
                }
            }

            if (!updated)
            {
                int currentHeld = 0;
                int currentConfirmed = 0;
                bool found = false;

                await using (var checkCmd = connection.CreateCommand())
                {
                    checkCmd.Transaction = tx;
                    checkCmd.CommandText = "SELECT held_seats, confirmed_seats FROM classes WHERE id = @id;";
                    AddParameter(checkCmd, "@id", id);

                    await using (var checkReader = await checkCmd.ExecuteReaderAsync(cancellationToken))
                    {
                        if (await checkReader.ReadAsync(cancellationToken))
                        {
                            currentHeld = checkReader.GetInt32(0);
                            currentConfirmed = checkReader.GetInt32(1);
                            found = true;
                        }
                    }
                }

                await tx.RollbackAsync(cancellationToken);

                if (!found)
                {
                    throw new NotFoundException($"Class with id '{id}' was not found.");
                }

                var occupied = currentHeld + currentConfirmed;
                throw new ConflictException(
                    "TOTAL_SEATS_BELOW_OCCUPIED",
                    $"Cannot reduce total seats to {newTotalSeats} because {occupied} seats are currently occupied ({currentHeld} held, {currentConfirmed} confirmed)."
                );
            }

            await tx.CommitAsync(cancellationToken);

            var availableSeats = returnedTotal - returnedHeld - returnedConfirmed;
            return new ClassResponse(
                returnedId.ToString(),
                returnedName,
                returnedTotal,
                returnedHeld,
                returnedConfirmed,
                availableSeats,
                holdDurationSeconds
            );
        }
        catch
        {
            try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
            throw;
        }
    }

    private static void AddParameter(DbCommand cmd, string name, object? value)
    {
        var param = cmd.CreateParameter();
        param.ParameterName = name;
        param.Value = value ?? DBNull.Value;
        cmd.Parameters.Add(param);
    }
}
