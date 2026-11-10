using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SchoolAdmission.Api;

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
    builder.Logging.AddConsole();  // ensure console logger ready early
    // Logged after app build so ILogger is available; flag here.
}

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

// ── MVC / controllers ─────────────────────────────────────────────────────────
builder.Services.AddControllers();

var app = builder.Build();

// ── Log connection string presence ───────────────────────────────────────────
var startupLogger = app.Services.GetRequiredService<ILogger<Program>>();
if (!string.IsNullOrWhiteSpace(connStr))
    startupLogger.LogInformation("Database connection string is configured.");
else
    startupLogger.LogWarning("ConnectionStrings:Default is not set. The application will start but database access will fail.");

startupLogger.LogInformation("CORS allowed origins: {Origins}", string.Join(", ", corsOrigins));
startupLogger.LogInformation("Hold duration: {Seconds}s", holdDurationSeconds);

// ── Middleware ────────────────────────────────────────────────────────────────
app.UseCors();
app.MapControllers();

app.Run();
return 0;

// Required by WebApplicationFactory<Program> in tests
public partial class Program { }

