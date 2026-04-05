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

  private_ip_google_access = true # Cloud SQL private IP erişimi
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
