# Skerry AI - Disaster Recovery (DR) Plan

**Version:** 1.0  
**Last Updated:** 2026-05-07  
**Owner:** Engineering Team  
**Review Date:** Quarterly  

---

## 1. Overview

This document defines the Disaster Recovery (DR) procedures for Skerry AI Lead Generation Platform. It establishes Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO) for business continuity.

---

## 2. Key Metrics

### Recovery Time Objective (RTO)
**Definition:** Maximum acceptable downtime after a disaster.  
**Target:** **4 hours** for Production environment.

| Environment | RTO | Notes |
|-------------|-----|-------|
| Production | 4 hours | Critical for customer operations |
| Staging | 24 hours | Non-critical, used for testing |
| Development | 48 hours | Can be rebuilt from scratch |

### Recovery Point Objective (RPO)
**Definition:** Maximum acceptable data loss measured in time.  
**Target:** **15 minutes** for Production environment.

| Environment | RPO | Notes |
|-------------|-----|-------|
| Production | 15 minutes | Based on backup frequency |
| Staging | 24 hours | Daily backups sufficient |
| Development | 48 hours | Code stored in Git |

---

## 3. Backup Strategy

### 3.1 Database Backups

**Method:** Automated `pg_dump` via Supabase managed backups + custom script.

**Schedule:**
- **Production:** Every 15 minutes (WAL archiving) + daily full backup at 02:00 UTC
- **Staging:** Daily at 03:00 UTC
- **Development:** Weekly on Sundays at 04:00 UTC

**Retention:**
- Production: 30 days (daily), 7 days (15-min logs)
- Staging: 14 days
- Development: 7 days

**Storage:**
- Supabase managed storage (primary)
- Local backups via `scripts/backup.sh` (secondary)
- Optional: AWS S3 for offsite storage

### 3.2 File/Asset Backups

| Asset Type | Backup Method | Frequency | Retention |
|-----------|---------------|-----------|-----------|
| User uploads | Supabase Storage replication | Real-time | 30 days |
| Generated emails | Database (covered above) | - | - |
| Configuration (.env) | Manual backup to 1Password | On change | Indefinite |
| Code repository | Git (GitHub) | On commit | Indefinite |

---

## 4. Recovery Procedures

### 4.1 Database Recovery

**From Supabase managed backup:**
1. Log into Supabase dashboard
2. Navigate to Project → Database → Backups
3. Select point-in-time recovery (PITR) or latest backup
4. Click "Restore" and follow prompts
5. Update connection strings if new database created

**From custom backup (`scripts/restore.sh`):**
```bash
# Restore from local backup
cd /path/to/skerry-ai
./scripts/restore.sh ./backups/skerry_backup_YYYYMMDD_HHMMSS.sql.gz

# Verify restore
curl http://localhost:3001/api/health
```

### 4.2 Full System Recovery

**Scenario:** Complete loss of server/infrastructure.

**Steps:**
1. **Provision new server** (e.g., AWS EC2, DigitalOcean Droplet)
2. **Install dependencies:**
   ```bash
   # Install Node.js, pnpm, PostgreSQL client
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs postgresql-client
   npm install -g pnpm
   ```
3. **Restore code:**
   ```bash
   git clone https://github.com/your-org/skerry-ai.git
   cd skerry-ai
   pnpm install
   ```
4. **Restore environment:**
   - Copy `.env.production` from secure backup
   - Update `DATABASE_URL` if restoring to new database
5. **Restore database** (see 4.1 above)
6. **Build and start:**
   ```bash
   pnpm build
   pnpm start
   ```
7. **Verify:** `curl http://localhost:3001/api/health`

**Estimated time:** 2-3 hours (within RTO of 4 hours)

---

## 5. Test Schedule

### 5.1 Backup Integrity Tests
- **Frequency:** Monthly
- **Procedure:** Restore backup to isolated test environment
- **Success Criteria:** All data present, application functional
- **Document results:** In `docs/dr-test-log.md`

### 5.2 Full DR Drill
- **Frequency:** Quarterly
- **Procedure:** Simulate complete system failure, perform full recovery
- **Participants:** Engineering team
- **Measure:** Actual RTO vs. target (4 hours)
- **Document results:** In `docs/dr-test-log.md`

### 5.3 Test Log Template
```markdown
## DR Test - YYYY-MM-DD

**Type:** [Backup Integrity | Full DR Drill]  
**Conducted by:** [Name]  
**Start time:** HH:MM UTC  
**End time:** HH:MM UTC  
**Actual RTO:** X hours Y minutes  
**Target RTO:** 4 hours  
**Result:** [PASS | FAIL]  
**Issues found:**  
**Action items:**  
```

---

## 6. Contact Information

| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | Engineering Lead | oncall@skerry.ai |
| Secondary On-Call | Senior Engineer | secondary@skerry.ai |
| Supabase Support | - | support@supabase.io |

---

## 7. Escalation Matrix

| Severity | Response Time | Notify |
|----------|---------------|---------|
| SEV1 - Full outage | 15 minutes | On-call, CTO |
| SEV2 - Partial outage | 1 hour | On-call |
| SEV3 - Degraded service | 4 hours | On-call |

---

## 8. Compliance Notes

- **SOC 2:** DR plan reviewed quarterly (required for Type II)
- **GDPR:** Backups contain personal data; ensure encryption at rest
- **Data Residency:** Backups stored in EU (Frankfurt) region for EU customers

---

## Appendix A: Useful Commands

```bash
# Create manual backup
./scripts/backup.sh

# List available backups
ls -lh ./backups/

# Restore from specific backup
./scripts/restore.sh ./backups/skerry_backup_20260507_123456.sql.gz

# Check database size
psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size('postgres'));"

# Check backup integrity (dry run)
gunzip -t ./backups/skerry_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

**Document Control:**  
- Created: 2026-05-07  
- Next Review: 2026-08-07  
- Status: ACTIVE
