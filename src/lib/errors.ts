export enum ErrorCode {
  /** Entity CRUD failures */
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  ENTITY_CREATE_FAILED = 'ENTITY_CREATE_FAILED',
  ENTITY_UPDATE_FAILED = 'ENTITY_UPDATE_FAILED',
  ENTITY_DELETE_FAILED = 'ENTITY_DELETE_FAILED',

  /** Claim CRUD failures */
  CLAIM_NOT_FOUND = 'CLAIM_NOT_FOUND',
  CLAIM_CREATE_FAILED = 'CLAIM_CREATE_FAILED',
  CLAIM_UPDATE_FAILED = 'CLAIM_UPDATE_FAILED',
  CLAIM_DELETE_FAILED = 'CLAIM_DELETE_FAILED',

  /** Import/export failures */
  IMPORT_INVALID_JSON = 'IMPORT_INVALID_JSON',
  IMPORT_INVALID_PAYLOAD = 'IMPORT_INVALID_PAYLOAD',
  IMPORT_EMPTY_ENTITIES = 'IMPORT_EMPTY_ENTITIES',
  IMPORT_ORPHANED_CLAIMS = 'IMPORT_ORPHANED_CLAIMS',
  EXPORT_FAILED = 'EXPORT_FAILED',

  /** Storage failures */
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',

  /** Search failures */
  SEARCH_FAILED = 'SEARCH_FAILED',

  /** AI provider failures */
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_PROVIDER_TIMEOUT = 'AI_PROVIDER_TIMEOUT',
  AI_PROVIDER_RATE_LIMITED = 'AI_PROVIDER_RATE_LIMITED',

  /** Generic fallback */
  UNKNOWN = 'UNKNOWN',
}

const USER_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.ENTITY_NOT_FOUND]: 'The requested entity could not be found.',
  [ErrorCode.ENTITY_CREATE_FAILED]: 'Could not create the entity. Please try again.',
  [ErrorCode.ENTITY_UPDATE_FAILED]: 'Could not save your changes. Please try again.',
  [ErrorCode.ENTITY_DELETE_FAILED]: 'Could not delete the entity. Please try again.',
  [ErrorCode.CLAIM_NOT_FOUND]: 'The requested claim could not be found.',
  [ErrorCode.CLAIM_CREATE_FAILED]: 'Could not create the claim. Please try again.',
  [ErrorCode.CLAIM_UPDATE_FAILED]: 'Could not save the claim. Please try again.',
  [ErrorCode.CLAIM_DELETE_FAILED]: 'Could not delete the claim. Please try again.',
  [ErrorCode.IMPORT_INVALID_JSON]: 'The file is not valid JSON.',
  [ErrorCode.IMPORT_INVALID_PAYLOAD]: 'The file format is invalid or corrupted.',
  [ErrorCode.IMPORT_EMPTY_ENTITIES]: 'No valid entities were found in the file.',
  [ErrorCode.IMPORT_ORPHANED_CLAIMS]: 'The file contains claims that reference missing entities.',
  [ErrorCode.EXPORT_FAILED]: 'Export failed. Please try again.',
  [ErrorCode.STORAGE_READ_FAILED]: 'Could not load your data. Storage may be corrupted.',
  [ErrorCode.STORAGE_WRITE_FAILED]: 'Could not save your data. Storage may be full.',
  [ErrorCode.SEARCH_FAILED]: 'Search encountered an error. Please try again.',
  [ErrorCode.AI_PROVIDER_ERROR]: 'The AI provider returned an error. Please try again.',
  [ErrorCode.AI_PROVIDER_TIMEOUT]: 'The AI provider timed out. Please try again.',
  [ErrorCode.AI_PROVIDER_RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.UNKNOWN]: 'An unexpected error occurred.',
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly userMessage: string

  constructor(
    code: ErrorCode,
    message?: string,
    options?: ErrorOptions,
  ) {
    super(message ?? USER_MESSAGES[code], options)
    this.name = 'AppError'
    this.code = code
    this.userMessage = USER_MESSAGES[code]
  }
}
