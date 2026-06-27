/**
 * Auto-Synthesis Agent.
 *
 * Analyzes the knowledge base to suggest connections and identify
 * contradictions using local heuristics. Presents suggestions in
 * a "Synthesis Inbox" for manual approval (human-in-the-loop).
 */
import { repository } from '../db/repository';
import { logger } from './logger';

export interface SynthesisSuggestion {
  id: string;
  type: 'connection' | 'contradiction' | 'enrichment';
  title: string;
  description: string;
  sourceEntities: string[];
  targetEntities?: string[];
  confidence: number;
  createdAt: string;
}

function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export async function findConnectionSuggestions(): Promise<SynthesisSuggestion[]> {
  const suggestions: SynthesisSuggestion[] = [];

  try {
    const entities = await repository.getAllEntities();
    if (entities.length < 2) return suggestions;

    const existingLinks = await repository.getAllLinks();
    const linkedPairs = new Set<string>();
    for (const link of existingLinks) {
      linkedPairs.add(`${link.source_id}->${link.target_id}`);
      linkedPairs.add(`${link.target_id}->${link.source_id}`);
    }

    for (let i = 0; i < entities.length; i++) {
      const e1 = entities[i];
      if (!e1.id || !e1.description) continue;
      const kw1 = extractKeywords(`${e1.name} ${e1.description}`);

      for (let j = i + 1; j < entities.length; j++) {
        const e2 = entities[j];
        if (!e2.id || !e2.description) continue;
        if (linkedPairs.has(`${e1.id}->${e2.id}`)) continue;

        const kw2 = extractKeywords(`${e2.name} ${e2.description}`);
        const similarity = jaccardSimilarity(kw1, kw2);

        if (similarity > 0.3) {
          suggestions.push({
            id: `conn-${e1.id}-${e2.id}`,
            type: 'connection',
            title: `Possible connection: ${e1.name} ↔ ${e2.name}`,
            description: `These entities share ${Math.round(similarity * 100)}% keyword overlap. Consider linking them.`,
            sourceEntities: [e1.name],
            targetEntities: [e2.name],
            confidence: similarity,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    logger.error('Failed to find connection suggestions', err);
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

export async function findContradictionSuggestions(): Promise<SynthesisSuggestion[]> {
  const suggestions: SynthesisSuggestion[] = [];

  try {
    const allClaims = await repository.getAllClaims();
    if (allClaims.length < 2) return suggestions;

    const negationPatterns = [
      /\bnot\b/, /\bnever\b/, /\bno\b/, /\bcannot\b/, /\bcan't\b/,
      /\bdon't\b/, /\bdoesn't\b/, /\bisn't\b/, /\bwasn't\b/,
      /\bfalse\b/, /\bincorrect\b/, /\bwrong\b/,
    ];

    const positivePatterns = [
      /\bis\b/, /\balways\b/, /\bcan\b/, /\bdo\b/, /\bdoes\b/,
      /\btrue\b/, /\bcorrect\b/, /\bright\b/, /\bsupports?\b/,
    ];

    for (let i = 0; i < allClaims.length; i++) {
      const c1 = allClaims[i];
      const e1 = await repository.getEntityById(c1.entity_id);
      const kw1 = extractKeywords(c1.statement);
      const hasNeg1 = negationPatterns.some(p => p.test(c1.statement));
      const hasPos1 = positivePatterns.some(p => p.test(c1.statement));

      for (let j = i + 1; j < allClaims.length; j++) {
        const c2 = allClaims[j];
        if (c1.entity_id === c2.entity_id) continue;

        const kw2 = extractKeywords(c2.statement);
        const similarity = jaccardSimilarity(kw1, kw2);
        const hasNeg2 = negationPatterns.some(p => p.test(c2.statement));
        const hasPos2 = positivePatterns.some(p => p.test(c2.statement));

        if (similarity > 0.4 && ((hasNeg1 && hasPos2) || (hasPos1 && hasNeg2))) {
          const e2 = await repository.getEntityById(c2.entity_id);
          suggestions.push({
            id: `contr-${c1.id}-${c2.id}`,
            type: 'contradiction',
            title: `Potential contradiction: ${e1?.name ?? 'Unknown'} vs ${e2?.name ?? 'Unknown'}`,
            description: `Claim 1: "${c1.statement}" vs Claim 2: "${c2.statement}"`,
            sourceEntities: [e1?.name ?? 'Unknown'],
            targetEntities: [e2?.name ?? 'Unknown'],
            confidence: similarity,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    logger.error('Failed to find contradiction suggestions', err);
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

export async function runSynthesis(): Promise<SynthesisSuggestion[]> {
  logger.info('Running synthesis analysis');

  const [connections, contradictions] = await Promise.all([
    findConnectionSuggestions(),
    findContradictionSuggestions(),
  ]);

  const all = [...connections, ...contradictions];
  logger.info(`Synthesis complete: ${connections.length} connections, ${contradictions.length} contradictions`);

  return all;
}
