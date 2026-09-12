import { makeT } from '../t'

/**
 * User-facing strings for the claims panel and rule-based claim extraction (N4).
 * All strings added here are typed via `makeT`.
 */
const messages = {
  'claims.title': 'Claims',
  'claims.count': (n: string) => `${n} ${n === '1' ? 'claim' : 'claims'}`,
  'claims.add': 'Add claim',
  'claims.empty':
    'No claims recorded for this entity yet. Capture a factual statement you can later verify, dispute, or cite.',
  'claims.verified': 'Verified',
  'claims.disputed': 'Disputed',
  'claims.unverified': 'Unverified',
  'claims.confidenceLabel': 'Confidence',
  'claims.statementLabel': 'Statement',
  'claims.editStatementLabel': 'Edit statement',
  'claims.statementPlaceholder': 'State a factual claim about this entity…',
  'claims.verificationLabel': 'Verification',
  'claims.sourceOptionalLabel': 'Source (optional)',
  'claims.sourcePlaceholder': 'Where did this claim come from? (URL, book, person…)',
  'claims.editLabel': 'Edit claim',
  'claims.edit': 'Edit',
  'claims.deleteLabel': 'Delete claim',
  'claims.delete': 'Delete',
  'claims.save': 'Save claim',
  'claims.update': 'Update claim',
  'claims.statementRequired': 'Claim statement is required',
  'claims.updated': 'Claim updated',
  'claims.deleted': 'Claim deleted',
  'claims.extract': 'Extract claims',
  'claims.extractTitle': 'Extract claims from note',
  'claims.extractBody':
    'Review the assertions found in this note. Confirm to add them as claims.',
  'claims.listStatement': 'Statement',
  'claims.listSource': 'Source',
  'claims.listNoSource': 'No source',
  'claims.confirm': (n: string) => `Add ${n} ${n === '1' ? 'claim' : 'claims'}`,
  'claims.cancel': 'Cancel',
  'claims.close': 'Close dialog',
  'claims.added': (n: string) => `Added ${n} ${n === '1' ? 'claim' : 'claims'}`,
  'claims.skipped': (n: string) => `Skipped ${n} ${n === '1' ? 'duplicate' : 'duplicates'}`,
  'claims.noneFound': 'No extractable assertions found in this note.',
} as const

export const translate = makeT(messages)