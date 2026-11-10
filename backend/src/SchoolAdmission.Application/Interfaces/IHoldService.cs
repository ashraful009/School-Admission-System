using SchoolAdmission.Application.Dtos;

namespace SchoolAdmission.Application.Interfaces;

public interface IHoldService
{
    Task<HoldResponse> CreateHoldAsync(Guid classId, string studentId, int holdDurationSeconds, CancellationToken cancellationToken = default);
    Task<HoldDetailsResponse> GetHoldByIdAsync(Guid holdId, CancellationToken cancellationToken = default);
    Task<ConfirmHoldResponse> ConfirmHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default);
    Task CancelHoldAsync(Guid holdId, string studentId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StudentHoldResponse>> GetHoldsByStudentIdAsync(string studentId, CancellationToken cancellationToken = default);
}
