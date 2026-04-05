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

  metadata_startup_script = file("${path.module}/startup-scripts/ai.sh")

  service_account {
    scopes = ["cloud-platform"]
  }
}
