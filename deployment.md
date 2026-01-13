# Deployment Guide (Full AWS EC2)

This document outlines the steps to deploy **both** the Frontend (Next.js) and the Real-time Server (Socket.IO) on a single AWS EC2 instance.

---

## 1. Environment Variables

Create a [`.env.local`](file:///c:/Users/ajays/OneDrive/Desktop/BubbleChat/.env.local) file in the root directory (`/var/www/bubblechat/.env.local`):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SOCKET_URL=

# Storage S3 Credentials (S3-compatible API)
SUPABASE_STORAGE_ENDPOINT=
SUPABASE_STORAGE_REGION=
SUPABASE_STORAGE_ACCESS_KEY_ID=
SUPABASE_STORAGE_SECRET_ACCESS_KEY=
SUPABASE_STORAGE_BUCKET=
```

---

## 2. Low Memory Troubleshooting (IMPORTANT)

If your EC2 instance (e.g., `t2.micro`) has low RAM (1GB), `npm run build` will likely hang or fail. **Run these commands to add 8GB of Swap Space:**

```bash
# Disable existing swap (if any)
sudo swapoff -a

# Create a 8GB swap file
sudo fallocate -l 8G /swapfile

# Set correct permissions
sudo chmod 600 /swapfile

# Set up the swap area
sudo mkswap /swapfile

# Enable the swap file
sudo swapon /swapfile

# Make the change permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify memory
free -h
```

---

## 3. Project Setup & Build

Run these commands on your EC2 instance:

```bash
# Navigate to your deployment directory
cd /var/www/bubblechat

# Change ownership to avoid sudo for every command
sudo chown -R $USER:$USER /var/www/bubblechat

# Install dependencies
npm install

# Build the Next.js application
npm run build

# Create dedicated env for the socket server (Port 3006 to avoid conflicts)
echo "PORT=3006" > server/.env
```

---

## 4. Process Management (PM2)

Start both using **unique ports** to avoid conflicts with other apps (like Oryzene):

```bash
# Start Next.js Frontend on Port 3005
pm2 start npm --name "bubble-frontend" -- start -- -p 3005

# Start Socket.io Backend on Port 3006
pm2 start server/server.js --name "bubble-socket"

# Save PM2 state
pm2 save
```

---

## 5. Nginx Configuration

Edit: `/etc/nginx/sites-available/bobblechat.skyber.dev`

```nginx
server {
    server_name bobblechat.skyber.dev;

    # Socket.IO Routing (Port 3006)
    location /socket.io/ {
        proxy_pass http://localhost:3006;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Next.js Frontend Routing (Port 3005)
    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ... SSL configuration (Certbot will add this automatically)
}
```

---

## Architecture Summary (Multi-App Setup)

| Component | Port | Internal | External |
| :--- | :--- | :--- | :--- |
| **Frontend (Next.js)** | 3005 | `localhost:3005` | `https://bobblechat.skyber.dev` |
| **Backend (Socket.IO)** | 3006 | `localhost:3006` | `https://bobblechat.skyber.dev/socket.io/` |
| **Database/Auth** | N/A | Supabase Cloud | Managed |
