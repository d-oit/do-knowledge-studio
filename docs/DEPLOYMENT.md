# Deployment

Knowledge Studio is a static web application that can be deployed to any static hosting platform.

## Build

```bash
pnpm run build
```

Output: `dist/` directory with optimized static files.

## Browser Requirements

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome | 86+ | Full OPFS support |
| Firefox | 111+ | Full OPFS support |
| Safari | 15.2+ | Partial OPFS ( IndexedDB fallback) |
| Edge | 86+ | Full OPFS support |

**HTTPS required** for OPFS (Origin Private File System) storage.

## Hosting Platforms

### Netlify

1. Push to GitHub
2. Connect repository in Netlify dashboard
3. Set build command: `pnpm run build`
4. Set publish directory: `dist`
5. Deploy

### Vercel

1. Push to GitHub
2. Import project in Vercel dashboard
3. Framework: Vite
4. Build command: `pnpm run build`
5. Output directory: `dist`
6. Deploy

### GitHub Pages

1. Push to GitHub
2. Go to Settings → Pages
3. Source: GitHub Actions
4. Create `.github/workflows/deploy.yml`:

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
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

### Self-Hosting

1. Build the project:
   ```bash
   pnpm run build
   ```

2. Serve the `dist/` directory with any static file server:
   ```bash
   # Using Node.js
   npx serve dist

   # Using Python
   python -m http.server -d dist 8080

   # Using Nginx
   location / {
       root /path/to/dist;
       try_files $uri $uri/ /index.html;
   }
   ```

3. Configure HTTPS (required for OPFS):
   - Use Let's Encrypt for free SSL
   - Or use a reverse proxy with SSL termination

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_LLM_API_KEY` | Default LLM API key | (none) |
| `VITE_LLM_BASE_URL` | Custom LLM base URL | (none) |

## COOP/COEP Headers

For full OPFS support, set these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Most hosting platforms set these automatically for Vite builds.

## Static Export

For sharing knowledge bases as static sites:

```bash
pnpm run cli -- export -f site -o ./my-knowledge-base
```

This generates a self-contained HTML file with all content embedded.

## Performance

- **Bundle size**: ~350KB gzipped (main chunk)
- **WASM**: ~430KB gzipped (SQLite)
- **Initial load**: <3s on 3G
- **Search init**: <10s (1000 entities)

## Troubleshooting

### Blank page after deployment

- Check browser console for errors
- Ensure HTTPS is enabled (required for OPFS)
- Verify COOP/COEP headers are set

### Data not persisting

- OPFS requires HTTPS
- Check browser storage quota
- Clear site data and reload

### Build fails

- Ensure Node.js 20+ is installed
- Run `pnpm install` before building
- Check for TypeScript errors: `pnpm run typecheck`
