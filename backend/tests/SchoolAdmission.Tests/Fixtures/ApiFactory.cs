using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using SchoolAdmission.Api;
using SchoolAdmission.Infrastructure;
using SchoolAdmission.Infrastructure.Workers;

namespace SchoolAdmission.Tests.Fixtures;

public class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;
    private readonly int _holdDurationSeconds;
    private readonly bool _expiryWorkerEnabled;
    private readonly int _expiryIntervalMs;

    public ApiFactory(
        string connectionString, 
        int holdDurationSeconds = 600, 
        bool expiryWorkerEnabled = false,
        int expiryIntervalMs = 500)
    {
        _connectionString = connectionString;
        _holdDurationSeconds = holdDurationSeconds;
        _expiryWorkerEnabled = expiryWorkerEnabled;
        _expiryIntervalMs = expiryIntervalMs;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = _connectionString,
                ["HOLD_DURATION_SECONDS"] = _holdDurationSeconds.ToString(),
                ["EXPIRY_WORKER_ENABLED"] = _expiryWorkerEnabled.ToString().ToLowerInvariant(),
                ["EXPIRY_INTERVAL_MILLISECONDS"] = _expiryIntervalMs.ToString()
            });
        });

        builder.ConfigureTestServices(services =>
        {
            // Configure AdmissionOptions for this test factory
            services.Configure<AdmissionOptions>(options =>
            {
                options.HoldDurationSeconds = _holdDurationSeconds;
            });

            // If expiry worker is disabled for this test, remove the hosted service
            if (!_expiryWorkerEnabled)
            {
                var workerDescriptors = services.Where(d => 
                    d.ServiceType == typeof(IHostedService) && 
                    d.ImplementationType == typeof(ExpiryWorker)).ToList();

                foreach (var descriptor in workerDescriptors)
                {
                    services.Remove(descriptor);
                }
            }

            // Replace DbContext to ensure it connects to the target test database
            var descriptors = services.Where(d => 
                d.ServiceType == typeof(DbContextOptions<AppDbContext>) || 
                d.ServiceType == typeof(AppDbContext)).ToList();

            foreach (var descriptor in descriptors)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AppDbContext>(options =>
            {
                options.UseNpgsql(_connectionString, npgsqlOptions =>
                {
                    npgsqlOptions.CommandTimeout(30);
                });
            });
        });
    }
}
