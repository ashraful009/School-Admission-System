# ASSUMPTIONS.md — Architectural Decisions and Assumptions

This document records all architectural choices, assumptions made where the brief was silent, and deliberate design decisions for the School Admission System (requirements T7, D-4).

---

## 1. Core Concurrency & Business Rules

### 1.1 Class-Scoped Active Application Per Student (Decision D17, Superseding D16)
* **Requirement text**: "A student cannot have more than one active hold or confirmed admission in the same class at the same time. However, the same student MUST be allowed to have active applications in DIFFERENT classes simultaneously."
* **Decision (D17, supersedes D16)**: A student may have at most **ONE active application** (meaning one unexpired `HELD` hold or one `CONFIRMED` admission) in the **SAME class**:
  - The same student is explicitly permitted to have active applications in different classes simultaneously (e.g. Class 6 Morning, Class 6 Day, Class 7 Morning).
  - Attempting to create a second active hold in the same class returns `409 ALREADY_APPLIED_IN_CLASS`.
  - Once a hold in a class is cancelled or expires, the student may reapply to that class.
* **Database Enforcement**: Enforced unconditionally at the database level by a partial unique index on `(class_id, student_id)`:
  ```sql
  CREATE UNIQUE INDEX ux_reservations_active_per_class
    ON reservations (class_id, student_id)
    WHERE status IN ('HELD', 'CONFIRMED');
  ```
  Because enforcement lives in PostgreSQL, it holds safely under extreme concurrency and across multiple backend processes (bonus X1).
* **Create-Hold Order & Deadlock Prevention**:
  1. Validate class exists (404).
  2. Reclaim expired HELD rows of this class, updating `classes.held_seats`.
  3. Pre-check: if the student already holds or confirmed an application in this class, return `409 ALREADY_APPLIED_IN_CLASS`.
  4. Conditional seat update (`held_seats = held_seats + 1 WHERE held_seats + confirmed_seats < total_seats`).
  5. Insert reservation. On unique violation (SQLSTATE 23505 race on `(class_id, student_id)`), roll back and return `409 ALREADY_APPLIED_IN_CLASS`.
  6. On deadlock or serialization failure (SQLSTATE 40P01, 40001), retry the whole transaction once before failing.

### 1.2 First-Come, First-Served (FCFS) Definition
* **Decision (D5)**: FCFS is implemented without an asynchronous queue or lottery mechanism:
  - A request that finishes before another starts is guaranteed to win.
  - Simultaneous requests contending for the last remaining seat are ordered by PostgreSQL's row-level lock on the `classes` table row.
  - Database commit order defines the grant order.
  - No overselling can occur because each seat reservation requires a single atomic conditional update:
    ```sql
    UPDATE classes
    SET held_seats = held_seats + 1
    WHERE id = @class_id AND (held_seats + confirmed_seats) < total_seats
    RETURNING id;
    ```
    If no row is updated, the transaction rolls back and returns `409 NO_SEATS_AVAILABLE`.

### 1.3 Read Consistency & Effective Counts
* **Decision (D6)**: Reads (`GET /classes`, `GET /classes/{id}`, `GET /holds/{id}`, `GET /me/holds`) must reflect true capacity even if the background cleanup worker has not yet processed recently expired holds:
  - In `GET /classes` and `GET /classes/{id}`, effective counters are computed in a single SQL query:
    $$\text{expiredHeld} = \text{COUNT}(*) \text{ WHERE status = 'HELD' AND expires\_at} \le \text{now()}$$
    $$\text{effectiveHeld} = \text{held\_seats} - \text{expiredHeld}$$
    $$\text{availableSeats} = \text{total\_seats} - \text{effectiveHeld} - \text{confirmed\_seats}$$
  - In `GET /holds/{id}` and `GET /me/holds`, a reservation with stored status `HELD` whose `expires_at` $\le \text{now()}$ is returned with dynamic status `EXPIRED`.
  - Database stored counters remain conservative (never drop below reality before worker cleanup), protecting PostgreSQL table CHECK constraints.
  - Reads do not perform lazy write mutations on GET requests, preserving HTTP GET idempotency and read-replica compatibility.

### 1.4 Multi-Instance Concurrency Guarantee (Bonus X1)
* **How X1 is guaranteed**: If two or more backend processes run on different ports against the same PostgreSQL database, capacity limits can never be breached:
  - **Zero in-memory state**: Neither seats nor holds are tracked in application memory or local locks (e.g. `lock`, `SemaphoreSlim`).
  - **Single source of truth**: The database row lock serializes competing seat allocation updates across any number of backend replicas.
  - **Database CHECK constraint**: `CONSTRAINT ck_classes_capacity CHECK (held_seats + confirmed_seats <= total_seats)` acts as a database-level safety net, rejecting any statement that would oversell.
  - **Safe background worker**: `ExpiryWorker` uses `SELECT ... FOR UPDATE SKIP LOCKED`, preventing multiple backend instances from deadlocking or double-reclaiming expired holds.
  - **Connection budget (D15)**: each process uses at most 50 pooled connections; PostgreSQL allows 200, so two processes (100) stay well inside the limit.
  - **Migrations**: the second process (`backend2`, compose profile `x1`) starts only after the first is healthy, so migrations never run twice at the same moment.
* **How it is proven**: `docker compose --profile x1 up -d --build` starts `backend2` on port 8081 against the same `db`. `docker compose --profile x1 run --rm x1-test` (script `scripts/x1-two-process-test.mjs`) creates a 10-seat class and sends 1000 parallel holds from different students, half to each process. Expected and observed: exactly 10 x 201 in total across both ports, 990 x 409 `NO_SEATS_AVAILABLE`, the same counters (held 10, available 0) through both ports, and `backend/sql/verify.sql` returns 0 rows for its consistency checks.

---

## 2. Technical Decisions & Architecture (D1 – D15)

| # | Topic | Decision | Reason |
|---|-------|----------|--------|
| **D1** | ORM & Data Access | EF Core (Npgsql) for schema migrations, entities, and read queries; raw SQL via ADO.NET for atomic conditional updates. | Combines EF Core migrations and productivity with raw SQL guarantees for high-concurrency conditional seat updates. |
| **D17** (supersedes D16) | Per-Class Active Application | Partial unique index on `(class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`. | Enforces at most one active application in the SAME class; allows simultaneous active applications in DIFFERENT classes per Section 2.5 and 2.6 specification. |
| **D3** | Shift Modeling | Shift is not an independent DB column; UI composes class name from class and shift inputs (`Class 6 - Morning Shift`). | Adheres to API contract (`POST /classes` accepts `{ name, totalSeats }`). |
| **D4** | Student Identifier | 17-digit birth registration number validated with `^\d{17}$`, stored as `varchar(17)`. | Matches official Bangladesh birth registration numbering standard; prevents numeric overflow issues with 64-bit integers. |
| **D5** | FCFS Implementation | Atomic single-statement conditional `UPDATE` on class row; commit order equals grant order. | High throughput, deterministic ordering, zero queuing complexity for synchronous REST endpoints. |
| **D6** | Read Consistency | Reads compute effective seat counts by subtracting expired-unreleased holds in the SQL query. | Instantaneous read consistency even if the background worker has a slight delay or is disabled. |
| **D7** | Data Types | `student_id` is `varchar(17)` with DB `CHECK (student_id ~ '^[0-9]{17}$')`. | Avoids string padding issues inherent to `char(17)` and enforces format validation in the engine. |
| **D8** | Primary Key Format | UUIDs (`gen_random_uuid()`), exposed in JSON as standard 36-char lowercase strings. | Globally unique, safe against enumeration attacks, fully supported by PostgreSQL and .NET `Guid`. |
| **D9** | Unified Error Body | `{ "error": { "code": "<CODE>", "message": "<plain English>" } }` for all 4xx/5xx responses. | Consistent client contract across validation failures, business conflicts, routing errors, and exceptions. |
| **D10** | Frontend Stack | Vite + React 18 + TypeScript + Tailwind CSS v4 (`@theme`) + TanStack Query v5 + `@fontsource`. | Modern developer ergonomics, auto-polling with background pause, zero runtime UI kit bloat, offline fonts. |
| **D11** | Database Clocks | Write paths use `clock_timestamp()`; autocommit reads may use `now()`. | `now()` freezes at transaction start; `clock_timestamp()` ensures freshness after waiting on a row lock. |
| **D12** | Test DB Strategy | Real PostgreSQL via Testcontainers with fallback to `TEST_CONNECTION_STRING`. | Allows Docker-only automated testing via `docker compose --profile tests run --rm tests` without host Docker-in-Docker requirements. |
| **D13** | Create-Hold Pre-check | Check for existing active hold before acquiring class row lock. | Fast rejection with `ALREADY_APPLIED_IN_CLASS` when a student reapplies, even if the class is completely full. |
| **D14** | Expiry Worker Config | Configurable via `EXPIRY_WORKER_ENABLED` (default `true`) and `EXPIRY_INTERVAL_MILLISECONDS` (default `1000`). | Allows automated tests to disable the worker and verify instantaneous read consistency (D6). |
| **D15** | Connection Pooling | PostgreSQL `max_connections=200`, Npgsql pool size 50 per backend instance. | Accommodates 1000 concurrent requests across multiple backend replicas without exhausting DB connections. |

---

## 3. Status Code & Error Handling Choices

All error responses adhere to the standard envelope:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description."
  }
}
```

* **400 Bad Request**:
  - `VALIDATION_ERROR`: Missing or blank class name, name $>100$ characters, total seats missing, $\le 0$, $>10000$, non-integer values, or malformed JSON.
  - `INVALID_STUDENT_ID`: Missing `X-Student-Id` header, non-numeric characters, or length not equal to 17 digits.
* **404 Not Found**:
  - `NOT_FOUND`: Target class or hold UUID does not exist, ID is malformed (treated as non-existent), attempting to access/confirm/cancel another student's hold, or route does not exist.
* **405 Method Not Allowed**:
  - `METHOD_NOT_ALLOWED`: HTTP verb not supported for the path (e.g. `DELETE /classes`).
* **415 Unsupported Media Type**:
  - `UNSUPPORTED_MEDIA_TYPE`: Request sent with non-JSON content type when a JSON body is required.
* **409 Conflict**:
  - `NO_SEATS_AVAILABLE`: Class has no available capacity remaining.
  - `ALREADY_APPLIED_IN_CLASS`: Student already has a `HELD` or `CONFIRMED` reservation in this class.
  - `HOLD_EXPIRED`: Attempting to confirm or cancel an expired hold.
  - `HOLD_NOT_ACTIVE`: Attempting to confirm a hold that was already cancelled.
  - `HOLD_ALREADY_CONFIRMED`: Attempting to cancel a hold that has already been confirmed.
  - `TOTAL_SEATS_BELOW_OCCUPIED`: Admin attempting to reduce class total seats below active held + confirmed count.
* **500 Internal Server Error**:
  - `INTERNAL_ERROR`: Catch-all for unhandled exceptions with safe, non-leaking error message.

---

## 4. Contract Extensions & Additive Fields

All base API contract specifications (A1 through A8) are strictly honored. The following non-breaking additions were introduced:

1. **A9: `PUT /classes/{classId}`**:
   - Allows administrative editing of class name and total seats.
   - Prevents total capacity from dropping below currently occupied seats (`held_seats + confirmed_seats`).
2. **Additive Hold Fields**:
   - `className`: Enables the hold details page and my-applications list to render class names without secondary lookup queries.
   - `createdAt`: Enables UI to display when the hold was created.
   - `confirmedAt`: Enables display of payment confirmation timestamp.
   - `serverTime`: Returned with hold responses to allow the frontend countdown timer to compute clock skew against server time.
3. **Additive Class Field**:
   - `holdDurationSeconds`: Returned in class objects so the client can dynamically display hold duration (e.g. "Holds valid for 10 minutes") rather than hard-coding static text.

---

## 5. Visual Mockup Corrections (Discrepancies Resolved)

The provided visual mockup images served as design inspirations, but had discrepancies with the requirements:

1. **Global vs. Per-Class Limit**: Class Details mockup claimed students could only hold one seat across all classes. *Correction*: Requirement R3 explicitly states the rule is per class; corrected text to "You can hold one seat per class at a time."
2. **Admission Fee Placeholder**: Hold page displayed "Admission fee BDT 5,000". *Correction*: The brief specifies simulated payment with no fee amount. Removed the fee figure.
3. **Edit Class Button**: Manage Classes mockup included an Edit button not present in initial API endpoints. *Correction*: Kept the Edit button and added endpoint A9 / feature U7.
4. **Dashboard Seat Counter**: Mockup showed a hardcoded "244 seats left today" while class tiles summed to 75. *Correction*: Computed the real dynamic sum of `availableSeats` across all classes.
5. **Admin Layout Navigation**: Admin mockups showed the student top bar. *Correction*: Admin pages use a dedicated sidebar layout under `/admin`, while the top nav includes "Student" and "Admin" role switchers.
6. **Multiple Active Holds on Dashboard**: Mockup card assumed a single active hold. *Correction*: Since students can hold seats in multiple classes, the dashboard displays the soonest-expiring hold card with a badge indicating `+N more active applications`.
7. **Hardcoded Expiry Duration**: Class Details mockup hardcoded "10 minutes". *Correction*: Derived from dynamic `holdDurationSeconds` configuration.
8. **Missing Hold Timestamps**: Hold and My Applications pages required creation and confirmation dates. *Correction*: Added `createdAt` and `confirmedAt` fields.
9. **Already Applied Guard**: Added disabled "Already applied" button state when the student already holds or has confirmed a seat in that class.
10. **Re-apply Action on Cancelled Holds**: My Applications mockup omitted action for cancelled holds. *Correction*: Both `EXPIRED` and `CANCELLED` applications provide an "Apply again" button.
11. **Birth Registration Entry Flow**: Ensured students are redirected to the Identity page if no birth registration number is stored in browser memory/localStorage.

---

## 6. S0 & Runtime Infrastructure Choices

* **Runtime Frontend Configuration (`config.js`)**: The frontend Docker container writes `/usr/share/nginx/html/config.js` on startup from the `API_URL` environment variable. This allows running the image in any environment without rebuilding.
* **CORS Origin Configuration**: Backend reads `Cors__AllowedOrigins` (comma-separated, default `http://localhost:3000`), ensuring security in production while enabling standard local testing.
* **Line Ending Normalization**: `.gitattributes` enforces LF line endings across the repository, preventing shell script execution errors in Linux containers.
* **Service-Isolated Docker Contexts**: Backend and Frontend have independent build contexts (`./backend` and `./frontend`), ensuring clean Docker caches and lightweight build contexts.
