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
4. [Architecture Tiers](#3-architecture-tiers) (Tier 1-5 + Tier 6: Email & AI Workers + Tier 7: Distributed Service Workers)
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

### Tier 6: Dedicated Email & AI Workers (Add-on)

**Concept:** Mevcut scraper altyapısından bağımsız, Email ve AI işlemleri için ayrılmış worker'lar. Her hizmet için biri anlık (real-time) diğeri batch (deferred) olmak üzere 2'şer worker process — toplam 4 yeni worker. Herhangi bir Tier (1-5) üzerine add-on olarak eklenir.

> **Not:** Email worker'ları (`email-instant`, `email-bulk`, `notifications`) zaten code-level'da mevcut ve Docker Compose'da tanımlı. Tier 6 bu yapıyı **AI worker'ları** ile genişletir ve tüm yapının mimari ilişkilerini resmileştirir.

---

#### 6.1 Sistem Topolojisi — Full Container Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER COMPOSE                                     │
│                                                                                 │
│  ┌──────────┐  ┌──────────┐                                                    │
│  │ postgres │  │  redis   │  ← Shared infrastructure                           │
│  │ (2GB)    │  │ (1.5GB)  │                                                    │
│  └────┬─────┘  └────┬─────┘                                                    │
│       │              │                                                          │
│       │    ┌─────────┴──────────────────────────────────────────┐               │
│       │    │              Redis (BullMQ Broker)                  │               │
│       │    │                                                    │               │
│       │    │  Queues:                                           │               │
│       │    │  ├── scraper-jobs-background   (scraper)           │               │
│       │    │  ├── scraper-jobs-interactive  (scraper)           │               │
│       │    │  ├── email-instant             (email)             │               │
│       │    │  ├── email-bulk                (email)             │               │
│       │    │  ├── notifications             (email/push)        │               │
│       │    │  ├── ai-realtime          ★NEW (ai)               │               │
│       │    │  └── ai-deferred          ★NEW (ai)               │               │
│       │    └────────────────────────────────────────────────────┘               │
│       │         │          │          │           │          │                  │
│  ┌────┴─────────┴──┐  ┌───┴──────┐  ┌┴─────────┐ ┌┴────────┐┌┴──────────┐     │
│  │    TIER 1-5     │  │  EMAIL   │  │  EMAIL   │ │NOTIFIC. ││           │     │
│  │   CONTAINERS    │  │  LAYER   │  │  LAYER   │ │  LAYER  ││  AI LAYER │     │
│  │                 │  │          │  │          │ │         ││   ★ NEW   │     │
│  │ ┌─────────────┐ │  │ ┌──────┐ │  │ ┌──────┐ │ │ ┌─────┐ ││ ┌───────┐ │     │
│  │ │ api (1GB)   │ │  │ │email │ │  │ │email │ │ │ │notif│ ││ │ai-rt  │ │     │
│  │ │ port 3001   │ │  │ │instnt│ │  │ │bulk  │ │ │ │     │ ││ │(1GB)  │ │     │
│  │ └─────────────┘ │  │ │(512M)│ │  │ │(1GB) │ │ │ │(512M│ ││ └───────┘ │     │
│  │ ┌─────────────┐ │  │ └──────┘ │  │ └──────┘ │ │ └─────┘ ││ ┌───────┐ │     │
│  │ │ dashboard   │ │  └──────────┘  └──────────┘ └─────────┘│ │ai-def │ │     │
│  │ │ (512M)      │ │                                         │ │(512M) │ │     │
│  │ └─────────────┘ │                EXISTING                 │ └───────┘ │     │
│  │ ┌─────────────┐ │                                         └──────────┘     │
│  │ │ worker (3GB)│ │                                                          │
│  │ │ bg+scheduler│ │                                                          │
│  │ └─────────────┘ │                                                          │
│  │ ┌─────────────┐ │                                                          │
│  │ │ worker-int  │ │                                                          │
│  │ │ (1GB)       │ │                                                          │
│  │ └─────────────┘ │                                                          │
│  │ ┌─────────────┐ │                                                          │
│  │ │ alloy (256M)│ │                                                          │
│  │ │ monitoring  │ │                                                          │
│  │ └─────────────┘ │                                                          │
│  └──────────────────┘                                                          │
│                                                                                 │
│  Total containers: 12 (was 10)     Total RAM: ~12GB (was ~10.3GB)              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### 6.2 Queue Topolojisi & Haberleşme

Tüm worker'lar aynı Redis instance üzerinden BullMQ queue'ları ile haberleşir. Doğrudan worker-to-worker iletişim **yoktur** — tüm koordinasyon Redis üzerinden queue mesajları ile gerçekleşir.

```
                        ┌────────────────────────┐
                        │         API            │
                        │  (Job Producer)        │
                        │                        │
                        │  Routes:               │
                        │  POST /forgot-password │──→ enqueueInstantEmail()
                        │  POST /signup          │──→ enqueueInstantEmail()   + enqueueNotification()
                        │  POST /login           │──→ enqueueInstantEmail()
                        │  POST /invite          │──→ enqueueInstantEmail()   + enqueueNotification()
                        │  POST /ai/analyze      │──→ enqueueAIJob()     ★NEW
                        │  POST /ai/keywords     │──→ enqueueAIJob()     ★NEW
                        │  POST /ai/content      │──→ enqueueAIJob()     ★NEW
                        │  POST /scraper/trigger │──→ enqueueScraperJob()
                        └───────────┬────────────┘
                                    │
                                    ▼
                ┌───────────────────────────────────────────┐
                │               REDIS                       │
                │         (BullMQ Message Broker)           │
                │                                           │
                │  7 Queues, 3 Domains:                     │
                │                                           │
                │  SCRAPER DOMAIN (existing)                │
                │  ┌─────────────────────────────────────┐  │
                │  │ scraper-jobs-background              │  │
                │  │   concurrency: 11                    │  │
                │  │   attempts: 1 (long-running)         │  │
                │  │   backoff: 30s exponential            │  │
                │  │   lock: per-platform Redis SET NX     │  │
                │  ├─────────────────────────────────────┤  │
                │  │ scraper-jobs-interactive              │  │
                │  │   concurrency: 1 (serial)            │  │
                │  │   attempts: 1                        │  │
                │  └─────────────────────────────────────┘  │
                │                                           │
                │  EMAIL/NOTIFICATION DOMAIN (existing)     │
                │  ┌─────────────────────────────────────┐  │
                │  │ email-instant                        │  │
                │  │   concurrency: 3                     │  │
                │  │   attempts: 3                        │  │
                │  │   backoff: 5s exponential             │  │
                │  │   priority: 2FA=1, others=default    │  │
                │  ├─────────────────────────────────────┤  │
                │  │ email-bulk                           │  │
                │  │   concurrency: 5                     │  │
                │  │   attempts: 2                        │  │
                │  │   backoff: 30s exponential            │  │
                │  │   rate limit: 50 jobs/min            │  │
                │  ├─────────────────────────────────────┤  │
                │  │ notifications                        │  │
                │  │   concurrency: 5                     │  │
                │  │   attempts: 3                        │  │
                │  │   backoff: 10s exponential            │  │
                │  │   rate limit: 100 jobs/min           │  │
                │  └─────────────────────────────────────┘  │
                │                                           │
                │  AI DOMAIN ★ NEW                          │
                │  ┌─────────────────────────────────────┐  │
                │  │ ai-realtime                          │  │
                │  │   concurrency: 2                     │  │
                │  │   attempts: 2                        │  │
                │  │   backoff: 5s exponential             │  │
                │  │   timeout: 60s per job               │  │
                │  │   rate limit: 30 jobs/min            │  │
                │  │   priority: user-facing=1            │  │
                │  ├─────────────────────────────────────┤  │
                │  │ ai-deferred                          │  │
                │  │   concurrency: 1                     │  │
                │  │   attempts: 2                        │  │
                │  │   backoff: 30s exponential            │  │
                │  │   timeout: 5min per job              │  │
                │  │   rate limit: 10 jobs/min            │  │
                │  └─────────────────────────────────────┘  │
                └───────────────────┬───────────────────────┘
                                    │
                    ┌───────────────┼───────────────────────────┐
                    │               │               │           │
                    ▼               ▼               ▼           ▼
            ┌──────────┐   ┌──────────┐   ┌──────────┐  ┌──────────┐
            │ SCRAPER  │   │  EMAIL   │   │  NOTIF   │  │    AI    │
            │ WORKERS  │   │ WORKERS  │   │  WORKER  │  │ WORKERS  │
            │ (2 cont) │   │ (2 cont) │   │ (1 cont) │  │ (2 cont) │
            └──────────┘   └──────────┘   └──────────┘  └──────────┘
```

---

#### 6.3 Job Akış Diyagramları

**A) Scraper → Email Cross-domain Akışı (mevcut)**

Scraper worker'ları tamamladıkları işler sonucu email veya notification tetikleyebilir.
Bu durumda scraper worker, Redis üzerinden email/notification queue'suna yeni job ekler.

```
Scheduler (cron)
    │
    ▼
scraper-jobs-background ──→ Worker (bg)
    │                           │
    │                           │  job type: daily_digest
    │                           │  1. DB'den digest data çek
    │                           │  2. Her user için email oluştur
    │                           │  3. enqueueBulkEmail() ──→ email-bulk queue
    │                           │  4. enqueueNotification() ──→ notifications queue
    │                           │
    │                           │  job type: category (scrape complete)
    │                           │  1. Yeni app keşfedildi
    │                           │  2. enqueueNotification() ──→ notifications queue
    │                           │     (competitor_alert tipi)
    │                           ▼
    │                    ┌──────────────┐
    │                    │  email-bulk  │──→ worker-email-bulk
    │                    └──────────────┘       │
    │                    ┌──────────────┐       │  SMTP gönderim
    │                    │notifications │──→ worker-notifications
    │                    └──────────────┘       │
    │                                          │  Push + in-app
    │                                          ▼
    │                                     PostgreSQL
    │                                     (email_logs, notification_logs)
```

**B) API → Email Real-time Akışı (mevcut)**

Kullanıcı aksiyonları anlık email tetikler. API doğrudan `email-instant` queue'suna job ekler.

```
User Request
    │
    ▼
API Route Handler
    │
    ├── POST /forgot-password
    │   └── enqueueInstantEmail({ type: "email_password_reset", ... })
    │       priority: default
    │
    ├── POST /auth/signup
    │   └── enqueueInstantEmail({ type: "email_welcome", ... })
    │       priority: default
    │
    ├── POST /auth/login
    │   └── enqueueInstantEmail({ type: "email_login_alert", ... })
    │       priority: default
    │
    ├── POST /auth/2fa/verify
    │   └── enqueueInstantEmail({ type: "email_2fa_code", ... })
    │       priority: 1 (HIGHEST)
    │
    └── POST /invite
        └── enqueueInstantEmail({ type: "email_invitation", ... })
            priority: default
    │
    ▼
┌──────────────┐
│email-instant │──→ worker-email-instant (concurrency: 3)
└──────────────┘       │
                       ├── Template render (HTML)
                       ├── SMTP transport (Nodemailer)
                       ├── Tracking pixel injection
                       ├── email_logs INSERT
                       └── Bounce handling
```

**C) API → AI Real-time Akışı ★ NEW**

Kullanıcı dashboard'dan AI analizi istediğinde, API `ai-realtime` queue'suna job ekler.
Worker OpenAI API'ye istek yapar, sonucu DB'ye yazar, opsiyonel olarak notification tetikler.

```
User Request (Dashboard)
    │
    ▼
API Route Handler
    │
    ├── POST /ai/analyze-app
    │   └── enqueueAIJob({ type: "app_analysis", slug, accountId })
    │       queue: ai-realtime, priority: 1
    │
    ├── POST /ai/keyword-suggestions
    │   └── enqueueAIJob({ type: "keyword_suggestions", keyword, platform })
    │       queue: ai-realtime, priority: 1
    │
    ├── POST /ai/content/comparison
    │   └── enqueueAIJob({ type: "content_comparison", appSlugs })
    │       queue: ai-realtime, priority: 2
    │
    └── POST /ai/content/category-overview
        └── enqueueAIJob({ type: "content_category", categorySlug })
            queue: ai-realtime, priority: 3
    │
    ▼
┌──────────────┐
│ ai-realtime  │──→ worker-ai-realtime (concurrency: 2)
└──────────────┘       │
                       ├── Check ai cache (aiKeywordSuggestions / aiCompetitorSuggestions)
                       │   └── Cache hit → return cached, skip LLM call
                       ├── callAI() → OpenAI API (gpt-4o / gpt-4o-mini)
                       │   ├── Structured JSON output
                       │   ├── Timeout: 60s
                       │   └── Auto-retry: transient errors only
                       ├── logAICall() → ai_logs INSERT (tokens, cost tracking)
                       ├── Result → DB write (cache table)
                       └── Opsiyonel: enqueueNotification()
                           └── "AI analysis complete" in-app notification
```

**D) Scheduler/Scraper → AI Deferred Akışı ★ NEW**

Cron job'lar veya scraper tamamlanma event'leri batch AI işlerini tetikler.
Bu işler zamanlamaya duyarlı değil, arka planda çalışır.

```
Scheduler (cron) veya Scraper Completion Event
    │
    ├── Cron: "Her gece 03:00 — tüm app'ler için score hesapla"
    │   └── enqueueAIJob({ type: "bulk_app_scoring" })
    │       queue: ai-deferred
    │
    ├── Cron: "Her hafta Pazar — trend analizi"
    │   └── enqueueAIJob({ type: "trend_analysis", platform })
    │       queue: ai-deferred
    │
    ├── Cron: "Her gece 04:00 — expired AI cache temizliği"
    │   └── enqueueAIJob({ type: "cache_cleanup" })
    │       queue: ai-deferred
    │
    └── Scraper completion → "Yeni kategori verisi → SEO content üret"
        └── enqueueAIJob({ type: "content_category", categorySlug })
            queue: ai-deferred, priority: 10 (low)
    │
    ▼
┌──────────────┐
│ ai-deferred  │──→ worker-ai-deferred (concurrency: 1)
└──────────────┘       │
                       ├── callAI() → OpenAI API (gpt-4o-mini preferred, cheaper)
                       │   ├── Timeout: 5min (bulk operations)
                       │   └── Rate limit: 10 jobs/min (API quota koruma)
                       ├── logAICall() → ai_logs INSERT
                       ├── Bulk DB writes (app_scores, ai cache tables)
                       └── Opsiyonel: enqueueBulkEmail()
                           └── "Weekly AI insights ready" digest
```

---

#### 6.4 Cross-domain Haberleşme Matrisi

Hangi worker hangi queue'ya job ekleyebilir? Tüm haberleşme Redis üzerinden, tek yönlü producer→queue→consumer.

```
PRODUCER (satır) hangi QUEUE'ya (sütun) job ekler?

                    │ scraper │ scraper  │ email  │ email │ notif. │ ai-rt  │ ai-def │
                    │   bg    │  inter.  │ instant│ bulk  │        │  ★NEW  │  ★NEW  │
────────────────────┼─────────┼──────────┼────────┼───────┼────────┼────────┼────────┤
API                 │   ✅    │    ✅    │   ✅   │  —    │   ✅   │  ✅    │   —    │
Scheduler (cron)    │   ✅    │    —     │   —    │  —    │   —    │  —     │  ✅    │
Worker (bg scraper) │   ✅¹   │    —     │   —    │  ✅   │   ✅   │  —     │  ✅²   │
Worker (interactive)│   —     │    —     │   —    │  —    │   —    │  —     │   —    │
Worker (email-inst) │   —     │    —     │   —    │  —    │   —    │  —     │   —    │
Worker (email-bulk) │   —     │    —     │   ✅³  │  —    │   ✅   │  —     │   —    │
Worker (notif.)     │   —     │    —     │   —    │  —    │   —    │  —     │   —    │
Worker (ai-rt) ★NEW │   —     │    —     │   —    │  —    │   ✅   │  —     │   —    │
Worker (ai-def)★NEW │   —     │    —     │   —    │  ✅   │   ✅   │  —     │   —    │

¹ Cascade: category → app_details → reviews (same queue, new jobs)
² Scraper tamamlanınca AI content üretimi tetiklenir
³ Bulk email bounce → instant queue'ya "email_bounce_alert" ekleyebilir
```

---

#### 6.5 Queue Konfigürasyonu — Detaylı

| Queue | Domain | Worker | Conc. | Attempts | Backoff | Rate Limit | Timeout | Priority Range | Memory |
|-------|--------|--------|-------|----------|---------|------------|---------|----------------|--------|
| `scraper-jobs-background` | Scraper | worker | 11 | 1 | 30s exp | — | 10-45min | default | 3GB |
| `scraper-jobs-interactive` | Scraper | worker-interactive | 1 | 1 | 30s exp | — | 10-45min | default | 1GB |
| `email-instant` | Email | worker-email-instant | 3 | 3 | 5s exp | — | 30s | 1 (2FA) - default | 512MB |
| `email-bulk` | Email | worker-email-bulk | 5 | 2 | 30s exp | 50/min | 2min | default | 1GB |
| `notifications` | Notif. | worker-notifications | 5 | 3 | 10s exp | 100/min | 30s | default | 512MB |
| `ai-realtime` ★ | AI | worker-ai-realtime | 2 | 2 | 5s exp | 30/min | 60s | 1-3 | 1GB |
| `ai-deferred` ★ | AI | worker-ai-deferred | 1 | 2 | 30s exp | 10/min | 5min | 10 (low) | 512MB |

**Neden bu rate limit'ler?**
- `ai-realtime: 30/min` — OpenAI API tier-1 RPM limit'i (~60 RPM). %50 headroom bırakır.
- `ai-deferred: 10/min` — Realtime'a quota bırakmak için kasıtlı olarak düşük. Gece çalışırken artırılabilir.
- `email-bulk: 50/min` — SMTP provider günlük limit'ine (genelde 500-2000/gün) uyumlu.

---

#### 6.6 Queue Kodu — Yeni Eklenecekler

**`apps/scraper/src/queue.ts` — yeni queue tanımları:**

```typescript
// ── Existing queue names ──────────────────────────────────────
export const BACKGROUND_QUEUE_NAME = "scraper-jobs-background";
export const INTERACTIVE_QUEUE_NAME = "scraper-jobs-interactive";
export const EMAIL_INSTANT_QUEUE_NAME = "email-instant";
export const EMAIL_BULK_QUEUE_NAME = "email-bulk";
export const NOTIFICATIONS_QUEUE_NAME = "notifications";

// ── NEW: AI queue names ────────────────────────────────────────
export const AI_REALTIME_QUEUE_NAME = "ai-realtime";
export const AI_DEFERRED_QUEUE_NAME = "ai-deferred";

// ── NEW: AI job data interface ─────────────────────────────────
export interface AIJobData {
  type:
    | "app_analysis"           // Tek app analizi (realtime)
    | "keyword_suggestions"    // Keyword önerileri (realtime)
    | "competitor_suggestions" // Rakip önerileri (realtime)
    | "content_comparison"     // App karşılaştırma (realtime)
    | "content_category"       // Kategori SEO content (realtime veya deferred)
    | "content_best_of"        // Best-of listicle (deferred)
    | "bulk_app_scoring"       // Toplu app puanlama (deferred)
    | "trend_analysis"         // Haftalık trend analizi (deferred)
    | "cache_cleanup";         // Expired cache temizliği (deferred)
  /** App slug for single-app operations */
  slug?: string;
  /** Keyword for keyword-related operations */
  keyword?: string;
  /** Platform scope */
  platform?: string;
  /** Category slug for category-level operations */
  categorySlug?: string;
  /** Multiple app slugs for comparison */
  appSlugs?: string[];
  /** Account ID for account-scoped operations */
  accountId?: string;
  /** User ID for user-scoped operations */
  userId?: string;
  /** Job origin: "api" | "scheduler" | "scraper" */
  triggeredBy: string;
  /** API request ID for correlation/tracing */
  requestId?: string;
}

// ── NEW: AI queue options ──────────────────────────────────────
const aiRealtimeJobOptions = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 5_000 },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

const aiDeferredJobOptions = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: JOB_REMOVE_ON_COMPLETE_COUNT },
  removeOnFail: { count: JOB_REMOVE_ON_FAIL_COUNT },
};

// ── NEW: AI queue singletons + enqueue helpers ─────────────────
let _aiRealtimeQueue: Queue<AIJobData> | null = null;
let _aiDeferredQueue: Queue<AIJobData> | null = null;

export function getAIRealtimeQueue(): Queue<AIJobData> {
  if (!_aiRealtimeQueue) {
    _aiRealtimeQueue = new Queue<AIJobData>(AI_REALTIME_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: aiRealtimeJobOptions,
    });
  }
  return _aiRealtimeQueue;
}

export function getAIDeferredQueue(): Queue<AIJobData> {
  if (!_aiDeferredQueue) {
    _aiDeferredQueue = new Queue<AIJobData>(AI_DEFERRED_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: aiDeferredJobOptions,
    });
  }
  return _aiDeferredQueue;
}

export async function enqueueAIJob(
  data: AIJobData,
  options?: { priority?: number; delay?: number; queue?: "realtime" | "deferred" }
): Promise<string> {
  const queue = options?.queue === "deferred"
    ? getAIDeferredQueue()
    : getAIRealtimeQueue();
  const job = await queue.add(`ai:${data.type}`, data, {
    priority: options?.priority,
    delay: options?.delay,
  });
  return job.id!;
}
```

---

#### 6.7 Worker Entrypoint'ler — Yeni Dosyalar

**`apps/scraper/src/ai-realtime-worker.ts`:**

```typescript
import { Worker, type Job } from "bullmq";
import { AI_REALTIME_QUEUE_NAME, getRedisConnection, type AIJobData } from "./queue.js";
import { processAIJob } from "./ai/process-ai-job.js";
import { createLogger } from "@appranks/shared";
import { setupGracefulShutdown } from "./graceful-shutdown.js";

const log = createLogger("ai-realtime-worker");
const AI_REALTIME_CONCURRENCY = 2;
const AI_REALTIME_RATE_LIMIT = { max: 30, duration: 60_000 }; // 30 jobs/min

const worker = new Worker<AIJobData>(
  AI_REALTIME_QUEUE_NAME,
  async (job: Job<AIJobData>) => {
    log.info("processing ai job", { type: job.data.type, id: job.id });
    return processAIJob(job.data, { timeout: 60_000, preferredModel: "gpt-4o" });
  },
  {
    connection: getRedisConnection(),
    concurrency: AI_REALTIME_CONCURRENCY,
    limiter: AI_REALTIME_RATE_LIMIT,
  }
);

worker.on("completed", (job) => log.info("ai job completed", { id: job.id, type: job.data.type }));
worker.on("failed", (job, err) => log.error("ai job failed", { id: job?.id, error: err.message }));

setupGracefulShutdown([worker], { timeout: 30_000 });
log.info("ai-realtime-worker started", { concurrency: AI_REALTIME_CONCURRENCY });
```

**`apps/scraper/src/ai-deferred-worker.ts`:**

```typescript
import { Worker, type Job } from "bullmq";
import { AI_DEFERRED_QUEUE_NAME, getRedisConnection, type AIJobData } from "./queue.js";
import { processAIJob } from "./ai/process-ai-job.js";
import { createLogger } from "@appranks/shared";
import { setupGracefulShutdown } from "./graceful-shutdown.js";

const log = createLogger("ai-deferred-worker");
const AI_DEFERRED_CONCURRENCY = 1;
const AI_DEFERRED_RATE_LIMIT = { max: 10, duration: 60_000 }; // 10 jobs/min

const worker = new Worker<AIJobData>(
  AI_DEFERRED_QUEUE_NAME,
  async (job: Job<AIJobData>) => {
    log.info("processing deferred ai job", { type: job.data.type, id: job.id });
    return processAIJob(job.data, { timeout: 300_000, preferredModel: "gpt-4o-mini" });
  },
  {
    connection: getRedisConnection(),
    concurrency: AI_DEFERRED_CONCURRENCY,
    limiter: AI_DEFERRED_RATE_LIMIT,
  }
);

worker.on("completed", (job) => log.info("deferred ai job completed", { id: job.id }));
worker.on("failed", (job, err) => log.error("deferred ai job failed", { id: job?.id, error: err.message }));

setupGracefulShutdown([worker], { timeout: 120_000 }); // longer grace for bulk ops
log.info("ai-deferred-worker started", { concurrency: AI_DEFERRED_CONCURRENCY });
```

---

#### 6.8 Docker Compose — Yeni Container Tanımları

```yaml
  # ── AI Workers ★ NEW ────────────────────────────────────────────

  worker-ai-realtime:
    build:
      context: .
      dockerfile: Dockerfile.worker-ai       # lightweight, no Playwright
    restart: always
    logging: *default-logging
    stop_grace_period: 30s
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-shopify_tracking}
      REDIS_URL: redis://redis:6379
      WORKER_MODE: ai-realtime
      OPENAI_API_KEY: ${OPENAI_API_KEY:?OPENAI_API_KEY is required}
      SENTRY_DSN: ${SENTRY_DSN:-}
      DASHBOARD_URL: ${DASHBOARD_URL:-http://localhost:3000}
      NODE_ENV: production
    deploy:
      resources:
        limits:
          memory: 1G
    depends_on:
      migrate:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker-ai-deferred:
    build:
      context: .
      dockerfile: Dockerfile.worker-ai
    restart: always
    logging: *default-logging
    stop_grace_period: 120s
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-shopify_tracking}
      REDIS_URL: redis://redis:6379
      WORKER_MODE: ai-deferred
      OPENAI_API_KEY: ${OPENAI_API_KEY:?OPENAI_API_KEY is required}
      SENTRY_DSN: ${SENTRY_DSN:-}
      DASHBOARD_URL: ${DASHBOARD_URL:-http://localhost:3000}
      NODE_ENV: production
    deploy:
      resources:
        limits:
          memory: 512M
    depends_on:
      migrate:
        condition: service_completed_successfully
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

**`Dockerfile.worker-ai`** — Playwright olmadan hafif image:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json turbo.json ./
COPY packages/ packages/
COPY apps/scraper/ apps/scraper/
RUN npm ci --omit=dev && npm run build -w packages/shared -w packages/db -w apps/scraper
# No Playwright, no Chromium — pure Node.js
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "process.exit(0)"
CMD ["node", "apps/scraper/dist/${WORKER_MODE}-worker.js"]
```

---

#### 6.9 Failure Handling & Dead Letter Queue

Tüm domain'ler aynı DLQ pattern'ini kullanır. Max retry sonrası iş `dead_letter_jobs` tablosuna yazılır.

```
Job fails (max attempts exceeded)
    │
    ▼
Worker "failed" event handler
    │
    ├── 1. dead_letter_jobs INSERT
    │   {
    │     jobId, queueName, jobType, platform,
    │     payload (JSON), errorMessage, errorStack,
    │     attemptsMade, maxAttempts, failedAt
    │   }
    │
    ├── 2. Sentry captureException (error tracking)
    │
    ├── 3. Queue-specific recovery:
    │   │
    │   ├── email-instant failure:
    │   │   └── enqueueNotification("email_delivery_failed")
    │   │       → Admin'e in-app alert
    │   │
    │   ├── email-bulk failure:
    │   │   └── Log to email_logs (status: "failed")
    │   │       → Bounce tracking counter++
    │   │
    │   ├── ai-realtime failure:
    │   │   └── DB cache status → "failed"
    │   │       → User dashboard'da "Analysis failed, retry?" gösterir
    │   │
    │   └── ai-deferred failure:
    │       └── Log only. Scheduler sonraki cycle'da tekrar tetikler.
    │
    └── 4. Critical failure (5+ DLQ entries/hour same type):
        └── Linear issue auto-create (existing pattern)
```

---

#### 6.10 Monitoring & Health Checks

```
┌─────────────────────────────────────────────────────────────┐
│                GET /api/system-admin/queue-stats             │
│                                                             │
│  Returns per-queue:                                         │
│  {                                                          │
│    "background":    { waiting, active, completed, failed }, │
│    "interactive":   { waiting, active, completed, failed }, │
│    "emailInstant":  { waiting, active, completed, failed }, │
│    "emailBulk":     { waiting, active, completed, failed }, │
│    "notifications": { waiting, active, completed, failed }, │
│    "aiRealtime":    { waiting, active, completed, failed }, ★NEW
│    "aiDeferred":    { waiting, active, completed, failed }, ★NEW
│  }                                                          │
│                                                             │
│  Alert thresholds:                                          │
│  ├── ai-realtime waiting > 10  → "AI response delay" alert │
│  ├── ai-deferred waiting > 50  → "AI batch backlog" warn   │
│  ├── email-instant waiting > 5 → "Email delay" alert       │
│  └── Any queue failed > 10/hr  → "Queue health" critical   │
└─────────────────────────────────────────────────────────────┘

Admin Dashboard (existing system-admin/scraper page):
  ├── Queue status cards (7 queues, was 5)
  ├── Per-queue job listing (waiting/active/failed)
  ├── Manual trigger buttons
  └── DLQ viewer with retry/discard actions
```

---

#### 6.11 Resource Özeti

| Container | RAM Limit | CPU Profile | Playwright? | External API? |
|-----------|-----------|-------------|-------------|---------------|
| worker (bg+sched) | 3GB | CPU-heavy | ✅ Yes | — |
| worker-interactive | 1GB | CPU-heavy | ✅ Yes | — |
| worker-email-instant | 512MB | I/O-bound | ❌ | SMTP |
| worker-email-bulk | 1GB | I/O-bound | ❌ | SMTP |
| worker-notifications | 512MB | I/O-bound | ❌ | Push API |
| worker-ai-realtime ★ | 1GB | I/O-bound | ❌ | OpenAI API |
| worker-ai-deferred ★ | 512MB | I/O-bound | ❌ | OpenAI API |
| **Tier 6 ek RAM** | **+1.5GB** | | | |
| **Toplam tüm worker'lar** | **~7.5GB** | | | |

---

#### 6.12 Neden Bu Mimari?

**Problem:** Scraper worker'ları CPU/RAM yoğun (Playwright, HTML parsing, 11 concurrent platform). Email ve AI işleri aynı process'te çalışırsa:
- Password reset email'i 45 dakikalık category scrape bitene kadar bekler
- AI analiz isteği Playwright RAM spike'ından etkilenir
- OpenAI API rate limit'i scraper timeout'larından etkilenir

**Çözüm — Domain izolasyonu:**
1. **Scraper domain** → CPU/RAM yoğun, Playwright gerektirir, uzun sürer (10-45 min)
2. **Email domain** → I/O yoğun (SMTP), kısa süreli (<30s), güvenilirlik kritik
3. **AI domain** → I/O yoğun (HTTP→OpenAI), orta süreli (1s-5min), maliyet kontrolü kritik

**Real-time vs Deferred ayrımı:**
- Real-time queue: Kullanıcı ekranda bekliyor. Düşük latency, yüksek priority.
- Deferred queue: Cron tetikliyor, kimse beklemiyor. Düşük priority, rate limit ile maliyet kontrolü.
- Aynı worker process'te olsalar bile ayrı queue = ayrı concurrency + priority. Deferred batch asla real-time'ı bloklamaz.

**Maliyet avantajı:**
- AI deferred worker `gpt-4o-mini` kullanır (10x ucuz) çünkü batch kalite toleransı yüksek
- AI realtime worker `gpt-4o` kullanır çünkü kullanıcı kaliteli yanıt bekler
- Rate limit ile aylık OpenAI faturası kontrol altında

**When to use:** Email ve AI feature'ları aktif olduğunda, herhangi bir Tier (1-5) ile birlikte

---

### Tier 7: Distributed Service Workers (Multi-Machine)

**Concept:** Tier 6'daki email, notification ve AI worker'larını birden fazla makineye dağıtır. Email+Notification always-on VM'de (güvenilirlik), AI worker'ları Spot VM'lerde (auto-scale). Tier 5'in scraper scaling yaklaşımını tüm service worker domain'lerine uygular.

> **Not:** Tier 7, Tier 5 + Tier 6'nın birleşimidir. Scraper'lar zaten Tier 5'te multi-machine. Tier 7 buna email ve AI worker'larını ayrı makinelere taşıyarak ekler.

---

#### 7.1 Sistem Topolojisi — Full Machine Map

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              TIER 7: DISTRIBUTED SERVICE WORKERS                         │
│                                                                                          │
│  ┌─────────────────────────────────────────────┐                                        │
│  │           LOAD BALANCER (ALB / GCP LB)       │                                        │
│  │           HTTPS termination + routing         │                                        │
│  └──────────────────────┬──────────────────────┘                                        │
│                         │                                                                │
│  ═══════════════════════╪════════════════════════════════════════  VPC (Private Network)  │
│                         │                                                                │
│  ┌──────────────────────┴──────────────────────┐                                        │
│  │                                              │                                        │
│  │  VM1: API + DASHBOARD (always-on, on-demand) │                                        │
│  │  ┌────────────────┐  ┌────────────────┐      │                                        │
│  │  │ API (Fastify)  │  │ Dashboard      │      │                                        │
│  │  │ port 3001      │  │ (Next.js)      │      │                                        │
│  │  │ 1GB            │  │ port 3000      │      │                                        │
│  │  │                │  │ 512MB          │      │                                        │
│  │  │ Job Producer:  │  │                │      │                                        │
│  │  │ enqueueEmail() │  │                │      │                                        │
│  │  │ enqueueAIJob() │  │                │      │                                        │
│  │  │ enqueueScraper │  │                │      │                                        │
│  │  └────────────────┘  └────────────────┘      │                                        │
│  │  RAM: 2GB  │  Type: e2-small / t3.small      │                                        │
│  └──────────────────────────────────────────────┘                                        │
│                         │                                                                │
│         ┌───────────────┼───────────────┬───────────────┐                                │
│         │               │               │               │                                │
│         ▼               ▼               ▼               ▼                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────────┐    │
│  │ VM2: SCRAPER │ │ VM2b:SCRAPER │ │ VM3: EMAIL   │ │ VM4+: AI WORKERS             │    │
│  │ WORKER       │ │ WORKER       │ │ + NOTIF +    │ │ (Spot, auto-scale 1→3)       │    │
│  │ (Spot)       │ │ (Spot)       │ │ REDIS        │ │                              │    │
│  │              │ │              │ │ (always-on)  │ │ ┌────────────┐ ┌────────────┐ │    │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ │ VM4a       │ │ VM4b       │ │    │
│  │ │worker    │ │ │ │worker    │ │ │ │redis     │ │ │ │ ai-realtime│ │ ai-realtime│ │    │
│  │ │(bg+sched)│ │ │ │(bg)      │ │ │ │(1.5GB)   │ │ │ │ (1GB)      │ │ (1GB)      │ │    │
│  │ │Plat 1-6  │ │ │ │Plat 7-11 │ │ │ ├──────────┤ │ │ └────────────┘ └────────────┘ │    │
│  │ │3GB       │ │ │ │3GB       │ │ │ │email-    │ │ │ ┌────────────┐                │    │
│  │ ├──────────┤ │ │ ├──────────┤ │ │ │instant   │ │ │ │ VM4c       │  ← scale up   │    │
│  │ │worker-   │ │ │ │worker-   │ │ │ │(512MB)   │ │ │ │ ai-deferred│                │    │
│  │ │interactv │ │ │ │interactv │ │ │ ├──────────┤ │ │ │ (512MB)    │                │    │
│  │ │1GB       │ │ │ │1GB       │ │ │ │email-    │ │ │ └────────────┘                │    │
│  │ └──────────┘ │ │ └──────────┘ │ │ │bulk      │ │ │                              │    │
│  │              │ │              │ │ │(1GB)     │ │ │ RAM: 2GB per VM              │    │
│  │ RAM: 5GB    │ │ RAM: 5GB    │ │ ├──────────┤ │ │ Type: e2-small Spot          │    │
│  │ Type: e2-med│ │ Type: e2-med│ │ │notifica- │ │ │      / t3.small Spot          │    │
│  │  Spot       �� │  Spot       │ │ │tions     │ │ │                              │    │
│  └──────────────┘ └──────────────┘ │ │(512MB)   │ │ └──────────────────────────────┘    │
│                                     │ └──────────┘ │                                     │
│                                     │              │                                     │
│                                     │ RAM: 4GB     │                                     │
│                                     │ Type: e2-small│                                    │
│                                     │  on-demand    │                                     │
│                                     └──────────────┘                                     │
│         │               │               │               │                                │
│         └───────────────┴───────────────┴───────────────┘                                │
│                                         │                                                │
│                              ┌──────────┴──────────┐                                    │
│                              │   MANAGED DATABASE    │                                    │
│                              │   (RDS / Cloud SQL)   │                                    │
│                              │                       │                                    │
│                              │  Primary (write)      │                                    │
│                              │  ├── API writes       │                                    │
│                              │  ├── Worker writes    │                                    │
│                              │  └── Email logs       │                                    │
│                              │                       │                                    │
│                              │  Read Replica (read)  │                                    │
│                              │  ├── Dashboard queries│                                    │
│                              │  └── AI cache reads   │                                    │
│                              │                       │                                    │
│                              │  Auto backup + PITR   │                                    │
│                              └───────────────────────┘                                    │
│                                                                                          │
│  MACHINE SUMMARY                                                                         │
│  ┌────────────────────────────────────────────────────────────────────────────┐           │
│  │ VM Type          │ Count  │ Pricing    │ RAM    │ Role                     │           │
│  │──────────────────│────────│────────────│────────│──────────────────────────│           │
│  │ API+Dashboard    │ 1      │ On-demand  │ 2GB    │ User-facing, always on   │           │
│  │ Scraper Workers  │ 1-3    │ Spot       │ 5GB    │ Playwright, CPU-heavy    │           │
│  │ Email+Notif+Redis│ 1      │ On-demand  │ 4GB    │ SMTP, push, BullMQ broker│           │
│  │ AI Workers       │ 1-3    │ Spot       │ 2GB    │ OpenAI API, I/O-bound    │           │
│  │ Managed DB       │ 1+rep  │ Managed    │ —      │ PostgreSQL + replica     │           │
│  │ Load Balancer    │ 1      │ Managed    │ —      │ HTTPS routing            │           │
│  │──────────────────│────────│────────────│────────│──────────────────────────│           │
│  │ TOTAL (min)      │ 4+LB+DB│           │ ~13GB  │ 1 of each worker type    │           │
│  │ TOTAL (max)      │ 8+LB+DB│           │ ~27GB  │ 3 scraper + 3 AI         │           │
│  └────────────────────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

#### 7.2 Neden Multi-Machine?

```
PROBLEM: Tek makinede tüm worker domain'leri birbirini etkiler

┌─────────────────────────────────────────────────────────────┐
│ SINGLE MACHINE (Tier 6)                                     │
│                                                             │
│  Playwright RAM spike ──→ Email worker OOM ──→ 2FA gecikir  │
│  AI batch job CPU ──→ Scraper timeout ──→ Data kaybı        │
│  Spot preemption ──→ TÜM worker'lar durur ──→ Email kayıp   │
│                                                             │
│  ⚠ Single point of failure for ALL domains                  │
└─────────────────────────────────────────────────────────────┘

SOLUTION: Domain isolation by machine type

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ SCRAPER VMs  │  │ EMAIL VM     │  │ AI VMs       │  │ API VM       │
│ (Spot)       │  │ (On-demand)  │  │ (Spot)       │  │ (On-demand)  │
│              │  │              │  │              │  │              │
│ Playwright   │  │ SMTP         │  │ OpenAI API   │  │ User traffic │
│ RAM spike    │  │ 2FA codes    │  │ Batch scoring│  │ Dashboard    │
│ izole        │  │ Password     │  │ izole        │  │ izole        │
│              │  │ reset        │  │              │  │              │
│ Spot preempt │  │ ASLA durma-  │  │ Spot preempt │  │ ASLA durma-  │
│ = re-queue   │  │ malı ❗       │  │ = re-queue   │  │ malı ❗       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**Domain bazlı izolasyon gerekçeleri:**

| Domain | Neden Ayrı Makine? | Pricing Tipi | Spot Uygunluğu |
|--------|-------------------|-------------|----------------|
| **Scraper** | Playwright 3-5GB RAM spike, 10-45 min uzun job'lar | Spot | ✅ Preemption = re-queue, job idempotent |
| **Email+Notif** | 2FA, password reset — saniye içinde ulaşmalı | On-demand | ❌ Preemption = kullanıcı erişim kaybı |
| **AI Realtime** | Kullanıcı dashboard'da bekliyor, 60s timeout | Spot | ⚠️ Kısa job, preemption rare, auto-retry |
| **AI Deferred** | Batch, gece çalışır, kimse beklemiyor | Spot | ✅ Mükemmel Spot adayı |
| **API+Dashboard** | Kullanıcı trafiği, her zaman erişilebilir | On-demand | ❌ Downtime = kullanıcı kaybı |

---

#### 7.3 Scaling Strategy

```
                     SCALING TOPOLOGY

   Component         Scaling        Trigger                     Min → Max
  ─────────────────────────────────────────────────────────────────────────
   API+Dashboard     Fixed (1)      —                           1 → 1
   Email+Notif       Fixed (1)      —                           1 → 1
   Scraper Workers   Auto-scale     queue depth > 20            1 → 3
                                    OR job time > 2x normal
   AI Workers        Auto-scale     ai-realtime waiting > 10    1 → 3
                                    OR ai-deferred waiting > 50


                        SCALING TIMELINE (örnek gün)

  06:00   12:00   18:00   00:00   03:00   06:00
    │       │       │       │       │       │
    ├───────┤       │       │       │       │
    │ Users │       │       │       │       │
    │ login │       │       │       │       │
    │       ├───────┤       │       │       │
    │       │ Peak  │       │       │       │
    │       │ AI    │       │       │       │
    │       │ usage │       │       │       │
    │       │       │       ├───────┤       │
    │       │       │       │ Batch │       │
    │       │       │       │ AI    │       │
    │       │       │       │ jobs  │       │
    │       │       │       │       │       │

  API VM:     ████████████████████████████████  (always 1)
  Email VM:   ████████████████████████████████  (always 1)
  Scraper:    ██░░░░██████░░░░██░░░░██████░░░░  (1-3, cron-driven)
  AI Workers: ░░░░░░████████░░░░░░░░████░░░░░░  (1-3, demand-driven)

  █ = active VM    ░ = scaled down (0 extra VMs)
```

**Auto-scale konfigürasyonu:**

```
# AWS Auto Scaling Group / GCP Managed Instance Group

SCRAPER_ASG:
  min_size: 1
  max_size: 3
  scale_up_policy:
    metric: custom/bullmq_queue_depth{queue="scraper-jobs-background"}
    threshold: 20
    cooldown: 300s
  scale_down_policy:
    metric: custom/bullmq_queue_depth{queue="scraper-jobs-background"}
    threshold: 5
    cooldown: 600s

AI_ASG:
  min_size: 1
  max_size: 3
  scale_up_policy:
    metric: custom/bullmq_queue_depth{queue="ai-realtime"}
    threshold: 10
    cooldown: 120s        # daha agresif — kullanıcı bekliyor
  scale_down_policy:
    metric: custom/bullmq_queue_depth{queue="ai-realtime"}
    threshold: 3
    cooldown: 300s
```

---

#### 7.4 Network & Service Discovery

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VPC (10.0.0.0/16)                           │
│                                                                     │
│  Public Subnet (10.0.1.0/24)           Private Subnet (10.0.2.0/24)│
│  ┌───────────────────────┐             ┌───────────────────────┐   │
│  │ Load Balancer         │             │ Managed DB (Primary)  │   │
│  │ → API VM (10.0.1.10)  │             │ 10.0.2.50             │   │
│  └───────────────────────┘             │                       │   │
│                                         │ Read Replica          │   │
│  Worker Subnet (10.0.3.0/24)           │ 10.0.2.51             │   │
│  ┌───────────────────────┐             └───────────────────────┘   │
│  │ Scraper VM  10.0.3.10 │                                         │
│  │ Scraper VM  10.0.3.11 │  ← auto-assigned                       │
│  │ Email VM    10.0.3.20 │  ← Redis burada (always-on)            │
│  │ AI VM       10.0.3.30 │                                         │
│  │ AI VM       10.0.3.31 │  ← auto-assigned                       │
│  └───────────────────────┘                                         │
│                                                                     │
│  Service Discovery:                                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Tüm worker'lar şu environment variable'ları alır:          │   │
│  │                                                             │   │
│  │ DATABASE_URL=postgresql://user:pass@10.0.2.50:5432/appranks│   │
│  │ DATABASE_READ_URL=postgresql://user:pass@10.0.2.51:5432/...│   │
│  │ REDIS_URL=redis://10.0.3.20:6379  (Email VM — always-on)  │   │
│  │ OPENAI_API_KEY=sk-...             (AI worker'lar için)     │   │
│  │ SMTP_HOST=smtp.provider.com       (Email worker için)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

REDIS PLACEMENT: Email VM üzerinde (Recommended)
┌────────────────────────────────────────────────────────────────────┐
│ ✅ Always-on VM = Redis asla Spot preemption'dan etkilenmez        │
│ ✅ Ek maliyet yok (managed Redis'e gerek yok)                      │
│ ✅ Email VM zaten düşük CPU kullanıyor — Redis'e kaynak bol        │
│ ⚠️ Email VM RAM'inden 1.5GB alır → VM boyutu 4GB olmalı           │
│                                                                    │
│ Alternatif: Managed Redis (ElastiCache / Memorystore)              │
│ ├── +$13-15/mo ek maliyet                                         │
│ ├── Auto-failover, fully managed                                   │
│ └── 500+ kullanıcıda değerlendirilmeli                            │
└────────────────────────────────────────────────────────────────────┘
```

---

#### 7.5 Failure & Preemption Handling

```
FAILURE SCENARIOS & RECOVERY

Scenario 1: Spot preemption — AI Worker VM
──────────────────────────────────────────
  AI VM receives 2-min SIGTERM warning
      │
      ▼
  Worker graceful shutdown (30s)
      │
      ├── In-flight ai-realtime jobs → complete if possible (60s timeout)
      │   └── Not completed → BullMQ marks as "stalled" → auto-retry
      │
      ├── In-flight ai-deferred jobs → complete if possible (5min timeout)
      │   └── Not completed → BullMQ marks as "stalled" → auto-retry
      │
      └── ASG launches replacement Spot VM (2-5 min)
          └── New worker picks up stalled jobs automatically

  Impact: 2-5 min AI latency spike. Email/Scraper UNAFFECTED. ✅


Scenario 2: Spot preemption — Scraper Worker VM
────────────────────────────────────────────────
  Scraper VM receives 2-min SIGTERM warning
      │
      ▼
  Worker graceful shutdown (120s — long-running jobs)
      │
      ├── In-flight scraper jobs → attempt completion
      │   └── Not completed → stalled → auto-retry next cycle
      │
      └── ASG launches replacement Spot VM

  Impact: Some platforms skip one cycle. Email/AI UNAFFECTED. ✅


Scenario 3: Email VM down (rare — on-demand)
─────────────────────────────────────────────
  Email VM crashes or becomes unresponsive
      │
      ▼
  Health check fails (30s interval × 3 attempts = 90s detection)
      │
      ├── 🚨 CRITICAL ALERT → PagerDuty/OpsGenie
      │
      ├── Redis on Email VM → ALL queues temporarily unavailable
      │   └── API: enqueue calls fail → in-memory retry buffer
      │   └── Workers: BullMQ auto-reconnect on Redis recovery
      │   └── Jobs NOT lost — BullMQ persistence (Redis AOF)
      │
      └── Recovery: cloud auto-healing restarts VM (2-5 min)
          └── Redis AOF replay → queue state restored
          └── All workers reconnect automatically

  Impact: 2-5 min full queue outage. HIGHEST PRIORITY. ⚠️


Scenario 4: Managed DB failover
───────────────────────────────
  Primary DB → automatic failover to standby
      │
      ▼
  30-60s connection reset
      │
      ├── All workers: connection pool retry (pg pool reconnect)
      ├── BullMQ jobs: paused during DB outage, resume after
      └── No data loss (synchronous replication)

  Impact: 30-60s pause. Automatic recovery. ✅
```

---

#### 7.6 Maliyet Analizi — Detaylı

**A) Component Bazlı Maliyet Tablosu**

| Component | GCP Fiyat | AWS Fiyat | Açıklama |
|-----------|-----------|-----------|----------|
| **VM1: API+Dashboard** (e2-small / t3.small, on-demand) | $13/mo | $15/mo | 2 vCPU, 2GB RAM, always-on |
| **VM2: Scraper Worker ×1** (e2-medium / t3.medium, Spot) | $8/mo | $9/mo | 2 vCPU, 4GB RAM, Spot ~70% discount |
| **VM3: Email+Notif+Redis** (e2-small / t3.small, on-demand) | $13/mo | $15/mo | 2 vCPU, 4GB RAM, always-on |
| **VM4: AI Worker ×1** (e2-small / t3.small, Spot) | $4/mo | $5/mo | 2 vCPU, 2GB RAM, Spot ~70% discount |
| **Managed DB** (Cloud SQL / RDS, db.t3.micro) | $9/mo | $12/mo | 1 vCPU, 1GB, auto-backup |
| **Read Replica** | $9/mo | $12/mo | Dashboard read offload |
| **Load Balancer** (GCP LB / AWS ALB) | $18/mo | $16/mo | HTTPS routing |
| **Disk** (30GB SSD per VM) | $5/mo | $5/mo | Persistent storage |

**B) 3 Senaryo — Aylık Toplam Maliyet**

```
SCENARIO COMPARISON (monthly cost, infrastructure only)

                        GCP          AWS
                     ─────────    ─────────
  MIN CONFIG
  (1 scraper + 1 AI worker)
  ┌─────────────────────────────────────────┐
  │ API VM (on-demand)     $13        $15   │
  │ Scraper VM ×1 (Spot)   $8         $9   │
  │ Email VM (on-demand)   $13        $15   │
  │ AI VM ×1 (Spot)        $4         $5   │
  │ Managed DB             $9        $12   │
  │ Read Replica           $9        $12   │
  │ Load Balancer         $18        $16   │
  │ Disk (4 VMs)           $5         $5   │
  │─────────────────────────────────────────│
  │ TOTAL                 $79        $89   │
  └─────────────────────────────────────────┘

  MID CONFIG
  (2 scraper + 2 AI workers)
  ┌─────────────────────────────────────────┐
  │ API VM (on-demand)     $13        $15   │
  │ Scraper VM ×2 (Spot)  $16        $18   │
  │ Email VM (on-demand)   $13        $15   │
  │ AI VM ×2 (Spot)        $8        $10   │
  │ Managed DB             $9        $12   │
  │ Read Replica           $9        $12   │
  │ Load Balancer         $18        $16   │
  │ Disk (6 VMs)           $8         $8   │
  │─────────────────────────────────────────│
  │ TOTAL                 $94       $106   │
  └─────────────────────────────────────────┘

  MAX CONFIG
  (3 scraper + 3 AI workers)
  ┌─────────────────────────────────────────┐
  │ API VM (on-demand)     $13        $15   │
  │ Scraper VM ×3 (Spot)  $24        $27   │
  │ Email VM (on-demand)   $13        $15   │
  │ AI VM ×3 (Spot)       $12        $15   │
  │ Managed DB             $9        $12   │
  │ Read Replica           $9        $12   │
  │ Load Balancer         $18        $16   │
  │ Disk (8 VMs)          $10        $10   │
  │─────────────────────────────────────────│
  │ TOTAL                $108       $122   │
  └─────────────────────────────────────────┘
```

**C) Tier Karşılaştırma — Maliyet Grafiği**

```
  Monthly Cost (USD)     GCP Pricing — Infrastructure Only
  ────────────────────────────────────────────────────────
  $120 │                                         ┌─────┐
       │                                         │ 108 │ Tier 7 MAX
  $110 │                                    ┌─────┤     │
       │                                    │     └─────┘
  $100 │                               ┌─────┐
       │                               │  94 │ Tier 7 MID
   $90 │                          ┌─────┤     │
       │                          │     └─────┘
   $80 │                     ┌─────┐
       │                     │  79 │ Tier 7 MIN
   $70 │                     │     │
       │                     └─────┘
   $60 │                ┌─────┐
       │                │  56 │ Tier 5 + Tier 6
   $50 │           ┌─────┤     │
       │           │  46 │     │     ┌──────────────────────────┐
   $40 │           │     └─────┘     │ █ Tier 5 alone  ($46-54) │
       │           └─────┘           │ █ Tier 5+6      ($48-56) │
   $30 │         Tier 5              │ █ Tier 7 min    ($79)    │
       │         alone               │ █ Tier 7 mid    ($94)    │
   $20 │                             │ █ Tier 7 max    ($108)   │
       │                             └──────────────────────────┘
   $10 │
       │
    $0 └──────────────────────────────────────────────────
         T5    T5+T6   T7min  T7mid  T7max
```

**D) OpenAI API Maliyet Tahmini**

```
  MODEL PRICING (as of 2026)
  ──────────────────────────────────────────────────────
  gpt-4o:       $2.50 / 1M input tokens,  $10 / 1M output tokens
  gpt-4o-mini:  $0.15 / 1M input tokens,  $0.60 / 1M output tokens

  REALTIME JOBS (gpt-4o) — user-facing
  ┌──────────────────────────────────────────────────────────┐
  │ Job Type            │ Avg Tokens    │ Cost/Job │ Jobs/mo │
  │─────────────────────│───────────────│──────────│─────────│
  │ app_analysis        │ 2K in + 1K out│  $0.015  │   ~200  │
  │ keyword_suggestions │ 1K in + 500out│  $0.007  │   ~500  │
  │ content_comparison  │ 3K in + 2K out│  $0.028  │   ~100  │
  │ category_overview   │ 2K in + 1K out│  $0.015  │    ~50  │
  │─────────────────────│───────────────│──────────│─────────│
  │ SUBTOTAL (realtime) │               │          │  ~$8/mo │
  └──────────────────────────────────────────────────────────┘

  DEFERRED JOBS (gpt-4o-mini) — batch, overnight
  ┌──────────────────────────────────────────────────────────┐
  │ Job Type            │ Avg Tokens    │ Cost/Job │ Jobs/mo │
  │─────────────────────│───────────────│──────────│─────────│
  │ bulk_app_scoring    │ 5K in + 1K out│  $0.001  │  ~1000  │
  │ trend_analysis      │ 3K in + 2K out│  $0.002  │    ~44  │
  │ content_best_of     │ 2K in + 1K out│  $0.001  │   ~100  │
  │─────────────────────│───────────────│──────────│─────────│
  │ SUBTOTAL (deferred) │               │          │  ~$2/mo │
  └──────────────────────────────────────────────────────────┘

  TOTAL OpenAI: ~$10/mo (başlangıç) → ~$30/mo (100+ aktif kullanıcı)
```

**E) Toplam Sahiplik Maliyeti (TCO)**

```
  TOTAL COST OF OWNERSHIP — GCP, monthly

  ┌──────────────────────────────────────────────────────────┐
  │                      Min        Mid        Max           │
  │ Infrastructure      $79        $94       $108           │
  │ OpenAI API          $10        $20        $30           │
  │ SMTP provider        $5         $5        $10           │
  │ Domain + SSL         $1         $1         $1           │
  │ Monitoring           $0         $0         $0 (free)    │
  │──────────────────────────────────────────────────────────│
  │ TOTAL               $95       $120       $149           │
  └──────────────────────────────────────────────────────────┘

  Kullanıcı başına maliyet:
  ┌──────────────────────────────────────────────────────────┐
  │ Users │ Config │ TCO/mo  │ Per User/mo │ Viable?        │
  │───────│────────│─────────│─────────────│────────────────│
  │    10 │ Min    │   $95   │   $9.50     │ ⚠️ Pahalı      │
  │    50 │ Min    │   $95   │   $1.90     │ ✅ Kabul edilir │
  │   100 │ Mid    │  $120   │   $1.20     │ ✅ İyi          │
  │   200 │ Mid    │  $120   │   $0.60     │ ✅ Çok iyi      │
  │   500 │ Max    │  $149   │   $0.30     │ ✅ Mükemmel     │
  │  1000 │ Max    │  $149   │   $0.15     │ ✅ Ölçekli      │
  └──────────────────────────────────────────────────────────┘
```

**F) Maliyet Ölçekleme Eğrisi**

```
  Monthly Cost ($)
       │
  $150 │                                              ●── Tier 7 Max ($149 TCO)
       │                                         ●
  $120 │                                    ●── Tier 7 Mid ($120 TCO)
       │                               ●
  $100 │                          ●── Tier 7 Min ($95 TCO, stable)
       │                     ●
   $80 │                ●
       │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Tier 5+6 ($48-56)
   $60 │
       │
   $40 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Tier 5 ($46-54)
       │
   $20 │
       │
    $0 └──┬──────┬──────┬──────┬──────┬──────┬──────┬──→ Users
          1     10     50    100    200    500   1000

  Break-even vs Tier 5+6: ~50 users (AI demand justifies dedicated VMs)
  Sweet spot: 100-500 users ($0.60-$0.30/user/mo)
```

**G) Tier 7 Light — Önerilen Başlangıç Konfigürasyonu ⭐**

Tier 7'nin tüm domain izolasyonunu koruyarak maliyeti yarıya indiren konfigürasyon. Load Balancer (Cloudflare zaten var) ve Read Replica (200 kullanıcıya kadar gereksiz) kaldırılır. Boot disk VM fiyatına dahil, ekstra persistent disk gerekmez.

```
TIER 7 LIGHT — $47/mo (GCP)
════════════════════════════════════════════════════════════════════

  ┌─────────────────────┐
  │     CLOUDFLARE      │  ← Mevcut, ücretsiz. LB yerine geçer.
  │  (DNS + CDN + SSL)  │     HTTPS termination + DDoS protection
  └──────────┬──────────┘
             │
  ═══════════╪══════════════════════════════════  VPC
             │
  ┌──────────┴──────────┐
  │ VM1: API+DASHBOARD  │  $13/mo
  │ (on-demand, 2GB)    │  e2-small / t3.small
  │ ┌────────┐┌────────┐│  Boot disk: 20GB (dahil)
  │ │  API   ││ Dash   ││
  │ │ 3001   ││ 3000   ││
  │ └────────┘└────────┘│
  └─────────────────────┘
             │
     ┌───────┼───────┐
     │       │       │
     ▼       ▼       ▼
  ┌───────┐┌───────┐┌────────────────────────┐
  │ VM2:  ││ VM3:  ││ VM4: AI WORKER         │
  │SCRAPER││EMAIL+ ││ (Spot, 2GB)            │
  │WORKER ││NOTIF+ ││                        │
  │(Spot) ││REDIS  ││ ┌──────────┐┌────────┐ │
  │       ││(on-dem││ │ai-realtime││ai-defer│ │
  │┌─────┐││and)   ││ │(1GB)     ││(512MB) │ │
  ││bg+  │││       ││ └──────────┘└────────┘ │
  ││sched│││┌─────┐││                        │
  ││(3GB)│││redis │││ $4/mo                  │
  │├─────┤│││1.5GB│││ e2-small Spot          │
  ││inter│││├─────┤││ Boot disk: 10GB (dahil)│
  ││actve│││email-│││                        │
  ││(1GB)│││inst. │││ Auto-scale: 1→3 VMs    │
  │└─────┘│││bulk  │││ Trigger: queue > 10   │
  │       │││notif │││                        │
  │$8/mo  │││(3GB) ││└────────────────────────┘
  │e2-med ││└─────┘││
  │ Spot  ││$13/mo ││
  └───────┘│e2-sml ││
           │on-dem ││
           └───────┘│
     │       │       │
     └───────┼───────┘
             │
      ┌──────┴──────┐
      │ MANAGED DB  │  $9/mo
      │ Cloud SQL   │  db-f1-micro / db.t3.micro
      │ (Primary)   │  Auto-backup + PITR dahil
      │             │  Read replica yok (sonra eklenir)
      └─────────────┘

  ┌─────────────────────────────────────────────────────┐
  │ COST BREAKDOWN                                      │
  │─────────────────────────────────────────────────────│
  │ VM1: API+Dashboard (on-demand)        $13/mo       │
  │ VM2: Scraper Worker (Spot)             $8/mo       │
  │ VM3: Email+Notif+Redis (on-demand)    $13/mo       │
  │ VM4: AI Worker (Spot)                  $4/mo       │
  │ Managed DB (backup dahil)              $9/mo       │
  │ Load Balancer                          $0 (CF)     │
  │ Ekstra disk                            $0 (boot)   │
  │ Read Replica                           $0 (sonra)  │
  │─────────────────────────────────────────────────────│
  │ INFRASTRUCTURE TOTAL                  $47/mo       │
  │ + OpenAI API                         ~$10/mo       │
  │ + SMTP provider                       ~$5/mo       │
  │─────────────────────────────────────────────────────│
  │ TCO (Total Cost of Ownership)        ~$62/mo       │
  └─────────────────────────────────────────────────────┘
```

**Tier 7 Light vs Full karşılaştırma:**

| | Tier 7 Light | Tier 7 Full |
|--|---|---|
| **Aylık infra** | $47 | $79-108 |
| **TCO (+ API + SMTP)** | ~$62 | ~$95-149 |
| **VM sayısı** | 4 | 4-8 |
| **Load Balancer** | Cloudflare (free) | ALB/GCP LB ($16-18) |
| **Read Replica** | Yok | Var |
| **AI auto-scale** | ✅ 1→3 | ✅ 1→3 |
| **Scraper auto-scale** | ❌ tek VM | ✅ 1→3 |
| **Domain izolasyonu** | ✅ Full | ✅ Full |
| **Max kullanıcı** | ~200 | 500+ |
| **Upgrade path** | + replica + LB + scraper scale | — |

**Tier 7 Light ne zaman yetersiz kalır?**

```
$47/mo ile başla → bu sinyalleri izle:
                                                        
Signal 1: DB read latency > 100ms consistently          
  → Read Replica ekle (+$9/mo = $56)                    
                                                        
Signal 2: Scraper queue depth > 20 regularly             
  → Scraper auto-scale ekle (Spot VM +$8/mo = $55-63)  
                                                        
Signal 3: 200+ concurrent users, API response > 500ms   
  → Load Balancer ekle ($16-18/mo → Full Tier 7)        
```

---

#### 7.7 Tier 5 vs Tier 6 vs Tier 7 — Ne Zaman Hangisi?

```
┌─────────────────────────────────────────────────────────────────────┐
│                     KARAR AĞACI                                     │
│                                                                     │
│  AI ve Email feature'ları aktif mi?                                 │
│      │                                                              │
│      ├── Hayır → Tier 5 yeterli (sadece scraper scaling)            │
│      │                                                              │
│      └── Evet → Kaç kullanıcı?                                     │
│              │                                                      │
│              ├── <50 kullanıcı → Tier 5 + Tier 6 (add-on)          │
│              │   Tek makine, email+AI container olarak              │
│              │   Maliyet: $48-56/mo                                 │
│              │                                                      │
│              └── 50+ kullanıcı → Tier 7                            │
│                  │                                                  │
│                  ├── 50-200 → Tier 7 Light ($47/mo) ⭐             │
│                  │   4 VM, Cloudflare LB, replica yok               │
│                  │   TCO: ~$62/mo                                   │
│                  │                                                  │
│                  ├── 200-500 → Tier 7 Full ($79-94/mo)              │
│                  │   + Read Replica + LB + Scraper scale            │
│                  │                                                  │
│                  └── 500+ → Tier 7 Max ($108-149/mo)                │
│                      3 scraper + 3 AI VM                            │
│                      (veya Kubernetes'e geçiş değerlendir)          │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 7.8 Migration Checklist

**Tier 7 (Tier 5 + Tier 6'dan yükseltme):**

Ön koşul: Tier 5 (auto-scaling scraper workers) + Tier 6 (email & AI queue'ları) zaten çalışıyor olmalı.

- [ ] **Network setup:**
  - [ ] VPC oluştur (veya mevcut VPC'yi kullan)
  - [ ] Subnet'leri ayır: public (API+LB), private (DB), worker (tüm worker'lar)
  - [ ] Security group'ları tanımla: API→Redis, Worker→Redis, Worker→DB, API→DB
- [ ] **Email+Notif+Redis VM (always-on):**
  - [ ] On-demand VM provision (e2-small / t3.small, 4GB RAM)
  - [ ] Docker + Docker Compose kurulumu
  - [ ] Redis container (1.5GB) — tüm queue'ların broker'ı
  - [ ] email-instant, email-bulk, notifications container'ları
  - [ ] Redis persistence: AOF enabled (appendonly yes)
  - [ ] Health check endpoint: Redis ping + SMTP connectivity
  - [ ] SMTP provider bağlantısı test (Nodemailer verify)
- [ ] **AI Worker VM (Spot):**
  - [ ] Spot VM template/image oluştur (e2-small / t3.small, 2GB RAM)
  - [ ] Docker + ai-realtime-worker + ai-deferred-worker container'ları
  - [ ] `OPENAI_API_KEY`, `REDIS_URL` (→ Email VM), `DATABASE_URL` (→ Managed DB) env vars
  - [ ] Health check: Redis connection + OpenAI API ping
- [ ] **Auto-scaling (AI):**
  - [ ] ASG/MIG oluştur: min=1, max=3
  - [ ] Custom metric: BullMQ `ai-realtime` queue depth → CloudWatch/Cloud Monitoring
  - [ ] Scale-up trigger: queue depth > 10, cooldown 120s
  - [ ] Scale-down trigger: queue depth < 3, cooldown 300s
- [ ] **Redis migration:**
  - [ ] Mevcut Scraper VM'deki Redis'ten Email VM'deki Redis'e migration
  - [ ] Tüm worker'ların `REDIS_URL`'ini güncelle (Email VM IP'sine yönlendir)
  - [ ] Verify: tüm queue'lar yeni Redis'e bağlı
- [ ] **DNS & routing:**
  - [ ] Load balancer → API VM routing
  - [ ] SSL certificate (ACM / Let's Encrypt)
  - [ ] DNS update: api.appranks.io → Load Balancer
- [ ] **Monitoring:**
  - [ ] Per-VM health check (CPU, RAM, disk)
  - [ ] Per-queue depth monitoring (7 queue)
  - [ ] Spot preemption alert (AI + Scraper VMs)
  - [ ] Email VM down → CRITICAL alert (PagerDuty/OpsGenie)
  - [ ] Cross-VM latency monitoring (Redis round-trip)
- [ ] **Test:**
  - [ ] Spot preemption simulation: AI VM terminate → job auto-retry verify
  - [ ] Email VM Redis restart → tüm worker'lar reconnect verify
  - [ ] Load test: 100 concurrent AI + 50 email + 11 platform scrape
  - [ ] Failover test: DB primary → replica switchover
  - [ ] Cost monitoring: 1 hafta çalıştır, gerçek maliyet vs tahmin karşılaştır

**When to use:** 50+ aktif kullanıcı, AI feature'lar yoğun kullanılıyor, $100+/mo bütçe

---

## 4. Tier Comparison

### At a Glance

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 (add-on) | Tier 7 Light ⭐ | Tier 7 Full |
|--|--------|--------|--------|--------|--------|-----------------|----------------|-------------|
| **What** | All on 1 VM | VM + Managed DB | API VM + Worker VM | API + Worker + DB | Auto-scale | + Email & AI Workers | 4 VM + DB (Cloudflare LB) | 4-8 VM + DB + LB |
| **Servers** | 1 | 1 + DB | 2 | 2 + DB | 2-3 + DB | Same + 4 containers | 4 + DB | 4-8 + DB + LB |

### Cost

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 (add-on) | Tier 7 Light ⭐ | Tier 7 Full |
|--|--------|--------|--------|--------|--------|-----------------|----------------|-------------|
| **GCP** | $17-22 | $17-23 | $15-21 | $22-30 | $46+ | +$0-2/mo | **$0 yr1★ / $47** | $79-108 |
| **AWS** | $14-20 | $14-18 yr1 | $16-21 | $14-18 yr1 | $45+ | +$0-2/mo | **$44 yr1 / $56** | $89-122 |
| **TCO (+ API/SMTP)** | — | — | — | — | — | — | **~$62 (yr2+)** | ~$95-149 |
| **2yr total** | — | — | — | — | — | — | **GCP $846 / AWS $1128** | — |
| **$20-25 startup?** | ✅ | ✅ | ✅ | ⚠️ AWS yr1 only | ❌ | ✅ (minimal overhead) | ❌ | ❌ |
| **$40-50 scale-up?** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **$100+/mo scale?** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Which Bottleneck Does Each Tier Solve?

| Bottleneck | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 (add-on) | Tier 7 Light ⭐ | Tier 7 Full |
|------------|--------|--------|--------|--------|--------|-----------------|----------------|-------------|
| #1 Single server failure | ⚠️ | ⚠️ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| #2 No DB backup | ❌ | ✅ | ❌ | ✅ | ✅ | — | ✅ | ✅ |
| #3 Shared DB pool | ❌ | ❌ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| #4 Playwright RAM | ❌ | ❌ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| #5 No disaster recovery | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | — | ✅ | ✅ |
| #6 Workers can't scale | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | — | ⚠️ AI only | ✅ |
| #7 Email/AI blocked by scrapers | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| #8 AI/Email can't scale independently | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ AI only | ✅ |
| **Bottlenecks solved** | **0/8** | **1/8** | **3/8** | **5/8** | **6/8** | **+1** | **7/8** | **8/8** |

### Operational Complexity

| | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Tier 5 | Tier 6 (add-on) | Tier 7 Light ⭐ | Tier 7 Full |
|--|--------|--------|--------|--------|--------|-----------------|----------------|-------------|
| **Setup time** | 1 hour | 2 hours | 2 hours | 3 hours | 1 day | +2 hours | 1-2 days | 2-3 days |
| **Code changes** | None | None | None | None | Minor | Moderate (queue setup) | Moderate (env config) | Moderate (env config) |
| **Deploy complexity** | Low | Low | Medium | Medium | High | +Low (containers) | Medium-High | High |
| **Monitoring needed** | Basic | Basic | Medium | Medium | Advanced | +4 health checks | Advanced + per-VM | Advanced + per-VM |
| **Best for** | MVP | Data safety | Performance | Production | Scale | Email/AI features | Domain isolation | Full isolation + scale |

### GCP vs AWS per Tier

| Tier | GCP Advantage | AWS Advantage | Recommendation |
|------|--------------|---------------|----------------|
| **Tier 1** | $300 free credit to start | Lightsail $20 flat, simple | **GCP** (free credit) |
| **Tier 2** | Simpler console | **RDS free 12 months** | **AWS** (free DB!) |
| **Tier 3** | Simpler setup | **Cheaper Spot + better recovery** | **AWS** |
| **Tier 4** | Simpler console | **RDS free yr1 = Tier 3 price** | **AWS** |
| **Tier 5** | Instance Group simpler | Spot Fleet more mature | Tie |
| **Tier 6** | N/A (add-on) | N/A (add-on) | Cloud-agnostic (containers) |
| **Tier 7 Light** | **$300 credit (6 mo free) + $47/mo long-term** | RDS free yr1 ($44/mo) | **GCP** ($300 credit + cheaper long-term) |
| **Tier 7 Full** | **$300 credit + $79-108/mo long-term** | Mature ASG + Spot Fleet | **GCP** (2yr TCO $282 cheaper) |

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
|  - Solves: scraper scaling                |
|                                           |
|  + Tier 6: Email & AI Workers (add-on)    |
|  - Same machine, dedicated containers     |
|  - Cost: +$0-2/mo                         |
|                                           |
+-------------------------------------------+
            |
            v
STAGE 5: SCALE + AI ($47-62/mo, 50+ users, AI features active)
+-------------------------------------------+
|                                           |
|  Tier 7 Light: Distributed Workers  ⭐    |
|  - 4 VM: API, Scraper, Email+Redis, AI   |
|  - Cloudflare as LB (free)               |
|  - No read replica (add later)           |
|  - Full domain isolation                 |
|  - Cost: $47/mo infra + ~$10 AI/SMTP    |
|  - TCO: ~$62/mo                          |
|                                           |
+-------------------------------------------+
            |
            v
STAGE 6: FULL SCALE ($100-150/mo, 200+ users, heavy AI)
+-------------------------------------------+
|                                           |
|  Tier 7 Full: + Replica + LB + Scale     |
|  - Read replica for dashboard queries    |
|  - ALB/GCP LB for HA                     |
|  - Scraper auto-scale 1→3               |
|  - AI auto-scale 1→3                    |
|  - Cost: $79-108/mo + ~$10-30 AI/SMTP   |
|  - Solves: everything at scale           |
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

**Tier 6 (Email & AI Workers — any Tier ile birlikte):**

Email worker'ları (email-instant, email-bulk, notifications) zaten mevcut. Aşağıdaki checklist AI worker'larının eklenmesini kapsar.

- [ ] **Queue setup:**
  - [ ] `queue.ts`'e `AI_REALTIME_QUEUE_NAME` ve `AI_DEFERRED_QUEUE_NAME` ekle
  - [ ] `AIJobData` interface tanımla (type, slug, keyword, platform, accountId, triggeredBy, requestId)
  - [ ] `getAIRealtimeQueue()` ve `getAIDeferredQueue()` singleton getter'ları
  - [ ] `enqueueAIJob()` helper (queue seçimi: realtime/deferred, priority, delay)
  - [ ] `closeAllQueues()`'a yeni queue'ları ekle
- [ ] **Worker entrypoint'ler:**
  - [ ] `ai-realtime-worker.ts` — concurrency: 2, rate limit: 30/min, timeout: 60s, model: gpt-4o
  - [ ] `ai-deferred-worker.ts` — concurrency: 1, rate limit: 10/min, timeout: 5min, model: gpt-4o-mini
  - [ ] `ai/process-ai-job.ts` — job type router (app_analysis, keyword_suggestions, bulk_scoring, vb.)
- [ ] **Docker:**
  - [ ] `Dockerfile.worker-ai` oluştur (Playwright yok, hafif Alpine image)
  - [ ] `docker-compose.prod.yml`'a `worker-ai-realtime` service ekle (1GB RAM limit)
  - [ ] `docker-compose.prod.yml`'a `worker-ai-deferred` service ekle (512MB RAM limit)
  - [ ] `OPENAI_API_KEY` env var zorunlu (`?` suffix)
- [ ] **API integration:**
  - [ ] AI route'larında `enqueueAIJob()` kullan (mevcut senkron `callAI()` yerine)
  - [ ] Scheduler'a AI deferred cron job'ları ekle (bulk_scoring, trend_analysis, cache_cleanup)
  - [ ] Scraper completion event'lerinde `enqueueAIJob(queue: "deferred")` tetikle
- [ ] **Monitoring:**
  - [ ] `GET /api/system-admin/queue-stats`'a `aiRealtime` ve `aiDeferred` ekle
  - [ ] Admin dashboard queue status cards'a 2 yeni kart
  - [ ] Alert threshold: ai-realtime waiting > 10, ai-deferred waiting > 50
- [ ] **DLQ & error handling:**
  - [ ] AI worker failed event → `dead_letter_jobs` INSERT
  - [ ] ai-realtime failure → DB cache status "failed" (dashboard retry butonu)
  - [ ] Sentry integration (her iki worker)
- [ ] **Test:**
  - [ ] Real-time AI isteği deferred batch sırasında gecikmiyor
  - [ ] Rate limit aşıldığında job graceful delay (BullMQ limiter)
  - [ ] Graceful shutdown: in-flight AI call tamamlanıyor

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
