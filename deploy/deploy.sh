#!/bin/bash
# Run this on the server after pushing new code to GitHub:
#   ssh root@YOUR_DROPLET_IP 'cd /root/convoai && ./deploy/deploy.sh'
# or SSH in first and run it locally on the server — either way, same effect.

set -e

TARGET="/root/convoai"
cd "$TARGET"

echo "→ Pulling latest from GitHub..."
git pull origin main

echo "→ Backend: installing dependencies..."
cd "$TARGET/backend"
python3.12 -m venv venv 2>/dev/null || true
venv/bin/pip install -q -r requirements.txt

if [ ! -f .env ]; then
    echo "⚠  No backend/.env found — copying .env.example."
    echo "⚠  Edit backend/.env with real API keys before the app will work."
    cp .env.example .env
fi

echo "→ Frontend: installing dependencies and building..."
cd "$TARGET/frontend"
npm install --silent
npm run build --silent

echo "→ Restarting backend service..."
sudo systemctl restart convoai-backend

echo "✓ Deploy complete."
