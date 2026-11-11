# AI_USAGE.md — AI Tools and Contribution Log

This document records the use of AI assistance during the planning, implementation, and testing of the School Admission System, in compliance with requirements **T6** and **D-6**.

---

## 1. Tools Employed
* **Antigravity Agent (Google DeepMind)**: Primary interactive coding agent used for workspace scaffolding, backend C#/.NET 8 development, SQL queries and migrations, React/TypeScript implementation, Docker configurations, and automated verification suites.
* **Claude (Anthropic)**: Used during early architecture exploration, prompt planning, and requirements decomposition.

---

## 2. Allocation of Work

| Component / Task | AI Contribution | Human Oversight & Review |
|------------------|-----------------|--------------------------|
| **Architecture & Database Design** | Drafted initial schema, SQL constraints, migration code, and repository structure. | Corrected ORM selection, designed atomic conditional update queries, validated per-class partial unique index. |
| **Backend Implementation (.NET 8)** | Generated controller scaffolding, middleware, DTO mappings, and BackgroundService skeleton. | Enforced strict error contract (`D9`), verified `clock_timestamp()` vs `now()` time semantics, and tuned connection pool limits. |
| **Frontend Implementation (React 18 + TS)** | Generated UI components, Tailwind CSS styling, routing layouts, and custom countdown hooks. | Refined layout against visual mockups, resolved design discrepancies, validated zero-reload recovery and mobile responsiveness. |
| **Testing & Docker Automation** | Created xUnit tests, Testcontainers fixtures, Dockerfiles, and compose configurations. | Debugged test isolation, verified persistence across restarts, and stress-tested 1000-request concurrency scenarios. |

---

## 3. Discrepancies, AI Mistakes, and Resolutions

The following log details instances where AI output was incorrect, incomplete, or deviated from project requirements, and how each issue was caught and resolved:

| # | Phase / Section | AI Error / Misconception | Detection Method | Resolution |
|---|-----------------|--------------------------|------------------|------------|
| 1 | Architecture Planning | Proposed using Prisma as the ORM for a C# .NET 8 backend. | Specification check (Prisma is a Node.js ORM, incompatible with .NET). | Selected EF Core (Npgsql) for migrations/queries combined with raw SQL for atomic updates (Decision D1). |
| 2 | UI Design Analysis | Interpreted visual mockup placeholders (e.g. "BDT 5,000" fee, single global hold limit, hardcoded "10 minutes") as binding specs. | Cross-referencing mockups against written functional requirements. | Replaced placeholders with real system dynamics: dynamic fee removal, dynamic duration derivation, and per-class hold isolation. |
| 3 | S0 Scaffold | Downgraded React to v18 without declaring `@types/node` in `package.json`, breaking TypeScript compilation. | Docker build failed with `TS2688: Cannot find type definition file for 'node'`. | Added `@types/node` to frontend devDependencies. |
| 4 | S6 Automated Tests | `ExpiryWorker` executed rapid polling loops when default connection string was absent in test harnesses; `ApiFactory` DI overrides missed `AdmissionOptions`. | Inspection of test output logs and thread hangs during xUnit execution. | Added connection string guard before worker initialization and registered options via `services.Configure<AdmissionOptions>()`. |
| 5 | S7 Frontend Foundation | Destructured unused `isActive` property in `RootLayout.tsx` `NavLink` callback under strict TypeScript flags. | `npm run build` failed with `TS6133`. | Replaced unused parameter with parameterless callback `() =>`. |
| 6 | S9 Student Dashboard | Used standard module imports instead of type-only imports for DTO interfaces under `verbatimModuleSyntax`. | `tsc -b` compilation error during build check. | Switched to explicit `import type { ... }` declarations. |
| 7 | S11 Application / Hold Page | Mismatched prop name `onClose` instead of `onDismiss` for the shared `Banner` component. | TypeScript build failed with `TS2322`. | Aligned prop name to `onDismiss`. |
| 8 | S12 My Applications | Left unused imports (`Link` in `MyApplicationsPage.tsx`, `React` and `Card` in `index.tsx`). | Strict TypeScript linting during automated build. | Removed unused import statements. |
| 9 | S16 Cross-Cutting Verification | Polling disabled on tab focus change (`refetchOnWindowFocus: false`) and missing auto-recovery event when backend restarts after outage. | Manual resilience audit simulating backend restart. | Enabled `refetchOnWindowFocus: true`, added global `server-recovered` event in `client.ts`, and auto-invalidated queries in `App.tsx`. |
| 10 | S17 Docker Healthchecks | Frontend container healthcheck queried `http://localhost:80/`, which resolved to IPv6 `::1` while Nginx only bound to IPv4. | Container reported unhealthy with `connection refused`. | Added `listen [::]:80;` to Nginx configuration and targeted `http://127.0.0.1:80/` in Docker healthcheck. |
| 11 | S19 Frontend Unit Tests | Initially installed Vitest 3 whose dependencies (tinypool, @vitest/mocker) had security advisories. | Running `npm audit` during dependency verification. | Upgraded to Vitest 5.1 with compatible Vite 6.4 and resolved all advisories (0 vulnerabilities). |
| 12 | S19 Multi-Process Docs | Referred to PostgreSQL table CHECK constraint as a "hardware-level" safety net in ASSUMPTIONS.md draft. | Technical review of architectural documentation. | Corrected terminology to "database-level" constraint. |
| 13 | S20 Active Hold Pre-Check | `DbDataReader` was left undisposed when invoking `tx.RollbackAsync()` inside the pre-check conflict branch, triggering an `NpgsqlOperationInProgressException` resulting in a 500 status. | Automated test run failure in `Same_student_cannot_hold_two_classes`. | Extracted scalar values into local variables within the using scope and disposed the reader prior to transaction rollback. |
| 14 | Section 3 Concurrency Fix | Permissive assertions (`StatusCode == NoContent || StatusCode == Conflict`) and fixed 1-second delay in `Cancel_vs_expire_real_worker_race` guaranteed 100% 409 outcomes, never observing cancellation winning. | Audit finding in test reliability review. | Decoupled cancellation-wins (204) and expiration-wins (409) into separate deterministic tests without fragile sleeps, asserting explicit HTTP status codes, verified database counters, and added row-lock contention test. |
| 15 | Section 4 415 Error Envelope | Presumed `InvalidModelStateResponseFactory` alone or `ErrorHandlingMiddleware` without MVC pipeline configuration would format HTTP 415 unsupported media type responses into the unified error envelope. | Sending `POST /classes` with `Content-Type: text/plain` returned framework-default `application/problem+json` ProblemDetails because MVC's `ClientErrorResultFilter` intercepted `UnsupportedMediaTypeResult` and wrote to the response before middleware could process it. | Set `options.SuppressMapClientErrors = true` to allow status codes to flow uncommitted to `ErrorHandlingMiddleware`, updated the 415 error message string, and added `UnsupportedContentTypeException` handling in `InvalidModelStateResponseFactory`. |
| 16 | Section 5 Frontend Error Precedence | Evaluated error messages in components using `err.rawMessage || err.message`, which unconditionally favored raw English strings returned by the backend over localized user-facing translations. | Audit finding in Section 5 i18n testing. | Removed `rawMessage` fallback in component error handlers, prioritized `err.message` (and `getUserMessage(lang)`), ensured internal exception details are never exposed to students, and verified Bangla translations take precedence. |
