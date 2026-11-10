using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Application.Errors;
using SchoolAdmission.Application.Interfaces;

namespace SchoolAdmission.Application.Services;

public class HoldService : IHoldService
{
    private readonly IHoldStore _holdStore;

    public HoldService(IHoldStore holdStore)
    {
        _holdStore = holdStore;
    }

    public Task<HoldResponse> CreateHoldAsync(Guid classId, string studentId, int holdDurationSeconds, CancellationToken cancellationToken = default)
    {
        return _holdStore.CreateHoldAsync(classId, studentId, holdDurationSeconds, cancellationToken);
    }

    public async Task<HoldDetailsResponse> GetHoldByIdAsync(Guid holdId, CancellationToken cancellationToken = default)
    {
        var hold = await _holdStore.GetHoldByIdAsync(holdId, cancellationToken);
        if (hold == null)
        {
            throw new NotFoundException($"Hold with id '{holdId}' was not found.");
        }

        return hold;
    }

    public Task<ConfirmHoldResponse> ConfirmHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default)
    {
        return _holdStore.ConfirmHoldAsync(holdId, studentId, cancellationToken);
    }

    public Task CancelHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default)
    {
        return _holdStore.CancelHoldAsync(holdId, studentId, cancellationToken);
    }

    public Task<IReadOnlyList<StudentHoldResponse>> GetHoldsByStudentIdAsync(string studentId, CancellationToken cancellationToken = default)
    {
        return _holdStore.GetHoldsByStudentIdAsync(studentId, cancellationToken);
    }
}
