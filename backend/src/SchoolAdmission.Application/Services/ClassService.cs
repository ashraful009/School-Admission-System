using System.Text.Json;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Application.Services;

public class ClassService : IClassService
{
    private readonly IClassStore _classStore;

    public ClassService(IClassStore classStore)
    {
        _classStore = classStore;
    }

    public async Task<ClassCreatedResponse> CreateClassAsync(CreateClassRequest request, CancellationToken cancellationToken = default)
    {
        var (name, totalSeats) = ValidateClassInput(request.Name, request.TotalSeats);
        return await _classStore.CreateClassAsync(name, totalSeats, cancellationToken);
    }

    public async Task<IReadOnlyList<ClassResponse>> GetAllClassesAsync(int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        return await _classStore.GetAllClassesAsync(holdDurationSeconds, cancellationToken);
    }

    public async Task<ClassResponse> GetClassByIdAsync(Guid id, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var admissionClass = await _classStore.GetClassByIdAsync(id, holdDurationSeconds, cancellationToken);
        if (admissionClass == null)
        {
            throw new NotFoundException($"Class with id '{id}' was not found.");
        }

        return admissionClass;
    }

    public async Task<ClassResponse> UpdateClassAsync(Guid id, UpdateClassRequest request, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        var (name, totalSeats) = ValidateClassInput(request.Name, request.TotalSeats);
        return await _classStore.UpdateClassAsync(id, name, totalSeats, holdDurationSeconds, cancellationToken);
    }

    private static (string Name, int TotalSeats) ValidateClassInput(string? rawName, JsonElement? rawTotalSeats)
    {
        if (string.IsNullOrWhiteSpace(rawName))
        {
            throw new ValidationException("name is required and cannot be empty or whitespace.");
        }

        var trimmedName = rawName.Trim();
        if (trimmedName.Length < 1 || trimmedName.Length > 100)
        {
            throw new ValidationException("name must be between 1 and 100 characters.");
        }

        if (rawTotalSeats == null ||
            rawTotalSeats.Value.ValueKind == JsonValueKind.Null ||
            rawTotalSeats.Value.ValueKind == JsonValueKind.Undefined)
        {
            throw new ValidationException("totalSeats is required and must be an integer.");
        }

        if (rawTotalSeats.Value.ValueKind != JsonValueKind.Number)
        {
            throw new ValidationException("totalSeats must be an integer between 1 and 10000.");
        }

        if (!rawTotalSeats.Value.TryGetInt32(out var totalSeats))
        {
            throw new ValidationException("totalSeats must be an integer between 1 and 10000.");
        }

        if (totalSeats < 1 || totalSeats > 10000)
        {
            throw new ValidationException("totalSeats must be an integer between 1 and 10000.");
        }

        return (trimmedName, totalSeats);
    }
}

