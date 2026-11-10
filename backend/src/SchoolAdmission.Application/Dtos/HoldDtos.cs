using System.Text.Json.Serialization;

namespace SchoolAdmission.Application.Dtos;

public record HoldResponse(
    [property: JsonPropertyName("holdId")] string HoldId,
    [property: JsonPropertyName("classId")] string ClassId,
    [property: JsonPropertyName("studentId")] string StudentId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("className")] string ClassName,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("serverTime")] string ServerTime
);

public record HoldDetailsResponse(
    [property: JsonPropertyName("holdId")] string HoldId,
    [property: JsonPropertyName("classId")] string ClassId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("className")] string ClassName,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("confirmedAt")] string? ConfirmedAt,
    [property: JsonPropertyName("serverTime")] string ServerTime
);

public record ConfirmHoldResponse(
    [property: JsonPropertyName("holdId")] string HoldId,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("classId")] string ClassId,
    [property: JsonPropertyName("confirmedAt")] string ConfirmedAt
);

public record StudentHoldResponse(
    [property: JsonPropertyName("holdId")] string HoldId,
    [property: JsonPropertyName("classId")] string ClassId,
    [property: JsonPropertyName("className")] string ClassName,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("expiresAt")] string ExpiresAt,
    [property: JsonPropertyName("createdAt")] string CreatedAt,
    [property: JsonPropertyName("confirmedAt")] string? ConfirmedAt,
    [property: JsonPropertyName("serverTime")] string ServerTime
);
