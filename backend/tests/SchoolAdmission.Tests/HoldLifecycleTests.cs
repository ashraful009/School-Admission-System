using System.Net;
using System.Net.Http.Json;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Tests.Fixtures;
using Xunit;

namespace SchoolAdmission.Tests;

public class HoldLifecycleTests : IAsyncLifetime
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
    public async Task Sequential_first_request_wins()
    {
        // B2, D5: Sequential first come, first served on a 1-seat class
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Sequential 1-Seat Class", 1);
        var classId = Guid.Parse(classCreated.Id);

        // First student applies
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req1.Headers.Add("X-Student-Id", "11111111111111111");
        var resp1 = await _client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        // Second student applies
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req2.Headers.Add("X-Student-Id", "22222222222222222");
        var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);

        var err = await resp2.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("NO_SEATS_AVAILABLE", err!.Error.Code);
    }

    [Fact]
    public async Task Same_student_can_hold_different_classes()
    {
        // R3, D2: One student may hold seats in multiple classes simultaneously
        var classA = await TestHelpers.CreateClassAsync(_client, "Class A", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Class B", 5);
        const string studentId = "33333333333333333";

        var reqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        reqA.Headers.Add("X-Student-Id", studentId);
        var respA = await _client.SendAsync(reqA);
        Assert.Equal(HttpStatusCode.Created, respA.StatusCode);

        var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classB.Id}/holds");
        reqB.Headers.Add("X-Student-Id", studentId);
        var respB = await _client.SendAsync(reqB);
        Assert.Equal(HttpStatusCode.Created, respB.StatusCode);
    }

    [Fact]
    public async Task Confirm_expired_409()
    {
        // R4, A6: Attempting to confirm an expired hold returns 409 HOLD_EXPIRED
        await using var shortFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: false);
        using var shortClient = shortFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(shortClient, "Expiring Confirm Class", 5);
        const string studentId = "44444444444444444";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classCreated.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await shortClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Wait until expired
        await Task.Delay(1500);

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await shortClient.SendAsync(confirmReq);

        Assert.Equal(HttpStatusCode.Conflict, confirmResp.StatusCode);
        var err = await confirmResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("HOLD_EXPIRED", err!.Error.Code);
    }

    [Fact]
    public async Task Confirm_other_students_hold_404()
    {
        // R4, A6: Confirming another student's hold returns 404 NOT_FOUND
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Other Student Confirm Class", 5);
        const string ownerId = "55555555555555555";
        const string otherId = "66666666666666666";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classCreated.Id}/holds");
        holdReq.Headers.Add("X-Student-Id", ownerId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", otherId);
        var confirmResp = await _client.SendAsync(confirmReq);

        Assert.Equal(HttpStatusCode.NotFound, confirmResp.StatusCode);
    }

    [Fact]
    public async Task Cancel_and_expiry_release_exactly_one_seat()
    {
        // A7, B3: Cancel releases exactly one seat, repeat cancel is idempotent 204
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Cancel Release Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "77777777777777777";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // First cancel: 204
        var cancelReq1 = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq1.Headers.Add("X-Student-Id", studentId);
        var cancelResp1 = await _client.SendAsync(cancelReq1);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp1.StatusCode);

        var classAfter1 = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.Equal(0, classAfter1!.HeldSeats);
        Assert.Equal(5, classAfter1.AvailableSeats);

        // Repeat cancel (idempotent): 204, seat count untouched
        var cancelReq2 = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq2.Headers.Add("X-Student-Id", studentId);
        var cancelResp2 = await _client.SendAsync(cancelReq2);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp2.StatusCode);

        var classAfter2 = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.Equal(0, classAfter2!.HeldSeats);
        Assert.Equal(5, classAfter2.AvailableSeats);
    }

    [Fact]
    public async Task Expired_hold_returns_seat_without_api_call()
    {
        // R2, D14: With worker enabled, expired hold returns seat automatically
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: true, expiryIntervalMs: 200);
        using var workerClient = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(workerClient, "Auto Expiry Class", 3);
        var classId = Guid.Parse(classCreated.Id);

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "88888888888888888");
        var holdResp = await workerClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();

        // Wait for expiry and worker run
        await Task.Delay(2000);

        var classResponse = await workerClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(0, classResponse!.HeldSeats);
        Assert.Equal(3, classResponse.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Reads_are_correct_with_worker_disabled()
    {
        // D6: Effective count on reads immediately discounts expired holds even when worker is disabled
        await using var disabledFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: false);
        using var disabledClient = disabledFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(disabledClient, "Effective Read Class", 1);
        var classId = Guid.Parse(classCreated.Id);

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", "99999999999999991");
        var holdResp = await disabledClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Wait until expired
        await Task.Delay(1500);

        // GET /classes must show available = 1, held = 0 via effective formula
        var classResponse = await disabledClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(0, classResponse!.HeldSeats);
        Assert.Equal(1, classResponse.AvailableSeats);

        // GET /holds/{id} must show status = EXPIRED
        var holdDetails = await disabledClient.GetFromJsonAsync<HoldDetailsResponse>($"/holds/{hold!.HoldId}");
        Assert.NotNull(holdDetails);
        Assert.Equal("EXPIRED", holdDetails!.Status);

        // Another student can take the seat via create-hold reclaim
        var nextReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        nextReq.Headers.Add("X-Student-Id", "99999999999999992");
        var nextResp = await disabledClient.SendAsync(nextReq);
        Assert.Equal(HttpStatusCode.Created, nextResp.StatusCode);
    }

    [Fact]
    public async Task Edit_cannot_go_below_occupied()
    {
        // A9: PUT /classes/{id} cannot reduce totalSeats below currently occupied (held + confirmed)
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Edit Seats Class", 5);
        var classId = Guid.Parse(classCreated.Id);

        // Create 1 hold and confirm it
        var hold1Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold1Req.Headers.Add("X-Student-Id", "12121212121212121");
        var hold1Resp = await _client.SendAsync(hold1Req);
        var hold1 = await hold1Resp.Content.ReadFromJsonAsync<HoldResponse>();

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold1!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", "12121212121212121");
        await _client.SendAsync(confirmReq);

        // Create 1 hold (unconfirmed)
        var hold2Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold2Req.Headers.Add("X-Student-Id", "34343434343434343");
        await _client.SendAsync(hold2Req);

        // Total occupied = 2 (1 confirmed + 1 held)
        // Edit to 1 seat: must return 409 TOTAL_SEATS_BELOW_OCCUPIED
        var editFail = await _client.PutAsJsonAsync($"/classes/{classId}", new { name = "Edit Seats Class", totalSeats = 1 });
        Assert.Equal(HttpStatusCode.Conflict, editFail.StatusCode);
        var err = await editFail.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("TOTAL_SEATS_BELOW_OCCUPIED", err!.Error.Code);

        // Edit to 2 seats: valid
        var editOk2 = await _client.PutAsJsonAsync($"/classes/{classId}", new { name = "Edit Seats Class", totalSeats = 2 });
        Assert.Equal(HttpStatusCode.OK, editOk2.StatusCode);

        // Edit to 10 seats: valid
        var editOk10 = await _client.PutAsJsonAsync($"/classes/{classId}", new { name = "Edit Seats Class (Expanded)", totalSeats = 10 });
        Assert.Equal(HttpStatusCode.OK, editOk10.StatusCode);
    }
}

