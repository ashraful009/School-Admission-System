using System.Net;
using System.Text;
using System.Text.Json;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Tests.Fixtures;
using Xunit;

namespace SchoolAdmission.Tests;

public class ValidationTests : IAsyncLifetime
{
    private TestDatabase _db = null!;
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        _db = await TestDatabase.CreateAsync();
        _factory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: false);
        _client = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    [Theory]
    [InlineData("POST", "/classes", "{}", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes", "{\"name\":\"\",\"totalSeats\":10}", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes", "{\"name\":\"Valid\",\"totalSeats\":0}", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes", "{\"name\":\"Valid\",\"totalSeats\":-5}", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes", "{\"name\":\"Valid\",\"totalSeats\":10001}", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes/not-a-valid-uuid/holds", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("POST", "/classes/00000000-0000-0000-0000-000000000000/holds", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("POST", "/classes/00000000-0000-0000-0000-000000000000/holds", "", "", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes/00000000-0000-0000-0000-000000000000/holds", "", "12345", HttpStatusCode.BadRequest)]
    [InlineData("POST", "/classes/00000000-0000-0000-0000-000000000000/holds", "", "2008123456789012a", HttpStatusCode.BadRequest)]
    [InlineData("GET", "/holds/not-a-valid-uuid", "", "", HttpStatusCode.NotFound)]
    [InlineData("GET", "/holds/00000000-0000-0000-0000-000000000000", "", "", HttpStatusCode.NotFound)]
    [InlineData("POST", "/holds/not-a-valid-uuid/confirm", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("POST", "/holds/00000000-0000-0000-0000-000000000000/confirm", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("POST", "/holds/00000000-0000-0000-0000-000000000000/confirm", "", "", HttpStatusCode.BadRequest)]
    [InlineData("DELETE", "/holds/not-a-valid-uuid", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("DELETE", "/holds/00000000-0000-0000-0000-000000000000", "", "20081234567890123", HttpStatusCode.NotFound)]
    [InlineData("DELETE", "/holds/00000000-0000-0000-0000-000000000000", "", "", HttpStatusCode.BadRequest)]
    [InlineData("GET", "/me/holds", "", "", HttpStatusCode.BadRequest)]
    [InlineData("GET", "/me/holds", "", "12345", HttpStatusCode.BadRequest)]
    public async Task Invalid_inputs_never_return_500(
        string method, 
        string path, 
        string body, 
        string studentId, 
        HttpStatusCode expectedStatus)
    {
        // R7: Invalid input returns 4xx, never 500
        var req = new HttpRequestMessage(new HttpMethod(method), path);
        if (!string.IsNullOrWhiteSpace(studentId))
        {
            req.Headers.Add("X-Student-Id", studentId);
        }

        if (!string.IsNullOrWhiteSpace(body))
        {
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        }

        var resp = await _client.SendAsync(req);

        Assert.NotEqual(HttpStatusCode.InternalServerError, resp.StatusCode);
        Assert.Equal(expectedStatus, resp.StatusCode);
    }

    // ── Priority 2: Missing Validation Coverage Integration Tests ────────────────

    public static IEnumerable<object[]> GetNamesExceeding100Characters()
    {
        yield return new object[] { new string('A', 101) };
        yield return new object[] { new string('B', 200) };
    }

    [Fact]
    public async Task CreateClass_WhitespaceOnlyName_Returns400WithValidationErrorEnvelope()
    {
        var content = new StringContent("{\"name\":\"   \",\"totalSeats\":10}", Encoding.UTF8, "application/json");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "name is required and cannot be empty or whitespace.");
    }

    [Theory]
    [MemberData(nameof(GetNamesExceeding100Characters))]
    public async Task CreateClass_NameExceeding100Characters_Returns400WithValidationErrorEnvelope(string longName)
    {
        var payload = JsonSerializer.Serialize(new { name = longName, totalSeats = 10 });
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "name must be between 1 and 100 characters.");
    }

    [Fact]
    public async Task CreateClass_DecimalTotalSeats_Returns400WithValidationErrorEnvelope()
    {
        var content = new StringContent("{\"name\":\"Class 6 - Morning\",\"totalSeats\":12.5}", Encoding.UTF8, "application/json");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "totalSeats must be an integer between 1 and 10000.");
    }

    [Fact]
    public async Task CreateClass_StringTotalSeats_Returns400WithValidationErrorEnvelope()
    {
        var content = new StringContent("{\"name\":\"Class 6 - Morning\",\"totalSeats\":\"12\"}", Encoding.UTF8, "application/json");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "totalSeats must be an integer between 1 and 10000.");
    }

    [Fact]
    public async Task CreateClass_MissingRequestBody_Returns400WithValidationErrorEnvelope()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/classes");
        req.Content = new StringContent(string.Empty, Encoding.UTF8, "application/json");
        var resp = await _client.SendAsync(req);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "The request field is required.");
    }

    [Fact]
    public async Task CreateClass_JsonNullRequestBody_Returns400WithValidationErrorEnvelope()
    {
        var content = new StringContent("null", Encoding.UTF8, "application/json");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(resp, HttpStatusCode.BadRequest, "VALIDATION_ERROR", "The request field is required.");
    }

    [Fact]
    public async Task CreateClass_UnsupportedContentTypeTextPlain_Returns415WithUnifiedEnvelope()
    {
        var content = new StringContent("name=Class+6&totalSeats=10", Encoding.UTF8, "text/plain");
        var resp = await _client.PostAsync("/classes", content);
        await AssertUnifiedErrorResponse(
            resp, 
            HttpStatusCode.UnsupportedMediaType, 
            "UNSUPPORTED_MEDIA_TYPE", 
            "The request Content-Type is not supported.");
    }

    [Fact]
    public async Task UpdateClass_UnsupportedContentTypeTextPlain_Returns415WithUnifiedEnvelope()
    {
        var content = new StringContent("name=Class+6&totalSeats=10", Encoding.UTF8, "text/plain");
        var resp = await _client.PutAsync($"/classes/{Guid.NewGuid()}", content);
        await AssertUnifiedErrorResponse(
            resp, 
            HttpStatusCode.UnsupportedMediaType, 
            "UNSUPPORTED_MEDIA_TYPE", 
            "The request Content-Type is not supported.");
    }

    [Fact]
    public async Task Classes_UnsupportedHttpMethodDelete_Returns405WithUnifiedEnvelope()
    {
        var req = new HttpRequestMessage(HttpMethod.Delete, "/classes");
        var resp = await _client.SendAsync(req);
        await AssertUnifiedErrorResponse(
            resp, 
            HttpStatusCode.MethodNotAllowed, 
            "METHOD_NOT_ALLOWED", 
            "The HTTP DELETE method is not allowed for this endpoint.");
    }

    private static async Task AssertUnifiedErrorResponse(
        HttpResponseMessage response, 
        HttpStatusCode expectedStatus, 
        string expectedErrorCode,
        string? expectedMessageSubstring = null)
    {
        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(expectedStatus, response.StatusCode);

        var rawBody = await response.Content.ReadAsStringAsync();
        Assert.False(string.IsNullOrWhiteSpace(rawBody), "Response body should not be empty.");

        // Assert no leaked stack trace or internal exception details
        Assert.DoesNotContain("stacktrace", rawBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("at SchoolAdmission.", rawBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("System.Exception", rawBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Exception:", rawBody, StringComparison.OrdinalIgnoreCase);

        // Assert unified error envelope structure
        var errorResponse = JsonSerializer.Deserialize<ErrorResponse>(rawBody, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        Assert.NotNull(errorResponse);
        Assert.NotNull(errorResponse.Error);
        Assert.Equal(expectedErrorCode, errorResponse.Error.Code);
        Assert.False(string.IsNullOrWhiteSpace(errorResponse.Error.Message), "Error message should not be empty.");

        if (expectedMessageSubstring != null)
        {
            Assert.Contains(expectedMessageSubstring, errorResponse.Error.Message, StringComparison.OrdinalIgnoreCase);
        }
    }
}

