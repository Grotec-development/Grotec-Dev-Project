# GROTEC FarmerOS — Database Backup & Disaster Recovery Guide

This operational runbook provides instructions for scheduled automated backups, integrity verification, and emergency disaster recovery procedures.

---

## 1. Automated Backups

### 1.1 Running an On-Demand Backup
Execute the provided script from the repository root:
```bash
./scripts/backup-db.sh
```
This produces a compressed archive and checksum in the `./backups` folder:
- `backups/grotec_backup_YYYYMMDD_HHMMSS.sql.gz`
- `backups/grotec_backup_YYYYMMDD_HHMMSS.sql.gz.sha256`

### 1.2 Configuring a Cron Schedule
To schedule daily backups at 02:00 AM IST with a 14-day automatic retention policy:
```bash
crontab -e
```
Add the following entry:
```cron
0 2 * * * cd /var/www/grotec-dev-project && DATABASE_URL="..." RETENTION_DAYS=14 ./scripts/backup-db.sh >> /var/log/grotec-backup.log 2>&1
```

---

## 2. Disaster Recovery & Restoration

### 2.1 Pre-Restoration Verification
1. Ensure the target database is reachable.
2. Confirm the SHA256 checksum matches:
   ```bash
   sha256sum -c backups/grotec_backup_20260921_120000.sql.gz.sha256
   ```

### 2.2 Executing Restoration
Run the restore script:
```bash
./scripts/restore-db.sh ./backups/grotec_backup_20260921_120000.sql.gz
```
To run non-interactively in automated pipelines:
```bash
./scripts/restore-db.sh ./backups/grotec_backup_20260921_120000.sql.gz --force
```

### 2.3 Post-Restoration Verification
Run the production health audit script to ensure all tables, queries, and APIs are functional:
```bash
./scripts/validate-production-health.sh
```
