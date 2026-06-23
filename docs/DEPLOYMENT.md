# Deployment

Knowledge Studio is a 100% static web application — there is no server
component. The output of `pnpm run build` (`dist/`) can be hosted on
any static-file platform, self-hosted behind a reverse proxy, or even
opened over `file://` for offline use (with limitations).

## Build

```bash
pnpm run build
```

This runs `tsc --noEmit` then `vite build` and produces the
production bundle in `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-<hash>.js
│   ├── index-<hash>.css
│   ├── sqlite-wasm-<hash>.js
│   └── …
└── …
```

Inspect the bundle with `pnpm run preview` to verify locally before
shipping.

## Browser Requirements

| Browser | Minimum Version | OPFS Support | Notes |
|---------|-----------------|--------------|-------|
| Chrome | 86+ | Full | Default development target |
| Edge | 86+ | Full | Chromium-based, identical to Chrome |
| Firefox | 111+ | Full | |
| Safari | 15.2+ | Partial (IndexedDB fallback) | OPFS works but with smaller quotas |
| Mobile Safari | 15.2+ | Partial | Same as desktop Safari |

**HTTPS is required** for OPFS (Origin Private File System) storage,
which is the primary persistence layer. `localhost` is treated as a
secure context by all modern browsers, so local development works
over plain HTTP.

## Hosting Platforms

### Netlify

1. Push the repository to GitHub.
2. Connect the repo in the Netlify dashboard.
3. Configure the build:
   - **Build command:** `pnpm run build`
   - **Publish directory:** `dist`
   - **Node version:** 20 (set in `netlify.toml` or the UI)
4. Netlify serves the SPA with a default fallback to `index.html`.
   No additional config is required.

### Vercel

1. Import the project in the Vercel dashboard.
2. Framework preset: **Vite**.
3. Build command: `pnpm run build`. Output directory: `dist`.
4. Vercel sets the right COOP/COEP headers automatically for the
   Vite preset.

### GitHub Pages

1. Push to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. Add `.github/workflows/deploy.yml`:

   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     build-deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deploy.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm run build
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: dist
         - id: deploy
           uses: actions/deploy-pages@v4
   ```

### Cloudflare Pages

1. Connect the repo from the Cloudflare dashboard.
2. Build command: `pnpm run build`. Output: `dist`.
3. Cloudflare serves the static bundle and supports `_headers` files
   for COOP/COEP tuning.

### Self-Hosting

Build the project and serve `dist/` with any static file server:

```bash
pnpm run build

# Node.js
npx serve dist

# Python
python -m http.server -d dist 8080

# Nginx
server {
    listen 443 ssl http2;
    server_name studio.example.com;

    root /var/www/do-knowledge-studio;
    index index.html;

    # Required for OPFS + WASM
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Resource-Policy "cross-origin" always;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**HTTPS is mandatory** in production for OPFS to work. Use Let's
Encrypt for free certificates or a managed reverse proxy with
automatic renewal.

## COOP / COEP Headers

For full OPFS support and SharedArrayBuffer (used by the SQLite
worker), set these response headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Most static hosts (Netlify, Vercel, Cloudflare Pages) set these
automatically for Vite builds. If your self-hosted deployment misses
them, the app falls back to an IndexedDB-only mode with reduced
performance.

## Static Export (Knowledge Sharing)

The `cli export` command can render the entire knowledge base as a
single self-contained HTML file, suitable for distributing a read-only
snapshot:

```bash
pnpm run cli -- export -f site -o ./my-knowledge-base
```

The output `index.html` has no external dependencies and can be sent
as an email attachment, hosted on a personal site, or opened from
`file://` for offline browsing. See `docs/CLI.md` for the full
command set.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_LLM_API_KEY` | Default LLM API key (build-time only) | (none) |
| `VITE_LLM_BASE_URL` | Custom LLM base URL | (none) |

These are baked into the JavaScript bundle at build time and are
visible to anyone with access to the deployed site. Use the
in-app settings instead for any key you want to keep private.

## Performance

Indicative numbers for a clean production build:

- **Main bundle:** ~350 KB gzipped
- **SQLite WASM:** ~430 KB gzipped
- **Orama + embeddings:** ~1.2 MB gzipped (lazy-loaded)
- **Initial paint:** <3 s on a 3G connection
- **Search index hydration (1 000 entities):** <10 s

The Orama and PDF exporter bundles are split into separate chunks
that are only fetched on demand.

## Troubleshooting

### Blank page after deployment

- Open the browser dev-tools console. The most common cause is a
  missing COOP/COEP header chain.
- Verify HTTPS is enabled — the app refuses to initialize OPFS
  over insecure origins.
- Check the network panel for failed chunk loads; if the service
  worker was cached against a previous deployment, hard-reload.

### Data does not persist

- OPFS requires a secure context (HTTPS or `localhost`).
- The browser storage quota may be exhausted — check
  `navigator.storage.estimate()` in the console.
- In private/incognito mode, OPFS is wiped at the end of the
  session.

### Build fails

- Use Node.js 20 or higher. `nvm use 20` if you have nvm.
- Run `pnpm install` before `pnpm run build`.
- Run `pnpm run typecheck` to surface TypeScript errors faster
  than the build.

### OPFS quota exceeded

OPFS files share the origin's storage budget. The first time the
quota is exceeded, the app surfaces a clear error. Use
**AI Harness → Settings → Database** to switch the storage target
to a user-selected directory via the File System Access API (where
available).

### 404 on direct route navigation

Single-page apps need a fallback to `index.html` for any path the
router understands. Make sure your host's rewrite rules include a
`try_files ... /index.html` (Nginx) or equivalent.

## Pre-Deployment Checklist

- [ ] `pnpm run build` completes with no TypeScript or Vite errors
- [ ] `pnpm run test` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm run typecheck` passes
- [ ] COOP/COEP headers are set (or the app gracefully falls back)
- [ ] HTTPS is configured
- [ ] The deployment target supports SPA fallback to `index.html`
- [ ] No `VITE_LLM_API_KEY` is committed to the bundle for shared
      deployments
