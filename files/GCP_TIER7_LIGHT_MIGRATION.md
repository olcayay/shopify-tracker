# GCP Tier 7 Light — Migration & Infrastructure Guide

**Date:** 2026-04-05
**Target:** Hetzner VPS (single machine) → GCP (4 VM + Cloud SQL)
**Budget:** ~$47/mo infrastructure + ~$15/mo services = ~$62/mo TCO
**Ref:** [CLOUD_MIGRATION_ANALYSIS.md](./CLOUD_MIGRATION_ANALYSIS.md) — Tier 7 Light

---

## Table of Contents

1. [Mimari Özet](#1-mimari-özet)
2. [Mevcut vs Hedef Karşılaştırma](#2-mevcut-vs-hedef-karşılaştırma)
3. [GCP Kaynakları — Detaylı](#3-gcp-kaynakları--detaylı)
4. [Terraform ile Infrastructure as Code](#4-terraform-ile-infrastructure-as-code)
5. [Docker Compose — VM Başına](#5-docker-compose--vm-başına)
6. [Deploy Scripts](#6-deploy-scripts)
7. [Migration Planı — Adım Adım](#7-migration-planı--adım-adım)
8. [DNS & Cloudflare Konfigürasyonu](#8-dns--cloudflare-konfigürasyonu)
9. [Monitoring & Alerting](#9-monitoring--alerting)
10. [Backup & Disaster Recovery](#10-backup--disaster-recovery)
11. [CI/CD Pipeline Güncellemesi](#11-cicd-pipeline-güncellemesi)
12. [Operasyon Runbook](#12-operasyon-runbook)
13. [Maliyet Takibi](#13-maliyet-takibi)

---

## Task Tracker

| # | Phase | Task | Linear | Priority | Status |
|---|-------|------|--------|----------|--------|
| # | Phase | Task | Linear | Priority | Status |
|---|-------|------|--------|----------|--------|
| 1 | Phase 0: Hazırlık | GCP account setup & $300 free credit activation | [PLA-726](https://linear.app/plan-b-side-projects/issue/PLA-726) | Urgent | Todo |
| 2 | Phase 0: Hazırlık | Install Terraform & create infra/ directory structure | [PLA-727](https://linear.app/plan-b-side-projects/issue/PLA-727) | Urgent | **In Review** |
| 3 | Phase 1: Terraform | VPC, subnet, firewall rules & Cloud NAT | [PLA-728](https://linear.app/plan-b-side-projects/issue/PLA-728) | High | **In Review** |
| 4 | Phase 1: Terraform | Cloud SQL (PostgreSQL 16) with private IP | [PLA-729](https://linear.app/plan-b-side-projects/issue/PLA-729) | High | **In Review** |
| 5 | Phase 1: Terraform | 4 VM definitions (API, Scraper, Email, AI) | [PLA-730](https://linear.app/plan-b-side-projects/issue/PLA-730) | High | **In Review** |
| 6 | Phase 1: Terraform | Write startup scripts & Terraform provisioners | [PLA-731](https://linear.app/plan-b-side-projects/issue/PLA-731) | High | **In Review** |
| 7 | Phase 2: Config | Per-VM Docker Compose files & env templates | [PLA-732](https://linear.app/plan-b-side-projects/issue/PLA-732) | High | **In Review** |
| 8 | Phase 2: Config | Deploy scripts (deploy.sh, deploy-one.sh, ssh.sh) | [PLA-733](https://linear.app/plan-b-side-projects/issue/PLA-733) | High | **In Review** |
| 9 | Phase 2: Config | GitHub Actions — Docker image build & push to GHCR | [PLA-734](https://linear.app/plan-b-side-projects/issue/PLA-734) | High | **In Review** |
| 10 | Phase 3: Provision | Terraform apply — provision all GCP resources | [PLA-735](https://linear.app/plan-b-side-projects/issue/PLA-735) | High | Todo |
| 11 | Phase 3: Provision | First deploy — .env files & docker compose up | [PLA-736](https://linear.app/plan-b-side-projects/issue/PLA-736) | High | Todo |
| 12 | Phase 4: Migration | Database migration — Hetzner PostgreSQL → Cloud SQL | [PLA-737](https://linear.app/plan-b-side-projects/issue/PLA-737) | High | **In Review** |
| 13 | Phase 5: Cutover | DNS cutover — Cloudflare → GCP API VM | [PLA-738](https://linear.app/plan-b-side-projects/issue/PLA-738) | High | Todo |
| 14 | Phase 5: Cutover | Setup monitoring alerts & GCP billing budget | [PLA-739](https://linear.app/plan-b-side-projects/issue/PLA-739) | Medium | **In Review** |
| 15 | Phase 5: Cutover | Decommission Hetzner VPS (after 1 week stable) | [PLA-740](https://linear.app/plan-b-side-projects/issue/PLA-740) | Low | Todo |

**Progress: 10/15 (67%) — Code complete. Manual ops bekliyor: GCP account, terraform apply, DNS, decommission.**

```
Phase 0: Hazırlık      ░█ (PLA-726 todo, PLA-727 ✓)
Phase 1: Terraform      ████ (PLA-728..731 ✓)
Phase 2: Config         ███ (PLA-732..734 ✓)
Phase 3: Provision      ░░ (PLA-735, PLA-736 — GCP credentials gerekli)
Phase 4: Migration      █ (PLA-737 ✓ script yazıldı, manual çalıştırma gerekli)
Phase 5: Cutover        ░█░ (PLA-738 todo, PLA-739 ✓ script, PLA-740 todo)

░ = Todo  ▓ = In Progress  █ = In Review
```

---

## 1. Mimari Özet

```
                    ┌──────────────────────┐
                    │     CLOUDFLARE       │
                    │  DNS + CDN + SSL     │
                    │  appranks.io         │
                    │  api.appranks.io     │
                    └──────────┬───────────┘
                               │
═══════════════════════════════╪═══════════════════  GCP VPC (10.0.0.0/16)
                               │
                    ┌──────────┴───────────┐
                    │  VM1: API+DASHBOARD  │
                    │  e2-small (on-demand)│
                    │  2 vCPU, 2GB RAM     │
                    │  Region: europe-west1│
                    │                      │
                    │  ┌──────┐ ┌────────┐ │
                    │  │ API  │ │  Dash  │ │
                    │  │ :3001│ │  :3000 │ │
                    │  └──────┘ └────────┘ │
                    │  ┌────────────────┐  │
                    │  │ Caddy (reverse │  │
                    │  │ proxy) :80/443 │  │
                    │  └────────────────┘  │
                    │  ┌────────────────┐  │
                    │  │ Alloy (monitor)│  │
                    │  └────────────────┘  │
                    └──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
   ┌──────────┴─────┐ ┌───────┴────────┐ ┌─────┴──────────┐
   │ VM2: SCRAPER   │ │ VM3: EMAIL+    │ │ VM4: AI WORKER │
   │ e2-medium      │ │ REDIS          │ │ e2-small       │
   │ (Spot)         │ │ e2-small       │ │ (Spot)         │
   │ 2vCPU, 4GB     │ │ (on-demand)    │ │ 2vCPU, 2GB     │
   │                │ │ 2vCPU, 4GB     │ │                │
   │ ┌────────────┐ │ │                │ │ ┌────────────┐ │
   │ │ worker     │ │ │ ┌────────────┐ │ │ │ai-realtime │ │
   │ │ (bg+sched) │ │ │ │   Redis    │ │ │ │   (1GB)    │ │
   │ │   (3GB)    │ │ │ │   (1.5GB)  │ │ │ ├────────────┤ │
   │ ├────────────┤ │ │ ├────────────┤ │ │ │ai-deferred │ │
   │ │ worker-    │ │ │ │email-inst. │ │ │ │  (512MB)   │ │
   │ │ interactive│ │ │ │email-bulk  │ │ │ └────────────┘ │
   │ │   (1GB)    │ │ │ │notificatns │ │ │                │
   │ └────────────┘ │ │ │   (2GB)    │ │ │ ┌────────────┐ │
   │                │ │ └────────────┘ │ │ │   Alloy    │ │
   │ ┌────────────┐ │ │                │ │ └────────────┘ │
   │ │   Alloy    │ │ │ ┌────────────┐ │ └────────────────┘
   │ └────────────┘ │ │ │   Alloy    │ │
   └────────────────┘ │ └────────────┘ │
                      └────────────────┘
              │                │                │
              └────────────────┼────────────────┘
                               │
                    ┌──────────┴───────────┐
                    │   CLOUD SQL          │
                    │   PostgreSQL 16      │
                    │   db-f1-micro        │
                    │   Auto-backup + PITR │
                    │   Private IP only    │
                    └──────────────────────┘
```

**4 VM + 1 Managed DB:**

| VM | Role | Machine Type | Pricing | RAM | IP |
|----|------|-------------|---------|-----|-----|
| VM1 | API + Dashboard + Caddy | e2-small | On-demand | 2GB | Static external |
| VM2 | Scraper Workers | e2-medium | **Spot** | 4GB | Internal only |
| VM3 | Email + Notification + Redis | e2-small | On-demand | 4GB¹ | Internal only |
| VM4 | AI Workers | e2-small | **Spot** | 2GB | Internal only |
| — | Cloud SQL (PostgreSQL 16) | db-f1-micro | Managed | 614MB | Private IP |

¹ VM3 Redis için 4GB custom config: e2-custom-2-4096

---

## 2. Mevcut vs Hedef Karşılaştırma

```
MEVCUT (Hetzner + Coolify)              HEDEF (GCP Tier 7 Light)
══════════════════════════              ══════════════════════════

┌─ Tek Makine ─────────────┐            ┌─ VM1: API ──────────────┐
│ Coolify (Traefik proxy)  │            │ Caddy (reverse proxy)   │
│ PostgreSQL container     │ ──DB──→    │ API container           │
│ Redis container          │            │ Dashboard container     │
│ API container            │            │ Alloy (monitoring)      │
│ Dashboard container      │            └─────────────────────────┘
│ Worker (bg+sched+email)  │
│ Worker-interactive       │            ┌─ VM2: Scraper ──────────┐
│ Worker-email-instant     │ ─Scraper→  │ Worker (bg+scheduler)   │
│ Worker-email-bulk        │            │ Worker-interactive      │
│ Worker-notifications     │            │ Alloy                   │
│ Alloy (monitoring)       │            └─────────────────────────┘
└──────────────────────────┘
                                        ┌─ VM3: Email+Redis ──────┐
  Sorunlar:                   ─Email──→ │ Redis (broker for ALL)  │
  ✗ Single point of failure             │ Worker-email-instant    │
  ✗ DB backup yok                       │ Worker-email-bulk       │
  ✗ Playwright RAM spike                │ Worker-notifications    │
    tüm servisleri etkiler              │ Alloy                   │
  ✗ Spot pricing kullanılamaz           └─────────────────────────┘
  ✗ Email, scraper'a bağımlı
                                        ┌─ VM4: AI ──────────────┐
                              ──AI───→  │ AI-realtime worker     │
                                        │ AI-deferred worker     │
                                        │ Alloy                   │
                                        └─────────────────────────┘

                                        ┌─ Cloud SQL ─────────────┐
                              ──DB───→  │ PostgreSQL 16           │
                                        │ Auto-backup (7 gün)     │
                                        │ PITR (point-in-time)    │
                                        │ Private IP (VPC only)   │
                                        └─────────────────────────┘
```

---

## 3. GCP Kaynakları — Detaylı

### 3.1 VPC & Network

| Kaynak | Değer |
|--------|-------|
| VPC | `appranks-vpc` (custom mode) |
| Subnet | `appranks-subnet` 10.0.1.0/24, europe-west1 |
| Firewall: SSH | TCP 22, source: your IP only |
| Firewall: HTTP | TCP 80,443, source: 0.0.0.0/0 (VM1 only) |
| Firewall: Internal | All TCP, source: 10.0.1.0/24 (VM-to-VM) |
| Firewall: Redis | TCP 6379, source: 10.0.1.0/24 (internal only) |
| Cloud NAT | Worker VM'ler internet'e çıkabilsin (external IP yok) |

### 3.2 VM Specs

**VM1: API + Dashboard** (`appranks-api`)
- Machine: `e2-small` (2 vCPU, 2GB)
- Disk: 20GB pd-balanced (boot)
- IP: Static external IP (Cloudflare'a verilecek)
- OS: Ubuntu 24.04 LTS (Container-Optimized veya plain)
- Tags: `http-server`, `https-server`

**VM2: Scraper Worker** (`appranks-scraper`)
- Machine: `e2-medium` (2 vCPU, 4GB)
- Disk: 20GB pd-balanced (boot)
- IP: Internal only (Cloud NAT ile internet erişimi)
- OS: Ubuntu 24.04 LTS
- **Provisioning: Spot** (70% discount, preemptible)
- Tags: `worker`

**VM3: Email + Redis** (`appranks-email`)
- Machine: `e2-custom-2-4096` (2 vCPU, 4GB)
- Disk: 20GB pd-balanced (boot) — Redis AOF burada
- IP: Internal only
- OS: Ubuntu 24.04 LTS
- Tags: `redis-server`

**VM4: AI Worker** (`appranks-ai`)
- Machine: `e2-small` (2 vCPU, 2GB)
- Disk: 10GB pd-balanced (boot)
- IP: Internal only (Cloud NAT ile internet erişimi)
- OS: Ubuntu 24.04 LTS
- **Provisioning: Spot** (70% discount)
- Tags: `worker`

### 3.3 Cloud SQL

| Parametre | Değer |
|-----------|-------|
| Engine | PostgreSQL 16 |
| Tier | db-f1-micro (614MB RAM, shared vCPU) |
| Storage | 10GB SSD (auto-increase enabled) |
| Backup | Daily, 7-day retention, PITR enabled |
| Availability | Single zone (HA = +$9/mo, sonra eklenebilir) |
| Network | Private IP only (VPC peering) |
| Flags | `max_connections=100`, `statement_timeout=60000` |

### 3.4 Maliyet Dökümü

```
┌───────────────────────────────────────────────────────┐
│ GCP Tier 7 Light — Monthly Cost (europe-west1)        │
│───────────────────────────────────────────────────────│
│                                                       │
│ VM1: e2-small on-demand (730h)                        │
│   Compute: $12.23/mo                                  │
│   Disk: 20GB pd-balanced = $2.00/mo                   │
│   Static IP: $0 (attached to running VM)              │
│   Subtotal: $14.23                            ~$14    │
│                                                       │
│ VM2: e2-medium Spot (730h × 0.3)                      │
│   Compute: $7.39 × 0.3 = $6.72/mo (Spot)             │
│   Disk: 20GB pd-balanced = $2.00/mo                   │
│   Subtotal: $8.72                              ~$9    │
│                                                       │
│ VM3: e2-custom-2-4096 on-demand (730h)                │
│   Compute: $14.46/mo                                  │
│   Disk: 20GB pd-balanced = $2.00/mo                   │
│   Subtotal: $16.46                            ~$16    │
│                                                       │
│ VM4: e2-small Spot (730h × 0.3)                       │
│   Compute: $12.23 × 0.3 = $3.67/mo (Spot)            │
│   Disk: 10GB pd-balanced = $1.00/mo                   │
│   Subtotal: $4.67                              ~$5    │
│                                                       │
│ Cloud SQL: db-f1-micro                                │
│   Instance: $7.67/mo                                  │
│   Storage: 10GB SSD = $1.70/mo                        │
│   Backup: included                                    │
│   Subtotal: $9.37                              ~$9    │
│                                                       │
│ Cloud NAT: 2 VMs × ~$1/mo                     ~$2    │
│                                                       │
│───────────────────────────────────────────────────────│
│ INFRASTRUCTURE TOTAL                         ~$55    │
│                                                       │
│ $300 free credit → ilk ~5.5 ay ücretsiz ★            │
│───────────────────────────────────────────────────────│
│                                                       │
│ + OpenAI API                                 ~$10    │
│ + SMTP (Resend / Mailgun free tier)           ~$0    │
│ + Domain (appranks.io)                        ~$1    │
│                                                       │
│ TCO TOTAL                                   ~$66    │
└───────────────────────────────────────────────────────┘
```

---

## 4. Terraform ile Infrastructure as Code

### 4.1 Proje Yapısı

```
infra/
├── terraform/
│   ├── main.tf                # Provider, backend
│   ├── variables.tf           # Input variables
│   ├── outputs.tf             # VM IPs, DB connection string
│   ├── vpc.tf                 # VPC, subnet, firewall rules
│   ├── cloud-nat.tf           # NAT gateway for worker VMs
│   ├── cloud-sql.tf           # PostgreSQL instance
│   ├── vm-api.tf              # VM1: API + Dashboard
│   ├── vm-scraper.tf          # VM2: Scraper Worker (Spot)
│   ├── vm-email.tf            # VM3: Email + Redis
│   ├── vm-ai.tf               # VM4: AI Worker (Spot)
│   ├── startup-scripts/
│   │   ├── common.sh          # Docker CE kurulumu (tüm VM'ler)
│   │   ├── api.sh             # VM1: Caddy + API + Dashboard
│   │   ├── scraper.sh         # VM2: Scraper worker containers
│   │   ├── email.sh           # VM3: Redis + Email workers
│   │   └── ai.sh              # VM4: AI worker containers
│   ├── terraform.tfvars       # Actual values (gitignored)
│   └── terraform.tfvars.example
├── compose/
│   ├── docker-compose-api.yml       # VM1 compose
│   ├── docker-compose-scraper.yml   # VM2 compose
│   ├── docker-compose-email.yml     # VM3 compose
│   ├── docker-compose-ai.yml        # VM4 compose
│   ├── Caddyfile                    # VM1 reverse proxy config
│   ├── alloy.river                  # Monitoring config (all VMs)
│   └── env/
│       ├── .env.api.example         # VM1 env template
│       ├── .env.scraper.example     # VM2 env template
│       ├── .env.email.example       # VM3 env template
│       └── .env.ai.example          # VM4 env template
└── scripts/
    ├── bootstrap.sh           # İlk kurulum: terraform init + apply
    ├── deploy.sh              # Tüm VM'lere deploy (SSH + docker compose)
    ├── deploy-one.sh          # Tek VM'e deploy: ./deploy-one.sh api
    ├── ssh.sh                 # SSH shortcut: ./ssh.sh scraper
    └── destroy.sh             # Teardown (confirmation required)
```

### 4.2 Terraform — Temel Dosyalar

**`infra/terraform/main.tf`**

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # State backend — başlangıçta local, sonra GCS'e taşınabilir
  # backend "gcs" {
  #   bucket = "appranks-terraform-state"
  #   prefix = "tier7-light"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
```

**`infra/terraform/variables.tf`**

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "europe-west1-b"
}

variable "ssh_user" {
  description = "SSH username for VMs"
  type        = string
  default     = "deploy"
}

variable "ssh_pub_key_path" {
  description = "Path to SSH public key"
  type        = string
  default     = "~/.ssh/appranks-gcp.pub"
}

variable "allowed_ssh_ips" {
  description = "IPs allowed to SSH into VMs"
  type        = list(string)
}

variable "db_password" {
  description = "Cloud SQL postgres password"
  type        = string
  sensitive   = true
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}
```

**`infra/terraform/vpc.tf`**

```hcl
# ── VPC ──────────────────────────────────────────────────
resource "google_compute_network" "vpc" {
  name                    = "appranks-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "appranks-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true  # Cloud SQL private IP erişimi
}

# ── Firewall Rules ───────────────────────────────────────

# SSH — sadece belirtilen IP'lerden
resource "google_compute_firewall" "ssh" {
  name    = "appranks-allow-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.allowed_ssh_ips
  target_tags   = ["ssh"]
}

# HTTP/HTTPS — sadece API VM'e (Cloudflare IP ranges)
resource "google_compute_firewall" "http" {
  name    = "appranks-allow-http"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  # Cloudflare IP ranges — https://www.cloudflare.com/ips/
  source_ranges = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22",
    "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
    "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22",
    "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  ]

  target_tags = ["http-server"]
}

# Internal — VPC içi tüm trafik serbest
resource "google_compute_firewall" "internal" {
  name    = "appranks-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.1.0/24"]
}
```

**`infra/terraform/cloud-nat.tf`**

```hcl
# Worker VM'ler (external IP yok) internet'e çıkabilsin
resource "google_compute_router" "router" {
  name    = "appranks-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "appranks-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option            = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
```

**`infra/terraform/cloud-sql.tf`**

```hcl
# Private service connection (Cloud SQL ↔ VPC)
resource "google_compute_global_address" "private_ip" {
  name          = "appranks-db-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip.name]
}

# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "appranks-db"
  database_version = "POSTGRES_16"
  region           = var.region

  depends_on = [google_service_networking_connection.private_vpc]

  settings {
    tier              = var.db_tier  # db-f1-micro
    availability_type = "ZONAL"     # HA sonra eklenebilir

    ip_configuration {
      ipv4_enabled    = false       # Public IP yok
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # UTC
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    database_flags {
      name  = "statement_timeout"
      value = "60000"  # 60s
    }

    disk_autoresize = true
    disk_size       = 10  # GB, auto-increase
    disk_type       = "PD_SSD"
  }

  deletion_protection = true
}

resource "google_sql_database" "appranks" {
  name     = "appranks"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "postgres" {
  name     = "postgres"
  instance = google_sql_database_instance.main.name
  password = var.db_password
}
```

**`infra/terraform/vm-api.tf`**

```hcl
# Static external IP for API VM (Cloudflare DNS target)
resource "google_compute_address" "api_ip" {
  name   = "appranks-api-ip"
  region = var.region
}

resource "google_compute_instance" "api" {
  name         = "appranks-api"
  machine_type = "e2-small"
  zone         = var.zone
  tags         = ["http-server", "ssh"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    access_config {
      nat_ip = google_compute_address.api_ip.address
    }
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  service_account {
    scopes = ["cloud-platform"]
  }
}
```

**`infra/terraform/vm-scraper.tf`**

```hcl
resource "google_compute_instance" "scraper" {
  name         = "appranks-scraper"
  machine_type = "e2-medium"
  zone         = var.zone
  tags         = ["worker", "ssh"]

  scheduling {
    preemptible                 = true
    automatic_restart           = false
    provisioning_model          = "SPOT"
    instance_termination_action = "STOP"
  }

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    # External IP yok — Cloud NAT kullanır
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  # Spot preemption'da auto-restart script
  metadata_startup_script = <<-EOF
    #!/bin/bash
    cd /opt/appranks && docker compose up -d
  EOF

  service_account {
    scopes = ["cloud-platform"]
  }
}
```

**`infra/terraform/vm-email.tf`**

```hcl
resource "google_compute_instance" "email" {
  name         = "appranks-email"
  machine_type = "e2-custom-2-4096"  # 2 vCPU, 4GB RAM
  zone         = var.zone
  tags         = ["redis-server", "ssh"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 20
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    # External IP yok
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  service_account {
    scopes = ["cloud-platform"]
  }
}
```

**`infra/terraform/vm-ai.tf`**

```hcl
resource "google_compute_instance" "ai" {
  name         = "appranks-ai"
  machine_type = "e2-small"
  zone         = var.zone
  tags         = ["worker", "ssh"]

  scheduling {
    preemptible                 = true
    automatic_restart           = false
    provisioning_model          = "SPOT"
    instance_termination_action = "STOP"
  }

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = 10
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id
    # External IP yok — Cloud NAT kullanır
  }

  metadata = {
    ssh-keys = "${var.ssh_user}:${file(var.ssh_pub_key_path)}"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    cd /opt/appranks && docker compose up -d
  EOF

  service_account {
    scopes = ["cloud-platform"]
  }
}
```

**`infra/terraform/outputs.tf`**

```hcl
output "api_external_ip" {
  description = "API VM external IP (for Cloudflare DNS)"
  value       = google_compute_address.api_ip.address
}

output "scraper_internal_ip" {
  value = google_compute_instance.scraper.network_interface[0].network_ip
}

output "email_internal_ip" {
  description = "Email VM internal IP (Redis broker address)"
  value       = google_compute_instance.email.network_interface[0].network_ip
}

output "ai_internal_ip" {
  value = google_compute_instance.ai.network_interface[0].network_ip
}

output "db_private_ip" {
  description = "Cloud SQL private IP"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_url" {
  description = "Full DATABASE_URL for services"
  value       = "postgresql://postgres:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/appranks"
  sensitive   = true
}

output "redis_url" {
  description = "Redis URL (on Email VM)"
  value       = "redis://${google_compute_instance.email.network_interface[0].network_ip}:6379"
}

output "ssh_commands" {
  value = {
    api     = "ssh ${var.ssh_user}@${google_compute_address.api_ip.address}"
    scraper = "gcloud compute ssh ${var.ssh_user}@appranks-scraper --zone=${var.zone} --tunnel-through-iap"
    email   = "gcloud compute ssh ${var.ssh_user}@appranks-email --zone=${var.zone} --tunnel-through-iap"
    ai      = "gcloud compute ssh ${var.ssh_user}@appranks-ai --zone=${var.zone} --tunnel-through-iap"
  }
}
```

**`infra/terraform/terraform.tfvars.example`**

```hcl
project_id       = "appranks-prod"
region           = "europe-west1"
zone             = "europe-west1-b"
ssh_user         = "deploy"
ssh_pub_key_path = "~/.ssh/appranks-gcp.pub"
allowed_ssh_ips  = ["YOUR_HOME_IP/32"]
db_password      = "CHANGE_ME_STRONG_PASSWORD"
db_tier          = "db-f1-micro"
```

### 4.3 Startup Scripts

Her VM ilk boot'ta ve Spot preemption sonrası restart'ta bu script'leri çalıştırır. Docker kurulumu + compose pull + up otomatik gerçekleşir.

**`infra/terraform/startup-scripts/common.sh`** — Tüm VM'lerde çalışır

```bash
#!/bin/bash
set -euo pipefail

# Skip if Docker already installed
if command -v docker &> /dev/null; then
  echo "Docker already installed, starting services..."
  cd /opt/appranks && docker compose pull && docker compose up -d
  exit 0
fi

# Install Docker CE
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker log rotation
cat > /etc/docker/daemon.json <<'DAEMONJSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" }
}
DAEMONJSON

systemctl enable docker
systemctl restart docker

# Add deploy user to docker group
usermod -aG docker deploy || true

echo "Docker installed successfully"
```

**`infra/terraform/startup-scripts/api.sh`** — VM1: API + Dashboard

```bash
#!/bin/bash
set -euo pipefail

# Run common setup (Docker install or restart)
/opt/appranks/common.sh

# Install Caddy (if not present)
if ! command -v caddy &> /dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
    tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

# Copy Caddyfile and restart
cp /opt/appranks/Caddyfile /etc/caddy/Caddyfile
systemctl enable caddy
systemctl restart caddy

# Start containers
cd /opt/appranks
docker compose pull
docker compose up -d
```

**`infra/terraform/startup-scripts/scraper.sh`** — VM2: Scraper

```bash
#!/bin/bash
set -euo pipefail
/opt/appranks/common.sh
cd /opt/appranks && docker compose pull && docker compose up -d
```

**`infra/terraform/startup-scripts/email.sh`** — VM3: Email + Redis

```bash
#!/bin/bash
set -euo pipefail
/opt/appranks/common.sh
cd /opt/appranks && docker compose pull && docker compose up -d

# Redis health check — diğer VM'ler buna bağımlı
for i in {1..30}; do
  if docker exec $(docker ps -qf "name=redis") redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "Redis is ready"
    exit 0
  fi
  sleep 2
done
echo "WARNING: Redis not ready after 60s"
```

**`infra/terraform/startup-scripts/ai.sh`** — VM4: AI Worker

```bash
#!/bin/bash
set -euo pipefail
/opt/appranks/common.sh
cd /opt/appranks && docker compose pull && docker compose up -d
```

### 4.4 VM Tanımlarında Startup Script Kullanımı

Terraform VM tanımlarındaki `metadata_startup_script` yerine dosya tabanlı yaklaşım. Her VM'e `/opt/appranks/` dizini Terraform `provisioner` ile kopyalanır:

**VM'lere dosya kopyalama — `infra/terraform/vm-api.tf`'e eklenen provisioner:**

```hcl
resource "google_compute_instance" "api" {
  # ... (mevcut config aynen kalır)

  # İlk boot'ta çalışacak startup script
  metadata_startup_script = file("${path.module}/startup-scripts/api.sh")

  # İlk kurulumda dosyaları kopyala
  provisioner "file" {
    source      = "${path.module}/startup-scripts/common.sh"
    destination = "/opt/appranks/common.sh"

    connection {
      type        = "ssh"
      user        = var.ssh_user
      private_key = file(var.ssh_private_key_path)
      host        = self.network_interface[0].access_config[0].nat_ip
    }
  }

  provisioner "file" {
    source      = "${path.module}/../compose/docker-compose-api.yml"
    destination = "/opt/appranks/docker-compose.yml"

    connection {
      type        = "ssh"
      user        = var.ssh_user
      private_key = file(var.ssh_private_key_path)
      host        = self.network_interface[0].access_config[0].nat_ip
    }
  }

  provisioner "file" {
    source      = "${path.module}/../compose/Caddyfile"
    destination = "/opt/appranks/Caddyfile"

    connection {
      type        = "ssh"
      user        = var.ssh_user
      private_key = file(var.ssh_private_key_path)
      host        = self.network_interface[0].access_config[0].nat_ip
    }
  }
}
```

> **Not:** Terraform provisioner sadece ilk `terraform apply`'da çalışır. Sonraki deploy'lar için `scripts/deploy.sh` kullanılır (bkz. Section 6).

---

## 5. Docker Compose — VM Başına

### 5.1 VM1: API + Dashboard

**`infra/compose/docker-compose-api.yml`**

```yaml
services:
  migrate:
    image: ghcr.io/olcayay/appranks-api:latest
    restart: "no"
    command: ["node", "packages/db/dist/migrate.js"]
    env_file: .env

  api:
    image: ghcr.io/olcayay/appranks-api:latest
    restart: always
    ports:
      - "127.0.0.1:3001:3001"
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 1G
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    depends_on:
      migrate:
        condition: service_completed_successfully

  dashboard:
    image: ghcr.io/olcayay/appranks-dashboard:latest
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: {{ next_public_api_url }}
      NODE_ENV: production
    deploy:
      resources:
        limits:
          memory: 512M
    depends_on:
      - api

  alloy:
    image: grafana/alloy:v1.5.1
    restart: always
    volumes:
      - ./alloy.river:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: [run, /etc/alloy/config.alloy, --stability.level=generally-available]
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 256M
```

### 6.2 VM2: Scraper Worker

**`infra/compose/docker-compose-scraper.yml`**

```yaml
services:
  worker:
    image: ghcr.io/olcayay/appranks-worker:latest
    restart: always
    stop_grace_period: 120s
    environment:
      WORKER_MODE: background
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 3G

  worker-interactive:
    image: ghcr.io/olcayay/appranks-worker-interactive:latest
    restart: always
    stop_grace_period: 120s
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 1G

  alloy:
    image: grafana/alloy:v1.5.1
    restart: always
    volumes:
      - ./alloy.river:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: [run, /etc/alloy/config.alloy, --stability.level=generally-available]
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 256M
```

### 6.3 VM3: Email + Notification + Redis

**`infra/compose/docker-compose-email.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --maxmemory 1gb --maxmemory-policy volatile-lru --bind 0.0.0.0 --protected-mode no
    volumes:
      - redis_data:/data
    ports:
      - "0.0.0.0:6379:6379"  # VPC internal — firewall ile korunuyor
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 1536M

  worker-email-instant:
    image: ghcr.io/olcayay/appranks-worker-email:latest
    restart: always
    stop_grace_period: 30s
    environment:
      WORKER_MODE: email-instant
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 512M
    depends_on:
      redis:
        condition: service_healthy

  worker-email-bulk:
    image: ghcr.io/olcayay/appranks-worker-email:latest
    restart: always
    stop_grace_period: 120s
    environment:
      WORKER_MODE: email-bulk
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 1G
    depends_on:
      redis:
        condition: service_healthy

  worker-notifications:
    image: ghcr.io/olcayay/appranks-worker-email:latest
    restart: always
    stop_grace_period: 30s
    environment:
      WORKER_MODE: notifications
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 512M
    depends_on:
      redis:
        condition: service_healthy

  alloy:
    image: grafana/alloy:v1.5.1
    restart: always
    volumes:
      - ./alloy.river:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: [run, /etc/alloy/config.alloy, --stability.level=generally-available]
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 256M

volumes:
  redis_data:
```

### 6.4 VM4: AI Worker

**`infra/compose/docker-compose-ai.yml`**

```yaml
services:
  ai-realtime:
    image: ghcr.io/olcayay/appranks-worker-ai:latest
    restart: always
    stop_grace_period: 30s
    environment:
      WORKER_MODE: ai-realtime
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 1G

  ai-deferred:
    image: ghcr.io/olcayay/appranks-worker-ai:latest
    restart: always
    stop_grace_period: 120s
    environment:
      WORKER_MODE: ai-deferred
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 512M

  alloy:
    image: grafana/alloy:v1.5.1
    restart: always
    volumes:
      - ./alloy.river:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: [run, /etc/alloy/config.alloy, --stability.level=generally-available]
    env_file: .env
    deploy:
      resources:
        limits:
          memory: 256M
```

---

## 6. Deploy Scripts

Terraform ilk kurulumu yapar, sonraki deploy'lar bu script'ler ile yapılır. Ansible yerine basit SSH + SCP.

**`infra/scripts/deploy.sh`** — Tüm VM'lere deploy

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_DIR="$INFRA_DIR/compose"
SSH_KEY="$HOME/.ssh/appranks-gcp"
SSH_USER="deploy"

# Terraform output'larından IP'leri al
cd "$INFRA_DIR/terraform"
API_IP=$(terraform output -raw api_external_ip)
EMAIL_IP=$(terraform output -raw email_internal_ip)
DB_IP=$(terraform output -raw db_private_ip)

echo "=== Deploy to all VMs ==="

# VM1: API
echo "→ Deploying API+Dashboard..."
scp -i "$SSH_KEY" "$COMPOSE_DIR/docker-compose-api.yml" "$SSH_USER@$API_IP:/opt/appranks/docker-compose.yml"
scp -i "$SSH_KEY" "$COMPOSE_DIR/Caddyfile" "$SSH_USER@$API_IP:/opt/appranks/Caddyfile"
scp -i "$SSH_KEY" "$COMPOSE_DIR/alloy.river" "$SSH_USER@$API_IP:/opt/appranks/alloy.river"
scp -i "$SSH_KEY" "$COMPOSE_DIR/env/.env.api" "$SSH_USER@$API_IP:/opt/appranks/.env"
ssh -i "$SSH_KEY" "$SSH_USER@$API_IP" "cd /opt/appranks && docker compose pull && docker compose up -d"

# VM2: Scraper (IAP tunnel)
echo "→ Deploying Scraper..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-scraper.yml" appranks-scraper:/opt/appranks/docker-compose.yml --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/env/.env.scraper" appranks-scraper:/opt/appranks/.env --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/alloy.river" appranks-scraper:/opt/appranks/alloy.river --zone=europe-west1-b
gcloud compute ssh appranks-scraper --zone=europe-west1-b --command="cd /opt/appranks && docker compose pull && docker compose up -d"

# VM3: Email
echo "→ Deploying Email+Redis..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-email.yml" appranks-email:/opt/appranks/docker-compose.yml --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/env/.env.email" appranks-email:/opt/appranks/.env --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/alloy.river" appranks-email:/opt/appranks/alloy.river --zone=europe-west1-b
gcloud compute ssh appranks-email --zone=europe-west1-b --command="cd /opt/appranks && docker compose pull && docker compose up -d"

# VM4: AI
echo "→ Deploying AI Worker..."
gcloud compute scp "$COMPOSE_DIR/docker-compose-ai.yml" appranks-ai:/opt/appranks/docker-compose.yml --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/env/.env.ai" appranks-ai:/opt/appranks/.env --zone=europe-west1-b
gcloud compute scp "$COMPOSE_DIR/alloy.river" appranks-ai:/opt/appranks/alloy.river --zone=europe-west1-b
gcloud compute ssh appranks-ai --zone=europe-west1-b --command="cd /opt/appranks && docker compose pull && docker compose up -d"

echo "=== Deploy complete ==="

# Health check
sleep 10
echo "→ Health check..."
curl -sf "https://api.appranks.io/health/live" && echo " API OK" || echo " API FAIL"
```

**`infra/scripts/deploy-one.sh`** — Tek VM'e deploy

```bash
#!/bin/bash
set -euo pipefail

VM_NAME="${1:?Usage: ./deploy-one.sh <api|scraper|email|ai>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$(dirname "$SCRIPT_DIR")/compose"

case "$VM_NAME" in
  api)
    API_IP=$(cd "$(dirname "$SCRIPT_DIR")/terraform" && terraform output -raw api_external_ip)
    scp -i ~/.ssh/appranks-gcp "compose/docker-compose-api.yml" "deploy@$API_IP:/opt/appranks/docker-compose.yml"
    scp -i ~/.ssh/appranks-gcp "$COMPOSE_DIR/env/.env.api" "deploy@$API_IP:/opt/appranks/.env"
    ssh -i ~/.ssh/appranks-gcp "deploy@$API_IP" "cd /opt/appranks && docker compose pull && docker compose up -d"
    ;;
  scraper|email|ai)
    gcloud compute scp "$COMPOSE_DIR/docker-compose-${VM_NAME}.yml" "appranks-${VM_NAME}:/opt/appranks/docker-compose.yml" --zone=europe-west1-b
    gcloud compute scp "$COMPOSE_DIR/env/.env.${VM_NAME}" "appranks-${VM_NAME}:/opt/appranks/.env" --zone=europe-west1-b
    gcloud compute ssh "appranks-${VM_NAME}" --zone=europe-west1-b --command="cd /opt/appranks && docker compose pull && docker compose up -d"
    ;;
  *)
    echo "Unknown VM: $VM_NAME. Use: api, scraper, email, ai"
    exit 1
    ;;
esac

echo "✓ Deployed to $VM_NAME"
```

**`infra/scripts/ssh.sh`** — SSH shortcut

```bash
#!/bin/bash
VM_NAME="${1:?Usage: ./ssh.sh <api|scraper|email|ai>}"

case "$VM_NAME" in
  api)
    API_IP=$(cd "$(dirname "$0")/../terraform" && terraform output -raw api_external_ip)
    ssh -i ~/.ssh/appranks-gcp "deploy@$API_IP"
    ;;
  scraper|email|ai)
    gcloud compute ssh "deploy@appranks-${VM_NAME}" --zone=europe-west1-b --tunnel-through-iap
    ;;
  *)
    echo "Unknown VM: $VM_NAME. Use: api, scraper, email, ai"
    exit 1
    ;;
esac
```

---

## 7. Migration Planı — Adım Adım

```
MIGRATION TIMELINE

Week 1: Hazırlık                    Week 2: GCP Kurulum
─────────────────                   ──────────────────
Day 1-2: Container registry         Day 5: Terraform apply
Day 3-4: CI/CD pipeline             Day 6: Deploy scripts + verify
         Docker image build          Day 7: Data migration

Week 3: Cutover                     Week 4: Monitoring
─────────────────                   ──────────────────
Day 8:  DNS switch                  Day 10-14: Observe
Day 9:  Verify all services                    Tune
        Hetzner'ı keep (fallback)              Optimize
Day 14: Hetzner kapatma kararı
```

### Phase 0: Ön Hazırlık (Hetzner'da)

```bash
# 0.1 — GCP account + billing setup
# https://console.cloud.google.com
# $300 free credit activate

# 0.2 — gcloud CLI kurulumu (local)
brew install google-cloud-sdk
gcloud auth login
gcloud config set project appranks-prod

# 0.3 — GCP API'leri etkinleştir
gcloud services enable compute.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable servicenetworking.googleapis.com
gcloud services enable containerregistry.googleapis.com

# 0.4 — SSH key oluştur
ssh-keygen -t ed25519 -f ~/.ssh/appranks-gcp -C "deploy@appranks"

# 0.5 — Terraform kurulumu
brew install terraform
```

### Phase 1: Container Registry & CI/CD

Mevcut sistem Coolify ile image build ediyor. GCP'de **Artifact Registry** veya **GitHub Container Registry (GHCR)** kullanacağız.

```bash
# GHCR tercih ediyoruz — GitHub Actions ile entegre, ücretsiz (public repo)
# veya private repo için 500MB free storage

# GitHub Actions'a Docker build + push ekle
# .github/workflows/ci.yml'a "docker-push" job eklenecek
```

### Phase 2: Terraform Apply

```bash
cd infra/terraform

# 2.1 — terraform.tfvars'ı doldur
cp terraform.tfvars.example terraform.tfvars
# Edit: project_id, db_password, allowed_ssh_ips, etc.

# 2.2 — Init + Plan
terraform init
terraform plan -out=tfplan

# 2.3 — Review plan, then apply
terraform apply tfplan

# 2.4 — Outputs'u kaydet
terraform output -json > ../terraform-outputs.json
terraform output api_external_ip    # → Cloudflare'a girilecek
terraform output database_url       # → .env dosyalarına
terraform output redis_url           # → .env dosyalarına
```

### Phase 3: İlk Deploy

```bash
# 3.1 — .env dosyalarını oluştur (Terraform output'larından)
cd infra/compose/env
cp .env.api.example .env.api
cp .env.scraper.example .env.scraper
cp .env.email.example .env.email
cp .env.ai.example .env.ai
# Her .env dosyasını Terraform output'larıyla doldur:
#   DATABASE_URL, REDIS_URL, secrets, vs.

# 3.2 — Tüm VM'lere deploy
cd infra/scripts
chmod +x deploy.sh deploy-one.sh ssh.sh
./deploy.sh

# 3.3 — Verify
./ssh.sh api       # docker ps
./ssh.sh scraper   # docker ps
./ssh.sh email     # docker ps — Redis çalışıyor mu?
./ssh.sh ai        # docker ps
```

### Phase 4: Data Migration

```bash
# 4.1 — Hetzner'dan DB dump
ssh root@5.78.101.102
docker exec -t <postgres-container> pg_dump -U postgres -d postgres --no-owner --no-acl > /tmp/appranks-dump.sql

# 4.2 — Dump'ı local'e çek
scp root@5.78.101.102:/tmp/appranks-dump.sql ./

# 4.3 — Cloud SQL'e import
# Option A: Cloud SQL proxy üzerinden
cloud-sql-proxy appranks-prod:europe-west1:appranks-db &
psql "postgresql://postgres:PASSWORD@127.0.0.1:5432/appranks" < appranks-dump.sql

# Option B: GCS bucket üzerinden
gsutil cp appranks-dump.sql gs://appranks-backups/migration/
gcloud sql import sql appranks-db gs://appranks-backups/migration/appranks-dump.sql \
  --database=appranks --user=postgres
```

### Phase 5: DNS Cutover

```
# 5.1 — Cloudflare'da DNS güncelle
#   api.appranks.io  → A record → <terraform output api_external_ip>
#   appranks.io      → A record → <terraform output api_external_ip>
#   TTL: 1 dakika (geçiş sırasında)

# 5.2 — Verify
curl https://api.appranks.io/health
curl https://appranks.io

# 5.3 — Tüm servisleri kontrol et
# - Dashboard login
# - Scraper queue çalışıyor mu (admin panel)
# - Email gönderimi (forgot password test)
# - AI analiz (dashboard'dan tetikle)

# 5.4 — 3 gün sorunsuz çalışırsa TTL'i 1 saate yükselt
# 5.5 — 1 hafta sonra Hetzner'ı kapat
```

---

## 8. DNS & Cloudflare Konfigürasyonu

```
Cloudflare Dashboard → appranks.io → DNS

Type    Name              Content                  Proxy    TTL
────    ────              ───────                  ─────    ───
A       appranks.io       <api_external_ip>        Proxied  Auto
A       api.appranks.io   <api_external_ip>        Proxied  Auto
```

**Caddy (VM1'de) — Reverse Proxy:**

**`infra/compose/Caddyfile`**

```
appranks.io {
    reverse_proxy localhost:3000
}

api.appranks.io {
    reverse_proxy localhost:3001
}
```

> Not: Cloudflare proxied mode'da SSL termination Cloudflare'da yapılır. Caddy'de HTTPS gerekli değil — Cloudflare → Caddy arası HTTP (Full Strict istersen Caddy auto-HTTPS açılır).

**Cloudflare SSL/TLS:** Full (strict) — Caddy auto-TLS ile uyumlu.

---

## 9. Monitoring & Alerting

Mevcut Grafana Alloy + Loki + Prometheus stack'i korunuyor. Her VM'de bir Alloy instance çalışıyor.

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ VM1 Alloy│  │ VM2 Alloy│  │ VM3 Alloy│  │ VM4 Alloy│
│ API logs │  │ Scraper  │  │ Email+   │  │ AI worker│
│ + metrics│  │ logs     │  │ Redis    │  │ logs     │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │             │             │             │
     └─────────────┴─────────────┴─────────────┘
                         │
              ┌──────────┴──────────┐
              │   Grafana Cloud     │
              │  ┌──────┐ ┌──────┐  │
              │  │ Loki │ │Prom. │  │
              │  │(logs)│ │(metr)│  │
              │  └──────┘ └──────┘  │
              │                     │
              │  Alerting Rules:    │
              │  • VM down > 2min   │
              │  • Queue depth > 20 │
              │  • Error rate > 5%  │
              │  • Redis down       │
              │  • DB conn. errors  │
              └─────────────────────┘
```

**Alert'ler (Grafana Cloud'da tanımlanacak):**

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| API down | health check fail > 2min | Critical | Email + Slack |
| Email VM down | no logs > 3min | Critical | Email |
| Scraper VM preempted | no logs > 5min | Warning | Slack |
| AI VM preempted | no logs > 5min | Warning | Slack |
| Queue backlog | any queue waiting > 50 | Warning | Slack |
| DB connection errors | > 5 errors/min | Critical | Email |
| Redis unreachable | ping fail > 1min | Critical | Email |

---

## 10. Backup & Disaster Recovery

```
BACKUP STRATEGY

┌─ Cloud SQL (automatic) ──────────────────────┐
│ Daily backup: 03:00 UTC                      │
│ Retention: 7 days                            │
│ PITR: enabled (transaction log backup)       │
│ Recovery: GCP Console → Restore to point     │
│ RPO: seconds (PITR) / 24h (daily backup)    │
│ RTO: ~10 minutes                             │
└──────────────────────────────────────────────┘

┌─ Redis (VM3 disk) ───────────────────────────┐
│ AOF: appendonly yes (every write persisted)   │
│ VM disk snapshot: weekly (Terraform'da)       │
│ Recovery: VM restart → Redis AOF replay       │
│ RPO: 0 (AOF) / 7 days (snapshot)            │
│ RTO: 2-5 minutes (VM restart)                │
└──────────────────────────────────────────────┘

┌─ Application (Git) ──────────────────────────┐
│ Tüm kod + config Git'te                      │
│ Docker images: GHCR'da tagged                 │
│ Infra: Terraform state (local → GCS bucket)  │
│ Secrets: .env files (gitignored, backed up)   │
│ Recovery: terraform apply + ./deploy.sh       │
│ RTO: ~30 minutes (full rebuild from scratch)  │
└──────────────────────────────────────────────┘
```

**Disaster Scenarios:**

| Senaryo | Etki | Recovery |
|---------|------|----------|
| VM1 (API) crash | Dashboard + API down | Auto-restart. ~2 min. |
| VM2 (Scraper) preempted | Scraper jobs pause | Spot VM auto-recreate. ~5 min. |
| VM3 (Email) crash | Email + Redis down | Auto-restart + Redis AOF. ~3 min. |
| VM4 (AI) preempted | AI jobs pause | Spot VM auto-recreate. ~5 min. |
| Cloud SQL failure | All DB ops fail | Auto-failover (if HA). Manual restore: ~10 min. |
| Full region outage | Everything down | Terraform apply in new region. ~1 hour. |

---

## 11. CI/CD Pipeline Güncellemesi

Mevcut GitHub Actions workflow'u güncellenmeli: Coolify webhook → Multi-VM SSH deploy.

```yaml
# .github/workflows/deploy.yml (yeni)
name: Deploy to GCP

on:
  push:
    branches: [main]

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push API
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.api
          push: true
          tags: ghcr.io/olcayay/appranks-api:latest,ghcr.io/olcayay/appranks-api:${{ github.sha }}

      - name: Build and push Dashboard
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.dashboard
          push: true
          tags: ghcr.io/olcayay/appranks-dashboard:latest
          build-args: |
            NEXT_PUBLIC_API_URL=https://api.appranks.io
            NEXT_PUBLIC_GA_ID=${{ secrets.GA_ID }}
            NEXT_PUBLIC_CLARITY_ID=${{ secrets.CLARITY_ID }}

      - name: Build and push Worker
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.worker
          push: true
          tags: ghcr.io/olcayay/appranks-worker:latest

      - name: Build and push Worker-Interactive
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.worker-interactive
          push: true
          tags: ghcr.io/olcayay/appranks-worker-interactive:latest

      - name: Build and push Worker-Email
        uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.worker-email
          push: true
          tags: ghcr.io/olcayay/appranks-worker-email:latest

      # AI worker image — Tier 6 aktif olduğunda eklenir
      # - name: Build and push Worker-AI
      #   uses: docker/build-push-action@v5
      #   with:
      #     context: .
      #     file: Dockerfile.worker-ai
      #     push: true
      #     tags: ghcr.io/olcayay/appranks-worker-ai:latest

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH & gcloud
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.GCP_SSH_PRIVATE_KEY }}" > ~/.ssh/appranks-gcp
          chmod 600 ~/.ssh/appranks-gcp

      - name: Setup gcloud CLI
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to all VMs
        run: |
          # VM1: API (direct SSH)
          ssh -i ~/.ssh/appranks-gcp -o StrictHostKeyChecking=no \
            deploy@${{ secrets.API_VM_IP }} \
            "cd /opt/appranks && docker compose pull && docker compose up -d"

          # VM2-4: Workers (IAP tunnel)
          for vm in appranks-scraper appranks-email appranks-ai; do
            gcloud compute ssh "deploy@$vm" --zone=europe-west1-b \
              --command="cd /opt/appranks && docker compose pull && docker compose up -d"
          done

      - name: Health check
        run: |
          for i in 1 2 3; do
            if curl -sf https://api.appranks.io/health/live; then
              echo "Health check passed"
              exit 0
            fi
            sleep 15
          done
          echo "Health check failed"
          exit 1
```

---

## 12. Operasyon Runbook

### SSH Erişimi

```bash
# VM1 (API) — external IP var, doğrudan SSH
ssh deploy@<api_external_ip>

# VM2/3/4 — internal IP, IAP tunnel
gcloud compute ssh deploy@appranks-scraper --zone=europe-west1-b --tunnel-through-iap
gcloud compute ssh deploy@appranks-email --zone=europe-west1-b --tunnel-through-iap
gcloud compute ssh deploy@appranks-ai --zone=europe-west1-b --tunnel-through-iap
```

### Yaygın Operasyonlar

```bash
# ── Tüm container'ları göster (herhangi bir VM'de) ──
docker ps

# ── Log takibi ──
docker logs -f --tail 100 <container-name>

# ── Restart (tek servis) ──
cd /opt/appranks && docker compose restart api

# ── Full redeploy (tek VM) ──
cd /opt/appranks && docker compose pull && docker compose up -d

# ── Redis CLI (VM3'te) ──
docker exec -it appranks-redis-1 redis-cli
> INFO memory
> LLEN bull:scraper-jobs-background:wait
> KEYS bull:*

# ── Cloud SQL bağlantı (local'den) ──
cloud-sql-proxy appranks-prod:europe-west1:appranks-db &
psql "postgresql://postgres:PASSWORD@127.0.0.1:5432/appranks"

# ── Spot VM preempted mi kontrol ──
gcloud compute instances describe appranks-scraper --zone=europe-west1-b --format='value(status)'
# RUNNING | TERMINATED | STAGING

# ── Spot VM restart (preemption sonrası) ──
gcloud compute instances start appranks-scraper --zone=europe-west1-b
gcloud compute instances start appranks-ai --zone=europe-west1-b

# ── Terraform — mevcut state'i göster ──
cd infra/terraform && terraform show

# ── Tek VM'e deploy ──
cd infra/scripts
./deploy-one.sh api       # sadece API VM
./deploy-one.sh scraper   # sadece Scraper VM
./deploy-one.sh email     # sadece Email VM
./deploy-one.sh ai        # sadece AI VM
```

### Spot VM Auto-Restart

GCP Spot VM'ler terminate edildiğinde otomatik restart yapmaz. Bunun için bir **instance schedule** veya **startup script** + **monitoring** gerekir.

Basit çözüm — Cloud Scheduler + Cloud Functions:

```
Her 5 dakikada bir:
  1. Check: appranks-scraper status == TERMINATED?
     → Yes: gcloud compute instances start appranks-scraper
  2. Check: appranks-ai status == TERMINATED?
     → Yes: gcloud compute instances start appranks-ai
```

Veya Grafana alert → webhook → Cloud Function → restart.

---

## 13. Maliyet Takibi

```bash
# GCP billing dashboard
# https://console.cloud.google.com/billing

# CLI ile maliyet kontrolü
gcloud billing accounts list
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="AppRanks Monthly" \
  --budget-amount=60USD \
  --threshold-rules=percent=80 \
  --threshold-rules=percent=100

# Budget alert: $48 (80%) ve $60 (100%) aşıldığında email
```

**Aylık maliyet beklentisi:**

```
Month 1-5: $0 ($300 credit)
Month 6+:  ~$55/mo (infrastructure)
           ~$10-15/mo (OpenAI + SMTP)
           ─────────
           ~$65-70/mo total
```

---

*Bu doküman GCP Tier 7 Light mimarisinin referans implementasyonudur. `files/CLOUD_MIGRATION_ANALYSIS.md` ile birlikte okunmalıdır.*
