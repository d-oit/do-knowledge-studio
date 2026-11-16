/**
 * Text reads for paths computed at runtime.
 *
 * `security/detect-non-literal-fs-filename` is purely syntactic: it reports
 * every fs call whose first argument is not a static expression, and it does
 * not model path validation, containment or symlink checks. `readFileSync` is
 * therefore unusable for a path the caller names or a walk discovers, even
 * after the caller has validated it.
 *
 * Dynamic text reads live here so the blind spot stays in one reviewed place:
 * every caller keeps its own validation (shape, containment, symlink refusal)
 * and hands over an already-validated path. `openAsBlob` opens the file with
 * the same bytes-on-disk semantics and decodes it as UTF-8 in `text()`.
 */
import { openAsBlob } from 'node:fs'

/** @param {string} path Validated path to read as UTF-8 text. */
export const readTextFile = async (path) => (await openAsBlob(path)).text()
