/**
 * Quick-capture share_target parsing for #1061.
 *
 * PWA `share_target` (GET) launches the app with `?share=1&title=…&text=…&url=…`.
 * Everything arriving here is untrusted: it is size-capped, stripped of control
 * characters, and rendered only through the sanitized preview. Nothing is
 * written to the corpus until the user confirms in the capture screen.
 */

/** Query keys emitted by the manifest `share_target`. */
export const SHARE_PARAMS = ['title', 'text', 'url'] as const;

/** Max chars accepted per field (share sheets can be large). */
export const MAX_SHARE_FIELD_CHARS = 4000;

/** Max chars of the share title kept as the Inbox note name. */
export const MAX_CAPTURE_TITLE_CHARS = 120;

/** Parsed, sanitized share payload. */
export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url: string;
}

/** Strips control characters and caps length. */
export const sanitizeShareField = (value: string | null): string => {
  if (value === null || value === '') return '';
  const stripped = value.replace(/[\u0000-\u001F\u007F]/gu, '').trim();
  return stripped.length <= MAX_SHARE_FIELD_CHARS
    ? stripped
    : stripped.slice(0, MAX_SHARE_FIELD_CHARS);
};

/** Parses a share launch URL (search string) into a payload, or null. */
export const parseShareParams = (search: string): SharePayload | null => {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  if (params.get('share') !== '1') return null;
  const payload: SharePayload = {
    title: sanitizeShareField(params.get('title')),
    text: sanitizeShareField(params.get('text')),
    url: sanitizeShareField(params.get('url')),
  };
  if (payload.title === '' && payload.text === '' && payload.url === '') return null;
  try {
    if (payload.url !== '') {
      const parsed = new URL(payload.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ...payload, url: '' };
      }
    }
  } catch {
    return { ...payload, url: '' };
  }
  return payload;
};

/** Builds the pre-filled Inbox note body from a share payload. */
export const buildCaptureBody = (payload: SharePayload): string => {
  const parts: string[] = [];
  if (payload.text !== '') parts.push(payload.text);
  if (payload.url !== '') parts.push(payload.url);
  if (parts.length === 0 && payload.title !== '') parts.push(payload.title);
  return parts.join('\n\n');
};
