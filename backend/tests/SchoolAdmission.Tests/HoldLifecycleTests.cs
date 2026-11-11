using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using SchoolAdmission.Application.Dtos;
using SchoolAdmission.Domain;
using SchoolAdmission.Infrastructure;
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
    public async Task Same_student_can_hold_seats_in_two_different_classes()
    {
        // Section 2.5 & 2.6: Same student can hold seats in two different classes
        var classA = await TestHelpers.CreateClassAsync(_client, "Class 6 - Morning Shift", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Class 6 - Day Shift", 5);
        const string studentId = "33333333333333333";

        // First hold in Class A succeeds (201 Created)
        var reqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        reqA.Headers.Add("X-Student-Id", studentId);
        var respA = await _client.SendAsync(reqA);
        Assert.Equal(HttpStatusCode.Created, respA.StatusCode);

        // Second hold in Class B also succeeds (201 Created)
        var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classB.Id}/holds");
        reqB.Headers.Add("X-Student-Id", studentId);
        var respB = await _client.SendAsync(reqB);
        Assert.Equal(HttpStatusCode.Created, respB.StatusCode);

        // Both classes have exactly 1 held seat
        var classADetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classA.Id}");
        Assert.NotNull(classADetails);
        Assert.Equal(1, classADetails!.HeldSeats);
        Assert.Equal(4, classADetails.AvailableSeats);

        var classBDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classB.Id}");
        Assert.NotNull(classBDetails);
        Assert.Equal(1, classBDetails!.HeldSeats);
        Assert.Equal(4, classBDetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classB.Id));
    }

    [Fact]
    public async Task Same_student_cannot_hold_two_seats_in_the_same_class()
    {
        // Section 2.5 & 2.6: Same student cannot hold two seats in the same class
        var classA = await TestHelpers.CreateClassAsync(_client, "Class 6 - Morning Shift", 5);
        const string studentId = "33333333333333334";

        // First hold in Class A succeeds
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req1.Headers.Add("X-Student-Id", studentId);
        var resp1 = await _client.SendAsync(req1);
        Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

        // Second hold in Class A fails with 409 ALREADY_APPLIED_IN_CLASS
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req2.Headers.Add("X-Student-Id", studentId);
        var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);

        var err = await resp2.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("ALREADY_APPLIED_IN_CLASS", err!.Error.Code);

        // Class A held_seats remains 1
        var classADetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classA.Id}");
        Assert.NotNull(classADetails);
        Assert.Equal(1, classADetails!.HeldSeats);
        Assert.Equal(4, classADetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
    }

    [Fact]
    public async Task Same_student_can_apply_to_a_third_different_class()
    {
        // Section 2.5 & 2.6: Same student can apply to a third different class
        var classA = await TestHelpers.CreateClassAsync(_client, "Class 6 - Morning Shift", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Class 6 - Day Shift", 5);
        var classC = await TestHelpers.CreateClassAsync(_client, "Class 7 - Morning Shift", 5);
        const string studentId = "33333333333333335";

        // Apply to Class A -> 201
        var reqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        reqA.Headers.Add("X-Student-Id", studentId);
        var respA = await _client.SendAsync(reqA);
        Assert.Equal(HttpStatusCode.Created, respA.StatusCode);

        // Apply to Class B -> 201
        var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classB.Id}/holds");
        reqB.Headers.Add("X-Student-Id", studentId);
        var respB = await _client.SendAsync(reqB);
        Assert.Equal(HttpStatusCode.Created, respB.StatusCode);

        // Apply to Class C -> 201
        var reqC = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classC.Id}/holds");
        reqC.Headers.Add("X-Student-Id", studentId);
        var respC = await _client.SendAsync(reqC);
        Assert.Equal(HttpStatusCode.Created, respC.StatusCode);

        // Verify all 3 classes have 1 held seat
        foreach (var cls in new[] { classA, classB, classC })
        {
            var details = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
            Assert.NotNull(details);
            Assert.Equal(1, details!.HeldSeats);
            Assert.Equal(4, details.AvailableSeats);
            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(cls.Id));
        }
    }

    [Fact]
    public async Task Cancelled_hold_allows_reapplication_to_the_same_class()
    {
        // A cancelled hold allows reapplication to the same class
        var classA = await TestHelpers.CreateClassAsync(_client, "Class 7 - Morning", 5);
        const string studentId = "34343434343434341";

        // Hold in Class A
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req1.Headers.Add("X-Student-Id", studentId);
        var resp1 = await _client.SendAsync(req1);
        resp1.EnsureSuccessStatusCode();
        var hold = await resp1.Content.ReadFromJsonAsync<HoldResponse>();

        // Cancel hold in Class A
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await _client.SendAsync(cancelReq);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp.StatusCode);

        // Reapply in same Class A succeeds (201 Created)
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req2.Headers.Add("X-Student-Id", studentId);
        var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Created, resp2.StatusCode);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
    }

    [Fact]
    public async Task Expired_hold_allows_reapplication_to_the_same_class()
    {
        // An expired hold allows reapplication to the same class
        await using var shortFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: false);
        using var shortClient = shortFactory.CreateClient();

        var classA = await TestHelpers.CreateClassAsync(shortClient, "Class A Short Expiry", 3);
        const string studentId = "36363636363636361";

        // Student holds in Class A
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req1.Headers.Add("X-Student-Id", studentId);
        var resp1 = await shortClient.SendAsync(req1);
        resp1.EnsureSuccessStatusCode();

        // Wait until expired
        await Task.Delay(1500);

        // Student reapplies to Class A -> 201 Created
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req2.Headers.Add("X-Student-Id", studentId);
        var resp2 = await shortClient.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Created, resp2.StatusCode);

        var details = await shortClient.GetFromJsonAsync<ClassResponse>($"/classes/{classA.Id}");
        Assert.NotNull(details);
        Assert.Equal(1, details!.HeldSeats);
        Assert.Equal(2, details.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
    }

    [Fact]
    public async Task Confirmed_application_blocks_another_application_in_the_same_class()
    {
        // A confirmed application blocks another application in the same class
        var classA = await TestHelpers.CreateClassAsync(_client, "Class 9 - Morning Shift", 5);
        const string studentId = "35353535353535351";

        // Hold in Class A
        var req1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req1.Headers.Add("X-Student-Id", studentId);
        var resp1 = await _client.SendAsync(req1);
        resp1.EnsureSuccessStatusCode();
        var hold = await resp1.Content.ReadFromJsonAsync<HoldResponse>();

        // Confirm hold in Class A
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await _client.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);

        // Try applying to Class A again -> 409 ALREADY_APPLIED_IN_CLASS
        var req2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        req2.Headers.Add("X-Student-Id", studentId);
        var resp2 = await _client.SendAsync(req2);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);

        var err = await resp2.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(err);
        Assert.Equal("ALREADY_APPLIED_IN_CLASS", err!.Error.Code);

        // Seats of Class A: confirmed = 1, held = 0
        var classADetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classA.Id}");
        Assert.NotNull(classADetails);
        Assert.Equal(0, classADetails!.HeldSeats);
        Assert.Equal(1, classADetails.ConfirmedSeats);
        Assert.Equal(4, classADetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
    }

    [Fact]
    public async Task Confirmed_application_in_one_class_does_not_block_application_in_another_class()
    {
        // A confirmed application in one class does not block an application in another class
        var classA = await TestHelpers.CreateClassAsync(_client, "Class A Confirmed", 5);
        var classB = await TestHelpers.CreateClassAsync(_client, "Class B Open", 5);
        const string studentId = "35353535353535352";

        // Hold and confirm in Class A
        var reqA = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classA.Id}/holds");
        reqA.Headers.Add("X-Student-Id", studentId);
        var respA = await _client.SendAsync(reqA);
        respA.EnsureSuccessStatusCode();
        var holdA = await respA.Content.ReadFromJsonAsync<HoldResponse>();

        var confirmReqA = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdA!.HoldId}/confirm");
        confirmReqA.Headers.Add("X-Student-Id", studentId);
        var confirmRespA = await _client.SendAsync(confirmReqA);
        Assert.Equal(HttpStatusCode.OK, confirmRespA.StatusCode);

        // Applying to Class B succeeds (201 Created)
        var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classB.Id}/holds");
        reqB.Headers.Add("X-Student-Id", studentId);
        var respB = await _client.SendAsync(reqB);
        Assert.Equal(HttpStatusCode.Created, respB.StatusCode);
        var holdB = await respB.Content.ReadFromJsonAsync<HoldResponse>();

        // Can also confirm Class B
        var confirmReqB = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdB!.HoldId}/confirm");
        confirmReqB.Headers.Add("X-Student-Id", studentId);
        var confirmRespB = await _client.SendAsync(confirmReqB);
        Assert.Equal(HttpStatusCode.OK, confirmRespB.StatusCode);

        // Verify both classes have 1 confirmed seat
        var cADetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classA.Id}");
        Assert.NotNull(cADetails);
        Assert.Equal(1, cADetails!.ConfirmedSeats);

        var cBDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classB.Id}");
        Assert.NotNull(cBDetails);
        Assert.Equal(1, cBDetails!.ConfirmedSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classA.Id));
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(classB.Id));
    }

    [Fact]
    public async Task Migration_cleans_duplicate_active_rows()
    {
        // Test migration data cleaning:
        // Roll back to InitialCreate, insert duplicate active rows (HELD/CONFIRMED) for students across classes,
        // then migrate to latest and verify:
        // 1. CONFIRMED beats HELD, then earliest created_at is kept.
        // 2. Others marked CANCELLED with cancelled_at set.
        // 3. Classes counters (held_seats, confirmed_seats) recomputed correctly.
        // 4. Duplicate query returns 0 rows.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_db.ConnectionString)
            .Options;

        await using (var db = new AppDbContext(options))
        {
            var migrator = db.GetInfrastructure().GetService<IMigrator>();
            Assert.NotNull(migrator);

            // Roll back to InitialCreate
            await migrator!.MigrateAsync("InitialCreate");

            // Seed classes
            var class1Id = Guid.NewGuid();
            var class2Id = Guid.NewGuid();
            var class3Id = Guid.NewGuid();

            var now = DateTimeOffset.UtcNow;

            await db.Database.ExecuteSqlRawAsync(@"
                INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
                VALUES 
                    ({0}, 'Migration Class 1', 10, 2, 0, {3}),
                    ({1}, 'Migration Class 2', 10, 0, 1, {3}),
                    ({2}, 'Migration Class 3', 10, 1, 0, {3});
            ", class1Id, class2Id, class3Id, now);

            // Student 1: has HELD in Class 1 (earlier) and CONFIRMED in Class 2 (later)
            // Rule: CONFIRMED beats HELD, so Class 2 (CONFIRMED) should be kept, Class 1 CANCELLED
            const string student1 = "81818181818181811";
            var res1 = Guid.NewGuid();
            var res2 = Guid.NewGuid();

            // Student 2: has HELD in Class 1 (earlier) and HELD in Class 3 (later)
            // Rule: Earliest created_at kept, so Class 1 (HELD) should be kept, Class 3 CANCELLED
            const string student2 = "82828282828282822";
            var res3 = Guid.NewGuid();
            var res4 = Guid.NewGuid();

            await db.Database.ExecuteSqlRawAsync(@"
                INSERT INTO reservations (id, class_id, student_id, status, created_at, expires_at)
                VALUES 
                    ({0}, {1}, {2}, 'HELD', {3}, {4}),
                    ({5}, {6}, {7}, 'CONFIRMED', {8}, {9}),
                    ({10}, {11}, {12}, 'HELD', {13}, {14}),
                    ({15}, {16}, {17}, 'HELD', {18}, {19});
            ", 
                res1, class1Id, student1, now.AddMinutes(-10), now.AddMinutes(10),
                res2, class2Id, student1, now.AddMinutes(-5), now.AddMinutes(10),
                res3, class1Id, student2, now.AddMinutes(-10), now.AddMinutes(10),
                res4, class3Id, student2, now.AddMinutes(-5), now.AddMinutes(10)
            );

            // Now apply the migration (EnforceOneActiveApplicationPerStudent)
            await migrator.MigrateAsync("EnforceOneActiveApplicationPerStudent");

            // Verify Student 1:
            // res2 is CONFIRMED, res1 is CANCELLED with cancelled_at not null
            var s1Res1 = await db.Reservations.AsNoTracking().FirstAsync(r => r.Id == res1);
            var s1Res2 = await db.Reservations.AsNoTracking().FirstAsync(r => r.Id == res2);
            Assert.Equal(HoldStatus.CANCELLED, s1Res1.Status);
            Assert.NotNull(s1Res1.CancelledAt);
            Assert.Equal(HoldStatus.CONFIRMED, s1Res2.Status);

            // Verify Student 2:
            // res3 (earlier) is HELD, res4 (later) is CANCELLED with cancelled_at not null
            var s2Res3 = await db.Reservations.AsNoTracking().FirstAsync(r => r.Id == res3);
            var s2Res4 = await db.Reservations.AsNoTracking().FirstAsync(r => r.Id == res4);
            Assert.Equal(HoldStatus.HELD, s2Res3.Status);
            Assert.Equal(HoldStatus.CANCELLED, s2Res4.Status);
            Assert.NotNull(s2Res4.CancelledAt);

            // Verify recomputed class counters match actual reservations
            var c1 = await db.Classes.AsNoTracking().FirstAsync(c => c.Id == class1Id);
            var c2 = await db.Classes.AsNoTracking().FirstAsync(c => c.Id == class2Id);
            var c3 = await db.Classes.AsNoTracking().FirstAsync(c => c.Id == class3Id);

            // Class 1 had res1 (cancelled) and res3 (held) -> held_seats=1, confirmed_seats=0
            Assert.Equal(1, c1.HeldSeats);
            Assert.Equal(0, c1.ConfirmedSeats);

            // Class 2 had res2 (confirmed) -> held_seats=0, confirmed_seats=1
            Assert.Equal(0, c2.HeldSeats);
            Assert.Equal(1, c2.ConfirmedSeats);

            // Class 3 had res4 (cancelled) -> held_seats=0, confirmed_seats=0
            Assert.Equal(0, c3.HeldSeats);
            Assert.Equal(0, c3.ConfirmedSeats);

            // Verify no students have > 1 active reservation
            var duplicateStudentsCount = await db.Reservations
                .Where(r => r.Status == HoldStatus.HELD || r.Status == HoldStatus.CONFIRMED)
                .GroupBy(r => r.StudentId)
                .Where(g => g.Count() > 1)
                .CountAsync();
            Assert.Equal(0, duplicateStudentsCount);
        }
    }

    [Fact]
    public async Task Migration_EnforceActiveApplicationPerClass_creates_class_scoped_index()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_db.ConnectionString)
            .Options;

        await using var db = new AppDbContext(options);
        var connection = db.Database.GetDbConnection();
        await connection.OpenAsync();

        // 1. Verify ux_reservations_active_per_class exists on (class_id, student_id)
        await using var cmd1 = connection.CreateCommand();
        cmd1.CommandText = @"
            SELECT indexdef 
            FROM pg_indexes 
            WHERE tablename = 'reservations' AND indexname = 'ux_reservations_active_per_class';
        ";
        var indexDef = await cmd1.ExecuteScalarAsync();
        Assert.NotNull(indexDef);
        var defStr = (string)indexDef!;
        Assert.Contains("class_id", defStr);
        Assert.Contains("student_id", defStr);
        Assert.Contains("HELD", defStr);
        Assert.Contains("CONFIRMED", defStr);

        // 2. Verify ux_reservations_active_per_student does NOT exist
        await using var cmd2 = connection.CreateCommand();
        cmd2.CommandText = @"
            SELECT COUNT(*)::int 
            FROM pg_indexes 
            WHERE tablename = 'reservations' AND indexname = 'ux_reservations_active_per_student';
        ";
        var studentIndexCount = Convert.ToInt32(await cmd2.ExecuteScalarAsync());
        Assert.Equal(0, studentIndexCount);
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

    [Fact]
    public async Task Hold_duration_defaults_to_600_seconds_when_env_var_absent()
    {
        // Priority 2: Proving default is exactly 600s when HOLD_DURATION_SECONDS is absent
        await using var defaultFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: null, expiryWorkerEnabled: false);
        using var defaultClient = defaultFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(defaultClient, "Default 600 Duration Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "61000000000000001";

        // Verify class exposes default duration 600s
        var classDetails = await defaultClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(600, classDetails!.HoldDurationSeconds);

        // Create hold
        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await defaultClient.SendAsync(holdReq);
        Assert.Equal(HttpStatusCode.Created, holdResp.StatusCode);
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        // Verify (ExpiresAt - CreatedAt).TotalSeconds equals 600 exactly
        var created = DateTimeOffset.Parse(hold!.CreatedAt);
        var expires = DateTimeOffset.Parse(hold.ExpiresAt);
        var durationSeconds = (expires - created).TotalSeconds;
        Assert.Equal(600, durationSeconds);
    }

    [Fact]
    public async Task Hold_duration_respects_custom_configuration()
    {
        // Priority 2: Custom duration configuration continues to work
        await using var customFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 120, expiryWorkerEnabled: false);
        using var customClient = customFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(customClient, "Custom 120 Duration Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "61000000000000002";

        var classDetails = await customClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(120, classDetails!.HoldDurationSeconds);

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await customClient.SendAsync(holdReq);
        Assert.Equal(HttpStatusCode.Created, holdResp.StatusCode);
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();
        Assert.NotNull(hold);

        var created = DateTimeOffset.Parse(hold!.CreatedAt);
        var expires = DateTimeOffset.Parse(hold.ExpiresAt);
        var durationSeconds = (expires - created).TotalSeconds;
        Assert.Equal(120, durationSeconds);
    }

    [Fact]
    public async Task Owner_can_confirm_valid_unexpired_hold()
    {
        // Priority 3.1: Owner can confirm a valid unexpired hold
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Valid Confirm Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "62000000000000001";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await _client.SendAsync(confirmReq);

        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);
        var confirmed = await confirmResp.Content.ReadFromJsonAsync<ConfirmHoldResponse>();
        Assert.NotNull(confirmed);
        Assert.Equal("CONFIRMED", confirmed!.Status);
        Assert.False(string.IsNullOrWhiteSpace(confirmed.ConfirmedAt));

        var classDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(1, classDetails.ConfirmedSeats);
        Assert.Equal(4, classDetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Confirm_cancelled_hold_returns_409_hold_not_active()
    {
        // Priority 3.4: Confirming a cancelled hold returns 409 HOLD_NOT_ACTIVE
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Confirm Cancelled Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "62000000000000002";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Cancel
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await _client.SendAsync(cancelReq);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp.StatusCode);

        // Confirm cancelled hold
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await _client.SendAsync(confirmReq);

        Assert.Equal(HttpStatusCode.Conflict, confirmResp.StatusCode);
        var error = await confirmResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("HOLD_NOT_ACTIVE", error!.Error.Code);

        // Stored counters unchanged (held = 0, confirmed = 0)
        var classDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(0, classDetails.ConfirmedSeats);
        Assert.Equal(5, classDetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Reconfirming_already_confirmed_hold_is_idempotent_and_does_not_increment_counters()
    {
        // Priority 3.5: Reconfirming an already confirmed hold does not increment counters again
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Reconfirm Idempotent Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "62000000000000003";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // First confirm
        var confirmReq1 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq1.Headers.Add("X-Student-Id", studentId);
        var confirmResp1 = await _client.SendAsync(confirmReq1);
        Assert.Equal(HttpStatusCode.OK, confirmResp1.StatusCode);
        var conf1 = await confirmResp1.Content.ReadFromJsonAsync<ConfirmHoldResponse>();

        // Second confirm sequentially
        var confirmReq2 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold.HoldId}/confirm");
        confirmReq2.Headers.Add("X-Student-Id", studentId);
        var confirmResp2 = await _client.SendAsync(confirmReq2);
        Assert.Equal(HttpStatusCode.OK, confirmResp2.StatusCode);
        var conf2 = await confirmResp2.Content.ReadFromJsonAsync<ConfirmHoldResponse>();

        Assert.Equal(conf1!.HoldId, conf2!.HoldId);
        Assert.Equal("CONFIRMED", conf2.Status);

        // Verify confirmedSeats remains exactly 1, heldSeats is 0
        var classDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(1, classDetails.ConfirmedSeats);
        Assert.Equal(4, classDetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Another_student_cannot_cancel_someone_elses_hold_returns_404()
    {
        // Priority 4.2: Another student cannot cancel someone else's hold (404)
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Other Student Cancel Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string ownerId = "63000000000000001";
        const string otherId = "63000000000000002";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", ownerId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Other student attempts cancel
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", otherId);
        var cancelResp = await _client.SendAsync(cancelReq);
        Assert.Equal(HttpStatusCode.NotFound, cancelResp.StatusCode);

        // Hold still active in DB
        var classDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(1, classDetails!.HeldSeats);
        Assert.Equal(4, classDetails.AvailableSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Cancelling_confirmed_hold_returns_409_hold_already_confirmed()
    {
        // Priority 4.4: Cancelling a CONFIRMED hold returns 409 HOLD_ALREADY_CONFIRMED
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Cancel Confirmed Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "63000000000000003";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Confirm
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentId);
        var confirmResp = await _client.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);

        // Attempt cancel on confirmed hold
        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await _client.SendAsync(cancelReq);

        Assert.Equal(HttpStatusCode.Conflict, cancelResp.StatusCode);
        var error = await cancelResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("HOLD_ALREADY_CONFIRMED", error!.Error.Code);

        // Class confirmed_seats stays 1, held_seats stays 0
        var classDetails = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(1, classDetails.ConfirmedSeats);

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Cancelling_expired_hold_returns_409_hold_expired()
    {
        // Priority 4.5: Cancelling an EXPIRED hold returns 409 HOLD_EXPIRED
        await using var shortFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: false);
        using var shortClient = shortFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(shortClient, "Cancel Expired Class", 5);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "63000000000000004";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await shortClient.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Wait until expired
        await Task.Delay(1500);

        var cancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq.Headers.Add("X-Student-Id", studentId);
        var cancelResp = await shortClient.SendAsync(cancelReq);

        Assert.Equal(HttpStatusCode.Conflict, cancelResp.StatusCode);
        var error = await cancelResp.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(error);
        Assert.Equal("HOLD_EXPIRED", error!.Error.Code);

        var classDetails = await shortClient.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.NotNull(classDetails);
        Assert.Equal(0, classDetails!.HeldSeats);
        Assert.Equal(0, classDetails.ConfirmedSeats);
    }

    [Fact]
    public async Task Cancellation_releases_held_seats_exactly_once()
    {
        // Priority 4.7: Cancellation releases heldSeats exactly once
        var classCreated = await TestHelpers.CreateClassAsync(_client, "Cancel Release Once Class", 3);
        var classId = Guid.Parse(classCreated.Id);
        const string studentId = "63000000000000005";

        var holdReq = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        holdReq.Headers.Add("X-Student-Id", studentId);
        var holdResp = await _client.SendAsync(holdReq);
        holdResp.EnsureSuccessStatusCode();
        var hold = await holdResp.Content.ReadFromJsonAsync<HoldResponse>();

        // Verify initial held count = 1
        var initialClass = await _client.GetFromJsonAsync<ClassResponse>($"/classes/{classId}");
        Assert.Equal(1, initialClass!.HeldSeats);

        // First cancel
        var cancelReq1 = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold!.HoldId}");
        cancelReq1.Headers.Add("X-Student-Id", studentId);
        var cancelResp1 = await _client.SendAsync(cancelReq1);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp1.StatusCode);

        // Check SQL held_seats directly
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT held_seats FROM classes WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", classId);
            var held = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            Assert.Equal(0, held);
        }

        // Second cancel (idempotent 204)
        var cancelReq2 = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold.HoldId}");
        cancelReq2.Headers.Add("X-Student-Id", studentId);
        var cancelResp2 = await _client.SendAsync(cancelReq2);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp2.StatusCode);

        // SQL held_seats remains 0, never -1
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT held_seats FROM classes WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", classId);
            var held = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            Assert.Equal(0, held);
        }

        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    [Fact]
    public async Task Lifecycle_transition_matrix_verified()
    {
        // Priority 5: Full 9-cell lifecycle transition matrix
        // | Current Status | Requested Operation | Expected Result |
        // | HELD           | Confirm             | 200             |
        // | HELD           | Expire              | EXPIRED         |
        // | HELD           | Cancel              | 204             |
        // | EXPIRED        | Confirm             | 409             |
        // | EXPIRED        | Cancel              | 409             |
        // | CANCELLED      | Confirm             | 409             |
        // | CONFIRMED      | Confirm             | 200 idempotent  |
        // | CONFIRMED      | Cancel              | 409             |
        // | CONFIRMED      | Expire              | Must remain CONFIRMED |

        // 1. HELD -> Confirm (200 OK, DB CONFIRMED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix HELD to Confirm", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000001"))).Content.ReadFromJsonAsync<HoldResponse>();
            var resp = await _client.SendAsync(CreateConfirmRequest(h!.HoldId, "66000000000000001"));
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
            Assert.Equal("CONFIRMED", await GetReservationDbStatusAsync(h.HoldId));
        }

        // 2. HELD -> Expire (Background worker sets DB status to EXPIRED)
        {
            await using var wf = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: true, expiryIntervalMs: 25);
            using var wc = wf.CreateClient();
            var cls = await TestHelpers.CreateClassAsync(wc, "Matrix HELD to Expire", 3);
            var h = await (await wc.SendAsync(CreateHoldRequest(cls.Id, "66000000000000002"))).Content.ReadFromJsonAsync<HoldResponse>();
            await Task.Delay(1300);
            Assert.Equal("EXPIRED", await GetReservationDbStatusAsync(h!.HoldId));
        }

        // 3. HELD -> Cancel (204 NoContent, DB CANCELLED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix HELD to Cancel", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000003"))).Content.ReadFromJsonAsync<HoldResponse>();
            var resp = await _client.SendAsync(CreateCancelRequest(h!.HoldId, "66000000000000003"));
            Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
            Assert.Equal("CANCELLED", await GetReservationDbStatusAsync(h.HoldId));
        }

        // 4. EXPIRED -> Confirm (409 HOLD_EXPIRED, DB stays EXPIRED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix EXPIRED to Confirm", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000004"))).Content.ReadFromJsonAsync<HoldResponse>();
            await SetReservationExpiredInDbAsync(h!.HoldId);
            var resp = await _client.SendAsync(CreateConfirmRequest(h.HoldId, "66000000000000004"));
            Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
            var err = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.Equal("HOLD_EXPIRED", err!.Error.Code);
            var details = await _client.GetFromJsonAsync<HoldDetailsResponse>($"/holds/{h.HoldId}");
            Assert.Equal("EXPIRED", details!.Status);
        }

        // 5. EXPIRED -> Cancel (409 HOLD_EXPIRED, DB stays EXPIRED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix EXPIRED to Cancel", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000005"))).Content.ReadFromJsonAsync<HoldResponse>();
            await SetReservationExpiredInDbAsync(h!.HoldId);
            var resp = await _client.SendAsync(CreateCancelRequest(h.HoldId, "66000000000000005"));
            Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
            var err = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.Equal("HOLD_EXPIRED", err!.Error.Code);
            var details = await _client.GetFromJsonAsync<HoldDetailsResponse>($"/holds/{h.HoldId}");
            Assert.Equal("EXPIRED", details!.Status);
        }

        // 6. CANCELLED -> Confirm (409 HOLD_NOT_ACTIVE, DB stays CANCELLED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix CANCELLED to Confirm", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000006"))).Content.ReadFromJsonAsync<HoldResponse>();
            await _client.SendAsync(CreateCancelRequest(h!.HoldId, "66000000000000006"));
            var resp = await _client.SendAsync(CreateConfirmRequest(h.HoldId, "66000000000000006"));
            Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
            var err = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.Equal("HOLD_NOT_ACTIVE", err!.Error.Code);
            Assert.Equal("CANCELLED", await GetReservationDbStatusAsync(h.HoldId));
        }

        // 7. CONFIRMED -> Confirm (200 OK idempotent, DB stays CONFIRMED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix CONFIRMED to Confirm", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000007"))).Content.ReadFromJsonAsync<HoldResponse>();
            await _client.SendAsync(CreateConfirmRequest(h!.HoldId, "66000000000000007"));
            var resp = await _client.SendAsync(CreateConfirmRequest(h.HoldId, "66000000000000007"));
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
            Assert.Equal("CONFIRMED", await GetReservationDbStatusAsync(h.HoldId));
        }

        // 8. CONFIRMED -> Cancel (409 HOLD_ALREADY_CONFIRMED, DB stays CONFIRMED)
        {
            var cls = await TestHelpers.CreateClassAsync(_client, "Matrix CONFIRMED to Cancel", 3);
            var h = await (await _client.SendAsync(CreateHoldRequest(cls.Id, "66000000000000008"))).Content.ReadFromJsonAsync<HoldResponse>();
            await _client.SendAsync(CreateConfirmRequest(h!.HoldId, "66000000000000008"));
            var resp = await _client.SendAsync(CreateCancelRequest(h.HoldId, "66000000000000008"));
            Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
            var err = await resp.Content.ReadFromJsonAsync<ErrorResponse>();
            Assert.Equal("HOLD_ALREADY_CONFIRMED", err!.Error.Code);
            Assert.Equal("CONFIRMED", await GetReservationDbStatusAsync(h.HoldId));
        }

        // 9. CONFIRMED -> Expire (Must remain CONFIRMED, worker must not touch it)
        {
            await using var wf = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 1, expiryWorkerEnabled: true, expiryIntervalMs: 25);
            using var wc = wf.CreateClient();
            var cls = await TestHelpers.CreateClassAsync(wc, "Matrix CONFIRMED to Expire", 3);
            var h = await (await wc.SendAsync(CreateHoldRequest(cls.Id, "66000000000000009"))).Content.ReadFromJsonAsync<HoldResponse>();
            // Confirm immediately
            var confirmResp = await wc.SendAsync(CreateConfirmRequest(h!.HoldId, "66000000000000009"));
            Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);
            // Wait until the original 1s hold duration passes and multiple worker cycles run
            await Task.Delay(1300);
            // Must remain CONFIRMED
            Assert.Equal("CONFIRMED", await GetReservationDbStatusAsync(h.HoldId));
            var clsDetails = await wc.GetFromJsonAsync<ClassResponse>($"/classes/{cls.Id}");
            Assert.Equal(1, clsDetails!.ConfirmedSeats);
            Assert.Equal(0, clsDetails.HeldSeats);
            await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, Guid.Parse(cls.Id));
        }
    }

    [Fact]
    public async Task Get_my_holds_returns_only_requesting_students_holds_with_correct_structure_and_effective_status()
    {
        // Priority 6: GET /me/holds integration test
        await using var factory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 600, expiryWorkerEnabled: false);
        using var client = factory.CreateClient();

        var class1 = await TestHelpers.CreateClassAsync(client, "MyHolds Class 1", 5);
        var class2 = await TestHelpers.CreateClassAsync(client, "MyHolds Class 2", 5);
        var class3 = await TestHelpers.CreateClassAsync(client, "MyHolds Class 3", 5);

        const string studentA = "65000000000000001";
        const string studentB = "65000000000000002";

        // Hold 1 for Student A in Class 1: remains active HELD
        var reqA1 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{class1.Id}/holds");
        reqA1.Headers.Add("X-Student-Id", studentA);
        var respA1 = await client.SendAsync(reqA1);
        var holdA1 = await respA1.Content.ReadFromJsonAsync<HoldResponse>();

        // Hold 2 for Student A in Class 2: confirmed
        var reqA2 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{class2.Id}/holds");
        reqA2.Headers.Add("X-Student-Id", studentA);
        var respA2 = await client.SendAsync(reqA2);
        var holdA2 = await respA2.Content.ReadFromJsonAsync<HoldResponse>();

        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdA2!.HoldId}/confirm");
        confirmReq.Headers.Add("X-Student-Id", studentA);
        await client.SendAsync(confirmReq);

        // Hold 3 for Student A in Class 3: expired (force expired in DB)
        var reqA3 = new HttpRequestMessage(HttpMethod.Post, $"/classes/{class3.Id}/holds");
        reqA3.Headers.Add("X-Student-Id", studentA);
        var respA3 = await client.SendAsync(reqA3);
        var holdA3 = await respA3.Content.ReadFromJsonAsync<HoldResponse>();

        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(holdA3!.HoldId));
            await cmd.ExecuteNonQueryAsync();
        }

        // Hold for Student B in Class 1
        var reqB = new HttpRequestMessage(HttpMethod.Post, $"/classes/{class1.Id}/holds");
        reqB.Headers.Add("X-Student-Id", studentB);
        await client.SendAsync(reqB);

        // Act: GET /me/holds for Student A
        var myHoldsReq = new HttpRequestMessage(HttpMethod.Get, "/me/holds");
        myHoldsReq.Headers.Add("X-Student-Id", studentA);
        var myHoldsResp = await client.SendAsync(myHoldsReq);
        Assert.Equal(HttpStatusCode.OK, myHoldsResp.StatusCode);

        var myHolds = await myHoldsResp.Content.ReadFromJsonAsync<List<StudentHoldResponse>>();
        Assert.NotNull(myHolds);

        // 1. Verifies only that student's reservations are returned
        Assert.Equal(3, myHolds!.Count);

        var ids = myHolds.Select(h => h.HoldId).ToHashSet();
        Assert.Contains(holdA1!.HoldId, ids);
        Assert.Contains(holdA2.HoldId, ids);
        Assert.Contains(holdA3.HoldId, ids);

        // 2. Verifies hold IDs, class IDs, statuses, and expiresAt values
        var item1 = myHolds.Single(h => h.HoldId == holdA1.HoldId);
        Assert.Equal(class1.Id, item1.ClassId);
        Assert.Equal("MyHolds Class 1", item1.ClassName);
        Assert.Equal("HELD", item1.Status);
        Assert.False(string.IsNullOrWhiteSpace(item1.ExpiresAt));
        Assert.False(string.IsNullOrWhiteSpace(item1.CreatedAt));
        Assert.Null(item1.ConfirmedAt);
        Assert.False(string.IsNullOrWhiteSpace(item1.ServerTime));

        var item2 = myHolds.Single(h => h.HoldId == holdA2.HoldId);
        Assert.Equal(class2.Id, item2.ClassId);
        Assert.Equal("MyHolds Class 2", item2.ClassName);
        Assert.Equal("CONFIRMED", item2.Status);
        Assert.NotNull(item2.ConfirmedAt);

        // 3. Verifies expired reservations are not incorrectly presented as active
        var item3 = myHolds.Single(h => h.HoldId == holdA3.HoldId);
        Assert.Equal(class3.Id, item3.ClassId);
        Assert.Equal("MyHolds Class 3", item3.ClassName);
        Assert.Equal("EXPIRED", item3.Status);

        // 4. Response JSON structure matches API contract
        foreach (var h in myHolds)
        {
            Assert.True(Guid.TryParse(h.HoldId, out _));
            Assert.True(Guid.TryParse(h.ClassId, out _));
            Assert.True(DateTimeOffset.TryParse(h.ExpiresAt, out _));
            Assert.True(DateTimeOffset.TryParse(h.CreatedAt, out _));
            Assert.True(DateTimeOffset.TryParse(h.ServerTime, out _));
        }
    }

    [Fact]
    public async Task Full_lifecycle_sequence_preserves_counter_consistency_and_capacity_invariants()
    {
        // Priority 7: Sequence of hold, confirm, cancel, expire, duplicate confirm, repeated cancel
        await using var workerFactory = new ApiFactory(_db.ConnectionString, holdDurationSeconds: 3, expiryWorkerEnabled: true, expiryIntervalMs: 50);
        using var client = workerFactory.CreateClient();

        var classCreated = await TestHelpers.CreateClassAsync(client, "Full Lifecycle Consistency Class", 5);
        var classId = Guid.Parse(classCreated.Id);

        const string student1 = "67000000000000001";
        const string student2 = "67000000000000002";
        const string student3 = "67000000000000003";
        const string student4 = "67000000000000004";

        // Step 1: Hold creation
        var hold1Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold1Req.Headers.Add("X-Student-Id", student1);
        var hold1 = await (await client.SendAsync(hold1Req)).Content.ReadFromJsonAsync<HoldResponse>();

        var hold2Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold2Req.Headers.Add("X-Student-Id", student2);
        var hold2 = await (await client.SendAsync(hold2Req)).Content.ReadFromJsonAsync<HoldResponse>();

        var hold3Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold3Req.Headers.Add("X-Student-Id", student3);
        var hold3 = await (await client.SendAsync(hold3Req)).Content.ReadFromJsonAsync<HoldResponse>();

        var hold4Req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        hold4Req.Headers.Add("X-Student-Id", student4);
        var hold4 = await (await client.SendAsync(hold4Req)).Content.ReadFromJsonAsync<HoldResponse>();

        // Step 2: Confirmation of Student 1
        var confirmReq1 = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold1!.HoldId}/confirm");
        confirmReq1.Headers.Add("X-Student-Id", student1);
        var confirmResp1 = await client.SendAsync(confirmReq1);
        Assert.Equal(HttpStatusCode.OK, confirmResp1.StatusCode);

        // Step 3: Cancellation of Student 2
        var cancelReq2 = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold2!.HoldId}");
        cancelReq2.Headers.Add("X-Student-Id", student2);
        var cancelResp2 = await client.SendAsync(cancelReq2);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp2.StatusCode);

        // Step 4: Expiration of Student 3
        // Extend student 4 in DB so only student 3 expires
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() + interval '10 minutes' WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", Guid.Parse(hold4!.HoldId));
            await cmd.ExecuteNonQueryAsync();
        }
        await Task.Delay(3500); // Student 3 expires and worker reclaims it

        // Step 5: Duplicate confirmation for Student 1
        var dupConfirmReq = new HttpRequestMessage(HttpMethod.Post, $"/holds/{hold1.HoldId}/confirm");
        dupConfirmReq.Headers.Add("X-Student-Id", student1);
        var dupConfirmResp = await client.SendAsync(dupConfirmReq);
        Assert.Equal(HttpStatusCode.OK, dupConfirmResp.StatusCode);

        // Step 6: Repeated cancellation for Student 2
        var repeatCancelReq = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{hold2.HoldId}");
        repeatCancelReq.Headers.Add("X-Student-Id", student2);
        var repeatCancelResp = await client.SendAsync(repeatCancelReq);
        Assert.Equal(HttpStatusCode.NoContent, repeatCancelResp.StatusCode);

        // Direct PostgreSQL verification
        await using (var conn = new NpgsqlConnection(_db.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT held_seats, confirmed_seats, total_seats FROM classes WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", classId);
            await using var reader = await cmd.ExecuteReaderAsync();
            Assert.True(await reader.ReadAsync());
            var held = reader.GetInt32(0);
            var confirmed = reader.GetInt32(1);
            var total = reader.GetInt32(2);

            Assert.Equal(1, held);      // Only Student 4
            Assert.Equal(1, confirmed); // Only Student 1
            Assert.Equal(5, total);
            Assert.True(held + confirmed <= total, "Capacity invariant violated: heldSeats + confirmedSeats must be <= totalSeats.");
        }

        // Verify stored class counters equal actual reservation counts
        await TestHelpers.AssertDatabaseCountersMatchAsync(_db.ConnectionString, classId);
    }

    private static HttpRequestMessage CreateHoldRequest(string classId, string studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/classes/{classId}/holds");
        req.Headers.Add("X-Student-Id", studentId);
        return req;
    }

    private static HttpRequestMessage CreateConfirmRequest(string holdId, string studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, $"/holds/{holdId}/confirm");
        req.Headers.Add("X-Student-Id", studentId);
        return req;
    }

    private static HttpRequestMessage CreateCancelRequest(string holdId, string studentId)
    {
        var req = new HttpRequestMessage(HttpMethod.Delete, $"/holds/{holdId}");
        req.Headers.Add("X-Student-Id", studentId);
        return req;
    }

    private async Task<string> GetReservationDbStatusAsync(string holdId)
    {
        await using var conn = new NpgsqlConnection(_db.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT status FROM reservations WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", Guid.Parse(holdId));
        return (string)(await cmd.ExecuteScalarAsync())!;
    }

    private async Task SetReservationExpiredInDbAsync(string holdId)
    {
        await using var conn = new NpgsqlConnection(_db.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE reservations SET expires_at = clock_timestamp() - interval '1 second' WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", Guid.Parse(holdId));
        await cmd.ExecuteNonQueryAsync();
    }
}

