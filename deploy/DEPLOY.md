# Deploying ConvoAI to your DigitalOcean droplet

Assumes an Ubuntu droplet (22.04/24.04 — DigitalOcean's default), a domain
already pointed at the droplet's IP (an A record), and your own GitHub
repo for this project. Replace `YOUR_DOMAIN` and `YOUR_DROPLET_IP` below
with your actual values.

**This guide is written for running as `root`** (DigitalOcean's default
droplet login), matching a confirmed working setup — paths below are
`/root/convoai`. If you're on a non-root user instead, swap `/root/convoai`
for `/home/your-username/convoai` throughout, and `root` for your actual
username in the systemd service's `User=`/`Group=` lines.

---

## 1. One-time server setup

SSH into the droplet and run:

```bash
sudo apt update && sudo apt upgrade -y

# Python 3.12
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt update
sudo apt install -y python3.12 python3.12-venv

# Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt install -y nodejs

# Nginx, git, certbot
sudo apt install -y nginx git certbot python3-certbot-nginx
```

**Firewall:**
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 2. Push your code to your own GitHub repo

From your project root (where `backend/` and `frontend/` live), if you
haven't already:
```bash
git init                      # if this isn't already a git repo
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:YOUR_GITHUB_REPO.git
git branch -M main
git push -u origin main
```

---

## 3. Give the droplet read access to your repo

If the repo is public, skip to step 4 — `git clone` with the HTTPS URL
just works.

If it's private, generate a **deploy key** (an SSH key scoped to just this
one repo, read-only — safer than using your personal GitHub key):

```bash
ssh-keygen -t ed25519 -C "convoai-deploy" -f ~/.ssh/convoai_deploy -N ""
cat ~/.ssh/convoai_deploy.pub
```
Copy that output. On GitHub: **your repo → Settings → Deploy keys → Add
deploy key**, paste it in, leave "Allow write access" unchecked.

Then tell SSH to use that key for GitHub:
```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
    IdentityFile ~/.ssh/convoai_deploy
    IdentitiesOnly yes
EOF
```

---

## 4. Clone the repo onto the server

Since this is a public repo, no deploy key or auth needed — just clone
straight into your home directory. No `sudo`, no `chown` — it's already
yours:

```bash
git clone https://github.com/djjune1193-oss/convoai.git /root/convoai
```
(Replace `your-username` with your actual username if not on root — or
just run `git clone https://github.com/djjune1193-oss/convoai.git ~/convoai`,
which does the same thing.)

---

## 5. Add your real API keys (one-time, manual)

```bash
cd /root/convoai/backend
cp .env.example .env
nano .env
```
Fill in:
```
DATABASE_URL=sqlite:///./chatapp.db
GEMINI_API_KEY=your_real_key
GEMINI_MODEL=gemini-3.5-flash-lite
TAVILY_API_KEY=your_real_key
AI_CONTEXT_MESSAGE_LIMIT=20
ALLOWED_ORIGINS=https://YOUR_DOMAIN
```
Save and exit (Ctrl+O, Enter, Ctrl+X in nano).

This `.env` is gitignored — it stays untouched by future `git pull`s. You
only do this once (or again if a key changes).

---

## 6. First deploy

```bash
cd /root/convoai
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```
This creates the Python venv, installs backend deps, builds the frontend.
It'll also try `sudo systemctl restart convoai-backend` at the end, which
will fail right now since the service doesn't exist yet — that's expected,
continue to step 7.

---

## 7. Install the systemd service

```bash
sudo cp /root/convoai/deploy/convoai-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now convoai-backend
sudo systemctl status convoai-backend    # should show "active (running)"
```

---

## 8. Install the Nginx config

```bash
sudo cp /root/convoai/deploy/nginx-convoai.conf /etc/nginx/sites-available/convoai
sudo nano /etc/nginx/sites-available/convoai   # replace YOUR_DOMAIN with your real domain
sudo ln -s /etc/nginx/sites-available/convoai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default     # remove the default placeholder site
sudo nginx -t                                    # should say "syntax is ok"
sudo systemctl reload nginx
```

At this point `http://YOUR_DOMAIN` should load the app over plain HTTP.

---

## 9. Enable HTTPS

**This isn't optional** — the 📍 nearby-places feature needs browser
geolocation, which browsers block entirely on non-HTTPS pages (except
`localhost`). Same for secure WebSockets once you're off plain HTTP.

```bash
sudo certbot --nginx -d YOUR_DOMAIN
```

Certbot edits the Nginx config automatically to add the HTTPS server block
and an HTTP→HTTPS redirect. Follow its prompts.

Verify: `https://YOUR_DOMAIN` should load with a valid certificate, and
`http://YOUR_DOMAIN` should redirect to it.

---

## 10. Every deploy after this

Locally:
```bash
git add .
git commit -m "whatever changed"
git push origin main
```

Then either SSH in and run the script:
```bash
ssh root@YOUR_DROPLET_IP
cd /root/convoai && ./deploy/deploy.sh
```
or do it as a single line from your own machine without a separate login
step:
```bash
ssh root@YOUR_DROPLET_IP 'cd /root/convoai && ./deploy/deploy.sh'
```

**Optional convenience:** **If you're on root (this guide's default), skip this** — root already has
full access and `sudo` doesn't prompt for a password anyway, so there's
nothing to work around. This only matters if you're on a non-root user:
`deploy.sh` calls `sudo systemctl restart convoai-backend`, which would
otherwise prompt for a password on every deploy unless you allow that one
specific command without one:
```bash
echo "your-username ALL=(root) NOPASSWD: /bin/systemctl restart convoai-backend" | sudo tee /etc/sudoers.d/convoai-deploy
```
That's the only command it'd be allowed to run passwordlessly — not
blanket sudo access.

Watch a deploy happen live if you want:
```bash
sudo journalctl -u convoai-backend -f
```

**Further automation (not set up here):** if typing that SSH command
after every push gets old, a GitHub Actions workflow that SSHes in and
runs `deploy.sh` automatically on push is a natural next step — it needs
your droplet's SSH key added as a GitHub Actions secret. Ask if you want
that built.

---

## Troubleshooting

- **`git clone` / `git pull` fails with "Permission denied (publickey)"**
  — the deploy key isn't set up right. Re-check step 3: the public key is
  added to the repo's Deploy keys, and `~/.ssh/config` points GitHub at
  the private key.
- **Backend won't start** — `sudo journalctl -u convoai-backend -n 50` for
  the actual Python traceback. Common cause: `.env` missing a required key,
  or the venv wasn't created (check `/root/convoai/backend/venv` exists).
- **502 Bad Gateway** — Nginx is up but can't reach the backend. Check
  `sudo systemctl status convoai-backend`; if it's not running, see above.
- **CORS errors in browser console** — `ALLOWED_ORIGINS` in `.env` doesn't
  match the domain you're actually visiting (check `https://` vs `http://`
  and any `www.` prefix — these must match exactly). Restart the backend
  after changing it.
- **Geolocation ("Use my location") silently fails** — you're not on
  HTTPS yet. See step 9.
- **WebSocket won't connect (chat doesn't update live)** — check the
  browser console for the actual WS URL it tried. It should be
  `wss://YOUR_DOMAIN/ws/...`. If it's `ws://` (not `wss://`) on an HTTPS
  page, that's a mixed-content block — confirms HTTPS isn't fully set up.
- **Photo uploads 404** — confirm `/root/convoai/backend/uploads/`
  exists and is writable by whatever user the `convoai-backend` service
  runs as (it's created automatically on backend startup, so this usually
  means the service crashed before creating it — check the logs).
- **`./deploy/deploy.sh: Permission denied`** — `chmod +x deploy/deploy.sh`
  (git doesn't always preserve the executable bit across platforms).
- **Nginx serves a 403 error for the frontend (but the API works fine)**
  — since the app now lives in your home directory instead of `/var/www`,
  Nginx (running as `www-data`) may not have permission to traverse into
  it, depending on your server's default permissions. Fix:
  ```bash
  chmod o+x /root
  chmod -R o+rX /root/convoai/frontend/dist
  ```

## What's still manual / not automated here

- Database is still SQLite — fine at low traffic, but has no concurrent-
  write scaling. Swap `DATABASE_URL` for a managed Postgres instance
  (DigitalOcean Managed Databases works well) when you outgrow it — the
  SQLAlchemy models don't change either way.
- No automated backups of `chatapp.db` or `uploads/`. Both live outside
  git (by design — they're runtime data, not code) but that means nothing
  currently copies them anywhere. A simple cron + `rsync` to another
  droplet or DO Spaces is the minimum you'd want before this holds data
  you can't afford to lose.
- No staging environment — every push to `main` goes straight to
  production once you run `deploy.sh`. Fine solo; worth a `staging`
  branch + second droplet later.
- Deploy is a manual trigger (you run `deploy.sh` after pushing), not
  automatic on push. See the GitHub Actions note in step 10 if you want
  that.
