# AppRanks — Cloud Migration Analysis

**Date:** 2026-03-27
**Prepared by:** Engineering Team
**Status:** Decision Pending
**Current Hosting:** Hetzner VPS via Coolify
**Budget Constraint:** $10-20/month

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Migration Scenarios](#2-migration-scenarios)
3. [Scenario A: GCP e2-medium Spot VM](#scenario-a-gcp-e2-medium-spot-vm)
4. [Scenario B: GCP e2-small + Cloud SQL Free Tier](#scenario-b-gcp-e2-small--cloud-sql-free-tier)
5. [Scenario C: GCP Free Tier Only (e2-micro)](#scenario-c-gcp-free-tier-only-e2-micro)
6. [Scenario D: Stay on Hetzner + GCP Backup](#scenario-d-stay-on-hetzner--gcp-backup)
7. [Scenario E: Hetzner + GCP Hybrid](#scenario-e-hetzner--gcp-hybrid)
8. [Cost Comparison Matrix](#6-cost-comparison-matrix)
9. [Decision Matrix](#7-decision-matrix)
10. [Risk Comparison](#8-risk-comparison)
11. [Recommendation](#9-recommendation)
12. [Migration Checklist](#10-migration-checklist)

---

## 1. Current Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hetzner VPS (Coolify)                        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Dashboard │  │   API    │  │  Worker  │  │   Worker      │  │
│  │ Next.js  │  │ Fastify  │  │ BullMQ   │  │  Interactive  │  │
│  │ :3000    │  │ :3001    │  │ Scraper  │  │  Playwright   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │              │                │          │
│       │         ┌────┴──────────────┴────────────────┘          │
│       │         │                                               │
│  ┌────┴─────────┴──┐  ┌─────────┐                              │
│  │   PostgreSQL    │  │  Redis  │                              │
│  │   :5432         │  │  :6379  │                              │
│  └─────────────────┘  └─────────┘                              │
│                                                                 │
│  Disk: ~50GB used                                               │
│  RAM: ~4-6GB used (Playwright spikes to 8GB+)                   │
│  CPU: 3 vCPU (bursts during scraping)                           │
└─────────────────────────────────────────────────────────────────┘
```

### Resource Usage Profile

| Resource | Idle | Normal Scraping | Peak (Browser Scraping) |
|----------|------|-----------------|------------------------|
| CPU | 5% | 30-50% | 80-100% |
| RAM | 2GB | 3-4GB | 6-8GB |
| Disk I/O | Low | Medium | Medium |
| Network | <1 Mbps | 5-10 Mbps | 10-20 Mbps |

### Current Costs

| Item | Cost |
|------|------|
| Hetzner VPS (CPX31 or similar) | €8-15/month |
| Domain | ~$12/year |
| Coolify (self-hosted) | Free |
| **Total** | **~€10-17/month** |

---

## 2. Migration Scenarios

```
                         ┌─────────────────┐
                         │  Current State   │
                         │ Hetzner/Coolify  │
                         │   €10-17/mo      │
                         └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────┴──────┐ ┌───┴────┐  ┌─────┴──────┐
              │  Full GCP  │ │ Hybrid │  │   Hetzner  │
              │  Migration │ │  Mix   │  │  + Backup  │
              └─────┬──────┘ └───┬────┘  └─────┬──────┘
                    │            │              │
             ┌──────┼──────┐    │              │
             │      │      │    │              │
          ┌──┴──┐┌──┴──┐┌──┴─┐┌─┴──┐      ┌───┴───┐
          │  A  ││  B  ││ C  ││ E  │      │   D   │
          │Spot ││Free ││Mic-││Hyb-│      │Backup │
          │ VM  ││Tier ││ro  ││rid │      │ Only  │
          └─────┘└─────┘└────┘└────┘      └───────┘
```

---

## Scenario A: GCP e2-medium Spot VM

**Concept:** Mevcut Docker Compose yapısını aynen bir GCP Spot VM'e taşı.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│              Google Cloud Platform                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │        GCE Spot VM (e2-medium)                     │  │
│  │        1 vCPU, 4GB RAM                             │  │
│  │                                                    │  │
│  │   ┌──────────┐ ┌───────┐ ┌────────┐ ┌────────┐   │  │
│  │   │Dashboard │ │  API  │ │ Worker │ │Worker-I│   │  │
│  │   │  :3000   │ │ :3001 │ │BullMQ  │ │Playwri.│   │  │
│  │   └──────────┘ └───────┘ └────────┘ └────────┘   │  │
│  │          │          │          │          │        │  │
│  │   ┌──────┴──────────┴──────────┴──────────┘       │  │
│  │   │                                               │  │
│  │   ┌──────────────┐  ┌─────────┐                   │  │
│  │   │  PostgreSQL  │  │  Redis  │                   │  │
│  │   └──────┬───────┘  └─────────┘                   │  │
│  │          │                                        │  │
│  └──────────┼────────────────────────────────────────┘  │
│             │                                            │
│  ┌──────────┴───────────┐  ┌──────────────────────┐     │
│  │  Persistent Disk     │  │  Cloud Storage       │     │
│  │  30GB SSD            │  │  Daily Backups (5GB) │     │
│  │  Survives VM restart │  │  FREE TIER           │     │
│  └──────────────────────┘  └──────────────────────┘     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Startup Script (metadata)                       │    │
│  │  → Auto-start Docker Compose on VM boot          │    │
│  │  → Handles Spot preemption recovery              │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

         ┌──────────────┐
         │  Cloudflare  │  ← DNS + CDN + SSL (Free)
         │  DNS/Proxy   │
         └──────────────┘

         ┌──────────────┐
         │ UptimeRobot  │  ← External monitoring (Free)
         └──────────────┘
```

### Spot VM Lifecycle

```
Normal Operation:
  VM Running ──── Scraping ──── Serving Dashboard ──── VM Running
                                                         │
Preemption Event (Google needs resources):               │
  VM Running ── SIGTERM (30s) ── VM STOPPED ─────────────┘
                                     │
                        ┌────────────┴────────────┐
                        │  Persistent Disk SAFE   │
                        │  Data preserved         │
                        └────────────┬────────────┘
                                     │
  Auto-restart (instance schedule) ──┘
                        │
  VM Starting ── Docker Compose Up ── Services Ready (~2-3 min)
                        │
  Resume Normal Operation
```

### Cost Breakdown

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| e2-medium Spot VM (1 vCPU, 4GB) | $8-12 | ~70% discount vs on-demand |
| 30GB SSD Persistent Disk | $2.40 | $0.08/GB/month |
| Egress traffic (~5GB) | $0.60 | First 1GB free, then $0.12/GB |
| Cloud Storage backup (5GB) | $0.00 | Free tier |
| Static IP (optional) | $0.00 | Free while attached to VM |
| **Total** | **$11-15/month** | |

### Pros

- [x] Mevcut Docker Compose **sıfır değişiklik** ile çalışır
- [x] 4GB RAM — mevcut workload için yeterli (tight ama çalışır)
- [x] Persistent Disk — VM restart'ta data korunur
- [x] Cloud Storage backup — free tier ile günlük backup
- [x] Google'ın global network altyapısı
- [x] `gcloud` CLI ile kolay yönetim
- [x] Bütçe içinde ($11-15/ay)

### Cons

- [ ] **Spot VM her an kapatılabilir** — 30 saniye uyarı ile
- [ ] Preemption sırasında **2-3 dakika downtime**
- [ ] **1 vCPU** — Hetzner'daki 3 vCPU'dan düşük
- [ ] Managed servis yok — backup/monitoring senin sorumluluğun
- [ ] **SLA yok** — Spot VM'lerin uptime garantisi yok
- [ ] Browser scraping sırasında RAM sıkışabilir

### Uptime Estimate

| Senaryo | Tahmini Uptime |
|---------|---------------|
| İyi hafta (preemption yok) | %100 |
| Normal hafta (1 preemption) | %99.5 (2-3 min downtime) |
| Kötü hafta (3 preemption) | %98.5 (10 min downtime) |
| Ortalama aylık | ~%99.2 |

---

## Scenario B: GCP e2-small + Cloud SQL Free Tier

**Concept:** Daha küçük VM + Google'ın managed database free tier denemesi.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│              Google Cloud Platform                        │
│                                                          │
│  ┌──────────────────────────┐  ┌──────────────────────┐  │
│  │   GCE Spot VM            │  │  Cloud SQL (db-f1)   │  │
│  │   e2-small               │  │  PostgreSQL 16       │  │
│  │   0.5 vCPU, 2GB RAM     │  │  Shared vCPU         │  │
│  │                          │  │  0.6GB RAM, 10GB     │  │
│  │  ┌────────┐ ┌────────┐  │  │  Auto backup ✓       │  │
│  │  │  API   │ │Dashboard│  │  │  HA: No              │  │
│  │  └────────┘ └────────┘  │  └──────────────────────┘  │
│  │  ┌────────┐ ┌────────┐  │                             │
│  │  │ Worker │ │Redis   │  │  ⚠️  Cloud SQL db-f1       │
│  │  └────────┘ └────────┘  │      pricing discontinued  │
│  └──────────────────────────┘      in some regions       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Cost Breakdown

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| e2-small Spot VM (0.5 vCPU, 2GB) | $4-6 | |
| Cloud SQL db-f1-micro | $7-9 | Shared core, auto backup |
| 20GB SSD disk | $1.60 | |
| Egress | $0.60 | |
| **Total** | **$13-17/month** | |

### Pros

- [x] **Managed database** — otomatik backup, patch, monitoring
- [x] DB VM'den bağımsız — VM crash'inde data güvende
- [x] Cloud SQL console'dan yönetim

### Cons

- [ ] **2GB RAM** — Playwright çalışamaz, worker'lar sığmaz
- [ ] Cloud SQL db-f1-micro çok yavaş (shared CPU)
- [ ] Redis hala container'da — managed Redis (Memorystore) $30+/ay
- [ ] Worker'lar için ayrı VM gerekir → bütçeyi aşar
- [ ] **Pratik olarak çalışmaz** — 2GB RAM bu workload için yetersiz

### Verdict: ❌ NOT RECOMMENDED

2GB RAM ile 6 Docker container + Playwright çalıştırmak imkansız. Cloud SQL free tier çok yavaş. Bütçeyi managed DB'ye harcamak VM'den çalıyor.

---

## Scenario C: GCP Free Tier Only (e2-micro)

**Concept:** Google'ın always-free tier'ını kullanarak sıfır maliyet.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│              Google Cloud Platform — Free Tier            │
│                                                          │
│  ┌──────────────────────────┐                            │
│  │   GCE e2-micro           │   ⚠️ LIMITATIONS:         │
│  │   0.25 vCPU, 1GB RAM    │   - 1GB RAM total         │
│  │   30GB HDD (free)       │   - 0.25 vCPU             │
│  │   1GB egress/month      │   - HDD not SSD           │
│  │                          │   - us-central1 only      │
│  │  ┌────────┐              │   - 1GB egress/month      │
│  │  │  ???   │              │                            │
│  │  └────────┘              │                            │
│  └──────────────────────────┘                            │
│                                                          │
└──────────────────────────────────────────────────────────┘

  💀 PostgreSQL alone needs 256MB+
  💀 Redis needs 64MB+
  💀 Node.js API needs 128MB+
  💀 Next.js Dashboard needs 256MB+
  💀 Playwright needs 512MB+
  💀 Total minimum: ~1.5GB → 1GB RAM ile ÇALIŞMAZ
```

### Cost Breakdown

| Item | Monthly Cost |
|------|-------------|
| e2-micro VM | $0 (free) |
| 30GB HDD | $0 (free) |
| **Total** | **$0/month** |

### Verdict: ❌ IMPOSSIBLE

1GB RAM ile bu sistem çalışamaz. PostgreSQL + Redis + API + Worker minimum 2GB gerektirir. Playwright eklediğinde 4GB minimum.

---

## Scenario D: Stay on Hetzner + GCP Backup

**Concept:** Hetzner'da kalmaya devam et, sadece backup'ı GCP Cloud Storage'a gönder.

### Architecture Diagram

```
┌───────────────────────────────┐       ┌──────────────────┐
│       Hetzner VPS             │       │  Google Cloud     │
│       (Current Setup)         │       │                  │
│                               │       │  ┌────────────┐  │
│  ┌─────────────────────────┐  │  pgdump  │   Cloud    │  │
│  │  Docker Compose         │  │ ──────►  │  Storage   │  │
│  │  (all 6 services)       │  │  daily   │  Bucket    │  │
│  └─────────────────────────┘  │       │  │  (5GB free)│  │
│                               │       │  └────────────┘  │
│  Cost: €8-15/month            │       │  Cost: $0/month  │
└───────────────────────────────┘       └──────────────────┘

         ┌──────────────┐
         │ UptimeRobot  │  ← External monitoring (Free)
         └──────────────┘
```

### Backup Flow

```
Daily at 04:00 UTC:
  ┌──────────┐     pg_dump      ┌──────────┐    gsutil cp     ┌─────────────┐
  │PostgreSQL│ ──────────────► │ backup   │ ──────────────► │Cloud Storage│
  │Container │     ~50MB       │ .sql.gz  │    encrypted    │  gs://...   │
  └──────────┘                 └──────────┘                 └─────────────┘
                                                                   │
                                                            7 daily backups
                                                            4 weekly backups
                                                            retained
```

### Cost Breakdown

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Hetzner VPS (current) | €8-15 | No change |
| GCP Cloud Storage | $0 | 5GB free tier |
| gsutil CLI | $0 | Free |
| **Total** | **€8-15/month** | Same as now |

### Pros

- [x] **Sıfır downtime** — hiçbir şey değişmiyor
- [x] **Sıfır risk** — mevcut çalışan sisteme dokunmuyorsun
- [x] **Offsite backup** — Hetzner çökse bile data GCP'de güvende
- [x] **Ek maliyet yok** — Cloud Storage 5GB free
- [x] Hetzner'ın 3 vCPU, 4-8GB RAM'i korunuyor
- [x] Coolify'ın kolay deploy mekanizması korunuyor

### Cons

- [ ] Hetzner'a bağımlılık devam ediyor
- [ ] Managed servis yok — hala her şey senin sorumluluğun
- [ ] Ölçeklenme planı yok
- [ ] Single server riski devam ediyor

### Implementation (15 minutes)

```bash
# 1. GCP'de bucket oluştur
gsutil mb -l europe-west1 gs://appranks-backups/

# 2. Service account oluştur, key indir
gcloud iam service-accounts create appranks-backup
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:appranks-backup@PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# 3. Hetzner VPS'e gsutil kur
# 4. Cron job ekle
```

---

## Scenario E: Hetzner + GCP Hybrid

**Concept:** Hetzner'da production çalışmaya devam, GCP'de disaster recovery (DR) replica hazır bekle.

### Architecture Diagram

```
┌──────────────────────────┐           ┌──────────────────────────┐
│    Hetzner (PRIMARY)     │           │     GCP (STANDBY)        │
│                          │           │                          │
│  ┌────────────────────┐  │  pg_dump  │  ┌────────────────────┐  │
│  │  Docker Compose    │  │ ────────► │  │  Docker Compose    │  │
│  │  (all services)    │  │   daily   │  │  (all services)    │  │
│  │  ACTIVE            │  │           │  │  STOPPED           │  │
│  └────────────────────┘  │           │  └────────────────────┘  │
│                          │           │                          │
│  Cost: €8-15/mo          │           │  Spot VM (stopped): $2   │
│                          │           │  30GB disk: $2.40        │
└──────────────────────────┘           └──────────────────────────┘

Normal: Hetzner serves everything, GCP VM is STOPPED (only disk costs)
Disaster: Start GCP VM, restore latest backup, switch DNS → 5 min recovery
```

### Disaster Recovery Flow

```
                    Hetzner DOWN detected!
                           │
                    ┌──────┴──────┐
                    │ UptimeRobot │
                    │   ALERT!    │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │  Manual or automated:   │
              │                         │
              │  1. Start GCP Spot VM   │
              │  2. Restore DB backup   │
              │  3. Switch DNS          │
              │  4. Verify services     │
              │                         │
              │  Recovery: ~5-15 min    │
              └─────────────────────────┘
```

### Cost Breakdown

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| Hetzner VPS (current) | €8-15 | Primary — always running |
| GCP Spot VM (STOPPED) | $0 | Stopped VMs don't cost |
| GCP 30GB SSD Disk | $2.40 | Persistent, always attached |
| Cloud Storage backup | $0 | 5GB free tier |
| **Total** | **€10-18/month** | +$2.40 for DR capability |

### Pros

- [x] **Best of both worlds** — Hetzner performance + GCP disaster recovery
- [x] Hetzner çökerse 5-15 dakikada GCP'ye geçiş
- [x] Sadece $2.40/ay ek maliyet (persistent disk)
- [x] Mevcut sisteme dokunmadan DR eklenir
- [x] GCP VM sadece ihtiyaç olduğunda başlatılır

### Cons

- [ ] DR geçişi manuel (otomasyona ihtiyaç var)
- [ ] Backup'tan restore sırasında son birkaç saatlik data kaybolabilir
- [ ] İki ortam yönetmek karmaşıklık ekler
- [ ] Spot VM başlatıldığında yer olmayabilir (nadir)

---

## 6. Cost Comparison Matrix

```
Monthly Cost ($)
     │
  25 ┤                                          ┌─────────┐
     │                                          │   GCP   │
  20 ┤                                          │On-Demand│
     │                                          │  $25    │
     │                                          └─────────┘
  15 ┤  ┌─────────┐  ┌─────────┐
     │  │ Hetzner │  │Scenario │  ┌─────────┐
     │  │ Current │  │   A     │  │Scenario │
  10 ┤  │ €10-15  │  │ $11-15  │  │   B     │
     │  └─────────┘  └─────────┘  │ $13-17  │
     │                             └─────────┘
   5 ┤  ┌─────────┐  ┌─────────┐
     │  │Scenario │  │Scenario │
     │  │   D     │  │   E     │
     │  │ €8-15   │  │ €10-18  │  ┌─────────┐
   0 ┤  └─────────┘  └─────────┘  │Scenario │
     │                             │   C     │
     │                             │  $0     │
     └─────────────────────────────└─────────┘─────────
       Hetzner    GCP Spot   GCP+SQL  Backup  Hybrid  Free
       Current      (A)       (B)      (D)     (E)    (C)
```

| | A: GCP Spot | B: GCP+SQL | C: Free | D: Backup | E: Hybrid |
|--|------------|-----------|---------|----------|----------|
| **Monthly Cost** | $11-15 | $13-17 | $0 | €8-15 | €10-18 |
| **CPU** | 1 vCPU | 0.5 vCPU | 0.25 vCPU | 3 vCPU | 3 vCPU |
| **RAM** | 4GB | 2GB | 1GB | 4-8GB | 4-8GB |
| **Disk** | 30GB SSD | 20GB SSD | 30GB HDD | 80GB | 80GB+30GB |
| **Uptime SLA** | 0% (spot) | 0% (spot) | 99.5% | 99.9% | 99.9%+ |
| **Managed DB** | No | Yes | No | No | No |
| **Auto Backup** | Manual | Yes | No | Manual→GCS | Manual→GCS |
| **Playwright** | Tight | ❌ No | ❌ No | ✅ Good | ✅ Good |
| **Code Changes** | None | Minor | N/A | None | None |
| **Downtime Risk** | High | High | N/A | Low | Very Low |
| **DR Capability** | None | None | N/A | Offsite backup | Full standby |

---

## 7. Decision Matrix

Scoring: 1 (worst) to 5 (best)

| Criteria (Weight) | A: GCP Spot | B: GCP+SQL | C: Free | D: Backup | E: Hybrid |
|-------------------|:-----------:|:---------:|:------:|:--------:|:--------:|
| **Cost** (25%) | 4 | 3 | 5 | 5 | 4 |
| **Reliability** (25%) | 2 | 2 | 1 | 4 | 5 |
| **Performance** (20%) | 2 | 1 | 1 | 4 | 4 |
| **Managed Services** (10%) | 1 | 3 | 1 | 1 | 1 |
| **Scalability** (10%) | 3 | 3 | 1 | 2 | 3 |
| **Simplicity** (10%) | 4 | 2 | 1 | 5 | 3 |
| | | | | | |
| **Weighted Score** | **2.6** | **2.2** | **1.8** | **3.8** | **3.7** |

---

## 8. Risk Comparison

```
Risk Level
     │
HIGH │  ●C             ●B
     │      ●A
     │
MED  │                          ●E
     │
LOW  │                              ●D
     │
     └────────────────────────────────────
         $0    $5    $10   $15   $20
                  Monthly Cost
```

| Risk | A: GCP Spot | D: Backup | E: Hybrid |
|------|:----------:|:--------:|:--------:|
| Total downtime/month | 5-30 min | 0 min | 0 min |
| Data loss window | 0 (persistent disk) | 0-24h (last backup) | 0-24h |
| VM preemption | Yes | No | No |
| Single server failure | Full outage | Full outage | 5-15 min failover |
| Migration risk | Medium | None | Low |
| Performance degradation | 1→3 vCPU downgrade | None | None |

---

## 9. Recommendation

### Primary: Scenario D — Hetzner + GCP Backup

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ★ RECOMMENDED: Scenario D                                 │
│                                                             │
│   Why:                                                      │
│   • Zero risk — nothing changes in production               │
│   • Zero downtime — no migration needed                     │
│   • Zero extra cost — Cloud Storage 5GB free                │
│   • Solves R-15 (no backup) — the #1 infrastructure risk   │
│   • Can upgrade to Scenario E later if needed               │
│   • 15 minutes to implement                                 │
│                                                             │
│   Cost: €8-15/month (same as now)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Secondary: Scenario E — When More Protection Needed

If Hetzner has reliability issues or business grows, upgrade from D to E by:
1. Create a GCP Spot VM (stopped by default — $0 when off)
2. Attach 30GB persistent disk ($2.40/month)
3. Pre-install Docker + clone repo on the standby VM
4. Write a failover script: start VM → restore backup → switch DNS

### Not Recommended: Full GCP Migration

$10-20/ay bütçeyle GCP'ye tam geçiş, Hetzner'dan **daha kötü** performans verir:
- 1 vCPU vs 3 vCPU
- Spot VM uptime garantisi yok
- Managed servisler bütçeye sığmıyor
- Playwright 4GB RAM'de sıkışır

**GCP tam geçiş ancak $50+/ay bütçeyle mantıklı olur** (e2-standard-2 on-demand + Cloud SQL + Memorystore).

---

## 10. Migration Checklist

### Scenario D Implementation (Recommended)

- [ ] GCP hesabı oluştur / mevcut hesabı aktifleştir
- [ ] Cloud Storage bucket oluştur: `gs://appranks-backups/`
- [ ] Service account + key oluştur (storage.objectAdmin role)
- [ ] Hetzner VPS'e `gsutil` kur ve authenticate et
- [ ] `pg_dump` + `gsutil cp` backup script yaz
- [ ] Cron job ekle: günlük 04:00 UTC
- [ ] İlk backup'ı çalıştır ve doğrula
- [ ] Restore test yap: backup'tan yeni DB oluştur, verify
- [ ] 7 gün bekle, backup'ların düzenli geldiğini doğrula
- [ ] UptimeRobot'a `/health` endpoint ekle
- [ ] Dokümante et: restore prosedürü

### Scenario E Upgrade (If Needed Later)

- [ ] GCP'de e2-medium Spot VM oluştur (stopped)
- [ ] 30GB persistent disk attach et
- [ ] Docker + Docker Compose kur
- [ ] Repo clone'la, .env hazırla
- [ ] Test: VM'i başlat, backup'tan restore et, servisleri doğrula
- [ ] Failover script yaz
- [ ] DNS failover prosedürünü dokümante et
- [ ] Aylık DR drill yap

---

*This document should be reviewed when hosting requirements change or budget increases.*
