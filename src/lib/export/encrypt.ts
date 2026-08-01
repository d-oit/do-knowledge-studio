const PBKDF2_ITERATIONS = 600000
const SALT_LENGTH = 16
const IV_LENGTH = 12

export const MIN_ITERATIONS = 100000
export const MAX_ITERATIONS = 10000000

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as ArrayBuffer, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer },
    key,
    encoder.encode(data),
  )
  return JSON.stringify({
    v: 1,
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    data: arrayBufferToBase64(encrypted),
    iterations: PBKDF2_ITERATIONS,
  })
}

interface EncryptedPayload {
  salt: string
  iv: string
  data: string
  iterations: number
}

const validateBase64Field = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new Error(message)
  }
  return value
}

const validateIterations = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('Invalid iterations parameter')
  }
  if (value < MIN_ITERATIONS) {
    throw new Error('Iteration count is too low')
  }
  if (value > MAX_ITERATIONS) {
    throw new Error('Iteration count exceeds maximum allowable limit')
  }
  return value
}

const parseEncryptedPayload = (payload: string): EncryptedPayload => {
  const parsed: unknown = JSON.parse(payload)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid encrypted payload structure')
  }
  const candidate = parsed as Partial<EncryptedPayload>
  return {
    salt: validateBase64Field(candidate.salt, 'Invalid or missing salt'),
    iv: validateBase64Field(candidate.iv, 'Invalid or missing IV'),
    data: validateBase64Field(candidate.data, 'Invalid or missing data'),
    iterations: validateIterations(candidate.iterations),
  }
}

export async function decryptData(payload: string, password: string): Promise<string> {
  const { salt, iv, data, iterations } = parseEncryptedPayload(payload)

  const saltBuf = base64ToArrayBuffer(salt)
  const ivBuf = base64ToArrayBuffer(iv)
  const dataBuf = base64ToArrayBuffer(data)
  const key = await deriveKey(password, new Uint8Array(saltBuf), iterations)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuf) as unknown as ArrayBuffer },
    key,
    dataBuf,
  )
  return new TextDecoder().decode(decrypted)
}

export function buildEncryptedReaderHtml(cipherPayload: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none';" />
  <title>DO Knowledge Studio — encrypted reader</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 760px; margin: 0 auto; padding: 2rem; color: #1a1814; background: #faf8f3; }
    h1 { font-family: Georgia, serif; }
    label { display: block; margin: 1rem 0 0.4rem; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b6760; }
    input { width: 100%; padding: 0.5rem 0.75rem; font: inherit; border: 1px solid #e5e1d8; border-radius: 6px; box-sizing: border-box; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; font: inherit; font-weight: 600; background: #1a1814; color: #faf8f3; border: 0; border-radius: 6px; cursor: pointer; }
    pre { white-space: pre-wrap; word-wrap: break-word; background: #f1ede4; padding: 0.75rem 1rem; border-radius: 6px; max-height: 60vh; overflow-y: auto; }
    .err { color: #b91c1c; margin-top: 0.5rem; font-size: 12px; }
    .info { color: #6b6760; font-size: 12px; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>Encrypted reader</h1>
  <p>This file was exported from DO Knowledge Studio. Enter the password to decrypt.</p>
  <label for="pw">Password</label>
  <input id="pw" type="password" autofocus />
  <button id="decrypt">Decrypt &amp; view</button>
  <p class="err" id="err"></p>
  <pre id="out"></pre>
  <p class="info">Encrypted with AES-256-GCM + PBKDF2 (600k iterations).</p>
  <script>
    var PAYLOAD = ${JSON.stringify(cipherPayload)};
    async function decrypt(password) {
      var obj = JSON.parse(PAYLOAD);
      if (!obj || typeof obj !== 'object') {
        throw new Error('Invalid export payload structure.');
      }
      if (typeof obj.salt !== 'string' || !obj.salt) {
        throw new Error('Missing or invalid salt.');
      }
      if (typeof obj.iv !== 'string' || !obj.iv) {
        throw new Error('Missing or invalid IV.');
      }
      if (typeof obj.data !== 'string' || !obj.data) {
        throw new Error('Missing or invalid ciphertext data.');
      }

      var iterations = obj.iterations;
      if (typeof iterations !== 'number' || isNaN(iterations) || !Number.isInteger(iterations)) {
        throw new Error('Invalid iteration parameter.');
      }
      if (iterations < ${MIN_ITERATIONS}) {
        throw new Error('Iteration count is too low for safe decryption.');
      }
      if (iterations > ${MAX_ITERATIONS}) {
        throw new Error('Iteration count exceeds the maximum allowable limit.');
      }

      var salt = Uint8Array.from(atob(obj.salt), function(c) { return c.charCodeAt(0); });
      var iv = Uint8Array.from(atob(obj.iv), function(c) { return c.charCodeAt(0); });
      var data = Uint8Array.from(atob(obj.data), function(c) { return c.charCodeAt(0); });
      var keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
      var key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      var decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
      return new TextDecoder().decode(decrypted);
    }
    document.getElementById("decrypt").addEventListener("click", async function() {
      var pw = document.getElementById("pw").value;
      var err = document.getElementById("err");
      var out = document.getElementById("out");
      err.textContent = "";
      if (!pw) { err.textContent = "Password is required."; return; }
      try {
        var json = await decrypt(pw);
        var data = JSON.parse(json);
        out.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        out.textContent = "";
        err.textContent = "Decryption failed — " + e.message;
      }
    });
    document.getElementById("pw").addEventListener("keydown", function(e) {
      if (e.key === "Enter") document.getElementById("decrypt").click();
    });
  </script>
</body>
</html>`
}
