using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SchoolAdmission.Api;
using SchoolAdmission.Api.Middleware;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Interfaces;
using SchoolAdmission.Application.Services;
using SchoolAdmission.Infrastructure;
using SchoolAdmission.Infrastructure.Stores;

var builder = WebApplication.CreateBuilder(args);

// ── Options: AdmissionOptions ─────────────────────────────────────────────────
var holdDurationRaw = builder.Configuration["HOLD_DURATION_SECONDS"] ?? "600";
if (!int.TryParse(holdDurationRaw, out var holdDurationSeconds) || holdDurationSeconds < 1)
{
    Console.Error.WriteLine(
        $"[FATAL] Environment variable HOLD_DURATION_SECONDS must be an integer >= 1. " +
        $"Got: \"{holdDurationRaw}\". Fix the value and restart.");
    return 1;
}
builder.Services.Configure<AdmissionOptions>(o =>
{
    o.HoldDurationSeconds = holdDurationSeconds;
});

// ── Connection string: log presence only, never the value ────────────────────
var connStr = builder.Configuration.GetConnectionString("Default");
if (!string.IsNullOrWhiteSpace(connStr))
{
    builder.Logging.AddConsole();
}

// ── Database Context & Stores ─────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (!string.IsNullOrWhiteSpace(connStr))
    {
        options.UseNpgsql(connStr, npgsqlOptions =>
        {
            npgsqlOptions.CommandTimeout(30);
        });
    }
});

builder.Services.AddScoped<IClassStore, ClassStore>();
builder.Services.AddScoped<IClassService, ClassService>();
builder.Services.AddScoped<IHoldStore, HoldStore>();
builder.Services.AddScoped<IHoldService, HoldService>();

// ── Background Services ───────────────────────────────────────────────────────
builder.Services.AddHostedService<SchoolAdmission.Infrastructure.Workers.ExpiryWorker>();

// ── CORS ──────────────────────────────────────────────────────────────────────
var corsOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// ── MVC / Controllers & Model Validation ──────────────────────────────────────
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var errors = context.ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .Where(m => !string.IsNullOrWhiteSpace(m))
                .ToList();

            var message = errors.Count > 0
                ? string.Join(" ", errors)
                : "The request body is invalid or malformed.";

            var body = new ErrorResponse(new ErrorDetail("VALIDATION_ERROR", message));
            return new BadRequestObjectResult(body);
        };
    });

var app = builder.Build();

// ── Global Error Handling Middleware (must be first) ─────────────────────────
app.UseMiddleware<ErrorHandlingMiddleware>();

// ── Log startup configuration ─────────────────────────────────────────────────
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
if (!string.IsNullOrWhiteSpace(connStr))
    startupLogger.LogInformation("Database connection string is configured.");
else
    startupLogger.LogWarning("ConnectionStrings:Default is not set. The application will start but database access will fail.");

startupLogger.LogInformation("CORS allowed origins: {Origins}", string.Join(", ", corsOrigins));
startupLogger.LogInformation("Hold duration: {Seconds}s", holdDurationSeconds);

// ── Apply database migrations with retry loop ────────────────────────────────
if (!string.IsNullOrWhiteSpace(connStr))
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    const int maxRetries = 10;
    var retryDelay = TimeSpan.FromSeconds(2);

    for (var attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            startupLogger.LogInformation("Applying database migrations (attempt {Attempt}/{MaxRetries})...", attempt, maxRetries);
            dbContext.Database.Migrate();
            startupLogger.LogInformation("Database migrations applied successfully.");
            break;
        }
        catch (Exception ex)
        {
            startupLogger.LogWarning(ex, "Database migration attempt {Attempt}/{MaxRetries} failed: {Message}", attempt, maxRetries, ex.Message);
            if (attempt == maxRetries)
            {
                startupLogger.LogCritical("Could not apply database migrations after {MaxRetries} attempts. Application will terminate.", maxRetries);
                throw;
            }
            Thread.Sleep(retryDelay);
        }
    }
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseCors();
app.MapControllers();

app.Run();
return 0;

// Required by WebApplicationFactory<Program> in tests
public partial class Program { }
