/**
 * dks-core: framework-neutral Knowledge Studio domain services shared by the
 * `dks` CLI, the optional MCP adapter, and the PWA (via re-export facades).
 * This module is the single public surface of the core; it imports no React,
 * Next.js, or MCP SDK types.
 */

export {
  parseFrontmatter,
  splitFrontmatter,
  type FmResult,
  type FmValue,
} from './frontmatter.js'
export {
  deriveTrustTier,
  extractClaimLines,
  isSafePath,
  parseBundleFiles,
  parseConcept,
  parseIndexFrontmatterVersion,
  parseIndexVersion,
  parseOkfImportBundle,
  type ClaimLine,
  type ImportedClaimLike,
  type ImportedEntityLike,
  type OkfImportServiceResult,
} from './okf-parse.js'
export { LibraryIndex, DEFAULT_LIMIT, type SearchHit } from './library-index.js'
export {
  checkVaultLimits,
  isMarkdownPath,
  MAX_MARKDOWN_FILES,
  MAX_MARKDOWN_FILE_BYTES,
  MAX_MARKDOWN_TOTAL_BYTES,
  MARKDOWN_EXTENSIONS,
  parseMarkdownBundle,
  parseMarkdownImport,
  slug,
  stripMarkdownExtension,
  scanMarkdownLinks,
  type MarkdownLinkSpans,
  type MarkdownImportDraft,
  type MarkdownImportResult,
  type MarkdownImportServiceResult,
  type RelativeLinkSpan,
  type WikiLinkSpan,
} from './markdown.js'
export {
  buildOkfBundle,
  type CoreExportClaim,
  type CoreExportEdge,
  type CoreExportEntity,
  type OkfBundle,
  type OkfBundleFile,
} from './okf-export.js'
export { buildMarkdownExport, type MarkdownExportFile } from './markdown-export.js'
export {
  search as pwaSearch,
  getEntityMap as pwaGetEntityMap,
  resetSearchCache as pwaResetSearchCache,
  MAX_CACHE_ENTRIES,
  type FilterableDoc,
  type PwaClaimLike,
  type PwaEntityLike,
  type SearchFilter,
  type SearchResult,
} from './pwa-retrieval.js'
export {
  buildUndirectedAdjacency,
  findShortestPath,
  pathEdgeKeys,
  pathNodeNames,
  undirectedEdgeKey,
  type GraphPathResult,
  type PathEdge,
  type PathHop,
  type PwaGraphEntityLike,
} from './graph-path.js'
export {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_FILE_PATHS,
  BACKUP_KDF_ITERATIONS,
  MIN_SUPPORTED_SCHEMA_VERSION,
  verifyBackupArchive,
  type BackupErrorCode,
  type BackupFailure,
  type BackupVerifyResult,
  type VerifiedBackupSummary,
} from './backup.js'
export type {
  BundleClaim,
  BundleConcept,
  BundleSource,
  CoreClaim,
  CoreEntity,
  LoadedBundle,
  TrustTier,
} from './types.js'
export {
  EXPORT_PREFIX,
  MAX_BUNDLE_ENTRIES,
  MAX_BUNDLE_UNCOMPRESSED_BYTES,
  MAX_BUNDLE_ZIP_BYTES,
  MAX_CONCEPT_BYTES,
  SUPPORTED_OKF_MAJOR,
} from './types.js'
export { loadBundleFromDisk } from './bundle-load.js'
export {
  type DirEntry,
  type FsPort,
  type FsWriterPort,
} from './io.js'
