using System.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SchoolAdmission.Infrastructure;
using Testcontainers.PostgreSql;

namespace SchoolAdmission.Tests.Fixtures;

public class TestDatabase : IAsyncDisposable
{
    private readonly PostgreSqlContainer? _container;
    private readonly string? _tempDbName;
    private readonly string? _adminConnString;

    public string ConnectionString { get; private set; } = string.Empty;

    public TestDatabase(PostgreSqlContainer? container, string connectionString, string? tempDbName = null, string? adminConnString = null)
    {
        _container = container;
        ConnectionString = connectionString;
        _tempDbName = tempDbName;
        _adminConnString = adminConnString;
    }

    public static async Task<TestDatabase> CreateAsync()
    {
        var envConn = Environment.GetEnvironmentVariable("TEST_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(envConn))
        {
            // Connect to configured PostgreSQL server, create isolated temporary database (D12)
            var builder = new NpgsqlConnectionStringBuilder(envConn);
            var adminDb = string.IsNullOrWhiteSpace(builder.Database) ? "postgres" : builder.Database;
            var adminConnStr = builder.ConnectionString;

            var tempDb = $"test_{Guid.NewGuid():N}";
            await using (var conn = new NpgsqlConnection(adminConnStr))
            {
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = $"CREATE DATABASE \"{tempDb}\";";
                await cmd.ExecuteNonQueryAsync();
            }

            builder.Database = tempDb;
            builder.MaxPoolSize = 50;
            builder.Timeout = 30;
            builder.CommandTimeout = 30;
            var targetConnStr = builder.ConnectionString;

            // Apply EF Core migrations
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(targetConnStr)
                .Options;
            await using (var db = new AppDbContext(options))
            {
                await db.Database.MigrateAsync();
            }

            return new TestDatabase(null, targetConnStr, tempDb, adminConnStr);
        }
        else
        {
            // Start real PostgreSQL via Testcontainers
            var container = new PostgreSqlBuilder()
                .WithImage("postgres:16")
                .WithDatabase("test_db")
                .WithUsername("test_user")
                .WithPassword("test_pass")
                .Build();

            await container.StartAsync();

            var connStrBuilder = new NpgsqlConnectionStringBuilder(container.GetConnectionString())
            {
                MaxPoolSize = 50,
                Timeout = 30,
                CommandTimeout = 30
            };
            var connStr = connStrBuilder.ConnectionString;

            // Apply EF Core migrations
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseNpgsql(connStr)
                .Options;
            await using (var db = new AppDbContext(options))
            {
                await db.Database.MigrateAsync();
            }

            return new TestDatabase(container, connStr);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_container != null)
        {
            await _container.DisposeAsync();
        }
        else if (!string.IsNullOrWhiteSpace(_tempDbName) && !string.IsNullOrWhiteSpace(_adminConnString))
        {
            try
            {
                await using var conn = new NpgsqlConnection(_adminConnString);
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = $@"
                    REVOKE CONNECT ON DATABASE ""{_tempDbName}"" FROM public;
                    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{_tempDbName}' AND pid <> pg_backend_pid();
                    DROP DATABASE IF EXISTS ""{_tempDbName}"";
                ";
                await cmd.ExecuteNonQueryAsync();
            }
            catch
            {
                // Ignore cleanup error on drop
            }
        }
    }
}

