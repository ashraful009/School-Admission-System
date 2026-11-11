using System.Data;
using System.Net;
using System.Net.Http.Json;
using Npgsql;
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
        // 50 concurrent requests from the same student to the same class produce exactly one successful hold
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

        // Verify all 49 conflicts returned ALREADY_APPLIED_IN_CLASS
        foreach (var conflictResp in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            var err = await conflictResp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.NotNull(err);
            Assert.Equal("ALREADY_APPLIED_IN_CLASS", err!.Error.Code);
        }

        // Verify stored counters equal actual
        var classResponse = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classResponse);
        Assert.Equal(1, classResponse!.HeldSeats);
        Assert.Equal(9, classResponse.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Concurrent_requests_from_same_student_to_two_different_classes_both_succeed()
    {
        // Concurrent requests from the same student to two different classes can each succeed, provided both classes have available seats
        var classA = await TestHelpers.CreateClassAsync(_client, "Concurrent Student Class A", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Concurrent Student Class B", 5);

        var classAId = Guid.Parse(classA.Id);
        var classBId = Guid.Parse(classB.Id);
        const string studentId = "50000000000000002";

        const int perClassRequests = 20;
        var tasksA = new Task<HttpResponseMessage>[perClassRequests];
        var tasksB = new Task<HttpResponseMessage>[perClassRequests];

        for (var i = 0; i < perClassRequests; i++)
        {
            var reqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classAId}/holds");
            reqA.Headers.Add("X-Student-Id", studentId);
            tasksA[i] = _client.SendAsync(reqA);

            var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classBId}/holds");
            reqB.Headers.Add("X-Student-Id", studentId);
            tasksB[i] = _client.SendAsync(reqB);
        }

        var responsesA = await Task.WhenAll(tasksA);
        var responsesB = await Task.WhenAll(tasksB);

        // In Class A: exactly 1 Created (201), 19 Conflict (409)
        var createdA = responsesA.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictA = responsesA.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, createdA);
        Assert.Equal(19, conflictA);

        // In Class B: exactly 1 Created (201), 19 Conflict (409)
        var createdB = responsesB.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictB = responsesB.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(1, createdB);
        Assert.Equal(19, conflictB);

        // All conflicts are ALREADY_APPLIED_IN_CLASS
        foreach (var conflictResp in responsesA.Concat(responsesB).Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            var err = await conflictResp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.NotNull(err);
            Assert.Equal("ALREADY_APPLIED_IN_CLASS", err!.Error.Code);
        }

        // Verify stored counters equal actual reservation rows for both classes
        var respA = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classAId}");
        Assert.NotNull(respA);
        Assert.Equal(1, respA!.HeldSeats);
        Assert.Equal(4, respA.AvailableSeats);
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classAId);

        var respB = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classBId}");
        Assert.NotNull(respB);
        Assert.Equal(1, respB!.HeldSeats);
        Assert.Equal(4, respB.AvailableSeats);
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classBId);
    }

    [Fact]
    public async Task Concurrent_requests_from_same_student_to_three_different_classes_all_succeed()
    {
        // Concurrent requests from the same student to 3 different classes all succeed
        var classA = await TestHelpers.CreateClassAsync(_client, "Concurrent Student Class A3", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Concurrent Student Class B3", 5);
        var classC = await TestHelpers.CreateClassAsync(_client, "Concurrent Student Class C3", 5);

        var classIds = new[] { Guid.Parse(classA.Id), Guid.Parse(classB.Id), Guid.Parse(classC.Id) };
        const string studentId = "50000000000000001";
        const int requestCount = 30; // 10 per class

        var tasks = new Task<HttpResponseMessage>[requestCount];
        for (var i = 0; i < requestCount; i++)
        {
            var targetClassId = classIds[i % 3];
            var request = new HttpRequestMessage(HttpMethod.Post, $"/classes/{targetClassId}/holds");
            request.Headers.Add("X-Student-Id", studentId);
            tasks[i] = _client.SendAsync(request);
        }

        var responses = await Task.WhenAll(tasks);

        var createdCount = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var conflictCount = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        var otherCount = responses.Count(r => r.StatusCode != HttpStatusCode.Created && r.StatusCode != HttpStatusCode.Conflict);

        Assert.Equal(0, otherCount);
        Assert.Equal(3, createdCount); // exactly 1 per class
        Assert.Equal(27, conflictCount);

        // Read error codes of the conflicts
        foreach (var conflictResp in responses.Where(r => r.StatusCode == HttpStatusCode.Conflict))
        {
            var err = await conflictResp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.NotNull(err);
            Assert.Equal("ALREADY_APPLIED_IN_CLASS", err!.Error.Code);
        }

        // Verify stored counters equal actual reservation rows for all 3 classes
        foreach (var cId in classIds)
        {
            var cResp = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cId}");
            Assert.NotNull(cResp);
            Assert.Equal(1, cResp!.HeldSeats);
            Assert.Equal(4, cResp.AvailableSeats);
            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, cId);
        }
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
    public async Task Confirm_vs_expire_deterministic_lifecycle()
    {
        // R4, D14, X1: Deterministic confirmation and expiration lifecycle verification without timing assumptions
        await using var factory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: false);
        using var client = factory.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            // Case A: Unexpired hold confirmation always succeeds (200 OK)
            var classCreatedA = await TestHelpers.CreateClassAsync(client, $"Lifecycle Confirm Class {i}", 1);
            var classIdA = Guid.Parse(classCreatedA.Id);
            var studentIdA = (40100000000000000L + i + 1).ToString("D17");

            var holdReqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classIdA}/holds");
            holdReqA.Headers.Add("X-Student-Id", studentIdA);
            var holdRespA = await client.SendAsync(holdReqA);
            holdRespA.EnsureSuccessStatusCode();
            var holdA = await holdRespA.Content.ReadFromJsonAsync<HoldResponse>();
            Assert.NotNull(holdA);

            var confirmReqA = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdA!.HoldId}/confirm");
            confirmReqA.Headers.Add("X-Student-Id", studentIdA);
            var confirmRespA = await client.SendAsync(confirmReqA);
            Assert.Equal(HttpStatusCode.OK, confirmRespA.StatusCode);

            var classDetailsA = await client.GetFromJsonAsync<ClassResponse>($"/classes/{classIdA}");
            Assert.NotNull(classDetailsA);
            Assert.Equal(0, classDetailsA!.HeldSeats);
            Assert.Equal(1, classDetailsA.ConfirmedSeats);
            Assert.Equal(0, classDetailsA.AvailableSeats);
            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classIdA);

            // Case B: Expired hold confirmation always fails with 409 HOLD_EXPIRED
            var classCreatedB = await TestHelpers.CreateClassAsync(client, $"Lifecycle Expire Class {i}", 1);
            var classIdB = Guid.Parse(classCreatedB.Id);
            var studentIdB = (40200000000000000L + i + 1).ToString("D17");

            var holdReqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classIdB}/holds");
            holdReqB.Headers.Add("X-Student-Id", studentIdB);
            var holdRespB = await client.SendAsync(holdReqB);
            holdRespB.EnsureSuccessStatusCode();
            var holdB = await holdRespB.Content.ReadFromJsonAsync<HoldResponse>();
            Assert.NotNull(holdB);

            // Deterministically expire the reservation in PostgreSQL
            await using (var conn = new NpgsqlConnection(_db.ConnectionString))
            {
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", Guid.Parse(holdB!.HoldId));
                await cmd.ExecuteNonQueryAsync();
            }

            var confirmReqB = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdB!.HoldId}/confirm");
            confirmReqB.Headers.Add("X-Student-Id", studentIdB);
            var confirmRespB = await client.SendAsync(confirmReqB);
            Assert.Equal(HttpStatusCode.Conflict, confirmRespB.StatusCode);
            var errorB = await confirmRespB.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.NotNull(errorB);
            Assert.Equal("HOLD_EXPIRED", errorB!.Error.Code);

            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classIdB);
        }
    }

    [Fact]
    public async Task Confirm_vs_expire_real_worker_race_confirmation_wins()
    {
        // Priority 3: Real ExpiryWorker running against real PostgreSQL, confirmation wins
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var workerClient = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(workerClient, "Worker Race Confirm Wins", 1);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "41111111111111111";

        // Create unexpired hold (duration 600s)
        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await workerClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        // Confirm while hold is valid and unexpired
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await workerClient.SendAsync(confirmReq);

        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);
        var confirmed = await confirmResp.Content.ReadFromJsonAsync<ConfirmHoldResponse>();
        Assert.NotNull(confirmed);
        Assert.Equal("CONFIRMED", confirmed!.Status);

        // Allow background ExpiryWorker to execute multiple polling cycles (every 50ms)
        await Task.Delay(150);

        // Verify final status is CONFIRMED, heldSeats decreased once, confirmedSeats increased once
        var classDetails = await workerClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(1, classDetails.ConfirmedSeats);
        Assert.Equal(0, classDetails.AvailableSeats);

        // Verify PostgreSQL row directly: worker did not touch or overwrite CONFIRMED
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status, confirmed_at, expired_at FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal("CONFIRMED", reader.GetString(0));
            Assert.False(reader.IsDBNull(1));
            Assert.True(reader.IsDBNull(2));
        }

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Confirm_vs_expire_real_worker_race_expiration_wins()
    {
        // Priority 3: Real ExpiryWorker running against real PostgreSQL, expiration wins
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var workerClient = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(workerClient, "Worker Race Expire Wins", 1);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "42222222222222222";

        // Create hold
        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await workerClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        // Deterministically set reservation expired in PostgreSQL
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold!.HoldId));
            await cmd.ExecuteNonQueryAsync();
        }

        // Allow actual ExpiryWorker to sweep and process the expired reservation
        string workerStatus = "";
        for (var attempt = 0; attempt < 20; attempt++)
        {
            await Task.Delay(50);
            await using var conn = new NpgsqlConnection(_db.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            workerStatus = (string)(await cmd.ExecuteScalarAsync())!;
            if (workerStatus == "EXPIRED") break;
        }
        Assert.Equal("EXPIRED", workerStatus);

        // Send confirm request after worker has reclaimed the reservation
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await workerClient.SendAsync(confirmReq);

        // Expiration wins: Confirm returns 409 HOLD_EXPIRED
        Assert.Equal(HttpStatusCode.Conflict, confirmResp.StatusCode);
        var error = await confirmResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("HOLD_EXPIRED", error!.Error.Code);

        // Verify final status is EXPIRED, heldSeats decreased exactly once, confirmedSeats unchanged
        var classDetails = await workerClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(0, classDetails.ConfirmedSeats);
        Assert.Equal(1, classDetails.AvailableSeats);

        // Verify PostgreSQL row directly
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status, confirmed_at, expired_at FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal("EXPIRED", reader.GetString(0));
            Assert.True(reader.IsDBNull(1));
            Assert.False(reader.IsDBNull(2));
        }

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Confirm_vs_expire_real_worker_repeated_race()
    {
        // Priority 3: Repeated execution exercising worker and API deterministic lifecycle outcomes
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var workerClient = workerFactory.CreateClient();

        for (var i = 0; i < 5; i++)
        {
            var classCreated = await TestHelpers.CreateClassAsync(workerClient, $"Repeated Worker Race {i}", 1);
            var classId = Guid.Parse(classCreated.Id);
            var studentIdA = (43000000000000000L + i * 2 + 1).ToString("D17");
            var studentIdB = (43000000000000000L + i * 2 + 2).ToString("D17");

            // Sub-run 1: Confirmation wins (unexpired hold)
            var holdReqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
            holdReqA.Headers.Add("X-Student-Id", studentIdA);
            var holdRespA = await workerClient.SendAsync(holdReqA);
            holdRespA.EnsureSuccessStatusCode();
            var holdA = await holdRespA.Content.ReadFromJsonAsync<HoldResponse>();

            var confirmReqA = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdA!.HoldId}/confirm");
            confirmReqA.Headers.Add("X-Student-Id", studentIdA);
            var confirmRespA = await workerClient.SendAsync(confirmReqA);
            Assert.Equal(HttpStatusCode.OK, confirmRespA.StatusCode);

            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);

            // Sub-run 2: Expiration wins on a new 1-seat class
            var classCreatedB = await TestHelpers.CreateClassAsync(workerClient, $"Repeated Expire Class {i}", 1);
            var classIdB = Guid.Parse(classCreatedB.Id);

            var holdReqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classIdB}/holds");
            holdReqB.Headers.Add("X-Student-Id", studentIdB);
            var holdRespB = await workerClient.SendAsync(holdReqB);
            holdRespB.EnsureSuccessStatusCode();
            var holdB = await holdRespB.Content.ReadFromJsonAsync<HoldResponse>();

            await using (var conn = new NpgsqlConnection(_db.ConnectionString))
            {
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '500 milliseconds' WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", Guid.Parse(holdB!.HoldId));
                await cmd.ExecuteNonQueryAsync();
            }

            // Wait for worker sweep
            string finalStatusB = "";
            for (var w = 0; w < 20; w++)
            {
                await Task.Delay(50);
                await using var conn = new NpgsqlConnection(_db.ConnectionString);
                await conn.OpenAsync();
                await using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT status FROM reservations WHERE id = @id";
                cmd.Parameters.AddWithValue("@id", Guid.Parse(holdB.HoldId));
                finalStatusB = (string)(await cmd.ExecuteScalarAsync())!;
                if (finalStatusB == "EXPIRED") break;
            }
            Assert.Equal("EXPIRED", finalStatusB);

            var confirmReqB = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdB!.HoldId}/confirm");
            confirmReqB.Headers.Add("X-Student-Id", studentIdB);
            var confirmRespB = await workerClient.SendAsync(confirmReqB);
            Assert.Equal(HttpStatusCode.Conflict, confirmRespB.StatusCode);
            var errorB = await confirmRespB.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.NotNull(errorB);
            Assert.Equal("HOLD_EXPIRED", errorB!.Error.Code);

            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classIdB);
        }
    }

    [Fact]
    public async Task Cancel_vs_expire_real_worker_cancellation_wins()
    {
        // Priority 1: Cancellation wins reliably while reservation is unexpired; ExpiryWorker leaves CANCELLED unchanged
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var workerClient = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(workerClient, "Cancel Wins Worker Class", 1);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "45111111111111111";

        // Step 1: Create an unexpired HELD reservation (600s duration)
        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await workerClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);
        Assert.Equal("HELD", hold!.Status);

        // Step 2: Complete cancellation while the reservation is still valid
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await workerClient.SendAsync(cancelReq);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp.StatusCode);

        // Step 3: Allow the actual ExpiryWorker to run multiple cycles
        await Task.Delay(150);

        // Step 4: Verify the worker leaves the CANCELLED reservation unchanged
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status, cancelled_at, expired_at FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal("CANCELLED", reader.GetString(0));
            Assert.False(reader.IsDBNull(1), "cancelled_at must be populated.");
            Assert.True(reader.IsDBNull(2), "expired_at must remain NULL.");
        }

        // Step 5: Verify held_seats is decremented exactly once, confirmed_seats remains unchanged, available_seats is correct
        var classDetails = await workerClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(0, classDetails.ConfirmedSeats);
        Assert.Equal(1, classDetails.AvailableSeats);

        // Step 6: Verify direct database counters match actual rows
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Cancel_vs_expire_real_worker_expiration_wins()
    {
        // Priority 2: Expiration wins deterministically; ExpiryWorker reclaims hold, subsequent cancel returns 409 HOLD_EXPIRED
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var workerClient = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(workerClient, "Expire Wins Worker Class", 1);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "45222222222222222";

        // Step 1: Create a HELD reservation
        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await workerClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        // Step 2: Ensure it is expired in PostgreSQL
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold!.HoldId));
            await cmd.ExecuteNonQueryAsync();
        }

        // Step 3: Allow the actual ExpiryWorker to process it
        string finalStatus = "";
        for (var attempt = 0; attempt < 20; attempt++)
        {
            await Task.Delay(50);
            await using var conn = new NpgsqlConnection(_db.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            finalStatus = (string)(await cmd.ExecuteScalarAsync())!;
            if (finalStatus == "EXPIRED") break;
        }

        // Step 4: Verify status becomes EXPIRED in PostgreSQL
        Assert.Equal("EXPIRED", finalStatus);

        // Step 5: Attempt cancellation
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await workerClient.SendAsync(cancelReq);

        // Step 6: Verify HTTP 409 with HOLD_EXPIRED
        Assert.Equal(HttpStatusCode.Conflict, cancelResp.StatusCode);
        var error = await cancelResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("HOLD_EXPIRED", error!.Error.Code);

        // Step 7: Verify counters are updated exactly once (no double decrement by failed cancel)
        var classDetails = await workerClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(0, classDetails.ConfirmedSeats);
        Assert.Equal(1, classDetails.AvailableSeats);

        // Step 8: Direct PostgreSQL verification
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT status, cancelled_at, expired_at FROM reservations WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold.HoldId));
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            Assert.Equal("EXPIRED", reader.GetString(0));
            Assert.True(reader.IsDBNull(1), "cancelled_at must remain NULL.");
            Assert.False(reader.IsDBNull(2), "expired_at must be populated.");
        }

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Row_lock_contention_api_waits_for_concurrent_lock_release()
    {
        // Demonstrates genuine PostgreSQL row-level lock contention and serialization without production code seams
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Row Lock Contention Class", 1);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "47000000000000001";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        // Open an independent connection and acquire exclusive row lock on this reservation
        await using var conn = new NpgsqlConnection(_db.ConnectionString);
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync(IsolationLevel.ReadCommitted);
        await using (var lockCmd = conn.CreateCommand())
        {
            lockCmd.Transaction = tx;
            lockCmd.CommandText = "SELECT id FROM reservations WHERE id = @id FOR UPDATE;";
            lockCmd.Parameters.AddWithValue("@id", Guid.Parse(hold!.HoldId));
            await lockCmd.ExecuteNonQueryAsync();
        }

        // Fire confirm request concurrently; API must block on PostgreSQL row lock
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmTask = _client.SendAsync(confirmReq);

        // Verify API request is actively blocked and cannot complete while lock is held
        await Task.Delay(150);
        Assert.False(confirmTask.IsCompleted, "API request should be blocked waiting for PostgreSQL row lock.");

        // Release the lock by committing the transaction
        await tx.CommitAsync();

        // API unblocks and succeeds
        var confirmResp = await confirmTask;
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);

        // Verify DB counters
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }
}

