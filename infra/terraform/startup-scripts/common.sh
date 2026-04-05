#!/bin/bash
set -euo pipefail

# Skip if Docker already installed — just restart services
if command -v docker &> /dev/null; then
  echo "Docker already installed, starting services..."
  if [ -f /opt/appranks/docker-compose.yml ]; then
    cd /opt/appranks && docker compose pull && docker compose up -d
  fi
  exit 0
fi

# Install Docker CE
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
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

# Create app directory
mkdir -p /opt/appranks

echo "Docker installed successfully"
