namespace SchoolAdmission.Api;

/// <summary>
/// Configuration options loaded from environment variables at startup.
/// </summary>
public sealed class AdmissionOptions
{
    /// <summary>
    /// How long (in seconds) a seat hold is reserved before it expires.
    /// Read from env HOLD_DURATION_SECONDS. Must be an integer >= 1.
    /// </summary>
    public int HoldDurationSeconds { get; set; } = 600;
}

