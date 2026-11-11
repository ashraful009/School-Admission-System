-- =============================================================================
-- Clean existing data and seed realistic Class 6 to 10 school admission data
-- =============================================================================

BEGIN;

-- Truncate existing reservations and classes
TRUNCATE TABLE reservations CASCADE;
TRUNCATE TABLE classes CASCADE;

-- Insert real Bangladeshi school admission classes (Class 6 to Class 10)
-- 1. Class 6 - Morning Shift (Total 60, Confirmed 40, Held 3, Available 17)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('60000000-0000-0000-0000-000000000001', 'Class 6 - Morning Shift', 60, 3, 40, now() - interval '5 days');

-- 2. Class 6 - Day Shift (Total 60, Confirmed 55, Held 2, Available 3)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('60000000-0000-0000-0000-000000000002', 'Class 6 - Day Shift', 60, 2, 55, now() - interval '5 days');

-- 3. Class 7 - Morning Shift (Total 50, Confirmed 30, Held 4, Available 16)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('70000000-0000-0000-0000-000000000001', 'Class 7 - Morning Shift', 50, 4, 30, now() - interval '4 days');

-- 4. Class 7 - Day Shift (Total 50, Confirmed 22, Held 1, Available 27)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('70000000-0000-0000-0000-000000000002', 'Class 7 - Day Shift', 50, 1, 22, now() - interval '4 days');

-- 5. Class 8 - Morning Shift (Total 45, Confirmed 45, Held 0, Available 0 - FULL)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('80000000-0000-0000-0000-000000000001', 'Class 8 - Morning Shift', 45, 0, 45, now() - interval '3 days');

-- 6. Class 8 - Day Shift (Total 45, Confirmed 38, Held 2, Available 5)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('80000000-0000-0000-0000-000000000002', 'Class 8 - Day Shift', 45, 2, 38, now() - interval '3 days');

-- 7. Class 9 - Morning Shift (Total 40, Confirmed 18, Held 3, Available 19)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('90000000-0000-0000-0000-000000000001', 'Class 9 - Morning Shift', 40, 3, 18, now() - interval '2 days');

-- 8. Class 9 - Day Shift (Total 40, Confirmed 25, Held 0, Available 15)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('90000000-0000-0000-0000-000000000002', 'Class 9 - Day Shift', 40, 0, 25, now() - interval '2 days');

-- 9. Class 10 - Morning Shift (Total 35, Confirmed 28, Held 2, Available 5)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('10000000-0000-0000-0000-000000000001', 'Class 10 - Morning Shift', 35, 2, 28, now() - interval '1 day');

-- 10. Class 10 - Day Shift (Total 35, Confirmed 12, Held 1, Available 22)
INSERT INTO classes (id, name, total_seats, held_seats, confirmed_seats, created_at)
VALUES ('10000000-0000-0000-0000-000000000002', 'Class 10 - Day Shift', 35, 1, 12, now() - interval '1 day');

-- ---------------------------------------------------------------------------
-- Seed Confirmed and Active HELD reservations to match the counters exactly!
-- ---------------------------------------------------------------------------

-- Confirmed reservations for Class 6 Morning (40 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '60000000-0000-0000-0000-000000000001',
    lpad((20081000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '4 days',
    now() - interval '3 days',
    now() - interval '4 days' + interval '5 minutes'
FROM generate_series(1, 40) AS i;

-- Active HELD reservations for Class 6 Morning (3 students, expires in 10 minutes)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '60000000-0000-0000-0000-000000000001',
    lpad((20081000000000050 + i)::text, 17, '0'),
    'HELD',
    now() - interval '1 minute',
    now() + interval '9 minutes'
FROM generate_series(1, 3) AS i;

-- Confirmed reservations for Class 6 Day (55 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '60000000-0000-0000-0000-000000000002',
    lpad((20082000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '4 days',
    now() - interval '3 days',
    now() - interval '4 days' + interval '4 minutes'
FROM generate_series(1, 55) AS i;

-- Active HELD reservations for Class 6 Day (2 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '60000000-0000-0000-0000-000000000002',
    lpad((20082000000000060 + i)::text, 17, '0'),
    'HELD',
    now() - interval '2 minutes',
    now() + interval '8 minutes'
FROM generate_series(1, 2) AS i;

-- Confirmed reservations for Class 7 Morning (30 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '70000000-0000-0000-0000-000000000001',
    lpad((20071000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '3 days' + interval '6 minutes'
FROM generate_series(1, 30) AS i;

-- Active HELD reservations for Class 7 Morning (4 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '70000000-0000-0000-0000-000000000001',
    lpad((20071000000000040 + i)::text, 17, '0'),
    'HELD',
    now() - interval '3 minutes',
    now() + interval '7 minutes'
FROM generate_series(1, 4) AS i;

-- Confirmed reservations for Class 7 Day (22 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '70000000-0000-0000-0000-000000000002',
    lpad((20072000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '3 days' + interval '2 minutes'
FROM generate_series(1, 22) AS i;

-- Active HELD reservations for Class 7 Day (1 student)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '70000000-0000-0000-0000-000000000002',
    lpad((20072000000000030 + i)::text, 17, '0'),
    'HELD',
    now() - interval '1 minute',
    now() + interval '9 minutes'
FROM generate_series(1, 1) AS i;

-- Confirmed reservations for Class 8 Morning (45 students - FULL)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '80000000-0000-0000-0000-000000000001',
    lpad((20061000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '3 days',
    now() - interval '2 days',
    now() - interval '3 days' + interval '3 minutes'
FROM generate_series(1, 45) AS i;

-- Confirmed reservations for Class 8 Day (38 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '80000000-0000-0000-0000-000000000002',
    lpad((20062000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '2 days' + interval '4 minutes'
FROM generate_series(1, 38) AS i;

-- Active HELD reservations for Class 8 Day (2 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '80000000-0000-0000-0000-000000000002',
    lpad((20062000000000045 + i)::text, 17, '0'),
    'HELD',
    now() - interval '2 minutes',
    now() + interval '8 minutes'
FROM generate_series(1, 2) AS i;

-- Confirmed reservations for Class 9 Morning (18 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '90000000-0000-0000-0000-000000000001',
    lpad((20051000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '2 days' + interval '5 minutes'
FROM generate_series(1, 18) AS i;

-- Active HELD reservations for Class 9 Morning (3 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '90000000-0000-0000-0000-000000000001',
    lpad((20051000000000030 + i)::text, 17, '0'),
    'HELD',
    now() - interval '1 minute',
    now() + interval '9 minutes'
FROM generate_series(1, 3) AS i;

-- Confirmed reservations for Class 9 Day (25 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '90000000-0000-0000-0000-000000000002',
    lpad((20052000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '2 days',
    now() - interval '1 day',
    now() - interval '2 days' + interval '7 minutes'
FROM generate_series(1, 25) AS i;

-- Confirmed reservations for Class 10 Morning (28 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '10000000-0000-0000-0000-000000000001',
    lpad((20041000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '1 day',
    now() - interval '12 hours',
    now() - interval '1 day' + interval '4 minutes'
FROM generate_series(1, 28) AS i;

-- Active HELD reservations for Class 10 Morning (2 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '10000000-0000-0000-0000-000000000001',
    lpad((20041000000000035 + i)::text, 17, '0'),
    'HELD',
    now() - interval '2 minutes',
    now() + interval '8 minutes'
FROM generate_series(1, 2) AS i;

-- Confirmed reservations for Class 10 Day (12 students)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at, confirmed_at)
SELECT 
    '10000000-0000-0000-0000-000000000002',
    lpad((20042000000000000 + i)::text, 17, '0'),
    'CONFIRMED',
    now() - interval '1 day',
    now() - interval '12 hours',
    now() - interval '1 day' + interval '6 minutes'
FROM generate_series(1, 12) AS i;

-- Active HELD reservations for Class 10 Day (1 student)
INSERT INTO reservations (class_id, student_id, status, created_at, expires_at)
SELECT 
    '10000000-0000-0000-0000-000000000002',
    lpad((20042000000000020 + i)::text, 17, '0'),
    'HELD',
    now() - interval '1 minute',
    now() + interval '9 minutes'
FROM generate_series(1, 1) AS i;

COMMIT;

