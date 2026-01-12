# Deployment Guide

This document outlines the steps to deploy BubbleChat. The recommended architecture is to host the **Frontend (Next.js)** on Vercel and the **Real-time Server (Socket.IO)** on AWS EC2.

---

## Option 1: Vercel (Frontend & Server Actions)

### 1. Environment Variables
Add the following to your Vercel Project Settings:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for server actions).
- `NEXT_PUBLIC_SOCKET_URL`: `https://bobblechat.skyber.dev` (The URL of your EC2 server).

### 2. Deploy
- Connect your GitHub repository to Vercel.
- Vercel will automatically detect Next.js and deploy.

---

## Option 2: AWS EC2 (Real-time Socket.IO Server)

### Prerequisites
- Nginx installed.
- PM2 installed (`npm install -g pm2`).
- Domain `bobblechat.skyber.dev` pointing to your EC2 IP.

### 1. Project Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd BubbleChat

# Install dependencies
pnpm install # or npm install

# Create environment file for server
touch server/.env
```
Add `PORT=3001` to `server/.env`.

### 2. Run with PM2
```bash
pm2 start server/server.js --name "bubble-socket"
pm2 save
pm2 startup
```

### 3. Nginx Configuration
Create a configuration file: `/etc/nginx/sites-available/bobblechat.skyber.dev`

```nginx
server {
    server_name bobblechat.skyber.dev;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/bobblechat.skyber.dev /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. SSL (Certbot)
```bash
sudo certbot --nginx -d bobblechat.skyber.dev
```

---

## Architecture Summary
| Component | Provider | URL |
| :--- | :--- | :--- |
| **App / Frontend** | Vercel | `your-app.vercel.app` (or custom domain) |
| **Real-time Engine** | AWS EC2 (PM2/Nginx) | `bobblechat.skyber.dev` |
| **Database/Auth/Storage**| Supabase | Supabase Cloud |
