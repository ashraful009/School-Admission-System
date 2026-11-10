#!/bin/sh
# 40-runtime-config.sh
# Writes /usr/share/nginx/html/config.js from env var API_URL.
# Runs at container start via nginx's /docker-entrypoint.d/ mechanism.
# No image rebuild is needed to change the backend URL (requirement T4).

set -e

API_URL="${API_URL:-http://localhost:8080}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = { API_URL: "${API_URL}" };
EOF

echo "Runtime config written: API_URL=${API_URL}"

