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

## 6. Other Cloud Alternatives (Non-GCP)

Sadece GCP değil, bütçeye uygun tüm alternatiflerin değerlendirmesi:

### F1: AWS Lightsail ($20/mo)

```
┌──────────────────────────────────────────────────────────┐
│                    AWS Lightsail                           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Instance: 2 vCPU, 4GB RAM, 80GB SSD             │  │
│  │  Transfer: 4TB/month included                     │  │
│  │  Static IP: Included                              │  │
│  │                                                    │  │
│  │  ┌──────────┐ ┌───────┐ ┌────────┐ ┌────────┐   │  │
│  │  │Dashboard │ │  API  │ │ Worker │ │Worker-I│   │  │
│  │  └──────────┘ └───────┘ └────────┘ └────────┘   │  │
│  │  ┌──────────────┐  ┌─────────┐                   │  │
│  │  │  PostgreSQL  │  │  Redis  │  (in Docker)      │  │
│  │  └──────────────┘  └─────────┘                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────┐                              │
│  │  Automatic Snapshots   │  $3.50/mo (70GB × $0.05)    │
│  │  Daily, 7-day retain   │  Point-in-time recovery     │
│  └────────────────────────┘                              │
│                                                          │
│  ┌────────────────────────┐                              │
│  │  Lightsail Firewall    │  Built-in, free              │
│  └────────────────────────┘                              │
└──────────────────────────────────────────────────────────┘
```

**Cost:** $20/month instance + $3.50 snapshots = **$23.50** (slightly over budget)
**Without snapshots:** $20/month flat

**Detailed breakdown:**
| Item | Monthly Cost |
|------|-------------|
| Lightsail 4GB instance | $20.00 |
| Static IP | $0 (included) |
| Automatic snapshots (optional) | $3.50 |
| DNS (Route 53, optional) | $0.50 |
| **Total** | **$20-24/month** |

**How Lightsail compares to Hetzner:**
| Spec | Hetzner CPX31 | Lightsail 4GB |
|------|:------------:|:-------------:|
| vCPU | 4 | 2 |
| RAM | 8GB | 4GB |
| Disk | 160GB SSD | 80GB SSD |
| Transfer | 20TB | 4TB |
| Snapshots | Manual | Automatic ($3.50) |
| Price | €9.29 ($10) | $20 |
| SLA | 99.9% | 99.99% |

**Verdict:** 2x the price of Hetzner for half the specs. BUT: AWS infrastructure, automatic snapshots, 99.99% SLA. At budget ceiling.

---

### F2: AWS EC2 Spot Instance ($8-12/mo)

```
┌──────────────────────────────────────────────────────────┐
│                    AWS EC2 Spot                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  t3.medium: 2 vCPU, 4GB RAM                      │  │
│  │  On-demand: $30/mo → Spot: ~$9-12/mo (70% off)   │  │
│  │  Burstable CPU (baseline 20%, burst to 200%)      │  │
│  │                                                    │  │
│  │  Docker Compose: same as current                   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  EBS Volume: 30GB gp3 SSD         │  $2.40/mo       │
│  │  Survives instance termination     │                  │
│  │  Snapshots to S3: $0.05/GB        │                  │
│  └────────────────────────────────────┘                  │
│                                                          │
│  ┌────────────────────────────────────┐                  │
│  │  Spot Interruption Handling:       │                  │
│  │  - 2-minute warning (vs GCP 30s)  │                  │
│  │  - Can request persistent spot     │                  │
│  │  - Auto Scaling Group recovery     │                  │
│  └────────────────────────────────────┘                  │
│                                                          │
│  S3 Backup: 5GB free tier                                │
└──────────────────────────────────────────────────────────┘
```

**Spot vs GCP Spot comparison:**
| Feature | AWS EC2 Spot | GCP Compute Spot |
|---------|:-----------:|:----------------:|
| Warning before termination | **2 minutes** | 30 seconds |
| Persistent spot request | ✅ Auto-relaunch | ❌ Manual restart |
| Price stability | More stable | More variable |
| Interruption frequency | Low (~5%) | Medium (~10%) |
| 2 vCPU + 4GB price | $9-12/mo | $8-12/mo |
| EBS/Disk persistence | ✅ EBS survives | ✅ PD survives |
| Free tier backup | S3 5GB | GCS 5GB |

**Cost:** $9-12 (spot) + $2.40 (EBS) + $0.50 (egress) = **$12-15/month**

**Verdict:** Better spot handling than GCP (2 min warning, auto-relaunch). Same budget. More mature spot ecosystem.

---

### F3: AWS EC2 + RDS Free Tier ($12-18/mo)

```
┌──────────────────────────────────────────────────────────┐
│                    AWS EC2 + RDS                          │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐  │
│  │  EC2 t3.micro        │  │  RDS db.t3.micro         │  │
│  │  2 vCPU, 1GB RAM    │  │  2 vCPU, 1GB RAM         │  │
│  │  Spot: $3-4/mo      │  │  PostgreSQL 16            │  │
│  │                      │  │  20GB SSD                 │  │
│  │  API + Dashboard     │  │  Auto backup (7 days)     │  │
│  │  (workers too tight) │  │  Free tier: 12 months     │  │
│  └──────────────────────┘  │  After: $12-15/mo         │  │
│                             └──────────────────────────┘  │
│                                                          │
│  ⚠️ 1GB RAM = workers won't fit on EC2 t3.micro         │
│  ⚠️ Need t3.medium ($9-12 spot) for workers             │
│  ⚠️ RDS free tier expires after 12 months               │
└──────────────────────────────────────────────────────────┘
```

**First 12 months (RDS free tier):**
| Item | Monthly Cost |
|------|-------------|
| EC2 t3.medium Spot | $9-12 |
| RDS db.t3.micro (free tier) | $0 |
| EBS 30GB | $2.40 |
| **Total** | **$11-15/month** |

**After 12 months (RDS paid):**
| Item | Monthly Cost |
|------|-------------|
| EC2 t3.medium Spot | $9-12 |
| RDS db.t3.micro | $12-15 |
| EBS 30GB | $2.40 |
| **Total** | **$23-30/month** ❌ OVER BUDGET |

**Verdict:** Good first year with free RDS. But budget doubles after free tier expires. Not sustainable long-term at $10-20/mo.

---

### GCP Additional Scenarios

### A2: GCP e2-standard-2 Spot (Best GCP Option)

```
┌──────────────────────────────────────────────────────────┐
│              GCP e2-standard-2 Spot                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  2 vCPU, 8GB RAM                                  │  │
│  │  Spot price: ~$15-20/mo (region dependent)        │  │
│  │                                                    │  │
│  │  ✅ 8GB RAM — Playwright runs comfortably         │  │
│  │  ✅ 2 vCPU — decent for scraping                  │  │
│  │  ⚠️ At budget ceiling                             │  │
│  │  ❌ Still spot — no uptime guarantee              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Region pricing (Spot):                                  │
│  us-central1: ~$15/mo                                    │
│  europe-west1: ~$17/mo                                   │
│  asia-east1: ~$16/mo                                     │
└──────────────────────────────────────────────────────────┘
```

**Cost:** $15-20 (spot) + $2.40 (disk) = **$17-22/month** (at/over budget)

**Verdict:** Best GCP option for this workload IF budget allows. 8GB RAM is ideal.

---

### A3: GCP N1 Preemptible (Older, Cheaper)

```
┌──────────────────────────────────────────────────────────┐
│              GCP N1 Preemptible                           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  n1-standard-1: 1 vCPU, 3.75GB RAM               │  │
│  │  Preemptible: ~$7-8/mo                            │  │
│  │                                                    │  │
│  │  Custom machine type possible:                     │  │
│  │  1 vCPU, 5GB RAM: ~$9/mo preemptible              │  │
│  │                                                    │  │
│  │  ⚠️ N1 is older gen (Skylake/Broadwell)           │  │
│  │  ⚠️ Preemptible = max 24h, then auto-terminated   │  │
│  │  ❌ Worse than E2 spot (forced 24h restart)        │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Cost:** $7-9 (preemptible) + $2.40 (disk) = **$9-12/month**

**Verdict:** Cheapest GCP option but forced restart every 24h. Not ideal for a production service.

---

### G: DigitalOcean Droplet

```
┌──────────────────────────────────────────┐
│         DigitalOcean                      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Option 1: 2 vCPU, 4GB, 80GB     │  │
│  │  $24/month (over budget)          │  │
│  │                                    │  │
│  │  Option 2: 2 vCPU, 2GB, 60GB     │  │
│  │  $18/month (tight RAM)            │  │
│  │                                    │  │
│  │  Option 3: 1 vCPU, 2GB, 50GB     │  │
│  │  $12/month (too small)            │  │
│  └────────────────────────────────────┘  │
│                                          │
│  + Managed DB available ($15+/mo extra)  │
│  + Snapshots ($0.06/GB/mo)               │
│  + Spaces object storage (S3-compat)     │
│  + Good community, docs                  │
│  - $18/mo option has only 2GB RAM        │
└──────────────────────────────────────────┘
```

**Cost:** $12-24/month depending on tier
**Verdict:** $18/month option is borderline — 2GB RAM too tight for Playwright. $24 option is good but over budget.

---

### H: Railway

```
┌──────────────────────────────────────────┐
│             Railway                       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Usage-based pricing:              │  │
│  │  - $5/month base (Hobby plan)      │  │
│  │  - vCPU: $0.000463/min             │  │
│  │  - RAM: $0.000231/min/GB           │  │
│  │  - Disk: $0.000042/min/GB          │  │
│  │                                    │  │
│  │  Estimated for our workload:       │  │
│  │  ~$25-40/month (OVER BUDGET)       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  + Zero-config Docker deploy             │
│  + Managed PostgreSQL + Redis included   │
│  + Auto-scaling                          │
│  + GitHub integration                    │
│  - Usage-based = unpredictable costs     │
│  - No Playwright support (no browser)    │
│  - Memory limits per service             │
│  - Scraper workload = expensive          │
└──────────────────────────────────────────┘
```

**Cost:** $25-40/month estimated (unpredictable)
**Verdict:** Over budget. Playwright won't work. Good for API/dashboard but not scrapers.

---

### I: Fly.io

```
┌──────────────────────────────────────────┐
│              Fly.io                       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  Hobby plan: Free allowance        │  │
│  │  - 3 shared-cpu VMs (256MB each)   │  │
│  │  - 3GB storage                     │  │
│  │                                    │  │
│  │  Performance VM (needed):          │  │
│  │  - 2 vCPU, 4GB: ~$30/month        │  │
│  │  - Plus Postgres: ~$7/month        │  │
│  │  - Plus Redis: ~$7/month           │  │
│  └────────────────────────────────────┘  │
│                                          │
│  + Edge deployment, global latency       │
│  + Managed Postgres & Redis              │
│  + Docker-native                         │
│  + Good DX                               │
│  - Free tier too small for this workload │
│  - Performance VMs over budget           │
│  - Playwright questionable (no X11)      │
└──────────────────────────────────────────┘
```

**Cost:** $30-45/month for usable setup
**Verdict:** Way over budget. Great platform but expensive for scraper workloads.

---

### J: Hetzner Cloud (Upgrade)

```
┌──────────────────────────────────────────┐
│         Hetzner Cloud (Upgrade)           │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  CPX21: 3 vCPU, 4GB, 80GB SSD    │  │
│  │  €5.39/month ($5.80)              │  │
│  │                                    │  │
│  │  CPX31: 4 vCPU, 8GB, 160GB SSD   │  │
│  │  €9.29/month ($10)                │  │
│  │                                    │  │
│  │  CAX21 (ARM): 4 vCPU, 8GB, 80GB  │  │
│  │  €7.49/month ($8)                 │  │
│  └────────────────────────────────────┘  │
│                                          │
│  + Best price/performance ratio          │
│  + All data in EU (GDPR friendly)        │
│  + 20TB traffic included                 │
│  + Snapshots: €0.01/GB/month             │
│  + Floating IPs, firewalls               │
│  - No managed DB/Redis                   │
│  - Coolify handles deployment            │
│  - Smaller company than hyperscalers     │
└──────────────────────────────────────────┘
```

**Cost:** €5.39-9.29/month ($6-10)
**Verdict:** Best price/performance. CPX31 with 8GB RAM is ideal for Playwright workloads at only $10/month.

---

### K: Oracle Cloud Free Tier

```
┌──────────────────────────────────────────┐
│       Oracle Cloud (Always Free)          │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  ARM VM.Standard.A1.Flex:          │  │
│  │  4 OCPUs, 24GB RAM (!)            │  │
│  │  200GB block storage               │  │
│  │  10TB outbound/month               │  │
│  │  $0/month (Always Free)           │  │
│  │                                    │  │
│  │  ⚠️  CAVEATS:                     │  │
│  │  - ARM architecture (aarch64)      │  │
│  │  - Docker images need ARM build    │  │
│  │  - Playwright/Chromium: ARM ok     │  │
│  │  - Account reclaim risk (idle)     │  │
│  │  - Availability varies by region   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  + 24GB RAM FREE — more than any paid   │
│  + 4 OCPUs — very powerful              │
│  + 200GB storage                         │
│  + Always free (not trial)               │
│  - ARM: needs multi-arch Docker builds   │
│  - Oracle may reclaim idle resources     │
│  - Limited region availability           │
│  - Oracle support is weak                │
│  - Community smaller than AWS/GCP        │
└──────────────────────────────────────────┘
```

**Cost:** $0/month (Always Free Tier)
**Verdict:** The most powerful free option. 24GB RAM is massive. BUT: ARM architecture requires Docker image rebuilds, and Oracle may reclaim idle accounts. Worth investigating.

---

## 7. MASTER COMPARISON TABLE — Google Cloud & AWS Focus

The definitive comparison. GCP and AWS variants detailed, others summarized.

### Infrastructure Specs — GCP Options

| | Current (Hetzner) | A: GCP e2-med Spot | A2: GCP e2-std2 Spot | A3: GCP N1 Preempt | B: GCP e2-sm+SQL | C: GCP Free |
|--|:---------:|:------------------:|:-------------------:|:------------------:|:----------------:|:-----------:|
| **Monthly Cost** | €10-15 | **$11-15** | $17-22 | $9-12 | $13-17 | $0 |
| **vCPU** | 3 | 1 | **2** | 1 | 0.5 | 0.25 |
| **RAM** | 4-8GB | 4GB | **8GB** | 3.75GB | 2GB | 1GB |
| **Disk** | 80GB SSD | 30GB SSD | 30GB SSD | 30GB SSD | 20GB SSD | 30GB HDD |
| **Spot Warning** | — | 30s | 30s | **24h forced kill** | 30s | — |
| **Uptime SLA** | 99.9% | 0% | 0% | 0% | 0% | 99.5% |
| **Playwright** | ✅ | ⚠️ Tight | ✅ Good | ⚠️ Tight | ❌ No | ❌ No |
| **Budget Fit** | ✅ | ✅ | ⚠️ Ceiling | ✅ | ⚠️ | ✅ |
| **Verdict** | Baseline | **Best GCP @budget** | Best GCP overall | Daily restarts | RAM too low | Impossible |

### Infrastructure Specs — AWS Options

| | F1: AWS Lightsail | F2: AWS EC2 t3.med Spot | F3: AWS EC2+RDS Free |
|--|:----------------:|:----------------------:|:-------------------:|
| **Monthly Cost** | $20-24 | **$12-15** | $11-15 (yr1) / $23-30 (yr2+) |
| **vCPU** | 2 | **2** | 2 |
| **RAM** | 4GB | 4GB | 4GB (EC2) + 1GB (RDS) |
| **Disk** | 80GB SSD | 30GB EBS SSD | 30GB + 20GB RDS |
| **Spot Warning** | — | **2 minutes** | **2 minutes** (EC2) |
| **Auto Relaunch** | — | ✅ Persistent request | ✅ Persistent request |
| **Uptime SLA** | **99.99%** | 0% (spot) | Mixed |
| **Managed DB** | ❌ | ❌ | ✅ (12mo free) |
| **Playwright** | ✅ | ✅ | ✅ |
| **Budget Fit** | ⚠️ Ceiling | ✅ | ✅ yr1 / ❌ yr2+ |
| **Verdict** | Over budget, safe | **Best AWS @budget** | Free DB expires |

### Infrastructure Specs — Hybrid & Other Options

| | D: Hetzner+Backup | E: Hybrid DR | J: Hetzner CPX31 | K: Oracle Free |
|--|:-----------------:|:------------:|:----------------:|:--------------:|
| **Monthly Cost** | €10-15 (+$0) | €12-18 | **€9.29** | $0 |
| **vCPU** | 3 | 3 | **4** | **4 (ARM)** |
| **RAM** | 4-8GB | 4-8GB | **8GB** | **24GB** |
| **Disk** | 80GB | 80+30GB | **160GB SSD** | **200GB** |
| **Uptime SLA** | 99.9% | 99.9%+ | 99.9% | 99.9% |
| **Playwright** | ✅ | ✅ | ✅✅ | ✅ (ARM build) |
| **Data Safety** | ✅ Backup | ✅✅ DR | ❌ No backup | ❌ No backup |
| **Migration Risk** | **Zero** | Low | **Zero** (upgrade) | Medium (ARM) |
| **Budget Fit** | ✅ | ✅ | ✅ | ✅ |
| **Verdict** | **Safest** | **Best protection** | **Best perf/$** | Free but risky |

### Capabilities

| | Current | A: GCP Spot | B: GCP+SQL | C: GCP Free | D: +Backup | E: Hybrid | F: AWS | G: DO | H: Railway | I: Fly.io | J: Hetzner | K: Oracle |
|--|:-------:|:----------:|:---------:|:----------:|:---------:|:--------:|:-----:|:----:|:--------:|:-------:|:--------:|:-------:|
| **Playwright** | ✅ | ⚠️ Tight | ❌ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ⚠️ | ✅✅ | ✅ |
| **Managed DB** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | Optional | ✅ | ✅ | ❌ | ❌ |
| **Managed Redis** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Optional | ✅ | ✅ | ❌ | ❌ |
| **Auto Backup** | ❌ | ❌ | ✅ | ❌ | ✅ GCS | ✅ GCS | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **SSL/CDN** | Coolify | Manual | Manual | Manual | Coolify | Mixed | Manual | Manual | Auto | Auto | Coolify | Manual |
| **CI/CD Deploy** | Coolify | Manual | Manual | N/A | Coolify | Mixed | Manual | Manual | Auto | Auto | Coolify | Manual |

### Reliability & Risk

| | Current | A: GCP Spot | B: GCP+SQL | C: GCP Free | D: +Backup | E: Hybrid | F: AWS | G: DO | H: Railway | I: Fly.io | J: Hetzner | K: Oracle |
|--|:-------:|:----------:|:---------:|:----------:|:---------:|:--------:|:-----:|:----:|:--------:|:-------:|:--------:|:-------:|
| **Uptime SLA** | 99.9% | 0%¹ | 0%¹ | 99.5% | 99.9% | 99.9%+ | 99.99% | 99.99% | 99.95% | 99.99% | 99.9% | 99.9% |
| **Preemption Risk** | None | **HIGH** | **HIGH** | None | None | None | None | None | None | None | None | Low² |
| **Data Loss Risk** | HIGH³ | Medium | Low | HIGH | **LOW** | **VERY LOW** | Medium | Medium | Low | Low | HIGH³ | HIGH³ |
| **DR Capability** | None | None | Partial | None | Backup | **Full DR** | None | Snapshot | Built-in | Built-in | None | None |
| **Migration Risk** | N/A | Medium | High | N/A | **Zero** | Low | Medium | Medium | High | High | **Zero** | Medium |

¹ Spot/preemptible VMs have no uptime SLA — can be terminated anytime
² Oracle may reclaim idle free-tier resources after 7 days of low usage
³ No offsite backup currently — single disk failure = total data loss

### Operational Complexity

| | Current | A: GCP Spot | B: GCP+SQL | C: GCP Free | D: +Backup | E: Hybrid | F: AWS | G: DO | H: Railway | I: Fly.io | J: Hetzner | K: Oracle |
|--|:-------:|:----------:|:---------:|:----------:|:---------:|:--------:|:-----:|:----:|:--------:|:-------:|:--------:|:-------:|
| **Code Changes** | N/A | None | Minor | N/A | None | None | None | None | Major⁴ | Major⁴ | None | Minor⁵ |
| **Setup Time** | N/A | 1h | 2h | N/A | 15min | 2h | 1h | 1h | 4h | 4h | 30min | 2h |
| **Learning Curve** | N/A | Medium | High | N/A | **Low** | Medium | Medium | Low | Medium | Medium | **None** | Medium |
| **Ongoing Mgmt** | Medium | Medium | Low | N/A | **Low** | Medium | Medium | Medium | **Low** | **Low** | Medium | Medium |
| **Coolify Compat** | ✅ | ❌ | ❌ | N/A | ✅ | Partial | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

⁴ Railway/Fly.io require per-service Docker configs, can't use docker-compose.prod.yml directly
⁵ Oracle ARM requires multi-arch Docker builds (linux/arm64)

### Budget Fit

| | Current | A | B | C | D | E | F | G | H | I | J | K |
|--|:-------:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Within $10-20?** | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ❌ | ❌ | ✅ | ✅ |
| **Predictable Cost?** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |

---

### GCP vs AWS Spot — Head-to-Head

| Feature | GCP Spot (A/A2) | AWS EC2 Spot (F2) | Winner |
|---------|:--------------:|:----------------:|:------:|
| **Best price (2vCPU, 4GB)** | $15-20/mo | **$12-15/mo** | **AWS** |
| **Budget option (1vCPU, 4GB)** | **$8-12/mo** | $6-8/mo | **AWS** |
| **Interruption warning** | 30 seconds | **2 minutes** | **AWS** |
| **Auto-relaunch after kill** | ❌ Manual | **✅ Persistent request** | **AWS** |
| **Interruption frequency** | ~10%/month | **~5%/month** | **AWS** |
| **Free tier storage** | GCS 5GB | S3 5GB | Tie |
| **Managed DB free tier** | ❌ None | **✅ RDS 12 months** | **AWS** |
| **CLI experience** | **gcloud (simple)** | aws-cli (verbose) | **GCP** |
| **Console UX** | **Simple, clean** | Complex, cluttered | **GCP** |
| **Billing transparency** | **Clear, real-time** | Confusing, delayed | **GCP** |
| **$300 free credit** | **✅ 90 days** | ❌ None | **GCP** |
| **Region near Turkey** | europe-west1 | eu-central-1 | Tie |
| **Docker Compose compat** | ✅ Identical | ✅ Identical | Tie |
| **Overall for spot VMs** | Good | **Better** | **AWS** |
| **Overall for beginners** | **Better** | Good | **GCP** |

---

## 8. System Architecture Tiers — GCP & AWS

### Workload Profile

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKLOAD ANALYSIS                             │
│                                                                 │
│  WRITES (Workers)                    READS (API/Dashboard)      │
│  ═══════════════                     ════════════════════       │
│  ~114,000 writes/day                 ~3K-25K queries/min        │
│  - Keywords: 54,400 (48%)            - App list: 60-200 q/load │
│  - Reviews:  41,250 (36%)            - App detail: 8-10 q/view │
│  - Category: 16,500 (14%)            - Categories: 2-5 q/load  │
│  - App det:   2,200 (2%)             - N+1 pattern on snapshots│
│                                                                 │
│  Peak concurrent:                    Peak concurrent:           │
│  11 workers × 3 threads = 33 conn   10-100 users = 30-250 q/m  │
│                                                                 │
│  Write hotspots:                     Read hotspots:             │
│  - appKeywordRankings (54K/day)      - appSnapshots (JSONB)     │
│  - reviews (41K/day)                 - latest rankings JOINs    │
│  - appCategoryRankings (16K/day)     - keyword positions        │
└─────────────────────────────────────────────────────────────────┘
```

### Tier 1: Monolith — Everything on One Server

```
┌─────────────────────────────────────────────────────────┐
│                    SINGLE SERVER                         │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐ │
│  │Dashboard│ │  API    │ │ Worker  │ │Worker-Inter. │ │
│  │ (READ)  │ │ (READ)  │ │ (WRITE) │ │  (WRITE)     │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬───────┘ │
│       │           │           │              │         │
│       └───────────┴───────────┴──────────────┘         │
│                       │                                 │
│              ┌────────┴────────┐                        │
│              │   PostgreSQL    │  ← ALL read+write      │
│              │   (container)   │     compete for pool   │
│              └─────────────────┘                        │
│              ┌─────────────────┐                        │
│              │     Redis       │                        │
│              └─────────────────┘                        │
│                                                         │
│  ⚠️ Workers saturate DB during scraping                 │
│  ⚠️ Dashboard slows down when workers are busy          │
│  ⚠️ Single point of failure                             │
│  ✅ Simplest setup                                      │
│  ✅ Cheapest                                            │
└─────────────────────────────────────────────────────────┘
```

**GCP Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| e2-medium Spot | 1 vCPU, 4GB | $8-12/mo |
| e2-standard-2 Spot | 2 vCPU, 8GB | $15-20/mo |
| 30GB PD SSD | | $2.40/mo |
| **Total** | | **$10-22/mo** |

**AWS Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| t3.medium Spot | 2 vCPU, 4GB | $9-12/mo |
| t3.large Spot | 2 vCPU, 8GB | $18-24/mo |
| 30GB EBS gp3 | | $2.40/mo |
| **Total** | | **$11-26/mo** |

---

### Tier 2: DB Outside — App + Workers on VM, Managed DB

```
┌──────────────────────────────┐    ┌──────────────────────┐
│         VM (Spot/On-demand)  │    │   Managed PostgreSQL │
│                              │    │                      │
│  ┌─────────┐ ┌─────────┐   │    │  ┌────────────────┐  │
│  │Dashboard│ │  API    │   │    │  │  Primary (RW)  │  │
│  └─────────┘ └─────────┘   │    │  │  Auto backup   │  │
│  ┌─────────┐ ┌──────────┐  │    │  │  Auto patch    │  │
│  │ Worker  │ │Worker-I  │  │    │  │  Point-in-time │  │
│  └─────────┘ └──────────┘  │    │  └────────────────┘  │
│  ┌─────────┐               │    │                      │
│  │  Redis  │  (container)  │    │  Backups: Automatic  │
│  └─────────┘               │    │  HA: Optional ($$$)  │
│              │              │    │                      │
│              └──────────────┼───►│  Connection: Private │
│                             │    │  Latency: <1ms (VPC) │
└──────────────────────────────┘    └──────────────────────┘

✅ DB survives VM crash/preemption
✅ Automatic backups + point-in-time recovery
✅ DB patching handled by provider
⚠️ Higher cost (managed DB $7-30+/mo)
⚠️ Network latency for DB queries (~1ms VPC)
```

**GCP Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| e2-medium Spot (app) | 1 vCPU, 4GB | $8-12/mo |
| Cloud SQL db-f1-micro | Shared, 0.6GB, 10GB | $7-9/mo |
| 30GB PD SSD | | $2.40/mo |
| **Total** | | **$17-23/mo** ⚠️ Over budget |

**AWS Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| t3.small Spot (app) | 2 vCPU, 2GB | $4-6/mo |
| RDS db.t3.micro (yr1 free!) | 2 vCPU, 1GB | $0 (yr1) / $12 (yr2+) |
| 30GB EBS | | $2.40/mo |
| **Total yr1** | | **$6-9/mo** ✅ |
| **Total yr2+** | | **$18-21/mo** ⚠️ At ceiling |

---

### Tier 3: Separate Workers — API/Dashboard + Workers Split

```
┌────────────────────────┐  ┌────────────────────────┐
│   VM 1: API + Dashboard│  │   VM 2: Workers        │
│   (READ-heavy)         │  │   (WRITE-heavy)        │
│                        │  │                        │
│  ┌─────────┐           │  │  ┌─────────┐           │
│  │Dashboard│ ← Reads   │  │  │ Worker  │ ← Writes  │
│  └─────────┘           │  │  └─────────┘           │
│  ┌─────────┐           │  │  ┌──────────┐          │
│  │  API    │ ← Reads   │  │  │Worker-I  │ ← Writes │
│  └─────────┘           │  │  └──────────┘          │
│                        │  │  ┌─────────┐           │
│  Pool: 10 connections  │  │  │  Redis  │           │
│  Response: Fast (no    │  │  └─────────┘           │
│  write contention)     │  │  Pool: 20 connections  │
│                        │  │                        │
└───────────┬────────────┘  └───────────┬────────────┘
            │                           │
            └──────────┬────────────────┘
                       │
              ┌────────┴────────┐
              │   PostgreSQL    │  (container or managed)
              │                 │
              │  Connections:   │
              │  API: 10 (read) │
              │  Workers: 20   │
              │  (write-heavy)  │
              └─────────────────┘

✅ API stays fast during heavy scraping
✅ Workers can be scaled independently
✅ Worker crash doesn't affect dashboard
✅ Each VM sized for its workload
⚠️ Two VMs = higher cost
⚠️ DB still single point of failure
```

**GCP Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| VM1: e2-small Spot (API) | 0.5 vCPU, 2GB | $4-6/mo |
| VM2: e2-medium Spot (Workers) | 1 vCPU, 4GB | $8-12/mo |
| DB: Container on VM2 | — | $0 |
| 2× 20GB PD SSD | | $3.20/mo |
| **Total** | | **$15-21/mo** ⚠️ At ceiling |

**AWS Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| VM1: t3.micro Spot (API) | 2 vCPU, 1GB | $2-3/mo |
| VM2: t3.medium Spot (Workers) | 2 vCPU, 4GB | $9-12/mo |
| DB: Container on VM2 | — | $0 |
| 2× 20GB EBS | | $3.20/mo |
| **Total** | | **$14-18/mo** ✅ |

---

### Tier 4: Full Split — API + Workers + Managed DB

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  VM 1: Frontend  │  │  VM 2: Workers   │  │  Managed DB      │
│                  │  │                  │  │                  │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │ Dashboard  │  │  │  │  Worker    │  │  │  │ PostgreSQL │  │
│  │ + API      │  │  │  │  (BG)     │  │  │  │ Primary    │  │
│  │ + Redis*   │  │  │  │  + Inter. │  │  │  │ + Replica  │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│                  │  │  ┌────────────┐  │  │                  │
│  Reads ─────────►│  │  │ Playwright │  │  │  ◄── Writes     │
│                  │  │  │ Browsers   │  │  │  ◄── Reads      │
│  Pool: 10       │  │  └────────────┘  │  │                  │
│  RAM: 1-2GB     │  │  Pool: 30       │  │  Auto backup ✅   │
│                  │  │  RAM: 4-8GB     │  │  HA optional ✅   │
└──────────────────┘  └──────────────────┘  └──────────────────┘

✅ Each component scales independently
✅ Worker crash = zero dashboard impact
✅ DB professionally managed (backup, patch, HA)
✅ Workers can burst resources during scraping
✅ API stays responsive
❌ 3 resources = highest cost
❌ Network latency between components
```

**GCP Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| VM1: e2-micro (API) | 0.25 vCPU, 1GB | $4-6/mo |
| VM2: e2-medium Spot (Workers) | 1 vCPU, 4GB | $8-12/mo |
| Cloud SQL db-f1-micro | Shared, 0.6GB | $7-9/mo |
| 2× 20GB PD SSD | | $3.20/mo |
| **Total** | | **$22-30/mo** ❌ Over budget |

**AWS Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| VM1: t3.micro Spot (API) | 2 vCPU, 1GB | $2-3/mo |
| VM2: t3.medium Spot (Workers) | 2 vCPU, 4GB | $9-12/mo |
| RDS db.t3.micro (yr1 free!) | 2 vCPU, 1GB, 20GB | $0 (yr1) |
| 2× 20GB EBS | | $3.20/mo |
| **Total yr1** | | **$14-18/mo** ✅ |
| **Total yr2+** | | **$26-30/mo** ❌ |

---

### Tier 5: Worker Scaling — Auto-scaling Worker Fleet

```
                              ┌─────────────────────┐
                              │   Load Balancer      │
                              │   (GCP LB / ALB)     │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┬┴───────────────────┐
                    │                    │                    │
              ┌─────┴──────┐      ┌─────┴──────┐      ┌─────┴──────┐
              │ API + Dash │      │ Worker 1   │      │ Worker 2   │
              │ (always on)│      │ (Spot)     │      │ (Spot)     │
              │ 1GB        │      │ Platforms  │      │ Platforms  │
              └─────┬──────┘      │ 1-6        │      │ 7-11       │
                    │             └─────┬──────┘      └─────┬──────┘
                    │                   │                    │
                    └───────────────────┴────────────────────┘
                                        │
                               ┌────────┴────────┐
                               │  Managed DB     │
                               │  + Read Replica │
                               └─────────────────┘

Worker scaling strategy:
  1 worker  = all 11 platforms (current)
  2 workers = 6 + 5 platforms (split)
  3 workers = 4 + 4 + 3 platforms (heavy load)

Scale trigger: job queue depth > 20 or avg job time > 2× normal
```

**GCP Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| API VM (e2-small, on-demand) | 0.5 vCPU, 2GB | $13/mo |
| Worker MIG (e2-medium Spot × 1-2) | 1 vCPU, 4GB | $8-24/mo |
| Cloud SQL db-f1-micro | Shared, 0.6GB | $7-9/mo |
| **Total (1 worker)** | | **$28-46/mo** ❌ |

**AWS Implementation:**
| Config | Spec | Cost |
|--------|------|------|
| API (t3.micro Spot) | 2 vCPU, 1GB | $2-3/mo |
| Worker ASG (t3.medium Spot × 1-2) | 2 vCPU, 4GB | $9-24/mo |
| RDS db.t3.micro (yr1 free) | 2 vCPU, 1GB | $0 (yr1) |
| ALB | | $16/mo (min) |
| **Total** | | **$27-43/mo** ❌ |

**Verdict:** Over budget at current scale. Makes sense when:
- Platform count > 20
- Scrape frequency increases (4x/day)
- Multiple customers need isolated scraping

---

### Architecture Tier Comparison

**Tier overview:**

| Tier | Description | Servers |
|------|-------------|---------|
| **Tier 1** | Monolith — all on one VM | 1 |
| **Tier 2** | DB Outside — VM + Managed DB | 1 VM + DB |
| **Tier 3** | Split VMs — API/Dashboard + Workers | 2 VMs |
| **Tier 4** | Full Split — API + Workers + Managed DB | 2 VMs + DB |
| **Tier 5** | Auto-scale — Scaling worker fleet | 2-3 VMs + DB |

**Cost comparison:**

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--|--------|--------|--------|--------|--------|
| **GCP** | $10-22 | $17-23 | $15-21 | $22-30 | $28-46 |
| **AWS** | $11-26 | $6-9 yr1 | $14-18 | $14-18 yr1 | $27-43 |
| **Budget?** | ✅ | ⚠️ | ⚠️ | ❌ | ❌ |

**Capability comparison:**

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--|--------|--------|--------|--------|--------|
| **API speed** | ❌ Slow | ❌ Slow | ✅ Fast | ✅ Fast | ✅ Fast |
| **Worker scale** | ❌ Fixed | ❌ Fixed | ⚠️ Manual | ⚠️ Manual | ✅ Auto |
| **DB safety** | ❌ | ✅ Managed | ⚠️ | ✅ Managed | ✅ Managed |
| **Playwright** | ⚠️ Shared | ⚠️ Shared | ✅ Dedicated | ✅ Dedicated | ✅ Dedicated |
| **Complexity** | Low | Medium | Medium | High | Very High |
| **Best for** | MVP | Data safety | Perf split | Production | Scale-up |

### Recommended Tier per Growth Stage

```
Stage 1: NOW (1 user, 11 platforms, $10-20/mo)
  └─► Tier 1 Monolith + Backup (Scenario D)

Stage 2: TRACTION (5-10 users, $20-30/mo budget)
  └─► Tier 3: Split VMs (API + Workers separate)

Stage 3: GROWTH (50+ users, $50-100/mo budget)
  └─► Tier 4: Full Split + Managed DB

Stage 4: SCALE (100+ users, 20+ platforms, $100+/mo)
  └─► Tier 5: Auto-scaling Workers + Read Replica
```

### DB Inside vs Outside Decision Tree

```
                    Do you need automatic backups?
                           │
                    ┌──────┴──────┐
                    │ No          │ Yes
                    │             │
              ┌─────┴─────┐    Can you afford $7-15/mo for managed DB?
              │ Tier 1    │           │
              │ DB inside │    ┌──────┴──────┐
              │ + manual  │    │ No          │ Yes
              │ backup    │    │             │
              └───────────┘  ┌─┴───────────┐ │
                             │ Tier 1      │ │
                             │ + cron      │ │
                             │ pg_dump     │ │
                             │ to S3/GCS   │ │
                             └─────────────┘ │
                                       ┌─────┴──────┐
                                       │ AWS RDS    │
                                       │ (yr1 free) │
                                       │    OR      │
                                       │ GCP SQL    │
                                       │ ($7-9/mo)  │
                                       └────────────┘
```

---

## 9. Decision Matrix (All Scenarios)

Scoring: 1 (worst) to 5 (best). Only budget-feasible options scored.

| Criteria (Weight) | Current | A: GCP Spot | D: +Backup | E: Hybrid | F: AWS | J: Hetzner↑ | K: Oracle |
|-------------------|:-------:|:----------:|:---------:|:--------:|:-----:|:----------:|:--------:|
| **Cost** (20%) | 4 | 3 | 5 | 4 | 2 | 5 | 5 |
| **Performance** (20%) | 3 | 2 | 3 | 3 | 3 | 5 | 5 |
| **Reliability** (20%) | 3 | 2 | 4 | 5 | 4 | 3 | 2 |
| **Data Safety** (15%) | 1 | 2 | 4 | 5 | 3 | 1 | 1 |
| **Simplicity** (10%) | 5 | 3 | 5 | 3 | 3 | 5 | 3 |
| **Scalability** (10%) | 2 | 3 | 2 | 3 | 3 | 3 | 4 |
| **Playwright** (5%) | 4 | 2 | 4 | 4 | 4 | 5 | 4 |
| | | | | | | | |
| **Weighted Score** | **2.85** | **2.35** | **3.80** | **3.80** | **3.05** | **3.60** | **3.25** |
| **Rank** | #5 | #7 | **#1 (tie)** | **#1 (tie)** | #4 | **#3** | #4 |

---

## 9. Risk vs Cost vs Performance Map

```
Performance (CPU+RAM)
     │
   5 │                              ●K (Oracle Free)
     │                      ●J (Hetzner CPX31)
   4 │
     │  ●D,E (Current++)
   3 │              ●F (AWS Lightsail)
     │      ●A (GCP Spot)
   2 │                      ●G (DO $18)
     │
   1 │  ●C (GCP Free)  ●B (GCP+SQL)
     │
     └──────────────────────────────────────
     0     5     10     15     20     25
                Monthly Cost ($)

     Size of circle = Reliability
     ●  = Low reliability
     ●  = High reliability
```

```
Data Safety
     │
   5 │                  ●E (Hybrid DR)
     │              ●D (+Backup)
   4 │
     │          ●F (AWS)
   3 │
     │      ●A (GCP Spot)
   2 │
     │  ●Current  ●J  ●K
   1 │          (no backup)
     │
     └──────────────────────────────────────
     0     5     10     15     20     25
                Monthly Cost ($)
```

---

## 10. Recommended Path

### If Goal is Data Safety (Minimum Risk):

```
NOW                    MONTH 1              MONTH 3+
 │                        │                    │
 │  Scenario D            │  Scenario E        │  Budget increases?
 │  Add GCP Backup        │  Add GCP Standby   │  Consider J or F
 │  Cost: +$0             │  Cost: +$2.40      │
 │  Time: 15 min          │  Time: 2 hours     │
 │  Risk: ZERO            │  Risk: LOW         │
 ▼                        ▼                    ▼
```

### If Goal is Performance Upgrade:

```
NOW                    MONTH 1
 │                        │
 │  Scenario J            │  + Scenario D
 │  Hetzner CPX31         │  Add GCP Backup
 │  4 vCPU, 8GB, 160GB   │  Best of both worlds
 │  Cost: €9.29/mo        │  Cost: €9.29/mo
 │  Time: 30 min          │
 ▼                        ▼
```

### If Goal is Free Cloud:

```
NOW                    MONTH 1              MONTH 2
 │                        │                    │
 │  Scenario K            │  Test stability    │  Stable?
 │  Oracle Free Tier      │  Run for 30 days   │  ├─ Yes: Stay
 │  4 OCPU, 24GB ARM     │  Monitor uptime    │  └─ No: Fall back
 │  Cost: $0/mo           │                    │      to Hetzner
 │  Time: 2 hours         │                    │
 │  Risk: MEDIUM          │                    │
 ▼                        ▼                    ▼
```

---

## 11. Final Recommendation Summary

| Priority | Scenario | Action | Cost Impact | Effort |
|----------|----------|--------|-------------|--------|
| **1st (DO NOW)** | D: +GCP Backup | Backup DB to Cloud Storage daily | +$0/mo | 15 min |
| **2nd (This Month)** | J: Hetzner CPX31 | Upgrade VPS for more RAM | +€1-4/mo | 30 min |
| **3rd (Optional)** | E: Hybrid DR | Add stopped GCP VM as standby | +$2.40/mo | 2 hours |
| **Explore** | K: Oracle Free | Test ARM compatibility | $0 | 2 hours |
| **Future ($50+)** | GCP Full | Full migration when budget allows | $50+/mo | 1 day |

**Bottom line:** $10-20/ay bütçeyle GCP'ye tam geçiş, mevcut Hetzner'dan daha kötü. En akıllı hamle: Hetzner'da kal, GCP'yi sadece backup/DR için kullan, performans lazımsa Hetzner CPX31'e yükselt.

---

*This document should be reviewed when hosting requirements change or budget increases.*

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
