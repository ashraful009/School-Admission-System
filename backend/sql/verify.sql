-- =============================================================================
-- backend/sql/verify.sql
-- Database consistency and constraint verification queries.
-- Reused in S1, S14, and S18.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- (a) Every class whose stored held_seats or confirmed_seats differs from the
--     real reservation counts.
--     Should return 0 rows when the database is in a consistent state.
-- -----------------------------------------------------------------------------
SELECT 
    c.id,
    c.name,
    c.held_seats AS stored_held,
    COALESCE(r.actual_held, 0) AS actual_held,
    c.confirmed_seats AS stored_confirmed,
    COALESCE(r.actual_confirmed, 0) AS actual_confirmed
FROM classes c
LEFT JOIN (
    SELECT 
        class_id,
        COUNT(*) FILTER (WHERE status = 'HELD') AS actual_held,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS actual_confirmed
    FROM reservations
    GROUP BY class_id
) r ON c.id = r.class_id
WHERE c.held_seats <> COALESCE(r.actual_held, 0)
   OR c.confirmed_seats <> COALESCE(r.actual_confirmed, 0);

-- -----------------------------------------------------------------------------
-- (b) Any class violating the capacity rule or non-negative counter checks.
--     (held_seats + confirmed_seats > total_seats OR held_seats < 0 OR confirmed_seats < 0)
--     Should return 0 rows.
-- -----------------------------------------------------------------------------
SELECT 
    id,
    name,
    total_seats,
    held_seats,
    confirmed_seats,
    (held_seats + confirmed_seats) AS occupied_seats
FROM classes
WHERE (held_seats + confirmed_seats) > total_seats
   OR held_seats < 0
   OR confirmed_seats < 0;

-- -----------------------------------------------------------------------------
-- (c) Existence and definition of the partial unique index ux_reservations_active_per_class.
--     Should return 1 row confirming the unique index and predicate.
-- -----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'reservations'
  AND indexname = 'ux_reservations_active_per_class';

