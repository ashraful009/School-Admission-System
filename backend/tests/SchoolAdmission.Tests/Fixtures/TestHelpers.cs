using System.Net.Http.Json;
using Npgsql;
using SchoolAdmission.Application.Dtos;
using Xunit;

namespace SchoolAdmission.Tests.Fixtures;

public static class TestHelpers
{
    public static async Task<ClassCreatedResponse> CreateClassAsync(HttpClient client, string name, int totalSeats)
    {
        var response = await client.PostAsJsonAsync("/classes", new { name, totalSeats });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<ClassCreatedResponse>();
        Assert.NotNull(created);
        return created!;
    }

    public static async Task AssertDatabaseCountersMatchAsync(string connectionString, Guid classId)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            SELECT 
                c.held_seats,
                COUNT(*) FILTER (WHERE r.status = 'HELD') AS actual_held,
                c.confirmed_seats,
                COUNT(*) FILTER (WHERE r.status = 'CONFIRMED') AS actual_confirmed
            FROM classes c
            LEFT JOIN reservations r ON c.id = r.class_id
            WHERE c.id = @classId
            GROUP BY c.id, c.held_seats, c.confirmed_seats;
        ";
        cmd.Parameters.AddWithValue("@classId", classId);

        await using var reader = await cmd.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync(), "Class row not found during database counter verification.");
        var held = reader.GetInt32(0);
        var actualHeld = reader.GetInt64(1);
        var confirmed = reader.GetInt32(2);
        var actualConfirmed = reader.GetInt64(3);

        Assert.Equal(held, actualHeld);
        Assert.Equal(confirmed, actualConfirmed);
    }
}

