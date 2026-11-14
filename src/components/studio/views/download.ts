/**
 * Browser download helpers.
 *
 * Kept separate from `export-types.ts` so a consumer that only needs to save a
 * file does not pull in the export-format registry and its icon imports.
 */

/** Triggers a browser download for the given blob. */
export const downloadBlob = (filename: string, blob: Blob) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** Triggers a browser download for the given text content. */
export const downloadFile = (filename: string, content: string, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType })
  downloadBlob(filename, blob)
}
