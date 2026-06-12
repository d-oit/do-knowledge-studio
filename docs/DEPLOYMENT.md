# Deployment Guide

Do Knowledge Studio is a local-first web application that runs entirely in the browser using SQLite WASM + OPFS. This guide covers deployment options and requirements.

## Browser Requirements

| Requirement | Details |
|-------------|---------|
| **HTTPS** | Required for OPFS (Origin Private File System) access |
| **Chrome** | 86+ (2020-10) |
| **Firefox** | 111+ (2023-03) |
| **Safari** | 15.2+ (2021-12) |
| **Edge** | 86+ (Chromium-based) |

> **Note:** OPFS is not available over `http://localhost` in some browsers. Use `https://` or a tunnel service for local testing.

## Static Export

The application builds to static files in `dist/`:

```bash
pnpm run build
# Output: dist/
```

### Build Output Structure

```
dist/
├── index.html          # SPA entry point
├── assets/             # JS/CSS bundles
├── db/
│   └── schema.sql      # SQLite schema (bundled)
└── ...
```

## Hosting Platforms

### Netlify

1. Connect your GitHub repository
2. Set build command: `pnpm run build`
3. Set publish directory: `dist`
4. Add `_redirects` for SPA routing:
   ```
   /*    /index.html   200
   ```

### Vercel

1. Import your GitHub repository
2. Framework preset: Other
3. Build command: `pnpm run build`
4. Output directory: `dist`
5. Add rewrite rule in `vercel.json`:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

### GitHub Pages

1. Enable GitHub Pages in repository settings
2. Use GitHub Actions workflow:
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v2
         - uses: actions/setup-node@v4
           with: { node-version: 20, cache: pnpm }
         - run: pnpm install
         - run: pnpm run build
         - uses: actions/upload-pages-artifact@v3
           with: { path: dist }
         - uses: actions/deploy-pages@v4
   ```

### Cloudflare Pages

1. Connect your repository
2. Build command: `pnpm run build`
3. Build output directory: `dist`
4. Add SPA fallback rule in Pages settings

### Self-Hosting

1. Build the application:
   ```bash
   pnpm install
   pnpm run build
   ```

2. Serve `dist/` with any static file server:
   ```bash
   # Using Node.js
   npx serve dist

   # Using Python
   python3 -m http.server -d dist 8080

   # Using Nginx
   location / {
       root /path/to/dist;
       try_files $uri $uri/ /index.html;
   }
   ```

3. Ensure HTTPS is enabled (required for OPFS):
   - Use a reverse proxy (Nginx, Caddy) with TLS
   - Or use a tunnel service (ngrok, Cloudflare Tunnel)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_LLM_API_KEY` | Default LLM API key (encrypted at rest) | — |
| `VITE_LLM_API_BASE_URL` | Custom LLM API base URL | Provider default |

> **Security:** API keys are encrypted using AES-GCM before storage in localStorage. Never commit API keys to source control.

## Data Storage

All user data is stored locally in the browser:

- **SQLite WASM + OPFS**: Primary storage for entities, claims, links, notes
- **localStorage**: LLM configuration and encryption keys
- **IndexedDB**: Orama search index (vector embeddings)

No data is sent to external servers unless the user explicitly configures an LLM provider.

## Troubleshooting

### "OPFS not available" error

- Ensure the site is served over HTTPS
- Check browser version meets requirements
- Some browsers require user gesture before OPFS access

### Search not working

- Orama index builds on first load (may take a few seconds)
- Check browser DevTools for indexing errors
- Clear site data and reload to rebuild index

### Export failures

- Static export creates a standalone HTML file
- Large knowledge bases may exceed browser memory limits
- Use CLI export for very large datasets:
  ```bash
  pnpm run cli -- export --format markdown
  ```
