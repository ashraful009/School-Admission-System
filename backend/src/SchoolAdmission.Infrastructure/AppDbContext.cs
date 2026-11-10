using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Domain;

namespace SchoolAdmission.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<AdmissionClass> Classes => Set<AdmissionClass>();
    public DbSet<Reservation> Reservations => Set<Reservation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AdmissionClass>(b =>
        {
            b.ToTable("classes", t =>
            {
                t.HasCheckConstraint("ck_classes_name_length", "char_length(btrim(name)) BETWEEN 1 AND 100");
                t.HasCheckConstraint("ck_classes_total_seats_min", "total_seats >= 1");
                t.HasCheckConstraint("ck_classes_counters_nonneg", "held_seats >= 0 AND confirmed_seats >= 0");
                t.HasCheckConstraint("ck_classes_capacity", "held_seats + confirmed_seats <= total_seats");
            });

            b.HasKey(c => c.Id);
            b.Property(c => c.Id)
                .HasColumnName("id")
                .HasDefaultValueSql("gen_random_uuid()");

            b.Property(c => c.Name)
                .HasColumnName("name")
                .HasMaxLength(100)
                .IsRequired();

            b.Property(c => c.TotalSeats)
                .HasColumnName("total_seats")
                .IsRequired();

            b.Property(c => c.HeldSeats)
                .HasColumnName("held_seats")
                .HasDefaultValue(0)
                .IsRequired();

            b.Property(c => c.ConfirmedSeats)
                .HasColumnName("confirmed_seats")
                .HasDefaultValue(0)
                .IsRequired();

            b.Property(c => c.CreatedAt)
                .HasColumnName("created_at")
                .HasDefaultValueSql("now()")
                .IsRequired();
        });

        modelBuilder.Entity<Reservation>(b =>
        {
            b.ToTable("reservations", t =>
            {
                t.HasCheckConstraint("ck_reservations_student_id", "student_id ~ '^[0-9]{17}$'");
                t.HasCheckConstraint("ck_reservations_status", "status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')");
            });

            b.HasKey(r => r.Id);
            b.Property(r => r.Id)
                .HasColumnName("id")
                .HasDefaultValueSql("gen_random_uuid()");

            b.Property(r => r.ClassId)
                .HasColumnName("class_id")
                .IsRequired();

            b.Property(r => r.StudentId)
                .HasColumnName("student_id")
                .HasMaxLength(17)
                .IsRequired();

            b.Property(r => r.Status)
                .HasColumnName("status")
                .HasMaxLength(10)
                .HasConversion<string>()
                .IsRequired();

            b.Property(r => r.CreatedAt)
                .HasColumnName("created_at")
                .HasDefaultValueSql("now()")
                .IsRequired();

            b.Property(r => r.ExpiresAt)
                .HasColumnName("expires_at")
                .IsRequired();

            b.Property(r => r.ConfirmedAt)
                .HasColumnName("confirmed_at");

            b.Property(r => r.CancelledAt)
                .HasColumnName("cancelled_at");

            b.Property(r => r.ExpiredAt)
                .HasColumnName("expired_at");

            b.HasOne(r => r.Class)
                .WithMany(c => c.Reservations)
                .HasForeignKey(r => r.ClassId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasIndex(r => new { r.ClassId, r.StudentId })
                .IsUnique()
                .HasDatabaseName("ux_reservations_active_per_class")
                .HasFilter("status IN ('HELD','CONFIRMED')");

            b.HasIndex(r => r.ExpiresAt)
                .HasDatabaseName("ix_reservations_expiry")
                .HasFilter("status = 'HELD'");

            b.HasIndex(r => new { r.StudentId, r.CreatedAt })
                .HasDatabaseName("ix_reservations_student")
                .IsDescending(false, true);
        });
    }
}

