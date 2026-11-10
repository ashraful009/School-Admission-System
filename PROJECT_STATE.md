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

- Last updated: 2026-11-10 16:53
- Current phase: Phase 3 (implementation). S0 complete.
- Last finished section: S0 Repo scaffold
- Next section: S1 DB schema
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
- B4 No login. UI asks for the student's 17-digit birth registration number and uses it as identity. API receives it in header `X-Student-Id`.
- B5 Payment is simulated. Pressing "Pay admission fee" means success. No gateway.

API contract (exact). Base URL http://localhost:8080, JSON. IDs like c_123 / h_789 are examples only; our format is free.
- A1 `POST /classes` body `{name, totalSeats}` -> 201 `{id, name, totalSeats}`
- A2 `GET /classes` -> 200 array of `{id, name, totalSeats, heldSeats, confirmedSeats, availableSeats}`
- A3 `GET /classes/{classId}` -> 200 same object
- A4 `POST /classes/{classId}/holds` header `X-Student-Id` -> 201 `{holdId, classId, studentId, status:"HELD", expiresAt}`; 409 when no seat
- A5 `GET /holds/{holdId}` -> 200 `{holdId, classId, status, expiresAt}`; status in HELD, CONFIRMED, EXPIRED, CANCELLED (the contract lists no header for A5; do not require one)
- A6 `POST /holds/{holdId}/confirm` header `X-Student-Id` -> 200 `{holdId, status:"CONFIRMED"}`
- A7 `DELETE /holds/{holdId}` header `X-Student-Id` -> 204
- A8 `GET /me/holds` header `X-Student-Id` -> 200 array of `{holdId, classId, className, status, expiresAt}`
- expiresAt format: ISO 8601 UTC, e.g. 2026-11-01T04:10:00Z.

Mandatory backend rules
- R1 heldSeats + confirmedSeats never exceeds totalSeats, however many requests arrive at once.
- R2 Hold duration from env `HOLD_DURATION_SECONDS` (default 600). After expiry the seat returns by itself; nobody calls any API.
- R3 A student cannot have more than one active hold or confirmed admission in the same class at the same time.
- R4 Only the student's own, not-yet-expired HELD hold can be confirmed.
- R5 Confirming the same hold several times increases confirmedSeats exactly once.
- R6 No data lost after `docker compose down` then `docker compose up` (named volume).
- R7 (implicit) Invalid input returns 4xx, never 500. availableSeats = totalSeats - heldSeats - confirmedSeats.

Mandatory UI rules
- U1 Everything from the UI. No Postman, no direct DB.
- U2 When the hold time ends, the app shows EXPIRED and disables "Pay admission fee" without page reload.
- U3 Class seat numbers update by themselves every few seconds without reload.
- U4 After refresh or closing and reopening the browser, the student still sees their running applications (remember the ID in localStorage; load from GET /me/holds).
- U5 Every error (no seat, hold expired, invalid input, server down) is shown in plain language. No blank page, no console-only errors.
- U6 Screens: create class (admin: name + seats); class list (total, held, confirmed, available, Apply button); application (status, time left, Pay, Cancel); my applications (all with status).

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

### Decided
- D1 EF Core (Npgsql) plus raw SQL for the conditional updates. Prisma is a Node ORM and must NOT be used.
- D2 Active-hold rule is PER CLASS, exactly as the requirement says: one student may have at most ONE active (HELD) or CONFIRMED application in the same class. Classes are independent (a student may hold Class 6 Morning and Class 7 Morning together, and Class 6 Morning and Class 6 Day together). After cancel or expiry the student may apply to that class again. Enforce with ONE partial unique index on (class_id, student_id) WHERE status IN ('HELD','CONFIRMED'); return a distinct 409 error code when hit. Do NOT add a global one-hold-per-student limit.
- D3 Shift is not a column. UI composes name "Class 6 - Morning Shift" from a class field and a shift dropdown. API only takes `name`.
- D4 Student ID validated as exactly 17 digits `^\d{17}$`, stored as string.
- D5 FCFS definition: a request that completes before another starts always wins; truly simultaneous requests are ordered by the class row lock; commit order is grant order. No queue (the contract is synchronous). Document in ASSUMPTIONS.md and README.
- D6 Read consistency: reads return effective counts and statuses that already subtract expired-but-unreleased holds (formula in section 7). Worker and create-hold reclaim only bring stored counters up to date.
- D7 student_id column is varchar(17) with CHECK (student_id ~ '^[0-9]{17}$'), not char(17).

### Open questions (status PENDING until the user answers; PROPOSED = default we will use after confirmation)
| # | Question | PROPOSED | Status |
|---|----------|----------|--------|
| 1 | Edit class? Contract has no PUT/PATCH | Skip Edit (no PUT). Remove Edit button from UI | PENDING |
| 2 | One student may hold CONFIRMED in several classes? | Yes (spec limits per class only) | PENDING (follows D2) |
| 3 | Repeat confirm on own CONFIRMED hold | 200 CONFIRMED, idempotent, counters untouched | PENDING |
| 4 | Confirm expired hold / another student's hold / CANCELLED hold | 409 / 404 / 409 | PENDING |
| 5 | DELETE own HELD / already CANCELLED / CONFIRMED or EXPIRED / other's hold | 204 / 204 (idempotent) / 409 / 404 | PENDING |
| 6 | Missing or invalid X-Student-Id; unknown hold or class; student already holds in this class | 400; 404; 409 with distinct machine-readable code | PENDING |
| 7 | POST /classes validation; duplicate names | name 1..100 chars after trim; totalSeats integer 1..10000; duplicate names allowed or 409? (user to decide) | PENDING |
| 8 | UI language | English (mockups are English; strings in one messages file so Bangla can be added). Digest earlier proposed Bangla; user to choose | PENDING |
| 9 | Admission fee amount | Do not show any amount (spec has none) | PENDING |
| 10 | Frontend tooling | Vite + React + TypeScript, plain CSS variables for neumorphic style, TanStack Query for polling (optional) | PENDING |
| 11 | Test strategy | xUnit + WebApplicationFactory + real PostgreSQL via Testcontainers. In-memory EF NOT acceptable for the concurrency test | PENDING |
| 12 | Frontend port in Docker | 3000 | PENDING |
| 13 | FCFS: confirm D5; add optional grant_seq audit column? | Confirm D5; no grant_seq | PENDING |
| 14 | Read consistency: confirm D6 formula; lazy reclaim on every GET not used | Confirm D6 | PENDING |
| 15 | How does the admin reach the admin pages (no login)? | Route /admin/* with a small "Admin" link in the footer of the student layout; no auth | PENDING |
| 16 | Extra response fields (allowed by contract) | Add `className`, `createdAt`, `confirmedAt`, `serverTime` to hold responses where useful; add `holdDurationSeconds` to class objects | PENDING |
| 17 | Mockup corrections listed in section 11.3 | Apply all | PENDING |

### S0-only technical choices (PROPOSED, made by the agent in S0, to be recorded in ASSUMPTIONS.md)
- Frontend backend URL via runtime `config.js` written at container start from env `API_URL` (no rebuild needed to change it); in `vite dev` fall back to `VITE_API_URL`, then http://localhost:8080.
- CORS allowed origins from env `Cors__AllowedOrigins` (default http://localhost:3000).
- Line endings forced to LF (.gitattributes) so shell scripts work in containers.

## 6. API behaviour and error codes (PROPOSED; final table comes in Phase 2)

Error body (PROPOSED): `{ "error": { "code": "<MACHINE_CODE>", "message": "<plain English>" } }`
Codes (PROPOSED): VALIDATION_ERROR 400, INVALID_STUDENT_ID 400, NOT_FOUND 404, NO_SEATS_AVAILABLE 409, ALREADY_APPLIED_IN_CLASS 409, HOLD_EXPIRED 409, HOLD_NOT_ACTIVE 409, INTERNAL_ERROR 500.
No input may ever produce 500. Status code choices per open questions 3 to 6 above.

## 7. Backend business logic (the core)

All time comparisons use the DATABASE clock (`now()`), never the app clock. Default READ COMMITTED is enough because each seat change is a single-row conditional UPDATE: the row lock serialises writers and the WHERE clause is re-checked after the lock. Lock the class row first, ordered by id when several rows.

FCFS (D5): atomic conditional UPDATE guarantees no oversell and no lottery, not strict arrival FIFO. A request completing before another starts always wins; simultaneous requests are ordered by row lock; no queue. Add one test: 1 seat, two sequential requests, first 201, second 409.

Create hold (one transaction):
1. Reclaim expired HELD holds of THIS class from any student: one statement marking them EXPIRED and decrementing held_seats (the worker may be late; an expired hold must not block the unique index or hide seats).
2. If the student has a CONFIRMED admission in this class: 409 (ALREADY_APPLIED_IN_CLASS).
3. `UPDATE classes SET held_seats = held_seats + 1 WHERE id=@c AND held_seats + confirmed_seats < total_seats RETURNING id`. No row: rollback, 409 NO_SEATS_AVAILABLE (or 404 if the class does not exist).
4. INSERT reservation HELD with `expires_at = now() + HOLD_DURATION_SECONDS`. Unique violation (SQLSTATE 23505): rollback, 409 ALREADY_APPLIED_IN_CLASS.
5. Commit, return 201.

Confirm (one transaction): `UPDATE reservations SET status='CONFIRMED', confirmed_at=now() WHERE id=@h AND student_id=@s AND status='HELD' AND expires_at > now() RETURNING class_id`; if a row returns, `UPDATE classes SET held_seats = held_seats - 1, confirmed_seats = confirmed_seats + 1`. If no row, inspect the hold: own CONFIRMED -> 200 (idempotent); expired -> 409; other cases per decisions.

Cancel: same pattern, HELD -> CANCELLED, held_seats - 1, owner only.

Expiry: a BackgroundService runs about every 1 second (configurable). In a transaction select expired HELD rows `FOR UPDATE SKIP LOCKED` in batches, mark EXPIRED, decrement held_seats per class. Safe with several backend processes and against the confirm-versus-expire race (exactly one wins).

Read consistency (D6): reads are read-only, one SQL statement (one snapshot). expiredHeld(class) = count of reservations with status HELD and expires_at <= now(). heldSeats = held_seats - expiredHeld; availableSeats = totalSeats - heldSeats - confirmedSeats. Example: total 10, stored held_seats 5, one expired-unreleased, 0 confirmed -> heldSeats 4, availableSeats 6. In GET /holds/{id} and /me/holds, status is EXPIRED when stored status is HELD and expires_at <= now(). Stored counters stay conservative so the CHECK constraint stays safe.

Errors: global middleware maps validation to 400, not found to 404, conflicts to 409, unexpected to a safe 500 JSON body. Tune pool size and timeouts so 1000 simultaneous requests give only 201 or 409.

README design section must explain: single-statement conditional update vs SELECT FOR UPDATE, optimistic concurrency and retry storms, counters vs COUNT(*), hot-row trade-off, why the DB CHECK exists. X1 (two processes) is safe because correctness lives in the database row lock and conditional UPDATE, not in app memory.

## 8. Architecture

```
backend/
  SchoolAdmission.sln
  Dockerfile                          (backend image, build context is backend/)
  src/SchoolAdmission.Api/            Controllers, middleware (error handling, X-Student-Id), DTOs, Program.cs
  src/SchoolAdmission.Application/    ClassService, HoldService (workflows), interfaces
  src/SchoolAdmission.Domain/         Entities, HoldStatus enum, rules
  src/SchoolAdmission.Infrastructure/ EF Core DbContext, migrations, SQL commands, ExpiryWorker (BackgroundService)
  tests/SchoolAdmission.Tests/        concurrency, idempotency, expiry, same-student, confirm-vs-expire
frontend/src/
  app/ (App, routes)  api/ (apiClient, error mapping)  shared/ (components, hooks, utils, styles/tokens)
  features/student/ (identity, classes, class-details, hold, my-applications)
  features/admin/   (dashboard, manage-classes, create-class)
docker-compose.yml, README.md, ASSUMPTIONS.md, AI_USAGE.md, PROJECT_STATE.md
```
Controllers contain no business logic and no SQL.

## 9. Database schema (target for S1)

- `classes(id, name, total_seats, held_seats, confirmed_seats, created_at)`; CHECK all counters >= 0 and held_seats + confirmed_seats <= total_seats.
- `reservations(id, class_id FK, student_id varchar(17) NOT NULL CHECK (student_id ~ '^[0-9]{17}$'), status, created_at, expires_at, confirmed_at, cancelled_at, expired_at)`.
- Partial unique index UNIQUE (class_id, student_id) WHERE status IN ('HELD','CONFIRMED').
- Index (expires_at) WHERE status = 'HELD'; index (student_id).
- No Students table, no events table.

## 10. Docker and environment

Services: `db` (postgres:16, named volume for /var/lib/postgresql/data, healthcheck), `backend` (port 8080, waits for healthy db, migrations at startup with retry), `frontend` (nginx serving the Vite build, host port 3000 PROPOSED). Env: `ConnectionStrings__Default`, `HOLD_DURATION_SECONDS=600`, `ASPNETCORE_URLS`, `Cors__AllowedOrigins`, frontend `API_URL`. Optional compose profile with a second backend on 8081 for X1 (S19). No manual step after `docker compose up`.

## 11. Frontend and UI

11.1 Pages. Student (5): Identity; Dashboard (summary tiles, active-hold card with countdown, class cards with seat bar and Apply); Class Details; Application/Hold (countdown ring, class summary, Pay, Cancel, expired and confirmed states); My Applications (HELD / CONFIRMED / EXPIRED / CANCELLED pills and actions). Admin (3): Dashboard; Manage Classes (table); Create Class (class field, shift dropdown, total seats, live preview). Student navigation: top bar (Classes, My applications, ID chip with Change). Admin navigation: left sidebar (Dashboard, Manage classes, Create class). No extra pages.

11.2 Behaviour. Polling about every 5 s for classes and the student's holds; countdown driven by expiresAt with clock-skew correction (response Date header or serverTime); at zero show EXPIRED, disable Pay, refetch; one central API client with error-to-message mapping; global banner for server-down; loading, empty and error states on every list.

11.3 Mockup corrections (the 8 mockup images are the visual source of truth for layout and style; these items are NOT requirements or are wrong):
1. Class Details says "hold one seat at a time across all classes": WRONG vs D2. Use "You can hold one seat per class at a time."
2. Hold page shows "Admission fee BDT 5,000": placeholder, remove (Q9).
3. Manage Classes shows an Edit button: remove unless Q1 says yes.
4. Dashboard "Seats left today 244" does not match the tiles (the six classes sum to 75 available): compute the real sum of availableSeats. "Good morning" is static: use a neutral greeting.
5. Manage Classes and Create Class mockups show the student top bar: use the admin sidebar layout instead.
6. Dashboard "Your active hold" is a single tile, but a student can have several active holds (one per class): show the soonest-expiring HELD with "+N more", and a "No active hold" state.
7. Class Details "10 minutes" is hard-coded: derive from the hold duration (holdDurationSeconds, Q16).
8. Hold page "Hold started" needs createdAt; My Applications "Paid 09 Nov, 11:20 AM" needs confirmedAt: extra fields (Q16).
9. On the Class Details page, if the student already has an active or confirmed application in that class, show a disabled "Already applied" state; the UI must also handle the 409 code.
10. My Applications: EXPIRED shows "Apply again" (kept); CANCELLED also gets "Apply again" (PROPOSED).
11. Identity page: the nav items show before an ID exists; redirect to Identity when no ID is stored.
Gaps to design in the same system and show the user BEFORE coding: EXPIRED and CONFIRMED hold page, error banners (invalid ID, no seats, hold expired, already applied in this class, server down), empty states, loading skeletons, mobile layout.

11.4 Design tokens (verified against the mockups by pixel sampling).
- Background #EEEAF6; surface gradient #F7F4FC to #E8E3F3; ink #241A3F; muted #7A7396; primary #4B22A6 with highlight #6B3FD4 (button gradient measured #683DD0 to #4C23A8); light purple #E4DBF7.
- Pills (bg / text): HELD #E4DBF7 / #4B22A6; CONFIRMED #D9F0E3 / #1D7A4A; EXPIRED #E3E0EA / #6E6885; CANCELLED #F6DDE4 / #B03A5B. (Backgrounds verified; text colours taken from the digest.)
- Raised card: `box-shadow: 9px 9px 20px #cfc8e2, -9px -9px 20px #fff; border-radius: 26px`. Inputs and bars: `inset 5px 5px 10px #d3cde5, inset -5px -5px 10px #fff; radius 16px`. Primary button: purple gradient, radius 16px. Secondary: flat surface with small raised shadow. Disabled: bg #E1DCEC, text #A59FBA, no shadow (bg verified).
- Type: Poppins for headings and numbers, Inter for body; bundle fonts locally (no CDN). Bengali font only if the UI is Bangla (Q8).
- Layout: student pages 1440 px design width, top nav, 56 px gutter; admin pages 250 px left sidebar.

## 12. Roadmap (tick when finished)

- [x] S0 Repo scaffold, root docker-compose with db + volume, empty backend and frontend that start
- [ ] S1 DB schema, EF Core migrations, constraints, indexes
- [ ] S2 Classes API (A1, A2, A3), validation, error middleware, X-Student-Id handling
- [ ] S3 Create hold (A4): the atomic core
- [ ] S4 Hold read, confirm, cancel, my holds (A5 to A8)
- [ ] S5 Expiry BackgroundService + effective status on reads
- [ ] S6 Backend automated tests (concurrency 1000 requests on 10 seats, confirm idempotency, expiry, same-student double hold, confirm-vs-expire, expired-hold read consistency with worker disabled, sequential first-come order)
- [ ] S7 Frontend foundation: tokens, shared components, API client, routing, error banner
- [ ] S8 Page 1 Student Identity
- [ ] S9 Page 2 Student Dashboard
- [ ] S10 Page 3 Class Details
- [ ] S11 Page 4 Application / Hold (countdown, pay, cancel, expired and confirmed states)
- [ ] S12 Page 5 My Applications
- [ ] S13 Admin shell + Page 6 Admin Dashboard
- [ ] S14 Page 7 Manage Classes
- [ ] S15 Page 8 Create Class
- [ ] S16 Cross-cutting UI states: loading, empty, errors, refresh persistence, polling
- [ ] S17 Dockerfiles, compose finalisation, persistence check, README
- [ ] S18 ASSUMPTIONS.md, AI_USAGE.md, final traceability check
- [ ] S19 Bonus: two-process test (X1), frontend tests (X2)

Priority if time runs short: must-haves first (S0 to S18), bonus (S19) last.

## 13. Section prompt and report templates

Prompt template the user sends: `SECTION <ID> - <name>` / Context / Goal / Requirements covered / Deliverables / Constraints / Done when.
Every section report ends with: files created or changed; how to run and test; DoD checklist; requirement IDs satisfied; suggested Git commit message; AI_USAGE note (or "none").

## 14. Validation checks (full pass in S18)

- API: curl or .http examples for every endpoint, happy path plus every 4xx (missing or malformed header, bad body, unknown ids, wrong owner, no seat, double hold, expired confirm). No input produces 500.
- DB: SQL checks that held_seats and confirmed_seats equal real reservation counts, no CHECK violation, partial unique index exists.
- Concurrency: 1000 simultaneous requests from different students on 10 seats = exactly 10 x 201, 990 x 409, final held + confirmed = 10 (also with two backend processes for X1). One student sending 50 simultaneous holds to one class = exactly one hold. Confirm racing with expiry = one winner, consistent counters.
- Idempotency and lifecycle: repeated confirm adds +1 once; cancel and expiry release exactly one seat; no double release.
- Expiry: with HOLD_DURATION_SECONDS=3 the seat returns without any API call; with the worker stopped GET /classes already shows reduced heldSeats; UI flips to EXPIRED and disables Pay without reload.
- Persistence: down then up keeps data; fresh clone on a clean machine with only Docker works.
- Frontend manual checklist: U1 to U6, refresh and browser-reopen persistence, server stopped (friendly error, recovery), invalid ID.
- Traceability: final table of every requirement ID -> where implemented -> which test or check proves it.

## 15. Change log (append one row per task, oldest first)

| Date-time (Asia/Dhaka) | Section | What changed | Main files |
|------------------------|---------|--------------|------------|
| 2026-11-10 16:53 | S0 | Repo scaffold, Docker Compose (Postgres, .NET 8, React 18 TS), health endpoints and volume persistence | docker-compose.yml, backend/, frontend/, .env.example, README.md |

## 16. Known issues / TODO

- (none yet)

## 17. AI mistakes log (feeds AI_USAGE.md)

- An earlier plan wrongly named Prisma as the ORM for a .NET backend. Caught by checking the spec (ORM is free choice, Prisma is a Node ORM). Fix: EF Core + raw SQL (D1).
- The design mockups contained placeholders that contradict the requirement or are invented (see 11.3). Caught by comparing each mockup against the requirement list.
- During S0 frontend scaffold, downgrading to React 18 omitted @types/node required by tsconfig.node.json, causing tsc -b to fail inside Docker. Caught by build verification; fixed by adding @types/node.

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
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowed CORS origins (default: `http://localhost:3000`)
- `API_URL`: Backend URL for frontend container runtime injection (default: `http://localhost:8080`)

### Running Backend Tests
```bash
docker run --rm -v "${PWD}/backend:/work" -w /work mcr.microsoft.com/dotnet/sdk:8.0 dotnet test
```
