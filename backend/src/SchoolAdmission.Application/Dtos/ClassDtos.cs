using System.Text.Json;
using System.Text.Json.Serialization;

namespace SchoolAdmission.Application.Dtos;

public class CreateClassRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("totalSeats")]
    public JsonElement? TotalSeats { get; set; }
}

public class UpdateClassRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("totalSeats")]
    public JsonElement? TotalSeats { get; set; }
}

public record ClassCreatedResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("totalSeats")] int TotalSeats
);

public record ClassResponse(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("totalSeats")] int TotalSeats,
    [property: JsonPropertyName("heldSeats")] int HeldSeats,
    [property: JsonPropertyName("confirmedSeats")] int ConfirmedSeats,
    [property: JsonPropertyName("availableSeats")] int AvailableSeats,
    [property: JsonPropertyName("holdDurationSeconds")] int HoldDurationSeconds
);

public record ErrorResponse(
    [property: JsonPropertyName("error")] ErrorDetail Error
);

public record ErrorDetail(
    [property: JsonPropertyName("code")] string Code,
    [property: JsonPropertyName("message")] string Message
);

