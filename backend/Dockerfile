# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy only the csproj files first so the restore layer is cached
COPY src/SchoolAdmission.Api/SchoolAdmission.Api.csproj             src/SchoolAdmission.Api/
COPY src/SchoolAdmission.Application/SchoolAdmission.Application.csproj src/SchoolAdmission.Application/
COPY src/SchoolAdmission.Domain/SchoolAdmission.Domain.csproj       src/SchoolAdmission.Domain/
COPY src/SchoolAdmission.Infrastructure/SchoolAdmission.Infrastructure.csproj src/SchoolAdmission.Infrastructure/

# Restore only the API project (and its transitive dependencies)
RUN dotnet restore src/SchoolAdmission.Api/SchoolAdmission.Api.csproj

# Copy the rest of the source
COPY src/ src/

# Publish in Release mode
RUN dotnet publish src/SchoolAdmission.Api/SchoolAdmission.Api.csproj \
    -c Release \
    --no-restore \
    -o /app

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Install curl for container healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app .

HEALTHCHECK --interval=5s --timeout=5s --retries=10 --start-period=10s \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "SchoolAdmission.Api.dll"]

