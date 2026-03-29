# PostgreSQL Managed Database Migration Guide (PLA-200)

## Current Setup
- Self-hosted PostgreSQL 16 in Docker on Hetzner VPS
- Container: `uwgokc8cs4g4ws0sk8w8o000`
- Data volume: Docker named volume
- No automated backups

## Recommended Managed Services

### Option A: Hetzner Managed Database (Recommended)
- Same datacenter = lowest latency
- PostgreSQL 16 supported
- Automated backups, point-in-time recovery
- Pricing: ~€15/mo for CPX11 equivalent

### Option B: Supabase
- Free tier available
- Built-in auth (not needed — we have our own)
- PostgreSQL 15/16

### Option C: Neon
- Serverless PostgreSQL
- Autoscaling, branching
- Free tier: 0.5 GB

## Migration Steps

### 1. Pre-migration
```bash
# Check current DB size
ssh root@5.78.101.102
docker exec uwgokc8cs4g4ws0sk8w8o000 psql -U postgres -d postgres -c "
  SELECT pg_size_pretty(pg_database_size('postgres')) AS db_size;
"

# Export full dump
docker exec uwgokc8cs4g4ws0sk8w8o000 pg_dump -U postgres -Fc postgres > backup.dump
```

### 2. Create managed instance
- Provision managed PostgreSQL 16
- Note the connection string: `postgresql://user:pass@host:port/dbname?sslmode=require`

### 3. Import data
```bash
pg_restore -h <managed-host> -U <user> -d <dbname> --no-owner backup.dump
```

### 4. Update application config
```env
# .env / Coolify environment
DATABASE_URL=postgresql://user:pass@managed-host:5432/dbname?sslmode=require
```

### 5. Verify
```bash
# Check migration count matches
psql $NEW_DATABASE_URL -c "SELECT count(*) FROM drizzle.\"__drizzle_migrations\";"

# Check table count
psql $NEW_DATABASE_URL -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

### 6. Switch over
1. Stop the worker containers (prevent writes)
2. Take final dump from old DB
3. Import into managed DB
4. Update DATABASE_URL in Coolify
5. Restart all containers
6. Verify health: `curl https://api.appranks.io/health/ready`

### 7. Cleanup
- Remove the old PostgreSQL container
- Remove Docker volume
- Update `docker-compose.prod.yml` to remove postgres service

## Connection Pool Settings

For managed DB with SSL:
```typescript
// packages/db/src/index.ts
const client = postgres(databaseUrl, {
  max: 20,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
  connection: { timezone: "UTC" },
  ssl: { rejectUnauthorized: false }, // For managed DB SSL
  connect_timeout: 10,
});
```

## Backup Strategy
- Managed service handles automated daily backups
- Point-in-time recovery up to 7 days
- Manual backups before each deployment with migrations
