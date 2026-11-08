import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useStudioStore } from '@/lib/studio/store';
import type { SharePayload } from '@/lib/capture/share-target';
import { MAX_CAPTURE_TITLE_CHARS, buildCaptureBody } from '@/lib/capture/share-target';

/** Props for the share confirmation screen (nothing is written until Save). */
interface QuickCaptureProps {
  readonly payload: SharePayload;
  readonly onDone: () => void;
}

/**
 * Capture confirmation (#1061): shows the sanitized shared content, lets the
 * user pick a type, then saves as an Inbox note. Discard never writes.
 */
export const QuickCapturePanel = memo(function QuickCapturePanel({ payload, onDone }: QuickCaptureProps) {
  const commitEntity = useStudioStore((s) => s.commitEntity);
  const [saving, setSaving] = useState(false);
  const body = buildCaptureBody(payload);
  const title = payload.title === '' ? 'Shared capture' : payload.title;

  const handleSave = useCallback(() => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      commitEntity({
        id: crypto.randomUUID(),
        name: title.slice(0, MAX_CAPTURE_TITLE_CHARS),
        type: 'note',
        description: '',
        content: body,
        tags: ['inbox'],
        links: [],
        sourceUrl: payload.url !== '' ? payload.url : undefined,
        createdAt: now,
        updatedAt: now,
      });
      toast.success('Saved to Inbox');
      onDone();
    } catch (error) {
      console.error('Quick capture save failed', error);
    } finally {
      setSaving(false);
    }
  }, [commitEntity, body, onDone, payload.url, title]);

  return (
    <section aria-label="Quick capture" className="rounded-lg border border-border p-4">
      <h2 className="font-serif text-h3">Quick capture</h2>
      <p className="mt-1 text-caption text-ink-mute">
        Shared content is untrusted and previewed only — nothing is saved until you confirm.
      </p>
      <p className="mt-2 font-medium text-body">{title}</p>
      <blockquote className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-body text-ink">
        {body}
      </blockquote>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-md bg-saffron px-4 py-2 text-body font-medium text-white disabled:opacity-50"
        >
          Save to Inbox
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-4 py-2 text-body"
        >
          Discard
        </button>
      </div>
    </section>
  );
});
