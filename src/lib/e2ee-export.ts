/**
 * E2EE Encrypted Markdown Export.
 *
 * Exports knowledge base as an AES-GCM encrypted markdown file
 * bundled with a self-contained HTML reader that decrypts on-the-fly.
 *
 * Uses PBKDF2 for password-derived key (100k iterations, SHA-256).
 */
import { generateMarkdownExport, type ExportData } from './export-core';

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptContent(content: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encoded = new TextEncoder().encode(content);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  // Pack: salt(16) + iv(12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptContent(encryptedBase64: string, password: string): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}

export function generateEncryptedExport(data: ExportData, password: string): Promise<string> {
  const markdown = generateMarkdownExport(data);
  return encryptContent(markdown, password);
}

const READER_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Encrypted Knowledge Base</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 600px; width: 100%; padding: 32px; }
    .lock-icon { font-size: 48px; text-align: center; margin-bottom: 24px; }
    h1 { font-size: 24px; text-align: center; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #94a3b8; margin-bottom: 32px; font-size: 14px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #94a3b8; }
    input[type="password"] { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #1e293b; color: #e2e8f0; font-size: 16px; }
    input:focus { outline: none; border-color: #38bdf8; }
    button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #38bdf8; color: #0f172a; font-size: 16px; font-weight: 600; cursor: pointer; }
    button:hover { background: #7dd3fc; }
    button:disabled { background: #475569; cursor: not-allowed; }
    .error { color: #f87171; font-size: 13px; margin-top: 8px; display: none; }
    .content { display: none; max-width: 800px; margin: 0 auto; padding: 32px; }
    .content pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.6; background: #1e293b; padding: 24px; border-radius: 8px; border: 1px solid #334155; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
    .toolbar button { width: auto; padding: 8px 16px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container" id="unlock-view">
    <div class="lock-icon">🔒</div>
    <h1>Encrypted Knowledge Base</h1>
    <p class="subtitle">Enter the password to decrypt and view</p>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="Enter password" autofocus />
    </div>
    <div class="error" id="error">Incorrect password or corrupted data</div>
    <button id="decrypt-btn" onclick="decrypt()">Decrypt</button>
  </div>
  <div class="content" id="content-view">
    <div class="toolbar">
      <button onclick="copyToClipboard()">Copy to Clipboard</button>
      <button onclick="downloadMarkdown()">Download .md</button>
      <button onclick="lock()">Lock</button>
    </div>
    <pre id="markdown-content"></pre>
  </div>
  <script>
    const ENCRYPTED_DATA = '__ENCRYPTED_DATA__';
    let decryptedContent = '';

    async function deriveKey(password, salt) {
      const keyMaterial = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
      );
    }

    async function decrypt() {
      const password = document.getElementById('password').value;
      if (!password) return;
      const btn = document.getElementById('decrypt-btn');
      const error = document.getElementById('error');
      btn.disabled = true;
      btn.textContent = 'Decrypting...';
      error.style.display = 'none';

      try {
        const combined = Uint8Array.from(atob(ENCRYPTED_DATA), c => c.charCodeAt(0));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);
        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        decryptedContent = new TextDecoder().decode(decrypted);
        document.getElementById('markdown-content').textContent = decryptedContent;
        document.getElementById('unlock-view').style.display = 'none';
        document.getElementById('content-view').style.display = 'block';
      } catch {
        error.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Decrypt';
      }
    }

    function copyToClipboard() {
      navigator.clipboard.writeText(decryptedContent).then(() => {
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy to Clipboard', 2000);
      });
    }

    function downloadMarkdown() {
      const blob = new Blob([decryptedContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-base.md';
      a.click();
      URL.revokeObjectURL(url);
    }

    function lock() {
      decryptedContent = '';
      document.getElementById('content-view').style.display = 'none';
      document.getElementById('unlock-view').style.display = 'block';
      document.getElementById('password').value = '';
      document.getElementById('markdown-content').textContent = '';
    }

    document.getElementById('password').addEventListener('keydown', e => {
      if (e.key === 'Enter') decrypt();
    });
  </script>
</body>
</html>`;

export async function generateEncryptedReader(
  data: ExportData,
  password: string,
): Promise<string> {
  const encrypted = await generateEncryptedExport(data, password);
  return READER_HTML_TEMPLATE.replace('__ENCRYPTED_DATA__', encrypted);
}
