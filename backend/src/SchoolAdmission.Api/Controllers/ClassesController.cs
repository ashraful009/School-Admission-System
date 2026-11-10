using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Api.Controllers;

[ApiController]
[Route("classes")]
public class ClassesController : ControllerBase
{
    private readonly IClassService _classService;
    private readonly IHoldService _holdService;
    private readonly AdmissionOptions _options;

    public ClassesController(
        IClassService classService, 
        IHoldService holdService, 
        IOptions<AdmissionOptions> options)
    {
        _classService = classService;
        _holdService = holdService;
        _options = options.Value;
    }

    [HttpPost]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassRequest request, CancellationToken cancellationToken)
    {
        var created = await _classService.CreateClassAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetClass), new { classId = created.Id }, created);
    }

    [HttpGet]
    public async Task<IActionResult> GetAllClasses(CancellationToken cancellationToken)
    {
        var classes = await _classService.GetAllClassesAsync(_options.HoldDurationSeconds, cancellationToken);
        return Ok(classes);
    }

    [HttpGet("{classId}")]
    public async Task<IActionResult> GetClass(string classId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(classId, out var id))
        {
            throw new NotFoundException($"Class with id '{classId}' was not found.");
        }

        var admissionClass = await _classService.GetClassByIdAsync(id, _options.HoldDurationSeconds, cancellationToken);
        return Ok(admissionClass);
    }

    [HttpPut("{classId}")]
    public async Task<IActionResult> UpdateClass(string classId, [FromBody] UpdateClassRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(classId, out var id))
        {
            throw new NotFoundException($"Class with id '{classId}' was not found.");
        }

        var updated = await _classService.UpdateClassAsync(id, request, _options.HoldDurationSeconds, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("{classId}/holds")]
    public async Task<IActionResult> CreateHold(
        string classId,
        [FromHeader(Name = "X-Student-Id")] string? studentIdHeader,
        CancellationToken cancellationToken)
    {
        var studentId = SchoolAdmission.Application.Common.StudentIdValidator.Validate(studentIdHeader);

        if (!Guid.TryParse(classId, out var id))
        {
            throw new NotFoundException($"Class with id '{classId}' was not found.");
        }

        var hold = await _holdService.CreateHoldAsync(id, studentId, _options.HoldDurationSeconds, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, hold);
    }
}

