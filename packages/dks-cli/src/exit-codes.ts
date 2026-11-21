/**
 * Process exit codes for the `dks` CLI envelope contract (#1171).
 *
 * `0` success · `2` usage/validation · `3` not-found · `4` conflict ·
 * `5` io · `6` permission · `7` internal. Exit code `1` is never used so
 * that shell pipelines can tell "dks failed" (>=2) from "no exit code at
 * all" (killed, or `1` from an unrelated tool).
 */

/** Command produced its envelope. */
export const EXIT_OK = 0
/** Arguments/flags/command names could not be validated. */
export const EXIT_USAGE = 2
/** Requested corpus object (bundle, entity, skill, archive) is absent. */
export const EXIT_NOT_FOUND = 3
/** Requested action conflicts with verified state (e.g. tampered backup). */
export const EXIT_CONFLICT = 4
/** Underlying read failed: malformed bundle, unreadable stream. */
export const EXIT_IO = 5
/** OS refused the read, or an archive demands an unavailable passphrase. */
export const EXIT_PERMISSION = 6
/** Unexpected internal error (bug, missing engine capability). */
export const EXIT_INTERNAL = 7
