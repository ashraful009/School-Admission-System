using SchoolAdmission.Application.Dtos;

namespace SchoolAdmission.Application.Interfaces;

public interface IClassService
{
    Task<ClassCreatedResponse> CreateClassAsync(CreateClassRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClassResponse>> GetAllClassesAsync(int holdDurationSeconds, CancellationToken cancellationToken = default);
    Task<ClassResponse> GetClassByIdAsync(Guid id, int holdDurationSeconds, CancellationToken cancellationToken = default);
    Task<ClassResponse> UpdateClassAsync(Guid id, UpdateClassRequest request, int holdDurationSeconds, CancellationToken cancellationToken = default);
}

