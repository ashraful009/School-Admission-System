using Microsoft.AspNetCore.Mvc;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("[controller]")]
public sealed class HealthController : ControllerBase
{
    /// <summary>
    /// Returns 200 { "status": "ok" } — used by Docker healthcheck and smoke tests.
    /// </summary>
    [HttpGet("/health")]
    public IActionResult Get() => Ok(new { status = "ok" });
}

