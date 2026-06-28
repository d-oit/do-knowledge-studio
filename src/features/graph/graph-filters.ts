export interface GraphFilters {
  typeFilter: ReadonlySet<string>;
  relationFilter: ReadonlySet<string>;
  nodeSearch: string;
  minDegree: number;
  claimVerificationFilter: ReadonlySet<string>;
}

export const EMPTY_GRAPH_FILTERS: GraphFilters = {
  typeFilter: new Set(),
  relationFilter: new Set(),
  nodeSearch: '',
  minDegree: 0,
  claimVerificationFilter: new Set(),
};

export const MIN_DEGREE_OPTIONS = [0, 1, 2, 3, 5] as const;
