resource "google_compute_instance" "email" {
  name         = "appranks-email"
  machine_type = "e2-custom-2-4096" # 2 vCPU, 4GB RAM
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

  metadata_startup_script = file("${path.module}/startup-scripts/email.sh")

  service_account {
    scopes = ["cloud-platform"]
  }
}
