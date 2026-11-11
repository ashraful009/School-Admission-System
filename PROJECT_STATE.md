# PROJECT_STATE.md — School Admission System (living file)

> READ THIS WHOLE FILE FIRST in every new chat or task. It is the single source of truth for the project.
> UPDATE IT at the END of every task (rules in section 0). Never paste the assignment document's text into this repo.

## 0. How to use this file

0.1 Start of every task: read this file completely, then do only the task you were given.
0.2 End of every task (mandatory, before your final answer), update in place:
- Section 1 (Snapshot): timestamp, last finished section, next section.
- Section 12 (Roadmap): tick the finished section.
- Section 15 (Change log): append one row (date-time, section, what changed, main files).
- Section 5 (Decisions / Open questions): record any answer the user gave or any decision that changed.
- Section 16 (Known issues), section 17 (AI mistakes), section 18 (How to run): only if something changed.
0.3 Timestamps: run `TZ=Asia/Dhaka date '+%Y-%m-%d %H:%M'` (do not guess the time).
0.4 Keep it compact and correct. Edit existing lines, do not duplicate. No secrets or passwords except the local dev defaults already in docker-compose.
0.5 If this file and the user's latest message disagree, the user's latest message wins; then fix this file.

## 1. Snapshot

- Last updated: 2026-11-11 15:46
- Current phase: Phase 3 (implementation). S19 complete + Bangla/English i18n switcher implemented.
- Last finished section: S19 + Bangla/English i18n support (navbar toggle, full UI & error messages in BN/EN, 35 frontend tests passing, 50 backend tests passing)
- Next section: none planned (only fixes or final review if the user asks)
- Hard deadline: 2026-11-11 23:59 (Asia/Dhaka assumed). The repository state at the deadline is graded; later commits are ignored. Aim to finish all must-haves by 2026-11-11 18:00.

## 2. Roles and hard rules

You are a senior full-stack engineer and mentor (.NET 8, PostgreSQL, React). The user builds a take-home assignment for an Assistant Software Engineer role. Goal: a correct, reproducible, well-tested system that shows strong backend and concurrency knowledge.

- Language: the user writes Banglish (Bengali in English letters). Reply to the user in the same style. Keep technical terms, code, comments, commit messages and all documentation in English.
- Rule 1: Do NOT assume anything silently. If a requirement is unclear, ask. Where a default is proposed, mark it PROPOSED and wait for confirmation before relying on it.
- Rule 2: Work in small sections, one section per task. Stop after each one. Do not generate the whole project at once.
- Rule 3: Follow the API contract and mandatory rules exactly. Never remove or rename a response field (adding fields is allowed).
- Rule 4: Keep it simple (2-day assignment). No microservices, no CQRS, no extra layers or libraries the requirements do not need. UI beauty is not graded; correctness and ease of use are.
- Rule 5: Every section ends with: files created or changed; how to run and test; a Definition-of-Done checklist; the requirement IDs it satisfies; a suggested Git commit message; a short note for AI_USAGE.md if an AI mistake was found. Do not run `git commit` or `git push` unless the user says so.
- Rule 6: Never put the assignment document or its text verbatim in the repository, README or this file. Do not include the company name, the submission link or contact details anywhere in the repo.

## 3. Project overview (own words)

A private school opens online admission. First come, first served, no lottery. Each class shift (for example "Class 6 - Morning Shift") is its own class with a limited number of seats, and thousands of guardians may apply at the same moment. Applying holds a seat for a limited time. Paying the admission fee inside that time confirms the admission. If time runs out, the seat returns to the pool automatically. We build a C# / .NET 8 / PostgreSQL backend and a React UI. Admin and guardians do everything from the UI. Output: a public GitHub repo where `docker compose up` alone starts PostgreSQL, backend and frontend. Reviewers also run automated tests directly against the API, so the contract must be followed exactly.

## 4. Requirements (traceable IDs)

Technology and environment
- T1 Backend C# (.NET 8+) + PostgreSQL. ORM is our choice (decision D1).
- T2 Frontend React 18+, JS or TS, Vite recommended, UI library our choice.
- T3 Backend runs at http://localhost:8080. DB connection changeable by environment variable.
- T4 Frontend's backend URL changeable by environment variable.
- T5 Whole project runs in Docker. Root docker-compose.yml. Reviewers have only Docker installed.
- T6 AI tools allowed, documented in AI_USAGE.md.
- T7 Where the brief is silent, make a reasonable assumption and write it with the reason in ASSUMPTIONS.md.

Business model
- B1 Each class shift is a separate class with its own seat count.
- B2 First come, first served (decision D5). No queue, no lottery.
- B3 Applying creates a HELD hold for a limited time. Paying in time makes it CONFIRMED. Otherwise the seat is released.
- B4 No login. UI asks for the student's 17-digit birth registration number and uses it as identity. API receives it in header `X-Student-Id`. Identity chip with "Change" returns to the Identity page and clears the stored ID.
- B5 Payment is simulated. Pressing "Pay admission fee" means success. No gateway.

API contract (exact). Base URL http://localhost:8080, JSON. IDs like c_123 / h_789 are examples only; our format is free.
- A1 `POST /classes` body `{name, totalSeats}` -> 201 `{id, name, totalSeats}` + `Location`
- A2 `GET /classes` -> 200 array of `{id, name, totalSeats, heldSeats, confirmedSeats, availableSeats, holdDurationSeconds}`
- A3 `GET /classes/{classId}` -> 200 same object
- A4 `POST /classes/{classId}/holds` header `X-Student-Id` -> 201 `{holdId, classId, studentId, status:"HELD", expiresAt, className, createdAt, serverTime}`; 409 when no seat or already applied
- A5 `GET /holds/{holdId}` -> 200 `{holdId, classId, status, expiresAt, className, createdAt, confirmedAt, serverTime}`; status in HELD, CONFIRMED, EXPIRED, CANCELLED (no header required)
- A6 `POST /holds/{holdId}/confirm` header `X-Student-Id` -> 200 `{holdId, status:"CONFIRMED", classId, confirmedAt}`
- A7 `DELETE /holds/{holdId}` header `X-Student-Id` -> 204
- A8 `GET /me/holds` header `X-Student-Id` -> 200 array of `{holdId, classId, className, status, expiresAt, createdAt, confirmedAt, serverTime}`
- A9 `PUT /classes/{classId}` body `{name, totalSeats}` -> 200 same object as A3 (extra, not in original brief; totalSeats cannot go below held + confirmed)
- expiresAt format: ISO 8601 UTC with second precision, e.g. 2026-11-11T04:10:00Z.

Mandatory backend rules
- R1 heldSeats + confirmedSeats never exceeds totalSeats, however many requests arrive at once.
- R2 Hold duration from env `HOLD_DURATION_SECONDS` (default 600). After expiry the seat returns by itself; nobody calls any API.
- R3 A student cannot have more than one active hold or confirmed admission in the same class at the same time (per class rule, Q2/D2).
- R4 Only the student's own, not-yet-expired HELD hold can be confirmed.
- R5 Confirming the same hold several times increases confirmedSeats exactly once (idempotent 200).
- R6 No data lost after `docker compose down` then `docker compose up` (named volume).
- R7 (implicit) Invalid input returns 4xx, never 500. availableSeats = totalSeats - heldSeats - confirmedSeats.

Mandatory UI rules
- U1 Everything from the UI. No Postman, no direct DB.
- U2 When the hold time ends, the app shows EXPIRED and disables "Pay admission fee" without page reload.
- U3 Class seat numbers update by themselves every few seconds without reload (polling).
- U4 After refresh or closing and reopening the browser, the student still sees their running applications (remember the ID in localStorage; load from GET /me/holds).
- U5 Every error (no seat, hold expired, invalid input, server down) is shown in plain language. No blank page, no console-only errors.
- U6 Screens: create class (admin: name + seats); class list (total, held, confirmed, available, Apply button); application (status, time left, Pay, Cancel); my applications (all with status).
- U7 Edit class from Manage Classes (extra, not in original brief; reuses create class form, totalSeats cannot go below held + confirmed).

Bonus: X1 two backend processes on different ports against the same DB never exceed totalSeats (explain in ASSUMPTIONS.md). X2 frontend automated test(s).

Deliverables
- D-1 Git repo with real incremental commit history; folders backend/ and frontend/.
- D-2 Dockerfile for backend and frontend; root docker-compose.yml.
- D-3 README.md: how to run with Docker, frontend URL, how to run tests.
- D-4 ASSUMPTIONS.md (short).
- D-5 At least 3 automated backend tests, one of them a concurrency test.
- D-6 AI_USAGE.md (short): tool, which part, where AI was wrong, how it was caught.
- D-7 Public GitHub repo submitted before the deadline. The assignment document is not shared.

## 5. Decisions and open questions

### Decided (Architectural & Technical)
- D1 EF Core (Npgsql) plus raw SQL for the conditional updates. Prisma is a Node ORM and must NOT be used.
- D2 Active-hold rule is PER CLASS, exactly as the requirement says: one student may have at most ONE active (HELD) or CONFIRMED application in the same class. Classes are independent (a student may hold Class 6 Morning and Class 7 Morning together, and Class 6 Morning and Class 6 Day together). After cancel or expiry the student may apply to that class again. Enforce with ONE partial unique index on (class_id, student_id) WHERE status IN ('HELD','CONFIRMED'); return a distinct 409 error code when hit. Do NOT add a global one-hold-per-student limit.
- D3 Shift is not a column. UI composes name "Class 6 - Morning Shift" from a class field and a shift dropdown. API only takes `name`.
- D4 Student ID validated as exactly 17 digits `^\d{17}$`, stored as string.
- D5 FCFS definition: a request that completes before another starts always wins; truly simultaneous requests are ordered by the class row lock; commit order is grant order. No queue (the contract is synchronous). Document in ASSUMPTIONS.md and README.
- D6 Read consistency: reads return effective counts and statuses that already subtract expired-but-unreleased holds (formula in section 7). Worker and create-hold reclaim only bring stored counters up to date.
- D7 student_id column is varchar(17) with CHECK (student_id ~ '^[0-9]{17}$'), not char(17).
- D8 IDs are UUIDs exposed as lowercase strings (DB `uuid`, `gen_random_uuid()`). A malformed id in a path is treated as unknown: 404, never 500.
- D9 Error body everywhere (also for 404 route, 405, 415): `{ "error": { "code": "<CODE>", "message": "<plain English>" } }`.
- D10 Frontend libraries: react-router-dom, TanStack Query v5, Tailwind CSS v4, local fonts through `@fontsource` packages. No UI kit.
- D11 Time handling in the DB. Write paths compare with `clock_timestamp()` (not `now()`, which is frozen at transaction start and would be stale after a lock wait). `expires_at = date_trunc('second', clock_timestamp()) + make_interval(secs => HOLD_DURATION_SECONDS)`, so the value shown in JSON equals the real deadline. Autocommit read statements may use `now()`.
- D12 Test database: Testcontainers by default; if env `TEST_CONNECTION_STRING` is set the tests use that PostgreSQL server instead (each test class creates its own temporary database). This lets README run the tests with Docker only, through a compose `tests` profile.
- D13 Create-hold improvement over the draft: after the reclaim step, check for the student's own HELD or CONFIRMED row in this class BEFORE grabbing a seat, so a student who already applied gets ALREADY_APPLIED_IN_CLASS even when the class is full. The unique index still protects against races.
- D14 Expiry worker settings from env: `EXPIRY_WORKER_ENABLED` (default true, tests switch it off), `EXPIRY_INTERVAL_MILLISECONDS` (default 1000), batch size 500.
- D15 Postgres `max_connections=200` in compose, Npgsql `Maximum Pool Size=50` per backend process (two processes for X1 must stay below the server limit).
- D16 (S19) X1 test: compose profile `x1` adds `backend2` (host 8081, same db, worker enabled, starts after `backend` is healthy) and `x1-test` (node:20-alpine running `scripts/x1-two-process-test.mjs`, so only Docker is needed). X2: Vitest 5 + React Testing Library + jsdom, config in `frontend/vitest.config.ts`, `npm test` = `vitest run`. Vitest 5 chosen over 3 because `npm audit` flagged vitest 3 / tinypool advisories (dev-only); Vitest 5 is compatible with Vite 6.4.

### Questions (Q1 to Q17) — All DECIDED
| # | Question / Topic | Final Decision | Status |
|---|------------------|----------------|--------|
| Q1 | Edit class? Contract has no PUT/PATCH | Edit class IS in scope. Add extra endpoint A9 `PUT /classes/{classId}` (additive, the contract stays intact). Total seats can never go below held + confirmed. UI: Edit button on Manage Classes, edit form reuses the Create Class page. | DECIDED |
| Q2 | One student may hold CONFIRMED in several classes? | Per class only (confirmed by user after a warning). One student may hold or confirm in several different classes. Classes are independent (D2 stays). | DECIDED |
| Q3 | Repeat confirm on own CONFIRMED hold | Repeat confirm on own CONFIRMED hold returns 200 CONFIRMED, idempotent, counters untouched. | DECIDED |
| Q4 | Confirm expired hold / another student's hold / CANCELLED hold | Expired returns 409 (HOLD_EXPIRED); another student's hold returns 404 (NOT_FOUND); CANCELLED returns 409 (HOLD_NOT_ACTIVE). | DECIDED |
| Q5 | DELETE own HELD / already CANCELLED / CONFIRMED or EXPIRED / other's hold | Own HELD returns 204; own CANCELLED returns 204 (idempotent); CONFIRMED returns 409 (HOLD_ALREADY_CONFIRMED); EXPIRED returns 409 (HOLD_EXPIRED); another student's returns 404 (NOT_FOUND). | DECIDED |
| Q6 | Missing or invalid X-Student-Id; unknown hold or class; student already holds in this class | Missing or invalid header returns 400 (INVALID_STUDENT_ID); unknown hold or class returns 404 (NOT_FOUND); student already applied returns 409 (ALREADY_APPLIED_IN_CLASS). | DECIDED |
| Q7 | POST /classes validation; duplicate names | name trimmed, 1 to 100 chars; totalSeats integer 1 to 10000. Duplicate names ALLOWED (reason: reviewer automated tests may create classes with the same name against a persistent DB, a 409 would break them). | DECIDED |
| Q8 | UI language | English UI, all strings in one `messages.ts` so Bangla can be added later. | DECIDED |
| Q9 | Admission fee amount | No fee amount shown (spec has none). | DECIDED |
| Q10 | Frontend tooling | Vite + React 18 + TypeScript + Tailwind CSS v4 (tokens in `@theme`). TanStack Query v5 for polling and mutations (D10). | DECIDED |
| Q11 | Test strategy | xUnit + WebApplicationFactory + real PostgreSQL via Testcontainers, with fallback to TEST_CONNECTION_STRING (D12). | DECIDED |
| Q12 | Frontend port in Docker | 3000 | DECIDED |
| Q13 | FCFS: confirm D5; add optional grant_seq audit column? | Confirm D5; no `grant_seq` column. | DECIDED |
| Q14 | Read consistency: confirm D6 formula; lazy reclaim on every GET not used | Confirm D6 formula. No lazy reclaim on GET. | DECIDED |
| Q15 | How does the admin reach admin pages (no login)? | Top nav on every page has two links: "Student" and "Admin". Admin lives under `/admin` (Dashboard, Manage classes, Create class) with the admin left sidebar. Student pages use the student top bar. No auth. | DECIDED |
| Q16 | Extra response fields (allowed by contract) | Add `className`, `createdAt`, `confirmedAt`, `serverTime` on hold responses; add `holdDurationSeconds` on class objects. | DECIDED |
| Q17 | Mockup corrections listed in section 11.3 | All mockup corrections in section 11.3 apply, with these updates: item 3 (Edit button) now stays; item 5 now means "admin pages use the sidebar layout and the top nav has Student and Admin links". | DECIDED |

### S0-only technical choices (PROPOSED, made by the agent in S0, to be recorded in ASSUMPTIONS.md)
- Frontend backend URL via runtime `config.js` written at container start from env `API_URL` (no rebuild needed to change it); in `vite dev` fall back to `VITE_API_URL`, then http://localhost:8080.
- CORS allowed origins from env `Cors__AllowedOrigins` (default http://localhost:3000).
- Line endings forced to LF (.gitattributes) so shell scripts work in containers.

## 6. API behaviour and error codes (final from Phase 2)

Error body: `{ "error": { "code": "<CODE>", "message": "<plain English>" } }`

Codes:
- `VALIDATION_ERROR` (400)
- `INVALID_STUDENT_ID` (400)
- `NOT_FOUND` (404)
- `METHOD_NOT_ALLOWED` (405)
- `UNSUPPORTED_MEDIA_TYPE` (415)
- `NO_SEATS_AVAILABLE` (409)
- `ALREADY_APPLIED_IN_CLASS` (409)
- `HOLD_EXPIRED` (409)
- `HOLD_NOT_ACTIVE` (409 - cancelled)
- `HOLD_ALREADY_CONFIRMED` (409)
- `TOTAL_SEATS_BELOW_OCCUPIED` (409)
- `INTERNAL_ERROR` (500)

Timestamps are ISO 8601 UTC with seconds, e.g. `2026-11-11T04:10:00Z`.

| # | Endpoint | Header | Success | Errors |
|---|----------|--------|---------|--------|
| A1 | `POST /classes` `{name, totalSeats}` | none | 201 `{id, name, totalSeats}` + `Location` | 400 VALIDATION_ERROR (missing or blank name, name over 100 chars, totalSeats missing, not an integer, under 1, over 10000, malformed JSON) |
| A2 | `GET /classes` | none | 200 array `{id, name, totalSeats, heldSeats, confirmedSeats, availableSeats, holdDurationSeconds}`, oldest first, `[]` if none | none |
| A3 | `GET /classes/{classId}` | none | 200 same object | 404 NOT_FOUND (unknown or malformed id) |
| A9 | `PUT /classes/{classId}` `{name, totalSeats}` (extra) | none | 200 same object as A3 | 400 VALIDATION_ERROR; 404 NOT_FOUND; 409 TOTAL_SEATS_BELOW_OCCUPIED (new total under held + confirmed after releasing expired holds) |
| A4 | `POST /classes/{classId}/holds` | `X-Student-Id` | 201 `{holdId, classId, studentId, status:"HELD", expiresAt, className, createdAt, serverTime}` | 400 INVALID_STUDENT_ID; 404 NOT_FOUND (class); 409 ALREADY_APPLIED_IN_CLASS; 409 NO_SEATS_AVAILABLE |
| A5 | `GET /holds/{holdId}` | none | 200 `{holdId, classId, status, expiresAt, className, createdAt, confirmedAt, serverTime}` (status is EXPIRED when HELD and past expiresAt) | 404 NOT_FOUND |
| A6 | `POST /holds/{holdId}/confirm` | `X-Student-Id` | 200 `{holdId, status:"CONFIRMED", classId, confirmedAt}`; repeat on own CONFIRMED hold also 200, counters untouched | 400 INVALID_STUDENT_ID; 404 NOT_FOUND (unknown, malformed, or someone else's); 409 HOLD_EXPIRED; 409 HOLD_NOT_ACTIVE (cancelled) |
| A7 | `DELETE /holds/{holdId}` | `X-Student-Id` | 204 (own HELD; own CANCELLED again also 204) | 400 INVALID_STUDENT_ID; 404 NOT_FOUND; 409 HOLD_ALREADY_CONFIRMED; 409 HOLD_EXPIRED |
| A8 | `GET /me/holds` | `X-Student-Id` | 200 array `{holdId, classId, className, status, expiresAt, createdAt, confirmedAt, serverTime}`, newest first, `[]` if none | 400 INVALID_STUDENT_ID |
| extra | `GET /health` | none | 200 `{status:"ok"}` | none |

`X-Student-Id` must match `^\d{17}$` exactly, otherwise 400 INVALID_STUDENT_ID. Any unexpected exception becomes 500 INTERNAL_ERROR with a safe message; request-level problems must never reach it. Env var defaults: `HOLD_DURATION_SECONDS=600`.

### Create hold algorithm (final, one transaction, READ COMMITTED)
1. Validate header; class must exist (404).
2. Reclaim expired HELD rows of this class: mark EXPIRED and decrement `held_seats` by the number reclaimed, in one statement using `clock_timestamp()`.
3. Pre-check (D13): If the student has a HELD or CONFIRMED row in this class: 409 ALREADY_APPLIED_IN_CLASS.
4. `UPDATE classes SET held_seats = held_seats + 1 WHERE id=@c AND held_seats + confirmed_seats < total_seats RETURNING ...`; no row: 409 NO_SEATS_AVAILABLE.
5. INSERT the reservation (`expires_at` per D11). SQLSTATE 23505: rollback, 409 ALREADY_APPLIED_IN_CLASS.
6. Commit, 201. Confirm, cancel, expiry worker and edit follow the patterns in Section 7 with `clock_timestamp()`.

## 7. Backend business logic (the core)

All time comparisons in write paths use `clock_timestamp()` (D11), never the app clock and not `now()` (which is frozen at transaction start and would be stale after a lock wait). Autocommit read statements may use `now()`. `expires_at = date_trunc('second', clock_timestamp()) + make_interval(secs => HOLD_DURATION_SECONDS)`. Default READ COMMITTED is enough because each seat change is a single-row conditional UPDATE: the row lock serialises writers and the WHERE clause is re-checked after the lock. Lock the class row first, ordered by id when several rows.

FCFS (D5): atomic conditional UPDATE guarantees no oversell and no lottery, not strict arrival FIFO. A request completing before another starts always wins; simultaneous requests are ordered by row lock; no queue. Add one test: 1 seat, two sequential requests, first 201, second 409.

Create hold (one transaction, READ COMMITTED):
1. Validate `X-Student-Id` header (400 if missing or not 17 digits); class must exist (404).
2. Reclaim expired HELD holds of THIS class from any student: one statement marking them EXPIRED and decrementing `held_seats` by the count reclaimed (the worker may be late; an expired hold must not block the unique index or hide seats). Time comparison uses `clock_timestamp()`.
3. Pre-check (D13): check for the student's own HELD or CONFIRMED row in this class BEFORE grabbing a seat, so a student who already applied gets 409 ALREADY_APPLIED_IN_CLASS even when the class is full.
4. `UPDATE classes SET held_seats = held_seats + 1 WHERE id=@c AND held_seats + confirmed_seats < total_seats RETURNING id`. No row: rollback, 409 NO_SEATS_AVAILABLE.
5. INSERT reservation HELD with `expires_at = date_trunc('second', clock_timestamp()) + make_interval(secs => HOLD_DURATION_SECONDS)`. Unique violation (SQLSTATE 23505 on `ux_reservations_active_per_class`): rollback, 409 ALREADY_APPLIED_IN_CLASS.
6. Commit, return 201.

Confirm (one transaction):
`UPDATE reservations SET status='CONFIRMED', confirmed_at=clock_timestamp() WHERE id=@h AND student_id=@s AND status='HELD' AND expires_at > clock_timestamp() RETURNING class_id`; if a row returns, `UPDATE classes SET held_seats = held_seats - 1, confirmed_seats = confirmed_seats + 1 WHERE id=@class_id`. If no row, inspect the hold:
- Own CONFIRMED -> 200 (idempotent, counters untouched).
- Expired (`expires_at <= clock_timestamp()`) -> 409 HOLD_EXPIRED.
- Cancelled (`status = 'CANCELLED'`) -> 409 HOLD_NOT_ACTIVE.
- Not found or someone else's -> 404 NOT_FOUND.

Cancel (one transaction):
`UPDATE reservations SET status='CANCELLED', cancelled_at=clock_timestamp() WHERE id=@h AND student_id=@s AND status='HELD' AND expires_at > clock_timestamp() RETURNING class_id`; if row returns, `UPDATE classes SET held_seats = held_seats - 1 WHERE id=@class_id`. If no row:
- Own CANCELLED -> 204 (idempotent).
- Own CONFIRMED -> 409 HOLD_ALREADY_CONFIRMED.
- Expired -> 409 HOLD_EXPIRED.
- Not found or someone else's -> 404 NOT_FOUND.

Expiry:
A BackgroundService (`ExpiryWorker`, D14) runs about every 1 second (configurable via `EXPIRY_INTERVAL_MILLISECONDS`, can be disabled for tests via `EXPIRY_WORKER_ENABLED=false`). In a transaction select expired HELD rows `FOR UPDATE SKIP LOCKED` in batches (batch size 500), mark EXPIRED (`expired_at = clock_timestamp()`), decrement `held_seats` per class. Safe with several backend processes (X1) and against the confirm-versus-expire race (exactly one wins).

Read consistency (D6):
Reads are read-only, one SQL statement (one snapshot). expiredHeld(class) = count of reservations with status HELD and expires_at <= now(). heldSeats = held_seats - expiredHeld; availableSeats = totalSeats - heldSeats - confirmedSeats. Example: total 10, stored held_seats 5, one expired-unreleased, 0 confirmed -> heldSeats 4, availableSeats 6. In GET /holds/{id} and /me/holds, status is EXPIRED when stored status is HELD and expires_at <= now(). Stored counters stay conservative so the CHECK constraint stays safe.

Errors:
Global middleware maps validation to 400, not found to 404, conflicts to 409, method not allowed to 405, unsupported media to 415, unexpected to a safe 500 JSON body. Tune pool size and timeouts so 1000 simultaneous requests give only 201 or 409.

README design section must explain: single-statement conditional update vs SELECT FOR UPDATE, optimistic concurrency and retry storms, counters vs COUNT(*), hot-row trade-off, why the DB CHECK exists. X1 (two processes) is safe because correctness lives in the database row lock and conditional UPDATE, not in app memory.

## 8. Architecture

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

Stack & layers:
- Backend: C# / .NET 8, ASP.NET Core, EF Core (Npgsql) + raw SQL inside Infrastructure stores, xUnit + WebApplicationFactory + Testcontainers (with fallback to TEST_CONNECTION_STRING per D12).
- Frontend: Vite + React 18 + TypeScript, Tailwind CSS v4 (design tokens configured via `@theme`), TanStack Query v5 (polling and mutations per D10), react-router-dom, `@fontsource` packages for local typography (Poppins, Inter).
- Controllers contain no business logic and no SQL. Seat changes are raw SQL inside the Infrastructure stores; services only orchestrate and map outcomes to errors.

## 9. Database schema (target for S1)

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

Stored counters are conservative (never below the truth); effective numbers on reads subtract expired-but-unreleased HELD rows (D6). No Students table, no events table.

## 10. Docker and environment

Services: `db` (postgres:16, named volume for /var/lib/postgresql/data, healthcheck, `max_connections=200` per D15), `backend` (port 8080, waits for healthy db, migrations at startup with retry, pool size 50), `frontend` (nginx serving the Vite build, host port 3000). Env: `ConnectionStrings__Default`, `HOLD_DURATION_SECONDS=600`, `ASPNETCORE_URLS`, `Cors__AllowedOrigins`, frontend `API_URL`. Optional compose profile with a second backend on 8081 for X1 (S19). No manual step after `docker compose up`.

## 11. Frontend and UI

11.1 Pages & Navigation.
- Top navigation on every page: two links — "Student" and "Admin".
- Student navigation: student top bar (Classes, My applications, ID chip with Change).
- Admin navigation: lives under `/admin` (Dashboard, Manage classes, Create class) with the admin left sidebar.
- Student pages (5):
  1. Identity (17-digit birth registration number entry).
  2. Dashboard (summary tiles, active-hold card with countdown, class cards with seat bar and Apply).
  3. Class Details.
  4. Application/Hold (countdown ring, class summary, Pay, Cancel, expired and confirmed states).
  5. My Applications (HELD / CONFIRMED / EXPIRED / CANCELLED pills and actions).
- Admin pages (3):
  1. Dashboard.
  2. Manage Classes (table with Edit button).
  3. Create / Edit Class (class field, shift dropdown, total seats, live preview; edit mode reuses this form).

11.2 Behaviour. Polling about every 5 s for classes and the student's holds; countdown driven by expiresAt with clock-skew correction (response Date header or serverTime); at zero show EXPIRED, disable Pay, refetch; one central API client with error-to-message mapping; global banner for server-down; loading, empty and error states on every list.

11.3 Mockup corrections (the 8 mockup images are the visual source of truth for layout and style; these items are NOT requirements or are wrong):
1. Class Details says "hold one seat at a time across all classes": WRONG vs D2. Use "You can hold one seat per class at a time."
2. Hold page shows "Admission fee BDT 5,000": placeholder, remove (Q9).
3. Manage Classes shows an Edit button: Edit button stays (A9 / U7). Total seats cannot go below held + confirmed.
4. Dashboard "Seats left today 244" does not match the tiles (the six classes sum to 75 available): compute the real sum of availableSeats. "Good morning" is static: use a neutral greeting.
5. Manage Classes and Create Class mockups show the student top bar: admin pages use the admin sidebar layout under `/admin`, and the top nav has Student and Admin links.
6. Dashboard "Your active hold" is a single tile, but a student can have several active holds (one per class): show the soonest-expiring HELD with "+N more", and a "No active hold" state.
7. Class Details "10 minutes" is hard-coded: derive from the hold duration (holdDurationSeconds, Q16).
8. Hold page "Hold started" needs createdAt; My Applications "Paid 09 Nov, 11:20 AM" needs confirmedAt: extra fields (Q16).
9. On the Class Details page, if the student already has an active or confirmed application in that class, show a disabled "Already applied" state; the UI must also handle the 409 code.
10. My Applications: EXPIRED shows "Apply again" (kept); CANCELLED also gets "Apply again".
11. Identity page: the nav items show before an ID exists; redirect to Identity when no ID is stored. Identity chip with "Change" returns to Identity page and clears stored ID.
Gaps to design in the same system and show the user BEFORE coding: EXPIRED and CONFIRMED hold page, error banners (invalid ID, no seats, hold expired, already applied in this class, server down), empty states, loading skeletons, mobile layout.

11.4 Design tokens & Tailwind (verified against the mockups by pixel sampling).
- Tailwind CSS v4: tokens defined in `@theme` in CSS.
- Background #EEEAF6; surface gradient #F7F4FC to #E8E3F3; ink #241A3F; muted #7A7396; primary #4B22A6 with highlight #6B3FD4 (button gradient measured #683DD0 to #4C23A8); light purple #E4DBF7.
- Pills (bg / text): HELD #E4DBF7 / #4B22A6; CONFIRMED #D9F0E3 / #1D7A4A; EXPIRED #E3E0EA / #6E6885; CANCELLED #F6DDE4 / #B03A5B.
- Raised card: `box-shadow: 9px 9px 20px #cfc8e2, -9px -9px 20px #fff; border-radius: 26px`. Inputs and bars: `inset 5px 5px 10px #d3cde5, inset -5px -5px 10px #fff; radius 16px`. Primary button: purple gradient, radius 16px. Secondary: flat surface with small raised shadow. Disabled: bg #E1DCEC, text #A59FBA, no shadow.
- Type: Poppins for headings and numbers, Inter for body; bundled locally via `@fontsource` (no CDN).

## 12. Roadmap (tick when finished)

- [x] S0 Repo scaffold, root docker-compose with db + volume, empty backend and frontend that start
- [x] S0.5 Merge Phase 2 plan into PROJECT_STATE.md (single source of truth)
- [x] S1 DB schema and EF Core migrations, constraints, indexes
- [x] S2 Classes API with edit (A1, A2, A3, A9), validation, error middleware, X-Student-Id handling
- [x] S3 Create hold (A4): the atomic core
- [x] S4 Hold read, confirm, cancel, my holds (A5 to A8)
- [x] S5 Expiry BackgroundService + effective status on reads
- [x] S6 Backend automated tests (concurrency 1000 requests on 10 seats, confirm idempotency, expiry, same-student double hold, confirm-vs-expire, expired-hold read consistency with worker disabled, sequential first-come order)
- [x] S7 Frontend foundation: Tailwind v4 tokens in @theme, shared components, API client, routing, error banner (STOP for user approval)
- [x] S8 Page 1 Student Identity
- [x] S9 Page 2 Student Dashboard
- [x] S10 Page 3 Class Details
- [x] S11 Page 4 Application / Hold (countdown, pay, cancel, expired and confirmed states)
- [x] S12 Page 5 My Applications
- [x] S13 Admin shell + Page 6 Admin Dashboard
- [x] S14 Page 7 Manage Classes
- [x] S15 Page 8 Create and Edit Class
- [x] S16 Cross-cutting UI states: loading, empty, errors, refresh persistence, polling
- [x] S17 Dockerfiles, compose finalisation, persistence check, README
- [x] S18 ASSUMPTIONS.md, AI_USAGE.md, final traceability check and full validation
- [x] S19 Bonus: two-process test (X1), frontend tests (X2)

Priority if time runs short: must-haves first (S0 to S18), bonus (S19) last.

## 13. Section prompt and report templates

Prompt template the user sends: `SECTION <ID> - <name>` / Context / Goal / Requirements covered / Deliverables / Constraints / Done when.
Every section report ends with: files created or changed; how to run and test; DoD checklist; requirement IDs satisfied; suggested Git commit message; AI_USAGE note (or "none").

## 14. Validation checks and Traceability matrix (full pass in S18)

### Traceability matrix (requirement -> section -> proof)
| ID | Implemented in | Proof (test or check) |
|----|----------------|-----------------------|
| T1, T2 | S0, S1, S7 | Multi-stage Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`), verified healthy in `docker compose up --build` |
| T3 | S0, S17 | `HealthEndpointTests.Get_Health_Returns200AndStatusOk`; `curl http://localhost:8080/health`; env table in README |
| T4 | S0 | `40-runtime-config.sh` dynamically generates `/usr/share/nginx/html/config.js` from `API_URL` env var without rebuild |
| T5 | S0, S17 | Root `docker-compose.yml` runs db, backend, and frontend; verified fresh clone build with only Docker installed |
| T6 | S18 | `AI_USAGE.md` records tools (Antigravity, Claude), task breakdown, 10 recorded AI errors, and detection/fix methods |
| T7 | S18 | `ASSUMPTIONS.md` records all architectural decisions (D1–D15), literal per-class rule, FCFS definition, read consistency, X1 guarantee, and mockup corrections |
| B1 | S2, S6 | `HoldLifecycleTests.Same_student_can_hold_different_classes` |
| B2 | S3, S6 | `HoldLifecycleTests.Sequential_first_request_wins` (1-seat class, first gets 201, second gets 409) |
| B3 | S3, S4, S5, S6 | `HoldLifecycleTests.Cancel_and_expiry_release_exactly_one_seat`, `HoldLifecycleTests.Expired_hold_returns_seat_without_api_call` |
| B4 | S2, S6, S8 | `StudentIdValidatorTests.*` (4 unit tests), `ValidationTests.Invalid_inputs_never_return_500`, UI Identity page with 17-digit enforcement |
| B5 | S4, S6, S11 | `ConcurrencyTests.Confirm_twice_counts_once`, UI Hold page simulated payment workflow |
| A1 | S2, S6 | `backend/http/api.http`, `HoldLifecycleTests.Sequential_first_request_wins`, `ValidationTests.Invalid_inputs_never_return_500` |
| A2 | S2, S6 | `backend/http/api.http`, `HoldLifecycleTests.Reads_are_correct_with_worker_disabled` |
| A3 | S2, S6 | `backend/http/api.http`, `HoldLifecycleTests.Expired_hold_returns_seat_without_api_call`, `ValidationTests.Invalid_inputs_never_return_500` |
| A4 | S3, S6 | `ConcurrencyTests.Concurrency_1000_requests_10_seats`, `backend/http/api.http`, `ValidationTests.Invalid_inputs_never_return_500` |
| A5 | S4, S6 | `backend/http/api.http`, `HoldLifecycleTests.Cancel_and_expiry_release_exactly_one_seat` |
| A6 | S4, S6 | `ConcurrencyTests.Confirm_twice_counts_once`, `HoldLifecycleTests.Confirm_expired_409`, `HoldLifecycleTests.Confirm_other_students_hold_404`, `backend/http/api.http` |
| A7 | S4, S6 | `HoldLifecycleTests.Cancel_and_expiry_release_exactly_one_seat`, `backend/http/api.http` |
| A8 | S4, S6 | `HoldLifecycleTests.Reads_are_correct_with_worker_disabled`, `backend/http/api.http`, `ValidationTests.Invalid_inputs_never_return_500` |
| A9 | S2, S6, S15 | `HoldLifecycleTests.Edit_cannot_go_below_occupied`, `backend/http/api.http`, `ValidationTests.Invalid_inputs_never_return_500`, UI ClassFormPage |
| R1 | S1, S3, S6 | `ConcurrencyTests.Concurrency_1000_requests_10_seats` (1000 concurrent reqs on 10 seats -> exactly 10 x 201, 990 x 409, 0 overbooking); `backend/sql/verify.sql` clean (0 rows) |
| R2 | S5, S6, S18 | `HoldLifecycleTests.Expired_hold_returns_seat_without_api_call`, S18 live check with `HOLD_DURATION_SECONDS=3` (seat returned automatically in 4s) |
| R3 | S1, S3, S6 | `ConcurrencyTests.Same_student_50_parallel_holds_create_one`, `HoldLifecycleTests.Same_student_can_hold_different_classes`, DB partial unique index `ux_reservations_active_per_class` |
| R4 | S4, S6 | `HoldLifecycleTests.Confirm_expired_409`, `HoldLifecycleTests.Confirm_other_students_hold_404` |
| R5 | S4, S6 | `ConcurrencyTests.Confirm_twice_counts_once` (sequential and concurrent) |
| R6 | S0, S17, S18 | S18 live check (`docker compose down` then `docker compose up -d` preserved all 20 classes and active holds intact via `pgdata` volume) |
| R7 | S2, S3, S4, S6 | `ValidationTests.Invalid_inputs_never_return_500` (18 parametrized invalid inputs across all endpoints return 400/404/405/415, never 500) |
| Read consistency (D6) | S2, S5, S6 | `HoldLifecycleTests.Reads_are_correct_with_worker_disabled` (effective counts immediately discount expired holds without waiting for worker) |
| Confirm vs expire | S5, S6 | `ConcurrencyTests.Confirm_vs_expire_one_winner` (exactly one winner between racing confirm and expire, no counter leak) |
| U1 to U6, U7 | S8 to S16 | Frontend manual checklist (Section 14 table: 14/14 checks PASS with verified evidence) |
| X1 | S5, S18, S19 | `docker compose --profile x1 run --rm x1-test` (`scripts/x1-two-process-test.mjs`): 1000 parallel holds split over ports 8080/8081 on a 10-seat class -> 10 x 201 (6+4), 990 x 409 NO_SEATS_AVAILABLE, held=10 via both ports; `verify.sql` 0 rows; guarantee in `ASSUMPTIONS.md` 1.4 and README |
| X2 | S19 | `cd frontend && npm test`: 3 files, 28 tests (identity validation + Identity page, useCountdown skew correction and expiry flip, error-code mapping in apiClient) |
| D-1 to D-7 | S0, S17, S18 | Complete repository deliverables: D-1 (incremental git history), D-2 (Dockerfiles & compose), D-3 (`README.md`), D-4 (`ASSUMPTIONS.md`), D-5 (50 automated backend tests), D-6 (`AI_USAGE.md`), D-7 (clean public repo without assignment text or contact links) |

### Validation checks
- API: curl or .http examples for every endpoint, happy path plus every 4xx (missing or malformed header, bad body, unknown ids, wrong owner, no seat, double hold, expired confirm). No input produces 500.
- DB: SQL checks that held_seats and confirmed_seats equal real reservation counts, no CHECK violation, partial unique index exists.
- Concurrency: 1000 simultaneous requests from different students on 10 seats = exactly 10 x 201, 990 x 409, final held + confirmed = 10 (also with two backend processes for X1). One student sending 50 simultaneous holds to one class = exactly one hold. Confirm racing with expiry = one winner, consistent counters.
- Idempotency and lifecycle: repeated confirm adds +1 once; cancel and expiry release exactly one seat; no double release.
- Expiry: with HOLD_DURATION_SECONDS=3 the seat returns without any API call; with the worker stopped GET /classes already shows reduced heldSeats; UI flips to EXPIRED and disables Pay without reload.
- Persistence: down then up keeps data; fresh clone on a clean machine with only Docker works.
- Frontend manual checklist: U1 to U6, U7, refresh and browser-reopen persistence, server stopped (friendly error, recovery), invalid ID.
- Traceability: final table of every requirement ID -> where implemented -> which test or check proves it.

### Frontend manual checklist (S16 verification)
| Requirement / Check | Status | Verification & Evidence |
|----------------------|--------|-------------------------|
| U1 All operations from UI | PASS | Admin creates and edits classes from `/admin/classes`; student enters ID at `/identity`, views classes at `/`, views details at `/classes/:id`, creates hold, pays simulated fee, cancels hold at `/holds/:id`, and reviews all applications at `/my-applications`. No external tools required. |
| U2 Hold expiry & Pay disabled without reload | PASS | `useCountdown` tracks server-offset monotonic time. At zero seconds, `effectiveStatus` flips to `EXPIRED`, status pill changes to `EXPIRED`, `Banner` informs user seat returned to pool, and "Pay admission fee" button switches to disabled with "Pay admission fee (Disabled — Hold Expired)". Sync callback refetches query without page reload. |
| U3 Polling & auto-refresh | PASS | TanStack Query v5 polls classes (`/classes`) and student holds (`/me/holds`) every 5 seconds across Dashboard, Class Details, Admin Dashboard, and Manage Classes. Seat counts (Available, Held, Confirmed) update in real-time. |
| U4 Refresh & browser reopen persistence | PASS | Student birth registration number stored in `localStorage` (`school_admission_student_id`) with in-memory fallback. On F5 refresh or browser window reopen, `/` reads ID, bypasses `/identity` guard, and loads student's active hold and application history from `GET /me/holds`. |
| U5 Plain language error handling | PASS | Every backend error code (`NO_SEATS_AVAILABLE`, `ALREADY_APPLIED_IN_CLASS`, `HOLD_EXPIRED`, `INVALID_STUDENT_ID`, `TOTAL_SEATS_BELOW_OCCUPIED`, `NOT_FOUND`, `NETWORK_ERROR`) mapped in `messages.ts` to clear English explanations. No console-only errors, no blank page. `RootErrorBoundary` guards against unhandled render crashes. |
| U6 All 8 required screens functional | PASS | 1. Student Identity (`/identity`); 2. Student Dashboard (`/`); 3. Class Details (`/classes/:id`); 4. Application/Hold (`/holds/:id`); 5. My Applications (`/my-applications`); 6. Admin Dashboard (`/admin`); 7. Manage Classes (`/admin/classes`); 8. Create/Edit Class (`/admin/classes/new` and `/admin/classes/:id/edit`). |
| U7 Edit class capacity constraint | PASS | Reuses `ClassFormPage`. If totalSeats is reduced below held + confirmed seats, form blocks submit with client error and backend rejects with `TOTAL_SEATS_BELOW_OCCUPIED` (409) stating minimum allowed seats. |
| Page Refresh (F5) | PASS | Full browser refresh on student dashboard, class details, hold page, my applications, and admin pages maintains routing and state without blank screen or Nginx 404 errors (SPA `try_files` configured). |
| Browser Reopen | PASS | Closing browser tab and reopening `http://localhost:3000` retains student identity, restores active hold card, and retains application history. |
| Server Stopped & Recovery | PASS | When backend stops (`docker compose stop backend`), global sticky red banner appears across all screens with "Server connection issue: Cannot reach the admission server". When backend starts (`docker compose start backend`), auto-recovery health probe detects HTTP 200 within 3s, clears the banner, and fires `server-recovered` event to refetch all queries without reload. |
| Invalid / Malformed IDs | PASS | Navigating to `/classes/non-existent-id` or `/holds/non-existent-id` or `/admin/classes/non-existent-id/edit` displays friendly `EmptyState` ("Class not found" / "Application Not Found") with "Back to classes" navigation. No unhandled rejections or blank screens. |
| Polling pauses when hidden | PASS | TanStack Query v5 `refetchIntervalInBackground: false` stops polling intervals when tab is hidden (`document.visibilityState === 'hidden'`). Resumes immediately upon return with `refetchOnWindowFocus: true`. `useCountdown` resyncs immediately on `visibilitychange`. |
| Responsive layout (390px mobile & tablet) | PASS | Student pages stack into single-column cards at 390px width with full-width action buttons and readable navigation; Admin pages display 2x2 metric grid and horizontal table scrolling on tablet (768px). |

## 15. Change log (append one row per task, oldest first)

| Date-time (Asia/Dhaka) | Section | What changed | Main files |
|------------------------|---------|--------------|------------|
| 2026-11-10 16:53 | S0 | Repo scaffold, Docker Compose (Postgres, .NET 8, React 18 TS), health endpoints and volume persistence | docker-compose.yml, backend/, frontend/, .env.example, README.md |
| 2026-11-10 17:04 | S0.5 | Merge Phase 2 plan into PROJECT_STATE.md (A9, U7, D8-D15, Q1-Q17 decided, API table, schema, matrix, roadmap) | PROJECT_STATE.md |
| 2026-11-10 17:14 | S1 | PostgreSQL schema, entities, AppDbContext, InitialCreate migration, startup retry loop, verify.sql, max_connections=200 | backend/src/SchoolAdmission.*, docker-compose.yml, backend/sql/verify.sql |
| 2026-11-10 17:22 | S2 | Classes API (A1, A2, A3, A9), ClassService, ClassStore, ErrorHandlingMiddleware, StudentIdValidator, api.http | backend/src/SchoolAdmission.*, backend/http/api.http, backend/tests/ |
| 2026-11-10 17:36 | S3 | Create hold atomic core (A4, R1-R3, B2-B3), HoldService, HoldStore conditional seat UPDATE, load-test.ps1, api.http | backend/src/SchoolAdmission.*, backend/load-test.ps1, backend/http/api.http |
| 2026-11-10 17:46 | S4 | Hold read, confirm, cancel, my holds (A5-A8, R4, R5, B5), HoldsController, idempotent confirm & cancel, api.http | backend/src/SchoolAdmission.*, backend/http/api.http |
| 2026-11-10 17:55 | S5 | ExpiryWorker BackgroundService with FOR UPDATE SKIP LOCKED (R2, D6, X1), effective reads verified, EXPIRY_WORKER_ENABLED switch | backend/src/SchoolAdmission.*, docker-compose.yml |
| 2026-11-10 18:08 | S6 | Backend automated tests suite (TestDatabase, ApiFactory, 50 xUnit tests covering concurrency, lifecycle, validation, counter matching) | backend/tests/SchoolAdmission.Tests/* |
| 2026-11-10 18:28 | S7 | Frontend foundation: Tailwind v4 @theme tokens, neumorphic styles, local fonts, shared components, api client, error mapping, routing & layouts, /dev/gallery with gap designs | frontend/src/*, frontend/package.json, frontend/vite.config.ts |
| 2026-11-11 07:28 | S8 | Page 1 Student Identity: 17-digit validation, live counter, memory fallback, route guard, header ID chip with Change | frontend/src/features/student/StudentIdentityPage.tsx, frontend/src/app/layouts/StudentLayout.tsx, frontend/src/api/client.ts |
| 2026-11-11 07:46 | S9 | Page 2 Student Dashboard: summary tiles (class count, real available seats sum, soonest active hold countdown with +N more), class cards with multi-segment seat bar, apply handler, 5s polling, loading skeleton, empty and error states | frontend/src/features/student/StudentDashboardPage.tsx, frontend/src/api/admissionApi.ts, frontend/src/features/student/index.tsx |
| 2026-11-11 07:54 | S10 | Page 3 Class Details: breadcrumb, title, FCFS hint with derived minutes, multi-segment progress bar with occupancy %, 4 summary tiles, big available number, Apply for this seat, one seat per class note, 5s polling, friendly 404 not-found empty state | frontend/src/features/student/ClassDetailsPage.tsx, frontend/src/api/admissionApi.ts, frontend/src/features/student/StudentDashboardPage.tsx, frontend/src/features/student/index.tsx |
| 2026-11-11 08:13 | S11 | Page 4 Application / Hold: countdown ring with clock skew correction, simulated payment Pay button, Cancel button, auto flip to EXPIRED at zero without reload, CONFIRMED and CANCELLED states, double submit prevention, reusable useCountdown hook | frontend/src/features/student/HoldApplicationPage.tsx, frontend/src/shared/hooks/useCountdown.ts, frontend/src/api/admissionApi.ts, frontend/src/shared/utils/date.ts, frontend/src/shared/components/CountdownRing.tsx |
| 2026-11-11 08:19 | S12 | Page 5 My Applications: application history list from A8, all 4 statuses with helper texts, in-list Pay/Cancel row updates without reload, live HELD to EXPIRED countdown flip, 5s polling, empty state with Classes link, row click navigation | frontend/src/features/student/MyApplicationsPage.tsx, frontend/src/features/student/index.tsx |
| 2026-11-11 08:29 | S13 | Admin shell + Page 6 Admin Dashboard: sidebar navigation (/admin, /admin/classes, /admin/classes/new), 4 summary tiles (Class shifts, Total seats, Held, Confirmed), Seats by class shift bars with 'n left', 5s polling, loading, empty, and error states | frontend/src/features/admin/AdminDashboardPage.tsx, frontend/src/features/admin/index.tsx |
| 2026-11-11 08:32 | S14 | Page 7 Manage Classes: table with Class shift, Total, Held, Confirmed, bold Available, Filled bar, Edit button (/admin/classes/:id/edit), Create class button (/admin/classes/new), 5s polling, live search, loading, empty, and error states | frontend/src/features/admin/ManageClassesPage.tsx, frontend/src/features/admin/index.tsx |
| 2026-11-11 08:37 | S15 | Page 8 Create & Edit Class: unified form (Class field, Shift dropdown, Total seats), composed name <Class> - <Shift>, live parent preview card, edit name splitting, A1 create, A9 update, TOTAL_SEATS_BELOW_OCCUPIED message with min seats, client validation mirroring backend, success note return to Manage Classes | frontend/src/features/admin/ClassFormPage.tsx, frontend/src/features/admin/ManageClassesPage.tsx, frontend/src/features/admin/index.tsx, frontend/src/api/admissionApi.ts |
| 2026-11-11 08:51 | S16 | Cross-cutting UI states: loading skeletons, empty states, error states, server-down banner and zero-reload auto-recovery, tab visibility polling pause/resume, mobile layout at 390px, tablet layout, RootErrorBoundary, frontend manual checklist | frontend/src/shared/components/RootErrorBoundary.tsx, frontend/src/shared/components/Card.tsx, frontend/src/api/client.ts, frontend/src/App.tsx, frontend/src/shared/hooks/useCountdown.ts, frontend/src/app/layouts/StudentLayout.tsx, frontend/src/features/admin/ClassFormPage.tsx, frontend/src/main.tsx, PROJECT_STATE.md |
| 2026-11-11 09:00 | S17 | Docker finalisation, volume persistence check, compose tests profile, and comprehensive README.md | backend/Dockerfile, frontend/Dockerfile, frontend/nginx.conf, docker-compose.yml, README.md, PROJECT_STATE.md |
| 2026-11-11 09:11 | S18 | ASSUMPTIONS.md, AI_USAGE.md, full validation pass (50 backend tests passing, verify.sql clean, 3s expiry verified live, down/up persistence verified), api.http expanded with all 4xx codes, traceability matrix updated | ASSUMPTIONS.md, AI_USAGE.md, backend/http/api.http, PROJECT_STATE.md |
| 2026-11-11 09:18 | S19 | Bonus X1: compose profile x1 (backend2 on 8081, x1-test runner), two-process script (10 x 201 across ports, verify.sql clean). Bonus X2: Vitest 5 + RTL, 28 frontend tests, npm test. README and ASSUMPTIONS updated | docker-compose.yml, scripts/x1-two-process-test.mjs, frontend/vitest.config.ts, frontend/src/**/*.test.ts(x), frontend/package.json, README.md, ASSUMPTIONS.md |
| 2026-11-11 15:46 | i18n | Bangla/English live language switcher: navbar toggle button (BN/EN), zero-dependency React context with localStorage persistence, complete UI and error mapping translation, 35 frontend tests passing | frontend/src/shared/i18n.tsx, frontend/src/shared/components/LanguageToggle.tsx, frontend/src/shared/messages.ts, frontend/src/shared/i18n.test.tsx, frontend/src/app/layouts/*, frontend/src/features/**/* |

## 16. Known issues / TODO

- (none yet)

## 17. AI mistakes log (feeds AI_USAGE.md)

- An earlier plan wrongly named Prisma as the ORM for a .NET backend. Caught by checking the spec (ORM is free choice, Prisma is a Node ORM). Fix: EF Core + raw SQL (D1).
- The design mockups contained placeholders that contradict the requirement or are invented (see 11.3). Caught by comparing each mockup against the requirement list.
- During S0 frontend scaffold, downgrading to React 18 omitted @types/node required by tsconfig.node.json, causing tsc -b to fail inside Docker. Caught by build verification; fixed by adding @types/node.
- In S6 initial test run, ExpiryWorker BackgroundService looped tightly in tests where ConnectionStrings__Default was unset, and ApiFactory configuration override did not initially reconfigure AdmissionOptions in DI. Caught by test logs; fixed by checking connection string before worker start and configuring AdmissionOptions directly via services.Configure<AdmissionOptions>().
- In S7 initial build, `isActive` was destructured in `RootLayout.tsx` NavLink className callback without being read, triggering TS6133 under strict TypeScript flags. Caught by `npm run build`; fixed by changing `({ isActive }) =>` to `() =>`.
- In S9, TypeScript with verbatimModuleSyntax required type-only imports for AdmissionClassDto and StudentHoldDto. Caught by npm run build; fixed by using import type.
- In S11, Banner `onDismiss` prop was initially named `onClose` in `HoldApplicationPage.tsx`, causing a TS2322 build error. Caught by `npm run build`; fixed by using `onDismiss`.
- In S12, unused imports `Link` in `MyApplicationsPage.tsx` and unused `React, Card` in `index.tsx` triggered TS6133 under strict flags. Caught by `npm run build`; fixed by removing unused imports.
- In S16, TanStack Query was configured with refetchOnWindowFocus: false, which prevented immediate re-fetching when returning from backgrounded tabs, and there was no automatic query invalidation when the backend recovered from downtime. Caught during S16 cross-cutting audit; fixed by enabling refetchOnWindowFocus: true, adding a global server-recovered event in client.ts, and invalidating queries in App.tsx so pages recover without reload.
- In S17, the frontend healthcheck initially used http://localhost:80/ in the Alpine container which resolved to IPv6 ::1, but nginx was only listening on IPv4, resulting in connection refused. Fixed by adding listen [::]:80; to nginx.conf and targeting http://127.0.0.1:80/ for the container healthcheck.
- In S19, the first dependency pick (Vitest 3) pulled packages with known advisories (tinypool, @vitest/mocker). Caught by `npm audit`; fixed by moving to Vitest 5.1 (compatible with Vite 6.4, 0 vulnerabilities). Also ASSUMPTIONS.md 1.4 wrongly called the DB CHECK a "hardware-level" safety net; corrected to "database-level".

## 18. How to run (filled in by S0 onward)

### Prerequisites
- Docker & Docker Compose installed and daemon running.

### Quick Start
```bash
docker compose up --build
```

### URLs & Ports
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080 (Health check: `http://localhost:8080/health`)
- Database: internal service `db:5432` (host port 5432 is intentionally unmapped)

### Environment Variables
- `POSTGRES_DB`: PostgreSQL database name (default: `admission_db`)
- `POSTGRES_USER`: PostgreSQL user (default: `admission_user`)
- `POSTGRES_PASSWORD`: PostgreSQL password (default: `admission_pass`)
- `ConnectionStrings__Default`: Connection string for backend (default: points to `db:5432`)
- `HOLD_DURATION_SECONDS`: Seat hold duration in seconds (integer >= 1, default: `600`)
- `EXPIRY_WORKER_ENABLED`: Enables background worker for cleaning expired holds (default: `true`)
- `EXPIRY_INTERVAL_MILLISECONDS`: Polling interval for background worker in ms (default: `1000`)
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowed CORS origins (default: `http://localhost:3000`)
- `API_URL`: Backend URL for frontend container runtime injection (default: `http://localhost:8080`)

### Running Backend Tests (Docker-only)
```bash
docker compose --profile tests run --rm tests
```

### Running Frontend Tests (X2)
```bash
cd frontend && npm ci && npm test
```

### Two-Process Test (X1)
```bash
docker compose --profile x1 up -d --build
docker compose --profile x1 run --rm x1-test
docker compose exec -T db psql -U admission_user -d admission_db < backend/sql/verify.sql
```

### Resetting Data
```bash
docker compose down -v
```
