using System.Net;
using System.Text;
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
}
