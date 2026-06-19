# Deployment Guide

This guide covers deploying `do-knowledge-studio` to various environments.

## Overview

`do-knowledge-studio` is a client-side application that can be deployed to:
- Static hosting (Netlify, Vercel, GitHub Pages, etc.)
- Self-hosted servers (Nginx, Apache, Caddy)
- CDN (Cloudflare, AWS CloudFront)

The application uses:
- SQLite WASM (in-browser, no backend needed)
- OPFS (Origin Private File System) for data persistence
- Static assets (no server-side processing)

## Build Process

### Production Build

```bash
pnpm run build
```

This creates an optimized production build in the `dist/` directory.

### Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   ├── sqlite3.wasm
│   ├── sqlite3-worker1-bundler-friendly.js
│   └── [other assets]
└── [other files]
```

## Deployment Options

### Option 1: Static Hosting (Recommended)

#### Netlify

1. **Via Git**:
   - Connect your repository
   - Build command: `pnpm run build`
   - Publish directory: `dist`
   - Node version: 22

2. **Via Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   pnpm run build
   netlify deploy --prod --dir=dist
   ```

3. **Configuration** (`netlify.toml`):
   ```toml
   [build]
     command = "pnpm run build"
     publish = "dist"

   [[headers]]
     for = "/*.wasm"
     [headers.values]
       Content-Type = "application/wasm"
   ```

#### Vercel

1. **Via Git**:
   - Import your repository
   - Framework preset: Vite
   - Build command: `pnpm run build`
   - Output directory: `dist`

2. **Via Vercel CLI**:
   ```bash
   npm install -g vercel
   pnpm run build
   vercel --prod
   ```

#### GitHub Pages

1. **Add to `package.json`**:
   ```json
   {
     "homepage": "https://[username].github.io/do-knowledge-studio"
   }
   ```

2. **Build and deploy**:
   ```bash
   pnpm run build
   pnpm run deploy
   ```

3. **GitHub Actions** (`.github/workflows/deploy.yml`):
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: 22
         - run: pnpm install
         - run: pnpm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

### Option 2: Self-Hosted

#### Nginx

1. **Build the application**:
   ```bash
   pnpm run build
   ```

2. **Copy to server**:
   ```bash
   scp -r dist/* user@server:/var/www/dks/
   ```

3. **Nginx configuration** (`/etc/nginx/sites-available/dks`):
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     root /var/www/dks;
     index index.html;

     # Security headers
     add_header X-Frame-Options "SAMEORIGIN" always;
     add_header X-Content-Type-Options "nosniff" always;
     add_header Referrer-Policy "no-referrer-when-downgrade" always;
     add_header Content-Security-Policy "default-src 'self' 'wasm-unsafe-eval'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;" always;

     # WASM MIME type
     types {
       application/wasm wasm;
     }

     # SPA routing
     location / {
       try_files $uri $uri/ /index.html;
     }

     # Cache static assets
     location /assets/ {
       expires 1y;
       add_header Cache-Control "public, immutable";
     }

     # No cache for index.html
     location = /index.html {
       add_header Cache-Control "no-cache, no-store, must-revalidate";
     }

     # Gzip compression
     gzip on;
     gzip_types text/css application/javascript application/wasm application/json;
     gzip_min_length 1000;
   }
   ```

4. **Enable and reload**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/dks /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### Apache

1. **Build the application**:
   ```bash
   pnpm run build
   ```

2. **Copy to server**:
   ```bash
   scp -r dist/* user@server:/var/www/dks/
   ```

3. **Apache configuration** (`/etc/apache2/sites-available/dks.conf`):
   ```apache
   <VirtualHost *:80>
     ServerName your-domain.com
     DocumentRoot /var/www/dks

     <Directory /var/www/dks>
       Options -Indexes +FollowSymLinks
       AllowOverride All
       Require all granted
     </Directory>

     # Security headers
     Header set X-Content-Type-Options "nosniff"
     Header set X-Frame-Options "SAMEORIGIN"
     Header set Referrer-Policy "no-referrer-when-downgrade"

     # WASM MIME type
     AddType application/wasm .wasm

     # SPA routing
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]

     # Compression
     <IfModule mod_deflate.c>
       AddOutputFilterByType DEFLATE text/css application/javascript application/wasm application/json
     </IfModule>
   </VirtualHost>
   ```

4. **Enable and reload**:
   ```bash
   sudo a2ensite dks
   sudo systemctl reload apache2
   ```

#### Caddy

1. **Caddyfile**:
   ```
   your-domain.com {
     root * /var/www/dks
     encode gzip

     # Security headers
     header {
       X-Content-Type-Options "nosniff"
       X-Frame-Options "SAMEORIGIN"
       Referrer-Policy "no-referrer-when-downgrade"
       Content-Security-Policy "default-src 'self' 'wasm-unsafe-eval'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
     }

     # SPA routing
     try_files {path} /index.html

     # Cache static assets
     @assets path /assets/*
     header @assets Cache-Control "public, immutable, max-age=31536000"
   }
   ```

2. **Reload Caddy**:
   ```bash
   sudo systemctl reload caddy
   ```

### Option 3: Docker

1. **Create `Dockerfile`**:
   ```dockerfile
   FROM node:22-alpine AS builder
   WORKDIR /app
   COPY package.json pnpm-lock.yaml ./
   RUN corepack enable && pnpm install --frozen-lockfile
   COPY . .
   RUN pnpm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create `nginx.conf`**:
   ```nginx
   server {
     listen 80;
     root /usr/share/nginx/html;
     index index.html;

     types {
       application/wasm wasm;
     }

     location / {
       try_files $uri $uri/ /index.html;
     }

     location /assets/ {
       expires 1y;
       add_header Cache-Control "public, immutable";
     }
   }
   ```

3. **Build and run**:
   ```bash
   docker build -t do-knowledge-studio .
   docker run -p 8080:80 do-knowledge-studio
   ```

## HTTPS Configuration

### Let's Encrypt (Certbot)

```bash
# Nginx
sudo certbot --nginx -d your-domain.com

# Apache
sudo certbot --apache -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

### Cloudflare
1. Add your domain to Cloudflare
2. Update nameservers
3. Enable "Full" or "Full (Strict)" SSL mode
4. Configure page rules for caching

## Environment-Specific Configuration

### Development
- Use `pnpm run dev` for local development
- Vite dev server with hot reload
- Source maps enabled

### Staging
- Deploy to staging environment
- Use staging API keys
- Enable error tracking (Sentry, etc.)
- Disable analytics

### Production
- Use production API keys
- Enable analytics (optional, privacy-respecting)
- Enable error tracking
- Configure CDN caching
- Set up monitoring

## Performance Optimization

### Build Optimization
- Code splitting by route
- Lazy loading of heavy components
- Tree shaking for unused code
- Asset compression (gzip/brotli)
- Image optimization

### Runtime Optimization
- Service worker for offline support
- Browser caching headers
- CDN for static assets
- OPFS for local data persistence
- IndexedDB fallback for older browsers

### Monitoring
- Core Web Vitals tracking
- Error rate monitoring
- API latency tracking
- User interaction analytics

## Security Considerations

### Required Headers
```
Content-Security-Policy: default-src 'self' 'wasm-unsafe-eval'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: no-referrer-when-downgrade
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### CORS Configuration
The application doesn't need CORS for most operations. If using external APIs:
```
Access-Control-Allow-Origin: https://your-domain.com
```

### Rate Limiting
Configure rate limiting at the reverse proxy level:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
location /api/ {
  limit_req zone=api burst=20;
}
```

## Backup and Recovery

### User Data
All user data is stored in the browser via OPFS. Users should:
1. Export their data regularly (Settings → Export)
2. Store backups in a safe location
3. Import on new devices as needed

### Application Data
No server-side data is stored. The application is stateless.

## Troubleshooting

### WASM Not Loading
- **Issue**: `.wasm` files not served with correct MIME type
- **Solution**: Configure server to serve `.wasm` as `application/wasm`

### OPFS Not Available
- **Issue**: Browser doesn't support OPFS
- **Solution**: Use a supported browser (Chrome 111+, Firefox 115+, Safari 16.4+)

### CORS Errors
- **Issue**: API calls blocked by CORS
- **Solution**: Configure CORS headers on API server

### Performance Issues
- **Issue**: Slow loading or response times
- **Solution**: Enable compression, use CDN, optimize images

## Monitoring and Analytics

### Privacy-Respecting Analytics
- Use Plausible or Simple Analytics (no cookies)
- Self-hosted options available
- Respect Do Not Track headers

### Error Tracking
- Sentry (self-hosted or cloud)
- LogRocket (session replay)
- Custom error reporting endpoint

### Health Checks
```bash
# Check application health
curl -I https://your-domain.com

# Check WASM assets
curl -I https://your-domain.com/assets/sqlite3-*.wasm
```

## Scaling Considerations

### Client-Side Scaling
- Application scales automatically with users
- No server-side load
- CDN handles static asset delivery

### Database Scaling
- SQLite WASM handles individual user data
- For multi-user scenarios, use separate OPFS partitions
- Consider server-side sync for cross-device access

## Cost Optimization

### Static Hosting
- **Netlify**: Free tier supports small projects
- **Vercel**: Free tier with generous limits
- **GitHub Pages**: Free for public repositories
- **Cloudflare Pages**: Free with unlimited bandwidth

### Self-Hosting
- **VPS**: $5-20/month for small deployments
- **Dedicated**: $50+/month for high traffic
- **CDN**: $0-50/month depending on usage

## Next Steps

1. Choose a deployment option
2. Configure HTTPS
3. Set up monitoring
4. Configure backups
5. Test deployment
6. Monitor performance
