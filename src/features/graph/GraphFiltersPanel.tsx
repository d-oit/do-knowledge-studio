import React, { useMemo } from 'react';
import { Search, X as XIcon, Check, Minus } from 'lucide-react';
import { EMPTY_GRAPH_FILTERS, MIN_DEGREE_OPTIONS, type GraphFilters } from './graph-filters';

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <fieldset className="graph-filter-section">
    <legend className="graph-filter-section-title">{title}</legend>
    {children}
  </fieldset>
);

/**
 * Side panel exposing graph filtering controls.
 *
 * Sections: node type multi-select, edge relation multi-select, a
 * free-text node label search, and a minimum-degree chip selector.
 * The component is fully controlled — it never mutates the supplied
 * `filters` directly but emits a new `GraphFilters` object via
 * `onChange` whenever a control changes. A "Reset filters" button
 * appears only when at least one filter is active.
 */
export const GraphFiltersPanel: React.FC<{
  nodeTypes: string[];
  edgeTypes: string[];
  filters: GraphFilters;
  onChange: (filters: GraphFilters) => void;
}> = ({ nodeTypes, edgeTypes, filters, onChange }) => {
  const toggleType = (type: string) => {
    const next = new Set(filters.typeFilter);
    if (next.has(type)) next.delete(type); else next.add(type);
    onChange({ ...filters, typeFilter: next });
  };

  const toggleRelation = (relation: string) => {
    const next = new Set(filters.relationFilter);
    if (next.has(relation)) next.delete(relation); else next.add(relation);
    onChange({ ...filters, relationFilter: next });
  };

  const setMinDegree = (n: number) => onChange({ ...filters, minDegree: n });
  const setNodeSearch = (q: string) => onChange({ ...filters, nodeSearch: q });

  const hasActiveFilter = useMemo(
    () =>
      filters.typeFilter.size > 0 ||
      filters.relationFilter.size > 0 ||
      filters.nodeSearch.length > 0 ||
      filters.minDegree > 0,
    [filters],
  );

  return (
    <section className="graph-filters-panel" aria-label="Graph filters">
      <FilterSection title="Type">
        {nodeTypes.length === 0 ? (
          <p className="graph-filter-empty">No node types yet</p>
        ) : (
          <ul className="graph-filter-checkbox-list">
            {nodeTypes.map(type => {
              const checked = filters.typeFilter.has(type);
              return (
                <li key={type}>
                  <label className="graph-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(type)}
                      aria-label={`Filter by type ${type}`}
                    />
                    <span>{type}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </FilterSection>

      <FilterSection title="Relation">
        {edgeTypes.length === 0 ? (
          <p className="graph-filter-empty">No relations yet</p>
        ) : (
          <ul className="graph-filter-checkbox-list">
            {edgeTypes.map(relation => {
              const checked = filters.relationFilter.has(relation);
              return (
                <li key={relation}>
                  <label className="graph-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRelation(relation)}
                      aria-label={`Filter by relation ${relation}`}
                    />
                    <span>{relation}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </FilterSection>

      <FilterSection title="Node search">
        <div className="graph-filter-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={filters.nodeSearch}
            onChange={(e) => setNodeSearch(e.target.value)}
            placeholder="Find nodes..."
            aria-label="Search nodes by label"
          />
          {filters.nodeSearch && (
            <button
              type="button"
              className="input-clear-button"
              onClick={() => setNodeSearch('')}
              aria-label="Clear node search"
            >
              <XIcon size={12} />
            </button>
          )}
        </div>
      </FilterSection>

      <FilterSection title="Min connections">
        <div className="graph-filter-degree">
          {MIN_DEGREE_OPTIONS.map(n => {
            const active = filters.minDegree === n;
            return (
              <button
                key={n}
                type="button"
                className={`filter-chip ${active ? 'active' : ''}`}
                onClick={() => setMinDegree(n)}
                aria-pressed={active}
                aria-label={`Show nodes with at least ${n} connection${n === 1 ? '' : 's'}`}
              >
                {n === 0 ? <Minus size={12} /> : <Check size={12} />} {n === 0 ? 'Any' : `${n}+`}
              </button>
            );
          })}
        </div>
      </FilterSection>

      {hasActiveFilter && (
        <button
          type="button"
          className="btn-secondary graph-filter-reset"
          onClick={() => onChange(EMPTY_GRAPH_FILTERS)}
        >
          Reset filters
        </button>
      )}
    </section>
  );
};
