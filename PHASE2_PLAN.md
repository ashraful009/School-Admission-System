# PHASE2_PLAN.md — final plan (temporary file, merged into PROJECT_STATE.md by prompt S0.5, never committed)

## A. Final decisions

### Your answers (Q1 to Q17)
| # | Final decision |
|---|----------------|
| 1 | Edit class IS in scope. Add extra endpoint A9 `PUT /classes/{classId}` (additive, the contract stays intact). Total seats can never go below held + confirmed. UI: Edit button on Manage Classes, edit form reuses the Create Class page |
| 2 | Per class only (confirmed by user after a warning). One student may hold or confirm in several different classes. Classes are independent (D2 stays) |
| 3 | Repeat confirm on own CONFIRMED hold: 200 CONFIRMED, idempotent |
| 4 | Confirm: expired 409, another student's hold 404, CANCELLED 409 |
| 5 | DELETE: own HELD 204; own CANCELLED 204 (idempotent); CONFIRMED or EXPIRED 409; another student's 404 |
| 6 | Missing or invalid X-Student-Id 400; unknown hold or class 404; already applied in this class 409 with its own code |
| 7 | name trimmed, 1 to 100 chars; totalSeats integer 1 to 10000. Duplicate names ALLOWED (reason: reviewer automated tests may create classes with the same name against a persistent DB, a 409 would break them) |
| 8 | English UI, all strings in one `messages.ts` so Bangla can be added later |
| 9 | No fee amount shown |
| 10 | Vite + React 18 + TypeScript + **Tailwind CSS v4** (tokens in `@theme`). TanStack Query v5 for polling and mutations (D10) |
| 11 | xUnit + WebApplicationFactory + real PostgreSQL via Testcontainers, with a fallback (D12) |
| 12 | Frontend on host port 3000 |
| 13 | FCFS definition D5 confirmed. No `grant_seq` column |
| 14 | Read-consistency formula D6 confirmed. No lazy reclaim on GET |
| 15 | Top nav on every page has two links: "Student" and "Admin". Admin lives under `/admin` (Dashboard, Manage classes, Create class) with the admin left sidebar. Student pages use the student top bar |
| 16 | Extra fields added (allowed): `className`, `createdAt`, `confirmedAt`, `serverTime` on hold responses; `holdDurationSeconds` on class objects |
| 17 | All mockup corrections in section 11.3 of PROJECT_STATE.md apply, with these updates: item 3 (Edit button) now stays; item 5 now means "admin pages use the sidebar layout and the top nav has Student and Admin links" |

### New technical decisions (please approve with the plan)
- D8 IDs are UUIDs exposed as lowercase strings (DB `uuid`, `gen_random_uuid()`). A malformed id in a path is treated as unknown: 404, never 500.
- D9 Error body everywhere (also for 404 route, 405, 415): `{ "error": { "code": "<CODE>", "message": "<plain English>" } }`.
- D10 Frontend libraries: react-router-dom, TanStack Query v5, Tailwind v4, local fonts through `@fontsource` packages. No UI kit.
- D11 Time handling in the DB. Write paths compare with `clock_timestamp()` (not `now()`, which is frozen at transaction start and would be stale after a lock wait). `expires_at = date_trunc('second', clock_timestamp()) + HOLD_DURATION_SECONDS`, so the value shown in JSON equals the real deadline. Autocommit read statements may use `now()`.
- D12 Test database: Testcontainers by default; if env `TEST_CONNECTION_STRING` is set the tests use that PostgreSQL server instead (each test class creates its own temporary database). This lets README run the tests with Docker only, through a compose `tests` profile.
- D13 Create-hold improvement over the draft: after the reclaim step, check for the student's own HELD or CONFIRMED row in this class BEFORE grabbing a seat, so a student who already applied gets ALREADY_APPLIED_IN_CLASS even when the class is full. The unique index still protects against races.
- D14 Expiry worker settings from env: `EXPIRY_WORKER_ENABLED` (default true, tests switch it off), `EXPIRY_INTERVAL_MILLISECONDS` (default 1000), batch size 500.
- D15 Postgres `max_connections=200` in compose, Npgsql `Maximum Pool Size=50` per backend process (two processes for X1 must stay below the server limit).

## B. Final requirement list

Unchanged from PROJECT_STATE.md section 4: T1 to T7, B1 to B5, A1 to A8, R1 to R7, U1 to U6, X1, X2, D-1 to D-7.
Added by user decisions (NOT in the original brief, extras): **A9** `PUT /classes/{classId}`, **U7** Edit class from Manage Classes.
Corrections to earlier drafts: A5 needs no header; B4 identity chip with "Change" returns to the Identity page and clears the stored ID; R3 is per class (Q2); the create-hold algorithm uses D13 and D11.

## C. Architecture and folder tree

```
repo/
  docker-compose.yml  .env.example  .gitignore  .gitattributes  .editorconfig
  README.md  ASSUMPTIONS.md  AI_USAGE.md  PROJECT_STATE.md
  backend/
    SchoolAdmission.sln   Dockerfile   .dockerignore
    sql/verify.sql                       (consistency checks, S1)
    http/api.http                        (request examples, S2 onward)
    src/SchoolAdmission.Api/             Controllers, Middleware (ErrorHandling, StudentId), Dtos, Program.cs
    src/SchoolAdmission.Application/     ClassService, HoldService, interfaces (IClassStore, IHoldStore), errors
    src/SchoolAdmission.Domain/          Entities (AdmissionClass, Reservation), HoldStatus, rules
    src/SchoolAdmission.Infrastructure/  AppDbContext, Migrations, SQL stores (raw SQL), ExpiryWorker
    tests/SchoolAdmission.Tests/         fixtures (TestDatabase, ApiFactory), concurrency, lifecycle, expiry, validation
  frontend/
    Dockerfile  nginx.conf  docker-entrypoint.d/40-runtime-config.sh  public/config.js
    src/app/ (App, router, layouts)   src/api/ (client, errors, hooks)   src/shared/ (components, hooks, utils, messages.ts, styles)
    src/features/student/ (identity, classes, class-details, hold, my-applications)
    src/features/admin/ (dashboard, manage-classes, class-form)
```
Controllers contain no business logic and no SQL. Seat changes are raw SQL inside the Infrastructure stores; services only orchestrate and map outcomes to errors.

## D. Database schema (target for S1)

```sql
CREATE TABLE classes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(100) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  total_seats     integer     NOT NULL CHECK (total_seats >= 1),
  held_seats      integer     NOT NULL DEFAULT 0,
  confirmed_seats integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_classes_counters_nonneg CHECK (held_seats >= 0 AND confirmed_seats >= 0),
  CONSTRAINT ck_classes_capacity        CHECK (held_seats + confirmed_seats <= total_seats)
);

CREATE TABLE reservations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      uuid        NOT NULL REFERENCES classes(id),
  student_id    varchar(17) NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
  status        varchar(10) NOT NULL CHECK (status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  confirmed_at  timestamptz NULL,
  cancelled_at  timestamptz NULL,
  expired_at    timestamptz NULL
);

-- D2 / R3: one active or confirmed application per student per class, enforced under concurrency
CREATE UNIQUE INDEX ux_reservations_active_per_class
  ON reservations (class_id, student_id) WHERE status IN ('HELD','CONFIRMED');
-- expiry worker, reclaim, and effective-count reads (only scans HELD rows)
CREATE INDEX ix_reservations_expiry  ON reservations (expires_at) WHERE status = 'HELD';
-- /me/holds
CREATE INDEX ix_reservations_student ON reservations (student_id, created_at DESC);
```
Stored counters are conservative (never below the truth); effective numbers on reads subtract expired-but-unreleased HELD rows (D6).

## E. API table (every status code and error body)

Error body: `{ "error": { "code": "...", "message": "..." } }`. Codes: VALIDATION_ERROR 400, INVALID_STUDENT_ID 400, NOT_FOUND 404, METHOD_NOT_ALLOWED 405, UNSUPPORTED_MEDIA_TYPE 415, NO_SEATS_AVAILABLE 409, ALREADY_APPLIED_IN_CLASS 409, HOLD_EXPIRED 409, HOLD_NOT_ACTIVE 409 (cancelled), HOLD_ALREADY_CONFIRMED 409, TOTAL_SEATS_BELOW_OCCUPIED 409, INTERNAL_ERROR 500. Timestamps are ISO 8601 UTC with seconds, e.g. `2026-11-11T04:10:00Z`.

| # | Endpoint | Header | Success | Errors |
|---|----------|--------|---------|--------|
| A1 | POST /classes `{name,totalSeats}` | none | 201 `{id,name,totalSeats}` + `Location` | 400 VALIDATION_ERROR (missing or blank name, name over 100 chars, totalSeats missing, not an integer, under 1, over 10000, malformed JSON) |
| A2 | GET /classes | none | 200 array `{id,name,totalSeats,heldSeats,confirmedSeats,availableSeats,holdDurationSeconds}`, oldest first, `[]` if none | none |
| A3 | GET /classes/{classId} | none | 200 same object | 404 NOT_FOUND (unknown or malformed id) |
| A9 | PUT /classes/{classId} `{name,totalSeats}` (extra) | none | 200 same object as A3 | 400 VALIDATION_ERROR; 404 NOT_FOUND; 409 TOTAL_SEATS_BELOW_OCCUPIED (new total under held + confirmed after releasing expired holds) |
| A4 | POST /classes/{classId}/holds | X-Student-Id | 201 `{holdId,classId,studentId,status:"HELD",expiresAt,className,createdAt,serverTime}` | 400 INVALID_STUDENT_ID; 404 NOT_FOUND (class); 409 ALREADY_APPLIED_IN_CLASS; 409 NO_SEATS_AVAILABLE |
| A5 | GET /holds/{holdId} | none | 200 `{holdId,classId,status,expiresAt,className,createdAt,confirmedAt,serverTime}` (status is EXPIRED when HELD and past expiresAt) | 404 NOT_FOUND |
| A6 | POST /holds/{holdId}/confirm | X-Student-Id | 200 `{holdId,status:"CONFIRMED",classId,confirmedAt}`; repeat on own CONFIRMED hold also 200, counters untouched | 400 INVALID_STUDENT_ID; 404 NOT_FOUND (unknown, malformed, or someone else's); 409 HOLD_EXPIRED; 409 HOLD_NOT_ACTIVE (cancelled) |
| A7 | DELETE /holds/{holdId} | X-Student-Id | 204 (own HELD; own CANCELLED again also 204) | 400 INVALID_STUDENT_ID; 404 NOT_FOUND; 409 HOLD_ALREADY_CONFIRMED; 409 HOLD_EXPIRED |
| A8 | GET /me/holds | X-Student-Id | 200 array `{holdId,classId,className,status,expiresAt,createdAt,confirmedAt,serverTime}`, newest first, `[]` if none | 400 INVALID_STUDENT_ID |
| extra | GET /health | none | 200 `{status:"ok"}` | none |

`X-Student-Id` must match `^\d{17}$` exactly, otherwise 400 INVALID_STUDENT_ID. Any unexpected exception becomes 500 INTERNAL_ERROR with a safe message; request-level problems must never reach it. Env var defaults: HOLD_DURATION_SECONDS 600.

### Create hold algorithm (final, one transaction, READ COMMITTED)
1. Validate header; class must exist (404).
2. Reclaim expired HELD rows of this class: mark EXPIRED and decrement `held_seats` by the number reclaimed, in one statement.
3. If the student has a HELD or CONFIRMED row in this class: 409 ALREADY_APPLIED_IN_CLASS (D13).
4. `UPDATE classes SET held_seats = held_seats + 1 WHERE id=@c AND held_seats + confirmed_seats < total_seats RETURNING ...`; no row: 409 NO_SEATS_AVAILABLE.
5. INSERT the reservation (`expires_at` per D11). SQLSTATE 23505: rollback, 409 ALREADY_APPLIED_IN_CLASS.
6. Commit, 201. Confirm, cancel, expiry worker and edit follow the patterns in PROJECT_STATE.md section 7 with `clock_timestamp()`.

## F. Traceability matrix (requirement -> section -> proof)

| ID | Implemented in | Proof (test or check) |
|----|----------------|-----------------------|
| T1, T2 | S0, S1, S7 | Builds in Docker; README |
| T3 | S0, S17 | `curl /health`; env table in README |
| T4 | S0 | `config.js` changes with `API_URL`, no rebuild (S0 check 7) |
| T5 | S0, S17 | Fresh clone, only `docker compose up --build` (S17 check) |
| T6, T7 | S18 | AI_USAGE.md, ASSUMPTIONS.md exist and are complete |
| B1 | S2 | Test `Classes_are_independent` |
| B2 | S3, S6 | Test `Sequential_first_request_wins` |
| B3 | S3, S4, S5 | Lifecycle tests (confirm, cancel, expiry) |
| B4 | S2, S8 | Header tests; UI manual check |
| B5 | S4, S11 | Confirm test; UI manual check |
| A1 to A3, A9 | S2 | `http/api.http` + `Classes_api_*` tests, `Edit_cannot_go_below_occupied` |
| A4 | S3 | `Concurrency_1000_requests_10_seats` |
| A5 to A8 | S4 | `Hold_lifecycle_*` tests |
| R1 | S1 (CHECK), S3 | `Concurrency_1000_requests_10_seats`, `sql/verify.sql` |
| R2 | S5 | `Expired_hold_returns_seat_without_api_call` |
| R3 | S1 (index), S3 | `Same_student_50_parallel_holds_create_one`, `Same_student_can_hold_different_classes` |
| R4 | S4 | `Confirm_expired_409`, `Confirm_other_students_hold_404` |
| R5 | S4 | `Confirm_twice_counts_once` (also parallel) |
| R6 | S17 | `down` then `up` check |
| R7 | S2 to S4 | `Invalid_inputs_never_return_500` (table-driven) |
| Read consistency (D6) | S2, S5 | `Reads_are_correct_with_worker_disabled` |
| Confirm vs expire | S5, S6 | `Confirm_vs_expire_one_winner` |
| U1 to U6, U7 | S8 to S16 | Manual checklist in S16 and S18 |
| X1 | S19 | Two-process test script; ASSUMPTIONS.md |
| X2 | S19 | `npm test` |
| D-1 to D-7 | S0, S17, S18 | S18 final check |

## G. Roadmap (prompts are in SECTION_PROMPTS.md)

S0 scaffold (running or done) · S0.5 merge this plan into PROJECT_STATE.md · S1 schema and migrations · S2 classes API with edit, errors, header · S3 create hold · S4 hold read, confirm, cancel, my holds · S5 expiry worker · S6 backend tests · S7 frontend foundation and design gallery (STOP for your approval) · S8 identity page · S9 student dashboard · S10 class details · S11 hold page · S12 my applications · S13 admin shell and dashboard · S14 manage classes · S15 create and edit class · S16 cross-cutting states · S17 Docker finalisation and README · S18 docs and full validation · S19 bonus.

## H. Risks to watch (time left at plan time: about 40 hours)

- Deadline is tight. Backend (S1 to S6) first, then UI. Bonus S19 only if time remains.
- Tests inside Docker with Testcontainers need the Docker socket; D12 gives a compose-based fallback.
- Postgres connection limits vs pool size (D15).
- Windows line endings break shell scripts in containers (`.gitattributes` handles it).
- The hot class row serialises writers by design; README explains the trade-off.
