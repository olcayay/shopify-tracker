# AppRanks — Cloud Migration Analysis

**Date:** 2026-03-27
**Prepared by:** Engineering Team
**Status:** Decision Pending
**Current Hosting:** Hetzner VPS via Coolify
**Budget:** $20-25/month (startup) | $40-50/month (scale-up)

---

## Table of Contents

0. [Executive Summary](#executive-summary)
1. [Key Decision Parameters](#key-decision-parameters)
2. [Current System & Bottlenecks](#1-current-system--bottlenecks)
3. [How AWS & GCP Can Help](#2-how-aws--gcp-can-help)
4. [Architecture Tiers](#3-architecture-tiers)
5. [Tier Comparison](#4-tier-comparison)
6. [Growth Roadmap & Migration Checklist](#5-growth-roadmap--migration-checklist)
7. [Glossary](#glossary)

---

## Executive Summary

AppRanks, 11 marketplace platformunu (Shopify, Salesforce, Canva, Wix, WordPress, Google Workspace, Atlassian, Zoom, Zoho, Zendesk, HubSpot) izleyen bir SaaS ürünüdür. Günlük ~114K database write, 73 zamanlanmış scraper job, Playwright browser otomasyonu ve Next.js dashboard içerir.

**Mevcut durum:** Tek Hetzner VPS (€10/ay), Docker Compose ile 6 container. Çalışıyor ama kritik riskler var: backup yok, DB bağlantı havuzu paylaşımlı, Playwright RAM spike'ları, disaster recovery yok.

**Kritik not — Worker load artışı (iki aşamalı):**

Şu anda 11 platformun hepsi sağlıklı çalışmıyor. Worker load'u iki aşamada artacak:

**Aşama 1 — Platform stabilizasyonu (yakın gelecek):** Tüm platformlar stabilize olduğunda worker load mevcut seviyenin **3-10 katına** çıkacak. Category scraper'lar gibi platform-bazlı joblar user sayısından bağımsız olarak sabit yükte çalışır. Bu artış kaçınılmaz ve kullanıcı sayısıyla ilgisi yoktur.

**Aşama 2 — Kullanıcı büyümesi (orta-uzun vade):** App details, keyword search, reviews gibi worker'lar kullanıcıların track ettiği app ve keyword sayısına bağlıdır. Her yeni kullanıcı yeni tracked app'ler ve keyword'ler ekler → bu worker'ların load'u **kullanıcı sayısıyla doğru orantılı büyür.** 10 kullanıcıda yönetilebilir olan yük, 100 kullanıcıda 10x olur.

```
Worker Load Buyume Modeli:

Load
  |
  |                                          xxxxxxx  User-dependent
  |                                     xxxxx         (app_details,
  |                                xxxxx              keywords,
  |                           xxxxx                   reviews)
  |                      xxxx
  |                  xxxx
  |              xxxx
  |    =========================================  Platform-fixed
  |    =  (categories, compute_scores)         =  (sabit, user'dan
  |    =========================================   bagimsiz)
  +--+--------+-----------+-----------+-------->
   Now    Full capacity  10 users   100 users
         (3-10x)
```

Bu demek ki:
- Günlük write sayısı: 114K → **350K-1.1M** (aşama 1) → **2-5M+** (aşama 2)
- Peak DB connections: 33 → **100-330** → **500+**
- RAM kullanımı: 6-8GB → **12-30GB** → **30-60GB+**
- Mevcut tek sunucu yapısı aşama 1'i bile **kesinlikle kaldıramaz**

Bu nedenle mimari, worker'ların API'den bağımsız scale edilebileceği şekilde tasarlanmalıdır. Tier 1 (monolith) hiçbir aşamada yeterli değildir.

**Karar gerekiyor:** Mevcut yapıyı AWS veya GCP ile nasıl güçlendireceğiz? 5 mimari tier analiz edildi (monolith'ten auto-scaling'e). Her tier'ın GCP ve AWS maliyeti, artı/eksileri ve hangi bottleneck'i çözdüğü detaylı karşılaştırıldı.

**Önerilen yol:** Worker scale ihtiyacı nedeniyle minimum **Tier 3** (API/Worker ayrımı, $15-21/ay) ile başlanmalı, kısa vadede **Tier 4**'e (Managed DB eklenerek, $22-33/ay) geçilmelidir.

---

## Key Decision Parameters

Mimari karar verirken değerlendirilmesi gereken parametreler:

### System Characteristics

| Parameter | Now | Phase 1: Full Capacity | Phase 2: 100 Users |
|-----------|-----|----------------------|-------------------|
| **Daily DB writes** | ~114K | **350K - 1.1M** | **2-5M+** |
| **Peak DB connections** | 43 | **100 - 330** | **500+** |
| **Peak RAM** | 6-8GB | **12-30GB** | **30-60GB+** |
| **Scheduled jobs** | 73 | 73 (same) | 73 (same) |
| **Tracked apps** | ~50 | ~50 | **500+** |
| **Tracked keywords** | ~80 | ~80 | **800+** |
| **DB size** | ~1GB | **5-10GB** | **50-100GB** |
| **Users** | 1-5 | 1-5 | 100 |

**Worker type scaling behavior:**

| Worker Type | Load Driver | Phase 1 | Phase 2 (100 users) |
|-------------|-------------|---------|---------------------|
| **Categories** | Platform count (fixed) | Same as now | Same as now |
| **Compute scores** | Platform count (fixed) | Same as now | Same as now |
| **App details** | Tracked app count (user-driven) | 3-10x | **50-100x** |
| **Keywords** | Tracked keyword count (user-driven) | 3-10x | **50-100x** |
| **Reviews** | Tracked app count (user-driven) | 3-10x | **50-100x** |

> **CRITICAL:** Category/compute workers have fixed load regardless of user count. But app_details, keywords, and reviews scale **linearly with users**. Architecture must allow these worker types to scale independently.

### Business Constraints

| Parameter | Value |
|-----------|-------|
| **Startup budget** | $20-25/month |
| **Scale-up budget** | $40-50/month |
| **Acceptable downtime/month** | ? (needs decision) |
| **Data loss tolerance** | ? (needs decision — hours? days? zero?) |
| **Geographic requirements** | EU preferred (GDPR, latency to Turkey) |
| **Compliance needs** | GDPR consideration for scraped data |
| **Team size for ops** | 1 person (key person risk) |
| **Deploy frequency** | Multiple times/week |
| **Current deploy method** | Coolify (git push auto-deploy) |

### Technical Requirements

| Requirement | Must Have? | Notes |
|-------------|-----------|-------|
| Docker Compose support | Yes | Zero code change migration |
| Playwright/Chromium | Yes | 3 platforms need browser |
| PostgreSQL 16 | Yes | Drizzle ORM, 88 migrations |
| Redis | Yes | BullMQ job queue |
| SSL/HTTPS | Yes | Customer-facing dashboard |
| Persistent storage | Yes | DB survives VM restart |
| Cron scheduling | Yes | 73 scheduled scraper jobs |
| SSH access | Preferred | Debug, log access |
| CI/CD pipeline | Nice to have | Currently Coolify handles |
| Monitoring/alerting | Nice to have | /health endpoint exists |

### Questions to Discuss with Advisor

1. **Uptime requirement:** %99 (7h downtime/ay) yeterli mi yoksa %99.9 (43min/ay) mı gerekiyor?
   - Spot VM: ~%99.2 (preemption kaynaklı)
   - On-demand VM: ~%99.9
   - Multi-VM: ~%99.95+

2. **Data loss tolerance:** Backup'tan restore'da kaç saatlik veri kaybı kabul edilebilir?
   - Manuel backup (cron pg_dump): 0-24 saat kayıp
   - Managed DB (RDS/Cloud SQL): 0-5 dakika kayıp (point-in-time)
   - Replication: 0 kayıp

3. **Growth projections — CRITICAL:** Şu an platformların hepsi tam kapasitede çalışmıyor. Tüm platformlar stabilize olduğunda worker load **3-10x artacak.** Bu yakın gelecek, yeni müşteri gelmeden bile olacak. Sorular:
   - Tüm 11 platform ne zaman tam kapasitede olacak? (Hafta? Ay?)
   - Worker VM'in 12-30GB RAM'e ihtiyacı olacak — hangi instance type?
   - Kaç yeni platform eklenecek? (Her platform ~7 cron job daha)
   - Tracked app/keyword sayısı artacak mı? (Write volume doğrudan etkiler)

4. **Spot VM tolerance:** Scraper'lar için 2-3 dakikalık kesinti kabul edilebilir mi?
   - Spot VM'ler %60-70 ucuz ama her an kapatılabilir
   - Dashboard için kabul edilebilir değilse: API on-demand, Workers Spot (Tier 3)

5. **Managed vs self-managed DB:**
   - AWS RDS: ilk yıl ücretsiz, auto backup, patching — ama yr2'den sonra $12-15/ay
   - Self-managed: pg_dump cron ile backup — bedava ama sorumluluk sende
   - Risk tolerance'a göre karar verilmeli

6. **Vendor lock-in tolerance:**
   - Docker Compose = taşınabilir (vendor lock-in yok)
   - RDS/Cloud SQL = orta lock-in (başka managed DB'ye taşınabilir)
   - Proprietary services (Lambda, Cloud Run) = yüksek lock-in

7. **Network topology:**
   - Tek region yeterli mi? (eu-west-1 / europe-west1)
   - Multi-region gerekli mi? (latency, DR)
   - VPN gerekli mi? (scraper IP gizleme)

8. **Cost optimization willingness:**
   - Reserved instances (1-3 yıl taahhüt, %30-60 indirim) değerlendirilebilir mi?
   - Savings Plans (AWS) veya Committed Use (GCP) uygun mu?

---

## 1. Current System & Bottlenecks

### Architecture

```
+-----------------------------------------------------------------+
|                    Hetzner VPS (Coolify)                         |
|                                                                 |
|  +----------+  +----------+  +----------+  +---------------+   |
|  | Dashboard |  |   API    |  |  Worker  |  | Worker-Inter  |   |
|  | Next.js   |  | Fastify  |  | BullMQ   |  | Playwright    |   |
|  | :3000     |  | :3001    |  | Scraper  |  | Browser       |   |
|  +-----+-----+  +----+-----+  +----+-----+  +-------+-------+  |
|        |              |             |                 |          |
|        +--------------+-------------+-----------------+          |
|                            |                                    |
|                  +---------+---------+  +---------+             |
|                  |    PostgreSQL     |  |  Redis  |             |
|                  |    :5432          |  |  :6379  |             |
|                  +-------------------+  +---------+             |
|                                                                 |
|  CPU: 3 vCPU  |  RAM: 4-8GB  |  Disk: 80GB SSD                |
+-----------------------------------------------------------------+
```

**6 Docker container**, tek sunucuda, tek disk, tek IP adresi.

### Resource Usage

| Resource | Idle | Scraping | Peak (Playwright) |
|----------|------|----------|-------------------|
| CPU | 5% | 30-50% | 80-100% |
| RAM | 2GB | 3-4GB | 6-8GB |
| Network | <1 Mbps | 5-10 Mbps | 10-20 Mbps |

### Workload Profile

```
+-----------------------------------------------------------------+
|                    DAILY WORKLOAD                                |
|                                                                 |
|  WRITES (Workers)                  READS (API/Dashboard)        |
|  ================                  =====================        |
|                                                                 |
|  NOW (partial operations):         NOW:                         |
|  ~114,000 writes/day               ~3K-25K queries/min          |
|                                                                 |
|  FULL CAPACITY (3-10x):            FULL CAPACITY:               |
|  ~350K - 1.1M writes/day           ~10K-50K queries/min         |
|                                                                 |
|  Keywords:  54,400 (48%)           App list:   60-200 q/load    |
|  Reviews:   41,250 (36%)           App detail: 8-10 q/view      |
|  Category:  16,500 (14%)           Categories: 2-5 q/load       |
|  App det:    2,200 (2%)            Keyword:    5-10 q/view      |
|                                                                 |
|  NOW:  11 workers x 3 = 33 conn   NOW:   1-5 users             |
|  FULL: 11 workers x 3 = 100-330   FULL:  10-100 users           |
+-----------------------------------------------------------------+
```

### Current Costs

| Item | Cost |
|------|------|
| Hetzner VPS (CPX31) | ~€10/month |
| Domain | ~$1/month |
| Coolify (self-hosted) | Free |
| **Total** | **~€11/month ($12)** |

### Bottlenecks

```
+---+-------------------------------------------+----------+--------+
| # | Bottleneck                                | Severity | Impact |
+---+-------------------------------------------+----------+--------+
| 1 | Single server = single point of failure   | CRITICAL | Server |
|   | Server down = everything down             |          | crash  |
|   |                                           |          | = total|
|   |                                           |          | outage |
+---+-------------------------------------------+----------+--------+
| 2 | No database backup                        | CRITICAL | Disk   |
|   | Disk failure = all data lost forever       |          | fail   |
|   |                                           |          | = data |
|   |                                           |          | gone   |
+---+-------------------------------------------+----------+--------+
| 3 | Shared DB connection pool                 | HIGH     | Workers|
|   | Workers (33 conn) + API (10 conn)         |          | slow   |
|   | compete for same 20-connection pool       |          | down   |
|   | Dashboard slows during scraping           |          | API    |
+---+-------------------------------------------+----------+--------+
| 4 | Playwright memory spikes                  | HIGH     | OOM    |
|   | Chromium uses 500MB+ per instance          |          | kills  |
|   | 11 concurrent scrapers = 6-8GB RAM        |          | random |
|   | Server only has 4-8GB total               |          | crashes|
+---+-------------------------------------------+----------+--------+
| 5 | No disaster recovery                      | MEDIUM   | Hours  |
|   | Server dies = hours to rebuild            |          | of     |
|   | No standby, no failover                   |          | down-  |
|   |                                           |          | time   |
+---+-------------------------------------------+----------+--------+
| 6 | Workers can't scale independently         | CRITICAL | Full   |
|   | Full capacity = 3-10x current load        |          | cap.   |
|   | Single VM cannot handle 350K-1.1M         |          | will   |
|   | writes/day + 12-30GB RAM                  |          | crash  |
|   | Workers MUST be separable from API        |          | server |
+---+-------------------------------------------+----------+--------+
```

---

## 2. How AWS & GCP Can Help

### Bottleneck-to-Service Mapping

Each bottleneck has a cloud service that solves it:

```
BOTTLENECK                        AWS SOLUTION              GCP SOLUTION
============                      ============              ============

1. Single server failure    -->   EC2 + Auto Recovery  -->  GCE + Instance Schedule
                                  EBS (disk) persists data  Persistent Disk survives

2. No database backup       -->   RDS (auto backup)   -->  Cloud SQL (auto backup)
                                  S3 for manual dumps       GCS for manual dumps

3. Shared DB pool            -->   Separate EC2 for    -->  Separate GCE for
   (workers vs API)                API vs Workers            API vs Workers

4. Playwright RAM spikes    -->   Dedicated worker     -->  Dedicated worker VM
                                  instance (4-8GB)          (4-8GB)

5. No disaster recovery    -->   Multi-AZ deploy      -->  Regional Instance Group
                                  VM snapshots               VM snapshots
                                  Route 53 failover          Cloud DNS failover

6. Workers can't scale     -->   Auto Scaling Group   -->  Managed Instance Group
                                  Spot Fleet                 Spot VMs
```

### GCP vs AWS Head-to-Head

| Feature | AWS | GCP | Winner |
|---------|-----|-----|--------|
| **Spot VM price (2vCPU, 4GB)** | **$9-12/mo** | $15-20/mo | **AWS** |
| **Spot interruption warning** | **2 minutes** | 30 seconds | **AWS** |
| **Auto-relaunch after kill** | **Persistent request** | Manual restart | **AWS** |
| **Spot interruption rate** | **~5%/month** | ~10%/month | **AWS** |
| **Managed DB free tier** | **RDS 12 months free** | None | **AWS** |
| **Object storage free** | S3 5GB | GCS 5GB | Tie |
| **Console UX** | Complex | **Simple, clean** | **GCP** |
| **Billing clarity** | Confusing | **Real-time, clear** | **GCP** |
| **$300 free credit** | None | **90 days** | **GCP** |
| **CLI simplicity** | aws-cli (verbose) | **gcloud (clean)** | **GCP** |
| **Region near Turkey** | eu-central-1 | europe-west1 | Tie |
| **Docker Compose compat** | Identical | Identical | Tie |
| **Spot VM verdict** | | | **AWS** (cheaper, safer) |
| **Beginner-friendly** | | | **GCP** (simpler UX) |

---

## 3. Architecture Tiers

### Tier 1: Monolith — All on One VM

**Concept:** Same as current Hetzner setup, but on GCP/AWS.

```
+-------------------------------------------------------+
|                    SINGLE VM                           |
|                                                       |
|  +----------+ +------+ +--------+ +--------------+   |
|  |Dashboard | | API  | | Worker | | Worker-Inter |   |
|  | (READ)   | |(READ)| |(WRITE) | |   (WRITE)    |   |
|  +-----+----+ +--+---+ +---+----+ +------+-------+   |
|        |         |          |             |           |
|        +---------+----------+-------------+           |
|                      |                                |
|              +-------+--------+                       |
|              |   PostgreSQL   |  <-- reads + writes   |
|              |  (container)   |      compete          |
|              +----------------+                       |
|              +----------------+                       |
|              |     Redis      |                       |
|              +----------------+                       |
+-------------------------------------------------------+

Solves: #1 (if cloud VM has persistent disk)
Keeps:  #2, #3, #4, #5, #6 (all other bottlenecks remain)
```

**Pros:**
- Zero code changes — `docker-compose.prod.yml` runs as-is
- Simplest setup, lowest cost
- Good enough for MVP / solo user
- Persistent disk survives VM restart

**Cons:**
- Workers and API still compete for DB connections
- Playwright still fights for RAM with other containers
- No managed backup — manual pg_dump required
- Dashboard slow during scraping hours
- Can't scale workers independently

**Cost Comparison:**

| Config | GCP | AWS |
|--------|-----|-----|
| **Small (1 vCPU, 4GB)** Spot | $8-12/mo | $9-12/mo |
| **Medium (2 vCPU, 8GB)** Spot | $15-20/mo | $18-24/mo |
| **Medium (2 vCPU, 4GB)** On-demand | $25/mo | $30/mo |
| **Medium (2 vCPU, 4GB)** Lightsail | — | $20/mo |
| 30GB SSD disk | $2.40/mo | $2.40/mo |
| Backup to cloud storage | Free (5GB) | Free (5GB) |
| **Total (recommended)** | **$17-22/mo** | **$14-20/mo** |

**Recommended config:** 2 vCPU, 8GB RAM Spot + 30GB SSD + daily backup to S3/GCS

---

### Tier 2: DB Outside — VM + Managed Database

**Concept:** Move PostgreSQL to a managed service. Everything else stays on VM.

```
+----------------------------+     +----------------------+
|    VM (Spot/On-demand)     |     |  Managed PostgreSQL  |
|                            |     |                      |
|  +----------+ +--------+  |     |  +----------------+  |
|  |Dashboard | |  API   |  |     |  | Primary (RW)   |  |
|  +----------+ +--------+  |     |  | Auto backup    |  |
|  +----------+ +--------+  |     |  | Auto patching  |  |
|  | Worker   | |Worker-I|  |     |  | Point-in-time  |  |
|  +----------+ +--------+  |     |  | recovery       |  |
|  +----------+             |     |  +----------------+  |
|  | Redis    | (container) |     |                      |
|  +----------+             |     |  Backups: Automatic   |
|                            |     |  Retention: 7 days   |
|          +-----------------+---->|  HA: Optional ($$$)  |
|                            |     |  Latency: <1ms (VPC) |
+----------------------------+     +----------------------+

Solves: #1 (partially), #2 (DB backup automatic!)
Keeps:  #3, #4, #5, #6
```

**Pros:**
- **Automatic daily backups** — solves the #1 critical risk
- Point-in-time recovery — restore to any second in last 7 days
- DB survives VM crash — data is on separate managed service
- Auto security patching for PostgreSQL
- AWS RDS free tier: **12 months free!**

**Cons:**
- Workers and API still on same VM (shared RAM/CPU)
- Playwright memory spikes still affect API
- Managed DB adds $7-15/mo cost (except AWS yr1 free)
- Network latency for DB queries (~1ms, negligible in VPC)
- Redis still on VM (Managed Redis costs $30+/mo)

**Cost Comparison:**

| Config | GCP | AWS |
|--------|-----|-----|
| VM: 1 vCPU, 4GB Spot | $8-12/mo | $9-12/mo |
| Managed DB (smallest) | Cloud SQL $7-9/mo | **RDS Free (yr1!)** |
| Managed DB (after yr1) | Cloud SQL $7-9/mo | RDS $12-15/mo |
| 30GB SSD disk | $2.40/mo | $2.40/mo |
| **Total (yr1)** | **$17-23/mo** | **$14-18/mo** |
| **Total (yr2+)** | **$17-23/mo** | **$23-29/mo** |

**Recommended config:** AWS EC2 t3.medium Spot + RDS db.t3.micro (free yr1)

---

### Tier 3: Split VMs — API + Workers Separate

**Concept:** API/Dashboard on one VM (read-optimized), Workers on another (write-optimized).

```
+------------------------+     +------------------------+
|  VM 1: API + Dashboard |     |  VM 2: Workers         |
|  (READ-heavy)          |     |  (WRITE-heavy)         |
|                        |     |                        |
|  +----------+          |     |  +--------+            |
|  |Dashboard | Reads    |     |  | Worker | Writes     |
|  +----------+          |     |  +--------+            |
|  +----------+          |     |  +--------+            |
|  |  API     | Reads    |     |  |Worker-I| Writes     |
|  +----------+          |     |  +--------+            |
|                        |     |  +--------+            |
|  Pool: 10 connections  |     |  | Redis  |            |
|  RAM: 1-2GB            |     |  +--------+            |
|  Response: Fast!       |     |  Pool: 20 connections  |
|                        |     |  RAM: 4-8GB            |
+----------+-------------+     +----------+-------------+
           |                              |
           +-------------+---------------+
                         |
                +--------+--------+
                |   PostgreSQL    |
                |  (container or  |
                |   managed DB)   |
                +-----------------+

Solves: #3 (pool separation), #4 (dedicated worker RAM), #6 (scale workers)
Keeps:  #2 (unless managed DB), #5
```

**Pros:**
- **API stays fast during scraping** — no more slow dashboard
- Workers get dedicated RAM for Playwright (4-8GB)
- DB connections separated: 10 for API, 20 for workers
- Worker VM can be bigger/smaller independently
- Worker crash doesn't affect dashboard
- Workers can be on cheaper Spot VM (preemption okay for scrapers)

**Cons:**
- Two VMs = higher cost
- DB still in container (unless combined with Tier 2 = Tier 4)
- Need to manage two deployments
- Redis on worker VM — API needs network access to it
- More operational complexity

**Cost Comparison:**

| Config | GCP | AWS |
|--------|-----|-----|
| VM1 (API): 0.5 vCPU, 2GB Spot | $4-6/mo | $4-6/mo |
| VM2 (Workers): 1 vCPU, 4GB Spot | $8-12/mo | $9-12/mo |
| DB: Container on VM2 | $0 | $0 |
| 2x 20GB SSD disk | $3.20/mo | $3.20/mo |
| **Total** | **$15-21/mo** | **$16-21/mo** |

**Recommended config:** Small on-demand VM for API + Medium Spot VM for workers

---

### Tier 4: Full Split — API + Workers + Managed DB

**Concept:** The production-grade setup. Each concern fully isolated.

```
+------------------+  +------------------+  +------------------+
| VM 1: Frontend   |  | VM 2: Workers    |  | Managed DB       |
|                  |  |                  |  |                  |
| +-------------+  |  | +-------------+  |  | +-------------+  |
| | Dashboard   |  |  | | Worker (BG) |  |  | | PostgreSQL  |  |
| | + API       |  |  | | + Inter.    |  |  | | Primary     |  |
| | + Redis     |  |  | +-------------+  |  | +-------------+  |
| +-------------+  |  | +-------------+  |  |                  |
|                  |  | | Playwright  |  |  | Auto backup      |
| Reads ---------> |  | | Browsers    |  |  | Auto patching    |
|                  |  | +-------------+  |  | Point-in-time    |
| Pool: 10        |  | Pool: 30        |  | HA: optional     |
| RAM: 1-2GB      |  | RAM: 4-8GB      |  |                  |
+------------------+  +------------------+  +------------------+

Solves: ALL bottlenecks (#1 through #6)
```

**Pros:**
- **Solves every bottleneck** — the complete solution
- Each component scales independently
- Worker crash = zero dashboard impact
- DB professionally managed with backups
- Workers can burst resources during scraping
- Can add read replica for dashboard performance
- Production-ready architecture

**Cons:**
- Highest cost at startup ($22-30/mo GCP, less with AWS free tier)
- Three resources to manage
- Network latency between components
- More complex deployment pipeline
- Overkill for single user

**Cost Comparison:**

| Config | GCP | AWS |
|--------|-----|-----|
| VM1 (API): micro/small | $4-6/mo | $2-3/mo |
| VM2 (Workers): medium Spot | $8-12/mo | $9-12/mo |
| Managed DB | Cloud SQL $7-9/mo | **RDS Free (yr1!)** |
| 2x 20GB SSD | $3.20/mo | $3.20/mo |
| **Total (yr1)** | **$22-30/mo** | **$14-18/mo** |
| **Total (yr2+)** | **$22-30/mo** | **$26-33/mo** |

**AWS advantage:** With RDS free tier yr1, Tier 4 costs the same as Tier 3!

---

### Tier 5: Auto-scaling Workers

**Concept:** Worker fleet scales based on demand. API always on.

```
              +-------------------+
              |  Load Balancer    |
              | (GCP LB / ALB)   |
              +--------+----------+
                       |
          +------------+------------+
          |            |            |
  +-------+----+ +----+------+ +---+-------+
  | API + Dash | | Worker 1  | | Worker 2  |
  | (always on)| | (Spot)    | | (Spot)    |
  | 1-2GB      | | Plat 1-6  | | Plat 7-11 |
  +-------+----+ +----+------+ +---+-------+
          |            |            |
          +------------+------------+
                       |
              +--------+--------+
              |  Managed DB     |
              | + Read Replica  |
              +-----------------+

Worker scaling:
  1 worker  = all 11 platforms
  2 workers = 6 + 5 platforms (split by load)
  3 workers = 4 + 4 + 3 platforms

Scale trigger: queue depth > 20 OR job time > 2x normal
```

**Pros:**
- Workers scale with demand automatically
- Pay only for what you use (Spot pricing)
- Handle 20+ platforms without bottleneck
- Read replica eliminates API read contention
- True production architecture

**Cons:**
- Requires load balancer ($16/mo AWS ALB minimum)
- Auto-scaling config is complex
- Multiple Spot VMs = more preemption management
- Over-engineered for <20 platforms
- $40-50+/mo minimum

**Cost Comparison:**

| Config | GCP | AWS |
|--------|-----|-----|
| API VM (small, on-demand) | $13/mo | $8/mo |
| Worker VMs (1-2 Spot) | $8-24/mo | $9-24/mo |
| Managed DB | Cloud SQL $7-9/mo | RDS $12-15/mo |
| Load Balancer | $18/mo | $16/mo |
| **Total (1 worker)** | **$46/mo** | **$45/mo** |
| **Total (2 workers)** | **$54/mo** | **$53/mo** |

**When to use:** 20+ platforms, 50+ users, $50+/mo budget

---

## 4. Tier Comparison

### At a Glance

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--|--------|--------|--------|--------|--------|
| **What** | All on 1 VM | VM + Managed DB | API VM + Worker VM | API + Worker + DB | Auto-scale |
| **Servers** | 1 | 1 + DB | 2 | 2 + DB | 2-3 + DB |

### Cost

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--|--------|--------|--------|--------|--------|
| **GCP** | $17-22 | $17-23 | $15-21 | $22-30 | $46+ |
| **AWS** | $14-20 | $14-18 yr1 | $16-21 | $14-18 yr1 | $45+ |
| **$20-25 startup?** | ✅ | ✅ | ✅ | ⚠️ AWS yr1 only | ❌ |
| **$40-50 scale-up?** | ✅ | ✅ | ✅ | ✅ | ✅ |

### Which Bottleneck Does Each Tier Solve?

| Bottleneck | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|------------|--------|--------|--------|--------|--------|
| #1 Single server failure | ⚠️ | ⚠️ | ✅ | ✅ | ✅ |
| #2 No DB backup | ❌ | ✅ | ❌ | ✅ | ✅ |
| #3 Shared DB pool | ❌ | ❌ | ✅ | ✅ | ✅ |
| #4 Playwright RAM | ❌ | ❌ | ✅ | ✅ | ✅ |
| #5 No disaster recovery | ❌ | ⚠️ | ⚠️ | ✅ | ✅ |
| #6 Workers can't scale | ❌ | ❌ | ⚠️ | ⚠️ | ✅ |
| **Bottlenecks solved** | **0/6** | **1/6** | **3/6** | **5/6** | **6/6** |

### Operational Complexity

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 |
|--|--------|--------|--------|--------|--------|
| **Setup time** | 1 hour | 2 hours | 2 hours | 3 hours | 1 day |
| **Code changes** | None | None | None | None | Minor |
| **Deploy complexity** | Low | Low | Medium | Medium | High |
| **Monitoring needed** | Basic | Basic | Medium | Medium | Advanced |
| **Best for** | MVP | Data safety | Performance | Production | Scale |

### GCP vs AWS per Tier

| Tier | GCP Advantage | AWS Advantage | Recommendation |
|------|--------------|---------------|----------------|
| **Tier 1** | $300 free credit to start | Lightsail $20 flat, simple | **GCP** (free credit) |
| **Tier 2** | Simpler console | **RDS free 12 months** | **AWS** (free DB!) |
| **Tier 3** | Simpler setup | **Cheaper Spot + better recovery** | **AWS** |
| **Tier 4** | Simpler console | **RDS free yr1 = Tier 3 price** | **AWS** |
| **Tier 5** | Instance Group simpler | Spot Fleet more mature | Tie |

---

## 5. Growth Roadmap & Migration Checklist

### Recommended Path

```
STAGE 1: STARTUP ($20-25/mo)
+-------------------------------------------+
|                                           |
|  Tier 3: Split VMs (RECOMMENDED)          |
|  - API/Dashboard on small VM              |
|  - Workers on separate medium VM          |
|  - Workers can scale for 3-10x load       |
|  - Cost: $15-21/mo                        |
|  - Solves: performance + scale            |
|                                           |
|  Why not Tier 1?                          |
|  Full worker capacity (3-10x) will        |
|  crash a single VM. Workers MUST be       |
|  separable from day one.                  |
|                                           |
+-------------------------------------------+
            |
            v
STAGE 2: FULL CAPACITY ($25-40/mo, all platforms healthy)
+-------------------------------------------+
|                                           |
|  Tier 4: Full Split + Managed DB          |
|  - Add RDS/Cloud SQL for auto backup      |
|  - Worker VM sized for 3-10x load         |
|  - 8-16GB RAM on worker VM                |
|  - Cost: $22-33/mo                        |
|  - Solves: backup + performance + scale   |
|                                           |
+-------------------------------------------+
            |
            v
STAGE 3: GROWTH ($40-50/mo, 20+ users)
+-------------------------------------------+
|                                           |
|  Tier 4: Full Split                       |
|  - Add Managed DB (or keep RDS)           |
|  - Production-grade architecture          |
|  - Cost: $22-33/mo                        |
|  - Solves: almost everything              |
|                                           |
+-------------------------------------------+
            |
            v
STAGE 4: SCALE ($50-100/mo, 100+ users)
+-------------------------------------------+
|                                           |
|  Tier 5: Auto-scaling                     |
|  - Multiple worker VMs                    |
|  - Load balancer + read replica           |
|  - Cost: $45-55/mo                        |
|  - Solves: everything                     |
|                                           |
+-------------------------------------------+
```

### DB Inside vs Outside

```
Do you need automatic backups?
          |
    +-----+-----+
    | No         | Yes
    |            |
  Tier 1       Can you afford $7-15/mo?
  + manual       |
  pg_dump    +---+---+
  to S3/GCS  | No    | Yes
             |       |
          Tier 1   +--------+--------+
          + cron   | AWS RDS (free!) |
          backup   | or GCP Cloud SQL|
                   +-----------------+
```

### Migration Checklist

**Tier 1 (Quick Start):**

- [ ] Create GCP/AWS account
- [ ] Provision VM (e2-standard-2 Spot / t3.medium Spot)
- [ ] Attach 30GB SSD persistent disk
- [ ] Install Docker + Docker Compose
- [ ] Clone repo, configure `.env`
- [ ] `docker compose -f docker-compose.prod.yml up -d`
- [ ] Setup reverse proxy (Caddy/Nginx) + SSL
- [ ] Update DNS records
- [ ] Setup daily backup cron (pg_dump to S3/GCS)
- [ ] Verify: `curl https://api.appranks.io/health`
- [ ] Setup UptimeRobot for external monitoring
- [ ] Migrate data: `pg_dump` from old server, `psql` restore on new

**Tier 2 (Add Managed DB):**

- [ ] All Tier 1 steps, except DB container
- [ ] Create RDS/Cloud SQL instance
- [ ] Update `DATABASE_URL` in `.env` to managed DB endpoint
- [ ] Remove `postgres` service from `docker-compose.prod.yml`
- [ ] Verify backup is automatic (check RDS/Cloud SQL console)
- [ ] Test point-in-time recovery

**Tier 3 (Split VMs):**

- [ ] VM1: Deploy API + Dashboard containers
- [ ] VM2: Deploy Worker + Redis containers
- [ ] Configure Redis to bind to private IP (VPC)
- [ ] Update `REDIS_URL` in API `.env` to point to VM2
- [ ] Verify both VMs can reach DB
- [ ] Test: trigger scraper from dashboard, verify results

**Tier 4 (Add Managed DB to Tier 3):**

- [ ] All Tier 3 steps
- [ ] Create managed DB (RDS/Cloud SQL)
- [ ] Migrate data to managed DB
- [ ] Update both VMs' `DATABASE_URL`
- [ ] Remove DB container from worker VM

**Tier 5 (Auto-scaling Workers):**

- [ ] All Tier 4 steps
- [ ] Setup Load Balancer (AWS ALB / GCP Load Balancer)
- [ ] Create worker VM image (AWS AMI / GCP Image) with Docker pre-installed
- [ ] Configure auto-scaling (AWS Auto Scaling Group / GCP Managed Instance Group)
  - Min: 1 worker, Max: 3 workers
  - Scale trigger: BullMQ queue depth > 20 or CPU > 80%
- [ ] Split platform assignments across workers (e.g., Worker 1: platforms 1-6, Worker 2: 7-11)
- [ ] Create DB read replica for dashboard queries
- [ ] Route API reads to replica, worker writes to primary
- [ ] Setup monitoring: CloudWatch (AWS) / Cloud Monitoring (GCP)
- [ ] Test: kill a worker VM, verify auto-relaunch and job recovery
- [ ] Load test: simulate 100 users + all 11 platforms at full capacity

---

---

## Glossary

| Abbreviation | Full Name | What It Does |
|-------------|-----------|-------------|
| **EC2** | Elastic Compute Cloud | AWS virtual machine service |
| **GCE** | Google Compute Engine | GCP virtual machine service |
| **RDS** | Relational Database Service | AWS managed PostgreSQL/MySQL |
| **Cloud SQL** | — | GCP managed PostgreSQL/MySQL |
| **S3** | Simple Storage Service | AWS object storage (backups, files) |
| **GCS** | Google Cloud Storage | GCP object storage (backups, files) |
| **EBS** | Elastic Block Store | AWS persistent disk for VMs |
| **PD** | Persistent Disk | GCP persistent disk for VMs |
| **ALB** | Application Load Balancer | AWS load balancer for HTTP traffic |
| **ASG** | Auto Scaling Group | AWS auto VM scaling (add/remove VMs by rules) |
| **MIG** | Managed Instance Group | GCP auto VM scaling (add/remove VMs by rules) |
| **AMI** | Amazon Machine Image | AWS VM snapshot/template |
| **VPC** | Virtual Private Cloud | Private network between cloud resources |
| **Spot VM** | — | Discounted VM that can be interrupted anytime |
| **On-demand** | — | Regular-priced VM with uptime guarantee |
| **SLA** | Service Level Agreement | Uptime guarantee (e.g. 99.9%) |
| **DR** | Disaster Recovery | Plan for recovering from server failure |
| **HA** | High Availability | Architecture that minimizes downtime |
| **IOPS** | I/O Operations Per Second | Disk read/write speed metric |

---

*This document should be reviewed when hosting requirements change or budget increases.*
