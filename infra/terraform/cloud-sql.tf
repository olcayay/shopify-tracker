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
    tier              = var.db_tier # db-f1-micro
    availability_type = "ZONAL"    # HA sonra eklenebilir

    ip_configuration {
      ipv4_enabled    = false # Public IP yok
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00" # UTC
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 7
      }
    }

    disk_autoresize = true
    disk_size       = 10 # GB, auto-increase
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
