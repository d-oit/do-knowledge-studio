/**
 * Read CSS custom property values from the document.
 * Used by non-DOM renderers (Sigma, MindElixir) to stay in sync with the active theme.
 */
export function getCssToken(token: string, element?: HTMLElement): string {
  const el = element ?? document.documentElement;
  return getComputedStyle(el).getPropertyValue(token).trim();
}

/**
 * Read all graph-related theme tokens.
 */
export function getGraphThemeTokens(element?: HTMLElement) {
  return {
    nodeDefault: getCssToken('--graph-node-default', element) || '#94a3b8',
    nodeSelected: getCssToken('--graph-node-selected', element) || '#00b894',
    edgeDefault: getCssToken('--graph-edge-default', element) || '#cbd5e1',
    edgeHighlighted: getCssToken('--graph-edge-highlighted', element) || '#00b894',
    interactivePrimary: getCssToken('--interactive-primary', element) || '#00b894',
  };
}

/**
 * Listen for theme changes and invoke callback.
 * Uses MutationObserver on data-theme attribute.
 */
export function onThemeChange(callback: () => void): () => void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'data-theme') {
        callback();
        return;
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return () => observer.disconnect();
}
