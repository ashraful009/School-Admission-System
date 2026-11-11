using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolAdmission.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnforceOneActiveApplicationPerStudent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Clean existing data so the index can be created:
            // For every student with more than one active row (HELD or CONFIRMED),
            // keep one row (CONFIRMED beats HELD, then the earliest created_at),
            // mark the others CANCELLED with cancelled_at set.
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY student_id 
                               ORDER BY 
                                   CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 2 END ASC,
                                   created_at ASC,
                                   id ASC
                           ) AS rn
                    FROM reservations
                    WHERE status IN ('HELD', 'CONFIRMED')
                ),
                to_cancel AS (
                    SELECT id FROM ranked WHERE rn > 1
                )
                UPDATE reservations
                SET status = 'CANCELLED',
                    cancelled_at = clock_timestamp()
                WHERE id IN (SELECT id FROM to_cancel);
            ");

            // Step 2: Recompute classes.held_seats (count of HELD rows) and
            // classes.confirmed_seats (count of CONFIRMED rows) from reservations.
            migrationBuilder.Sql(@"
                UPDATE classes c
                SET held_seats = COALESCE(counts.held_cnt, 0),
                    confirmed_seats = COALESCE(counts.confirmed_cnt, 0)
                FROM (
                    SELECT 
                        c2.id,
                        COUNT(r.id) FILTER (WHERE r.status = 'HELD')::int AS held_cnt,
                        COUNT(r.id) FILTER (WHERE r.status = 'CONFIRMED')::int AS confirmed_cnt
                    FROM classes c2
                    LEFT JOIN reservations r ON c2.id = r.class_id
                    GROUP BY c2.id
                ) counts
                WHERE c.id = counts.id;
            ");

            // Step 3: Drop ux_reservations_active_per_class
            migrationBuilder.DropIndex(
                name: "ux_reservations_active_per_class",
                table: "reservations");

            // Step 4: Create unique index ux_reservations_active_per_student
            migrationBuilder.CreateIndex(
                name: "ux_reservations_active_per_student",
                table: "reservations",
                column: "student_id",
                unique: true,
                filter: "status IN ('HELD','CONFIRMED')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_reservations_active_per_student",
                table: "reservations");

            migrationBuilder.CreateIndex(
                name: "ux_reservations_active_per_class",
                table: "reservations",
                columns: new[] { "class_id", "student_id" },
                unique: true,
                filter: "status IN ('HELD','CONFIRMED')");
        }
    }
}

