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

  metadata_startup_script = file("${path.module}/startup-scripts/api.sh")

  service_account {
    scopes = ["cloud-platform"]
  }
}
