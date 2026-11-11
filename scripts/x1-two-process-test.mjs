// Bonus X1: two backend processes, one database, no oversell.
//
// Creates a fresh class with X1_SEATS seats (default 10), then fires X1_REQUESTS (default 1000)
// parallel POST /classes/{id}/holds requests from different students, split evenly between two
// backend processes (BACKEND_A and BACKEND_B). Prints the tally per port and in total, and the
// class counters as seen through both processes. Exits with code 1 if anything is off.
//
// Inside Docker (only Docker needed):   docker compose --profile x1 run --rm x1-test
// From the host (Node 18+):             node scripts/x1-two-process-test.mjs
//   defaults: BACKEND_A=http://localhost:8080  BACKEND_B=http://localhost:8081

const A = (process.env.BACKEND_A || 'http://localhost:8080').replace(/\/$/, '');
const B = (process.env.BACKEND_B || 'http://localhost:8081').replace(/\/$/, '');
const REQUESTS = Number.parseInt(process.env.X1_REQUESTS || '1000', 10);
const SEATS = Number.parseInt(process.env.X1_SEATS || '10', 10);

async function json(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  // Both processes must be up.
  for (const base of [A, B]) {
    const res = await fetch(`${base}/health`).catch(() => null);
    if (!res || !res.ok) {
      console.error(`Backend not reachable: ${base}/health`);
      process.exit(1);
    }
  }

  const created = await fetch(`${A}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `X1 two-process test ${new Date().toISOString()}`, totalSeats: SEATS }),
  });
  if (created.status !== 201) {
    console.error(`Could not create class: HTTP ${created.status}`);
    process.exit(1);
  }
  const cls = await json(created);
  console.log(`Class ${cls.id} created with ${SEATS} seats`);
  console.log(`Firing ${REQUESTS} parallel holds: even -> ${A}, odd -> ${B}`);

  // Unique 17-digit student ids per run (the class is new, but keep ids readable and distinct).
  const runPrefix = String(Date.now() % 1_000_000).padStart(6, '0');
  const started = Date.now();
  const results = await Promise.all(
    Array.from({ length: REQUESTS }, async (_, i) => {
      const base = i % 2 === 0 ? A : B;
      const studentId = `9${runPrefix}${String(i).padStart(10, '0')}`;
      try {
        const res = await fetch(`${base}/classes/${cls.id}/holds`, {
          method: 'POST',
          headers: { 'X-Student-Id': studentId },
        });
        const body = await json(res);
        return { base, status: res.status, code: res.status === 201 ? 'CREATED' : body?.error?.code ?? '?' };
      } catch (err) {
        return { base, status: 0, code: `NETWORK_ERROR (${err?.cause?.code ?? err?.message})` };
      }
    }),
  );
  console.log(`All requests finished in ${Date.now() - started} ms\n`);

  const tally = new Map();
  for (const r of results) {
    const key = `${r.base} ${r.status} ${r.code}`;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  console.log('Tally per port:');
  for (const [key, count] of [...tally.entries()].sort()) console.log(`  ${String(count).padStart(5)}  ${key}`);

  const created201 = results.filter((r) => r.status === 201).length;
  const noSeat409 = results.filter((r) => r.status === 409 && r.code === 'NO_SEATS_AVAILABLE').length;
  const other = REQUESTS - created201 - noSeat409;
  console.log(`\nTotal: ${created201} x 201, ${noSeat409} x 409 NO_SEATS_AVAILABLE, ${other} other`);

  // The same counters must be visible through both processes (they share the database).
  let countersOk = true;
  for (const base of [A, B]) {
    const c = await json(await fetch(`${base}/classes/${cls.id}`));
    console.log(
      `Counters via ${base}: total=${c.totalSeats} held=${c.heldSeats} confirmed=${c.confirmedSeats} available=${c.availableSeats}`,
    );
    if (c.heldSeats + c.confirmedSeats !== SEATS || c.availableSeats !== 0) countersOk = false;
  }

  const pass = created201 === SEATS && other === 0 && countersOk;
  console.log(pass ? '\nRESULT: PASS (no oversell across two processes)' : '\nRESULT: FAIL');
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

