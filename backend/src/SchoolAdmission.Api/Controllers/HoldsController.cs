using Microsoft.AspNetCore.Mvc;
using SchoolAdmission.Application.Common;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
public class HoldsController : ControllerBase
{
    private readonly IHoldService _holdService;

    public HoldsController(IHoldService holdService)
    {
        _holdService = holdService;
    }

    [HttpGet("holds/{holdId}")]
    public async Task<IActionResult> GetHold(string holdId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(holdId, out var id))
        {
            throw new NotFoundException($"Hold with id '{holdId}' was not found.");
        }

        var hold = await _holdService.GetHoldByIdAsync(id, cancellationToken);
        return Ok(hold);
    }

    [HttpPost("holds/{holdId}/confirm")]
    public async Task<IActionResult> ConfirmHold(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentIdHeader,
        CancellationToken cancellationToken)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);

        if (!Guid.TryParse(holdId, out var id))
        {
            throw new NotFoundException($"Hold with id '{holdId}' was not found.");
        }

        var confirmed = await _holdService.ConfirmHoldAsync(id, studentId, cancellationToken);
        return Ok(confirmed);
    }

    [HttpDelete("holds/{holdId}")]
    public async Task<IActionResult> CancelHold(
        string holdId,
        [FromHeader(Name = "X-Student-Id")] string? studentIdHeader,
        CancellationToken cancellationToken)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);

        if (!Guid.TryParse(holdId, out var id))
        {
            throw new NotFoundException($"Hold with id '{holdId}' was not found.");
        }

        await _holdService.CancelHoldAsync(id, studentId, cancellationToken);
        return NoContent();
    }

    [HttpGet("me/holds")]
    public async Task<IActionResult> GetMyHolds(
        [FromHeader(Name = "X-Student-Id")] string? studentIdHeader,
        CancellationToken cancellationToken)
    {
        var studentId = StudentIdValidator.Validate(studentIdHeader);

        var holds = await _holdService.GetHoldsByStudentIdAsync(studentId, cancellationToken);
        return Ok(holds);
    }
}

