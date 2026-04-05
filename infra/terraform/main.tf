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
