/**
 * Visual Query Builder.
 *
 * Builds complex search queries from structured filter chips.
 * Supports combining entity types, relations, tags, and text search.
 */

export interface QueryFilter {
  id: string;
  type: 'entity-type' | 'relation' | 'tag' | 'text' | 'verification';
  value: string;
  operator: 'and' | 'or' | 'not';
}

export interface BuiltQuery {
  text: string;
  filters: QueryFilter[];
  description: string;
}

export function buildQueryFromFilters(filters: QueryFilter[]): BuiltQuery {
  if (filters.length === 0) {
    return { text: '', filters: [], description: 'No filters applied' };
  }

  const parts: string[] = [];
  const descriptions: string[] = [];

  for (const filter of filters) {
    switch (filter.type) {
      case 'entity-type':
        parts.push(`type:${filter.value}`);
        descriptions.push(`type is "${filter.value}"`);
        break;
      case 'relation':
        parts.push(`relation:${filter.value}`);
        descriptions.push(`linked by "${filter.value}"`);
        break;
      case 'tag':
        parts.push(`tag:${filter.value}`);
        descriptions.push(`tagged "${filter.value}"`);
        break;
      case 'text':
        parts.push(filter.value);
        descriptions.push(`contains "${filter.value}"`);
        break;
      case 'verification':
        parts.push(`status:${filter.value}`);
        descriptions.push(`verification is "${filter.value}"`);
        break;
    }
  }

  const text = parts.join(' ');
  const description = descriptions.length === 1
    ? descriptions[0]
    : descriptions.slice(0, -1).join(', ') + ' and ' + descriptions[descriptions.length - 1];

  return { text, filters, description };
}

export function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
