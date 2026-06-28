/**
 * NLP Intent Parser for Voice-to-Knowledge.
 *
 * Extracts structured entities and claims from natural language sentences.
 * Uses simple pattern matching (no ML dependencies) for local-first operation.
 */

export interface ParsedEntity {
  name: string;
  type: string;
  description: string;
}

export interface ParsedClaim {
  entityName: string;
  statement: string;
  confidence: number;
}

export interface ParsedRelation {
  source: string;
  target: string;
  relation: string;
}

export interface ParseResult {
  entities: ParsedEntity[];
  claims: ParsedClaim[];
  relations: ParsedRelation[];
  rawText: string;
}

const ENTITY_PATTERNS = [
  /(?:^|\s)([\w][\w\s]{1,30}?)\s+is\s+(?:a|an|the)?\s*([\w][\w\s]{0,30}?)(?:\.|,|$)/gi,
  /(?:create|add|new)\s+(?:an?\s+)?(?:entity|concept|note|person|organization)\s+(?:called|named)?\s*["']?([^"'.]+?)["']?\s+(?:of|with|type)\s+([\w]+)/gi,
  /(?:create|add|new)\s+(?:an?\s+)?(?:entity|concept|note|person|organization)\s+(?:called|named)?\s*["']?([^"'.]+?)["']?(?:\.|,|$)/gi,
  /(?:let me note|note down|record)\s+(?:that\s+)?(.{2,80}?)(?:\.|,|$)/gi,
];

const CLAIM_PATTERNS = [
  /([\w\s]+?)\s+(?:is|are|was|were)\s+(?:always |never |often |sometimes )?([\w\s]+?)(?:\.|,|$)/gi,
  /(?:i think|i believe|it seems|apparently|arguably)\s+(.+?)(?:\.|,|$)/gi,
  /(?:the fact that|it is known that|research shows)\s+(.+?)(?:\.|,|$)/gi,
];

const RELATION_PATTERNS = [
  /([\w\s]+?)\s+(?:relates? to|connects? to|links? to|associates? with)\s+([\w\s]+?)(?:\.|,|$)/gi,
  /([\w\s]+?)\s+(?:is (?:a |the )?(?:type of|kind of|part of|component of))\s+([\w\s]+?)(?:\.|,|$)/gi,
  /([\w\s]+?)\s+(?:contradicts?|opposes?|conflicts? with)\s+([\w\s]+?)(?:\.|,|$)/gi,
];

function extractEntities(text: string): ParsedEntity[] {
  const entities: ParsedEntity[] = [];
  const seen = new Set<string>();

  for (const pattern of ENTITY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const name = (match[1] || '').trim();
      const typeHint = (match[2] || '').trim();
      if (name.length < 2 || seen.has(name.toLowerCase())) continue;

      let type = 'concept';
      if (/person|who|someone|he|she/i.test(typeHint)) type = 'person';
      else if (/org|company|team|group/i.test(typeHint)) type = 'org';
      else if (/tech|software|library|framework|tool/i.test(typeHint)) type = 'tech';
      else if (/place|location|city|country/i.test(typeHint)) type = 'place';
      else if (/note|idea|thought/i.test(typeHint)) type = 'note';

      entities.push({ name, type, description: `${name} ${typeHint}`.trim() });
      seen.add(name.toLowerCase());
    }
  }

  return entities;
}

function extractClaims(text: string): ParsedClaim[] {
  const claims: ParsedClaim[] = [];
  const seen = new Set<string>();

  for (const pattern of CLAIM_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const subject = (match[1] || '').trim();
      const predicate = (match[2] || '').trim();
      if (subject.length < 2 || predicate.length < 2) continue;

      const statement = `${subject} ${predicate}`.trim();
      if (seen.has(statement.toLowerCase())) continue;

      claims.push({
        entityName: subject,
        statement,
        confidence: 0.7,
      });
      seen.add(statement.toLowerCase());
    }
  }

  return claims;
}

function extractRelations(text: string): ParsedRelation[] {
  const relations: ParsedRelation[] = [];
  const seen = new Set<string>();

  for (const pattern of RELATION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const source = (match[1] || '').trim();
      const target = (match[2] || '').trim();
      if (source.length < 2 || target.length < 2) continue;

      const key = `${source}->${target}`;
      if (seen.has(key)) continue;

      let relation = 'relates_to';
      if (/contradict|oppose|conflict/i.test(text)) relation = 'contradicts';
      else if (/type of|kind of|part of|component/i.test(text)) relation = 'is_a';
      else if (/relates?|connects?|links?|associates/i.test(text)) relation = 'relates_to';

      relations.push({ source, target, relation });
      seen.add(key);
    }
  }

  return relations;
}

export function parseVoiceInput(text: string): ParseResult {
  const cleaned = text.trim();
  if (!cleaned) {
    return { entities: [], claims: [], relations: [], rawText: text };
  }

  const entities = extractEntities(cleaned);
  const claims = extractClaims(cleaned);
  const relations = extractRelations(cleaned);

  return { entities, claims, relations, rawText: text };
}
