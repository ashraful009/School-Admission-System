using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SchoolAdmission.Tests;

public sealed class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Get_Health_Returns200AndStatusOk()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert status code
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Assert body contains status == "ok"
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
    }

    // DTO used only for deserialisation in this test
    private sealed record HealthResponse(string Status);
}

