import { useCallback, useMemo, useState } from 'react';
import type { Entity, Link } from '../../lib/validation';
import { EMPTY_GRAPH_FILTERS, type GraphFilters } from './graph-filters';

interface UseGraphFiltersResult {
  graphFilters: GraphFilters;
  setGraphFilters: (filters: GraphFilters) => void;
  entityTypeMap: Record<string, string>;
  edgeRelationMap: Record<string, string>;
  nodeDegreeMap: Record<string, number>;
  applyGraphFilters: (data: { entities: Entity[]; links: Link[] }) => { entities: Entity[]; links: Link[] };
}

export const useGraphFilters = (entities: Entity[], links: Link[]): UseGraphFiltersResult => {
  const [graphFilters, setGraphFilters] = useState<GraphFilters>(EMPTY_GRAPH_FILTERS);

  const entityTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of entities) {
      if (e.id) map[e.id] = e.type;
    }
    return map;
  }, [entities]);

  const edgeRelationMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const l of links) {
      if (l.id) map[l.id] = l.relation;
    }
    return map;
  }, [links]);

  const nodeDegreeMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of links) {
      if (l.source_id) map[l.source_id] = (map[l.source_id] ?? 0) + 1;
      if (l.target_id) map[l.target_id] = (map[l.target_id] ?? 0) + 1;
    }
    return map;
  }, [links]);

  const applyGraphFilters = useCallback(
    (data: { entities: Entity[]; links: Link[] }) => {
      const { typeFilter, relationFilter, nodeSearch, minDegree } = graphFilters;
      if (typeFilter.size === 0 && relationFilter.size === 0 && nodeSearch.length === 0 && minDegree === 0) {
        return data;
      }
      const q = nodeSearch.toLowerCase();
      const allowedNodes = new Set<string>();
      for (const e of data.entities) {
        if (!e.id) continue;
        if (typeFilter.size > 0 && (!e.type || !typeFilter.has(e.type))) continue;
        if (minDegree > 0 && (nodeDegreeMap[e.id] ?? 0) < minDegree) continue;
        if (q.length > 0 && !e.name.toLowerCase().includes(q)) continue;
        allowedNodes.add(e.id);
      }
      const filteredLinks = data.links.filter(l => {
        if (relationFilter.size > 0 && (!l.relation || !relationFilter.has(l.relation))) return false;
        return allowedNodes.has(l.source_id) && allowedNodes.has(l.target_id);
      });
      return {
        entities: data.entities.filter(e => e.id && allowedNodes.has(e.id)),
        links: filteredLinks,
      };
    },
    [graphFilters, nodeDegreeMap],
  );

  return { graphFilters, setGraphFilters, entityTypeMap, edgeRelationMap, nodeDegreeMap, applyGraphFilters };
};
