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
  description = "SSH commands for each VM"
  value = {
    api     = "ssh ${var.ssh_user}@${google_compute_address.api_ip.address}"
    scraper = "gcloud compute ssh ${var.ssh_user}@appranks-scraper --zone=${var.zone} --tunnel-through-iap"
    email   = "gcloud compute ssh ${var.ssh_user}@appranks-email --zone=${var.zone} --tunnel-through-iap"
    ai      = "gcloud compute ssh ${var.ssh_user}@appranks-ai --zone=${var.zone} --tunnel-through-iap"
  }
}
