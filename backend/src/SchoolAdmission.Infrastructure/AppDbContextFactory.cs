using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SchoolAdmission.Infrastructure;

public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        // Default design-time dummy connection string
        optionsBuilder.UseNpgsql("Host=localhost;Database=admission_db;Username=admission_user;Password=admission_pass");

        return new AppDbContext(optionsBuilder.Options);
    }
}

