# School Admission System

A robust, production-grade online school admission platform built with **C# / .NET 8** and **React 18 + TypeScript**, backed by **PostgreSQL** and fully containerised with **Docker**.

The system provides first-come, first-served (FCFS) seat reservations with simulated fee payment, real-time seat availability polling, automated hold expiration, and comprehensive administration capabilities.

---

## 1. Prerequisites

- **Docker Engine 24+** and **Docker Compose v2+** (e.g. Docker Desktop on macOS/Windows or Docker Engine on Linux).
- No local installation of the .NET SDK, Node.js, or PostgreSQL is required. The entire stack—database, backend API, frontend web application, and automated test runners—runs in Docker containers.

---

## 2. Quick Start

Clone the repository and run:

```bash
docker compose up --build
```

Docker Compose builds and starts all three services in order:
1. `db`: PostgreSQL 16 initialized with connection tuning (`max_connections=200`), database schema, and healthchecks.
2. `backend`: ASP.NET Core 8 Web API, automatically executing EF Core schema migrations upon startup and verifying database readiness.
3. `frontend`: Nginx serving the compiled React 18 SPA with runtime environment variable injection for backend connectivity.

To stop the services and retain data:
```bash
docker compose down
```

To stop the services and completely reset all data:
```bash
docker compose down -v
```

---

## 3. URLs and Port Mapping

| Service | Host URL | Description |
|---|---|---|
| **Frontend Web App** | [http://localhost:3000](http://localhost:3000) | Single Page Application (Student & Admin portals) |
| **Backend API Health** | [http://localhost:8080/health](http://localhost:8080/health) | API healthcheck endpoint (`{"status":"ok"}`) |
| **Backend API Base** | [http://localhost:8080](http://localhost:8080) | RESTful API endpoints |
| **PostgreSQL Database** | `db:5432` (internal Docker network) | Host port is unexposed for security |

### Navigation Paths in Frontend
- **Student Identity**: `http://localhost:3000/identity` (Enter 17-digit birth registration number)
- **Student Dashboard**: `http://localhost:3000/` (Browse classes, view active hold countdown, apply)
- **Class Details**: `http://localhost:3000/classes/:classId` (Live seat distribution and apply button)
- **Application / Hold**: `http://localhost:3000/holds/:holdId` (Countdown ring, Pay fee, Cancel hold)
- **My Applications**: `http://localhost:3000/my-applications` (History of all held, confirmed, expired, and cancelled seats)
- **Admin Dashboard**: `http://localhost:3000/admin` (High-level enrollment statistics and seat bars)
- **Manage Classes**: `http://localhost:3000/admin/classes` (Real-time tabular class management and edit links)
- **Create Class**: `http://localhost:3000/admin/classes/new` (Unified create/edit form with live parent preview)

---

## 4. Environment Variables

All settings have sensible defaults configured in `docker-compose.yml` and `.env.example`:

| Variable | Default Value | Description |
|---|---|---|
| `POSTGRES_DB` | `admission_db` | PostgreSQL database name |
| `POSTGRES_USER` | `admission_user` | PostgreSQL database username |
| `POSTGRES_PASSWORD` | `admission_pass` | PostgreSQL database password |
| `ConnectionStrings__Default` | `Host=db;Port=5432;Database=admission_db;...` | Npgsql database connection string |
| `HOLD_DURATION_SECONDS` | `600` | Seat reservation hold window in seconds (default: 10 minutes) |
| `EXPIRY_WORKER_ENABLED` | `true` | Enables the background worker for cleaning expired reservations |
| `EXPIRY_INTERVAL_MILLISECONDS`| `1000` | Interval at which the background worker runs cleanup queries (ms) |
| `Cors__AllowedOrigins` | `http://localhost:3000` | Comma-separated list of allowed CORS browser origins |
| `API_URL` | `http://localhost:8080` | Backend API URL injected at container startup into frontend |

---

## 5. Running Automated Tests

### Backend Automated Test Suite (Docker-only)
The project currently includes 88 comprehensive automated xUnit tests (verified suite) covering high-concurrency races (1,000 simultaneous requests on 10 seats), double-submit idempotency, hold lifecycle transitions (hold, confirm, cancel, expire), input validation table tests, and expired-hold read consistency.

Run the test suite inside Docker without needing .NET installed locally:

```bash
docker compose --profile tests run --rm tests
```

*Output summary:*
```text
Test Run Successful.
Total tests: 88
     Passed: 88
 Total time: ~11 Seconds
```

### Frontend Unit Tests (Vitest + React Testing Library, bonus X2)
Comprehensive test suite across 12 test files (currently 103 verified tests) covering identity validation (17-digit rule and the Identity page), the countdown hook (server clock-skew correction and the flip to EXPIRED at zero), the active application hook, student flows, class details, hold lifecycle, application history, admin dashboard, class creation and management, and error-code to plain-language message mapping in the API client:

```bash
cd frontend
npm ci
npm test
```

*Output summary:*
```text
 Test Files  12 passed (12)
      Tests  103 passed (103)
```

### Frontend Build Verification
The frontend TypeScript build and bundle can be verified directly:

```bash
cd frontend
npm ci
npm run build
```

### Two-Process Concurrency Test (bonus X1, Docker-only)
Starts a second backend process on port 8081 against the same database, then sends 1000 parallel hold requests (half to each port) at a new 10-seat class:

```bash
docker compose --profile x1 up -d --build          # db, backend (8080), frontend, backend2 (8081)
docker compose --profile x1 run --rm x1-test       # runs scripts/x1-two-process-test.mjs
docker compose exec -T db psql -U admission_user -d admission_db < backend/sql/verify.sql
```

The script prints a tally per port and exits non-zero on failure. Expected: `Total: 10 x 201, 990 x 409 NO_SEATS_AVAILABLE, 0 other`, both ports report `held=10 available=0`, and the first two queries of `verify.sql` return 0 rows. With Node 18+ on the host you can also run `node scripts/x1-two-process-test.mjs` (defaults to ports 8080 and 8081). Stop the second process with `docker compose --profile x1 stop backend2`.

---

## 6. Architecture & Concurrency Design

### First-Come, First-Served (FCFS) Definition
The system enforces strict first-come, first-served semantics:
- A request that completes before another begins is guaranteed priority.
- Truly simultaneous requests hitting the server concurrently are serialized by the PostgreSQL row-level lock on the target class row.
- **Commit order is grant order.** There is no artificial queue or lottery; allocation is strictly synchronous, deterministic, and immediate.

### Single Conditional `UPDATE` vs `SELECT FOR UPDATE`
Rather than holding long-lived transaction locks using `SELECT FOR UPDATE`, seat allocation executes a single atomic conditional update:

```sql
UPDATE classes
SET held_seats = held_seats + 1
WHERE id = @classId AND held_seats + confirmed_seats < total_seats
RETURNING id;
```

**Why this matters:**
1. **Zero Overselling**: The database engine re-evaluates the `WHERE` condition when acquiring the row lock. If `held_seats + confirmed_seats == total_seats`, zero rows are modified, and the backend immediately returns `409 NO_SEATS_AVAILABLE`.
2. **Minimal Lock Duration**: The row lock is held only for microseconds during the single `UPDATE`, maximizing throughput under sudden demand spikes.

### Atomic Counters vs `COUNT(*)` Scans
Instead of executing expensive `COUNT(*)` queries on the `reservations` table during reservation creation, seat counts are maintained as indexed columns on the `classes` table:
- Stored counters provide $O(1)$ capacity validation during concurrent write spikes.
- Reads apply an effective count formula:
  $$\text{effectiveHeld} = \text{held\_seats} - \text{expiredHeld}$$
  $$\text{availableSeats} = \text{total\_seats} - \text{effectiveHeld} - \text{confirmed\_seats}$$
  This ensures read consistency even if the background cleanup worker has not yet processed recently elapsed holds.

### Avoiding Optimistic Concurrency Retry Storms
Optimistic concurrency (e.g. tracking row version tokens and looping on conflicts) suffers from catastrophic retry storms under high contention: if 1,000 guardians apply for 10 seats simultaneously, 990 requests would spin in retry loops, thrashing CPU and connection pools. By using atomic conditional updates, requests succeed or fail fast without retry storms.

### Hot-Row Trade-Off
Locking the class row during seat reservation serializes writes for that specific class. Because each class shift is independent, contention is localized strictly to that class row, allowing different classes to process reservations in parallel.

### Defense in Depth: Inviolable Database Constraints
Correctness does not depend solely on application code:
```sql
CONSTRAINT ck_classes_counters_nonneg CHECK (held_seats >= 0 AND confirmed_seats >= 0),
CONSTRAINT ck_classes_capacity        CHECK (held_seats + confirmed_seats <= total_seats)
```
These database-level `CHECK` constraints guarantee that capacity can never be exceeded under any circumstances, even across multiple API processes.

### Per-Class Active Application (Section 2.5 & 2.6, Decision D17)
A student cannot have more than one active (`HELD` unexpired or `CONFIRMED` admission) application in the SAME class at the same time. However, the same student MUST be allowed to have active applications in DIFFERENT classes simultaneously. This is strictly enforced in PostgreSQL by a partial unique index (`ux_reservations_active_per_class ON reservations (class_id, student_id) WHERE status IN ('HELD','CONFIRMED')`). Attempting to hold another seat in the same class returns `409 ALREADY_APPLIED_IN_CLASS`. Once a hold is cancelled or expires, the student can apply again to that class.

### Multi-Process Concurrency (X1)
Because concurrency control and seat invariants are enforced directly within PostgreSQL via row locks, conditional updates, and partial unique indexes, running multiple backend replicas behind a load balancer is fully safe by design without distributed locks. No seat or hold state lives in process memory, so a second process sees and changes exactly the same rows, and the expiry workers of both processes use `FOR UPDATE SKIP LOCKED` so a hold is released once. This is demonstrated by the two-process test in section 5 (exactly 10 successes across ports 8080 and 8081 on a 10-seat class); details in `ASSUMPTIONS.md` section 1.4.

---

## 7. Data Persistence Verification

Data is safely persisted across container restarts and shutdowns in a named Docker volume (`pgdata`):

1. **Start application**:
   ```bash
   docker compose up -d
   ```
2. **Create class and reserve seats** via the UI or API.
3. **Stop containers**:
   ```bash
   docker compose down
   ```
4. **Restart containers**:
   ```bash
   docker compose up -d
   ```
5. All classes, reservations, confirmed admissions, and student states are preserved intact.

---

## 8. License

This project is created for educational and evaluation purposes.
