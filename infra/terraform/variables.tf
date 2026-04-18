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

variable "ssh_private_key_path" {
  description = "Path to SSH private key (for provisioners)"
  type        = string
  default     = "~/.ssh/appranks-gcp"
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

variable "db_replica_tier" {
  description = "Cloud SQL read replica machine tier"
  type        = string
  default     = "db-f1-micro"
}
