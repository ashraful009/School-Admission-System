using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Tests.Fixtures;
using Xunit;

namespace SchoolAdmission.Tests;

public class ConcurrencyTests : IAsyncLifetime
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

    [Fact]
    public async Task Concurrency_1000_requests_10_seats()
    {
        // R1, A4, B2: 1000 simultaneous requests on 10 seats produce exactly 10 x 201 and 990 x 409
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Concurrent 1000 Class", 10);
        var classId = Guid.Parse(classCreated.Id);

        const int requestCount = 1000;
        var tasks = new Task<HttpResponseMessage>[requestCount];

        for (var i = 0; i < requestCount; i++)
        {
            var studentId = (10000000000000000L + i + 1).ToString("D17");
            var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            request.Headers.Add("X-Student-Id", studentId);
            tasks[i] = _client.SendAsync(request);
        }

        var responses = await Task.WhenAll(tasks);

        var createdCount = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        var otherCount = responses.Count(r => r.StatusCode != HttpStatusCode.Created && r.StatusCode != HttpStatusCode.Conflict);

        Assert.Equal(0, otherCount);
        Assert.Equal(10, createdCount);
        Assert.Equal(990, conflictCount);

        // Verify class counts via API
        var classResponse = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(10, classResponse!.HeldSeats);
        Assert.Equal(0, classResponse.ConfirmedSeats);
        Assert.Equal(0, classResponse.AvailableSeats);

        // Verify DB stored counters equal actual reservation rows
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Same_student_50_parallel_holds_create_one()
    {
        // R3, A4: 50 parallel requests from the same student produce exactly one 201 and 49 x 409
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Same Student 50 Class", 10);
        var classId = Guid.Parse(classCreated.Id);

        const string studentId = "20000000000000001";
        const int requestCount = 50;
        var tasks = new Task<HttpResponseMessage>[requestCount];

        for (var i = 0; i < requestCount; i++)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            request.Headers.Add("X-Student-Id", studentId);
            tasks[i] = _client.SendAsync(request);
        }

        var responses = await Task.WhenAll(tasks);

        var createdCount = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);

        Assert.Equal(1, createdCount);
        Assert.Equal(49, conflictCount);

        // Verify stored counters equal actual
        var classResponse = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(1, classResponse!.HeldSeats);
        Assert.Equal(9, classResponse.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Confirm_twice_counts_once()
    {
        // R5, A6: Confirming the same hold in parallel increases confirmedSeats exactly once and returns 200 to all
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Parallel Confirm Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "30000000000000001";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        const int parallelConfirms = 10;
        var tasks = new Task<HttpResponseMessage>[parallelConfirms];

        for (var i = 0; i < parallelConfirms; i++)
        {
            var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
            confirmReq.Headers.Add("X-Student-Id", studentId);
            tasks[i] = _client.SendAsync(confirmReq);
        }

        var responses = await Task.WhenAll(tasks);

        // All parallel confirms must return 200 OK
        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));

        var classResponse = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(0, classResponse!.HeldSeats);
        Assert.Equal(1, classResponse.ConfirmedSeats);
        Assert.Equal(4, classResponse.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Confirm_vs_expire_one_winner()
    {
        // R4, D14, X1: Race confirm against expiry. Exactly one wins; counters stay completely consistent.
        await using var shortFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: false);
        using var shortClient = shortFactory.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            var classCreated = await TestHelpers.CreateClassAsync(shortClient, $"Race Class {i}", 1);
            var classId = Guid.Parse(classCreated.Id);
            var studentId = (40000000000000000L + i + 1).ToString("D17");

            var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            holdReq.Headers.Add("X-Student-Id", studentId);
            var holdResp = await shortClient.SendAsync(holdReq);
            holdResp.EnsureSuccessStatusCode();
            var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
            Assert.NotNull(hold);

            // Wait until the boundary of expiration
            await Task.Delay(1000);

            var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
            confirmReq.Headers.Add("X-Student-Id", studentId);
            var confirmResp = await shortClient.SendAsync(confirmReq);

            Assert.True(
                confirmResp.StatusCode == HttpStatusCode.OK || confirmResp.StatusCode == HttpStatusCode.Conflict,
                $"Unexpected status {confirmResp.StatusCode}");

            // Verify counters always equal reality in either outcome
            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
        }
    }
}
