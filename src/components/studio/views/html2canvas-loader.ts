/**
 * Lazy html2canvas loader (#1063).
 *
 * Isolates the dynamic import (and its type) behind one seam so the PNG
 * rasterizer stays off the initial mind-map chunk and no consumer repeats
 * the import dance. The caller owns error handling.
 */

/** Rasterizer signature, taken from the library's own default export type. */
export type Html2Canvas = typeof import('html2canvas').default;

/** Resolves the rasterizer, loading its chunk on first call. */
export const loadHtml2Canvas = async (): Promise<Html2Canvas> => {
  const htmlModule = (await import('html2canvas')) as unknown as {
    default: Html2Canvas;
  };
  return htmlModule.default;
};
