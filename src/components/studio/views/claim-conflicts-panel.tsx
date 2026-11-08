import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Copy, GitMerge, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioStore } from '@/lib/studio/store';
import { findClaimConflictsAsync } from '@/lib/claims/conflicts';
import {
  dismissConflictPair,
  isPairDismissed,
  loadDismissedPairs,
} from '@/lib/claims/conflict-dismissals';
import { translate } from '@/lib/i18n/messages/conflicts';

/** One flagged pair with resolved claim records. */
interface ResolvedConflict {
  readonly idA: string;
  readonly idB: string;
  readonly kind: 'duplicate' | 'possible-contradiction';
  readonly score: number;
  readonly reason: string;
  readonly statementA: string;
  readonly statementB: string;
  readonly confidenceA: number;
  readonly confidenceB: number;
}

const formatPercent = (value: number): string =>
  new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0 }).format(value);

/**
 * Conflicts panel (#1059): lists duplicate / possible-contradiction pairs with
 * both sources and confidence, offering merge, supersede and dismiss. All
 * actions are user-confirmed and undoable via the claims slice history.
 */
export const ClaimConflictsPanel = memo(function ClaimConflictsPanel() {
  const claims = useStudioStore((s) => s.claims);
  const entities = useStudioStore((s) => s.entities);
  const deleteClaim = useStudioStore((s) => s.deleteClaim);
  const updateClaim = useStudioStore((s) => s.updateClaim);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [pairs, setPairs] = useState<ResolvedConflict[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissedPairs());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      if (claims.length < 2) {
        setPairs([]);
        return;
      }
      setScanning(true);
      try {
        const controller = new AbortController();
        const onAbort = (): void => {
          cancelled = true;
        };
        controller.signal.addEventListener('abort', onAbort, { once: true });
        const found = await findClaimConflictsAsync(claims);
        controller.signal.removeEventListener('abort', onAbort);
        if (cancelled) return;
        const byId = new Map(claims.map((c) => [c.id, c]));
        const resolved: ResolvedConflict[] = [];
        for (const hit of found) {
          if (cancelled) break;
          if (isPairDismissed(hit.idA, hit.idB, loadDismissedPairs())) continue;
          const a = byId.get(hit.idA);
          const b = byId.get(hit.idB);
          if (a === undefined || b === undefined) continue;
          resolved.push({
            ...hit,
            statementA: a.statement,
            statementB: b.statement,
            confidenceA: a.confidence,
            confidenceB: b.confidence,
          });
        }
        if (!cancelled) setPairs(resolved);
      } catch (error) {
        console.error('Conflict scan failed', error);
      } finally {
        if (!cancelled) setScanning(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [claims]);

  const entityName = useCallback(
    (entityId: string): string => entities.find((e) => e.id === entityId)?.name ?? entityId,
    [entities],
  );

  const handleMerge = useCallback(
    (idA: string, idB: string) => {
      // Keeps A, removes B (undoable via pushHistory inside deleteClaim).
      deleteClaim(idB);
      setPairs((prev) => prev.filter((p) => !(p.idA === idA && p.idB === idB)));
      toast.success(translate('conflicts.mergedToast'));
    },
    [deleteClaim],
  );

  const handleSuperseded = useCallback(
    (idB: string) => {
      updateClaim(idB, { verification: 'disputed' });
      setPairs((prev) => prev.filter((p) => p.idA !== idB && p.idB !== idB));
      toast.success(translate('conflicts.mergedToast'));
    },
    [updateClaim],
  );

  const handleDismiss = useCallback((idA: string, idB: string) => {
    const next = dismissConflictPair(idA, idB);
    setDismissed(next);
    setPairs((prev) => prev.filter((p) => !(p.idA === idA && p.idB === idB)));
    toast.success(translate('conflicts.dismissedToast'));
  }, []);

  const visible = useMemo(
    () => pairs.filter((p) => !isPairDismissed(p.idA, p.idB, dismissed)),
    [pairs, dismissed],
  );

  return (
    <section aria-label={translate('conflicts.title')} className="rounded-lg border border-border p-4">
      <h2 className="font-serif text-h3">{translate('conflicts.title')}</h2>
      <p className="mt-1 text-caption text-ink-mute">{translate('conflicts.suggestionNote')}</p>
      {scanning ? (
        <p className="mt-3 text-body text-ink-mute">Scanning…</p>
      ) : visible.length === 0 ? (
        <p className="mt-3 text-body text-ink-mute">{translate('conflicts.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((pair) => (
            <li key={`${pair.idA}|${pair.idB}`} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-caption font-medium">
                {pair.kind === 'duplicate' ? <Copy className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                <span>{pair.kind === 'duplicate' ? translate('conflicts.duplicate') : translate('conflicts.contradiction')}</span>
                <span className="text-ink-faint">
                  {formatPercent(pair.score)} · {pair.reason}
                </span>
              </div>
              <p className="mt-2 text-body">
                &ldquo;{pair.statementA}&rdquo; ({formatPercent(pair.confidenceA)})
              </p>
              <p className="mt-1 text-body">
                &ldquo;{pair.statementB}&rdquo; ({formatPercent(pair.confidenceB)})
              </p>
              <p className="mt-1 text-caption text-ink-faint">
                {entityName(claims.find((c) => c.id === pair.idA)?.entityId ?? '')} ↔{' '}
                {entityName(claims.find((c) => c.id === pair.idB)?.entityId ?? '')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-body"
                  onClick={() => handleMerge(pair.idA, pair.idB)}
                  aria-label={`${translate('conflicts.merge')}: ${pair.statementA}`}
                >
                  <span className="inline-flex items-center gap-1">
                    <GitMerge className="h-4 w-4" /> {translate('conflicts.merge')}
                  </span>
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-body"
                  onClick={() => handleSuperseded(pair.idB)}
                >
                  {translate('conflicts.superseded')}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-body"
                  onClick={() => handleDismiss(pair.idA, pair.idB)}
                >
                  <span className="inline-flex items-center gap-1">
                    <X className="h-4 w-4" /> {translate('conflicts.dismiss')}
                  </span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
});
