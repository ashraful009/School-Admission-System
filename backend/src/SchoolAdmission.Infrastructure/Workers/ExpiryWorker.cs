using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace SchoolAdmission.Infrastructure.Workers;

public class ExpiryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ExpiryWorker> _logger;
    private readonly int _intervalMs;
    private readonly bool _enabled;
    private readonly bool _hasConnectionString;

    public ExpiryWorker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<ExpiryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        var connStr = configuration.GetConnectionString("Default");
        _hasConnectionString = !string.IsNullOrWhiteSpace(connStr);

        var enabledRaw = configuration["EXPIRY_WORKER_ENABLED"] ?? "true";
        _enabled = !string.Equals(enabledRaw, "false", StringComparison.OrdinalIgnoreCase);

        var intervalRaw = configuration["EXPIRY_INTERVAL_MILLISECONDS"] ?? "1000";
        if (!int.TryParse(intervalRaw, out _intervalMs) || _intervalMs < 50)
        {
            _intervalMs = 1000;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_hasConnectionString)
        {
            _logger.LogInformation("ExpiryWorker will not run because ConnectionStrings:Default is not configured.");
            return;
        }

        if (!_enabled)
        {
            _logger.LogInformation("ExpiryWorker is disabled via configuration (EXPIRY_WORKER_ENABLED=false).");
            return;
        }

        _logger.LogInformation("ExpiryWorker started. Running every {IntervalMs}ms with batch size 500.", _intervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(_intervalMs, stoppingToken);
                await ProcessExpiredHoldsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in ExpiryWorker execution cycle. Resuming next cycle.");
            }
        }

        _logger.LogInformation("ExpiryWorker stopped.");
    }

    private async Task ProcessExpiredHoldsAsync(CancellationToken cancellationToken)
    {
        // Loop in batches of 500 until all expired holds are processed
        while (!cancellationToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var connection = dbContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var tx = await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
            try
            {
                await using var cmd = connection.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
                    WITH expired_batch AS (
                        SELECT id, class_id
                        FROM reservations
                        WHERE status = 'HELD' 
                          AND expires_at <= clock_timestamp()
                        ORDER BY id
                        LIMIT 500
                        FOR UPDATE SKIP LOCKED
                    ),
                    updated_reservations AS (
                        UPDATE reservations r
                        SET status = 'EXPIRED', expired_at = clock_timestamp()
                        FROM expired_batch eb
                        WHERE r.id = eb.id
                        RETURNING r.class_id
                    ),
                    class_counts AS (
                        SELECT class_id, COUNT(*) AS cnt
                        FROM updated_reservations
                        GROUP BY class_id
                    ),
                    updated_classes AS (
                        UPDATE classes c
                        SET held_seats = held_seats - cc.cnt
                        FROM class_counts cc
                        WHERE c.id = cc.class_id
                        RETURNING c.id
                    )
                    SELECT COALESCE(SUM(cnt), 0) FROM class_counts;
                ";

                var result = await cmd.ExecuteScalarAsync(cancellationToken);
                var expiredCount = Convert.ToInt64(result);

                await tx.CommitAsync(cancellationToken);

                if (expiredCount > 0)
                {
                    _logger.LogInformation("ExpiryWorker reclaimed {Count} expired reservation(s).", expiredCount);
                }

                // If less than 500 were expired, we have cleared the current backlog
                if (expiredCount < 500)
                {
                    break;
                }
            }
            catch
            {
                try { await tx.RollbackAsync(cancellationToken); } catch { /* ignore */ }
                throw;
            }
        }
    }
}
