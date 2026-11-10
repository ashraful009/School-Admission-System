using SchoolAdmission.Application.Dtos;

namespace SchoolAdmission.Application.Interfaces;

public interface IClassStore
{
    Task<ClassCreatedResponse> CreateClassAsync(string name, int totalSeats, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ClassResponse>> GetAllClassesAsync(int holdDurationSeconds, CancellationToken cancellationToken = default);
    Task<ClassResponse?> GetClassByIdAsync(Guid id, int holdDurationSeconds, CancellationToken cancellationToken = default);
    Task<ClassResponse> UpdateClassAsync(Guid id, string name, int newTotalSeats, int holdDurationSeconds, CancellationToken cancellationToken = default);
}

