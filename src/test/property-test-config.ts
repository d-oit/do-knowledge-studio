const NORMAL_PROPERTY_RUNS = 100
const NIGHTLY_PROPERTY_RUNS = 2_000
const NORMAL_PROPERTY_TIMEOUT_MS = 15_000
const NIGHTLY_PROPERTY_TIMEOUT_MS = 120_000
const DEFAULT_FAST_CHECK_SEED = 1_062_2026
const PROFILE_ENVIRONMENT_VARIABLE = 'FAST_CHECK_PROFILE'
const SEED_ENVIRONMENT_VARIABLE = 'FAST_CHECK_SEED'
const PATH_ENVIRONMENT_VARIABLE = 'FAST_CHECK_PATH'

type PropertyProfile = 'normal' | 'nightly'

const readPropertyProfile = (): PropertyProfile => {
  const profile = process.env[PROFILE_ENVIRONMENT_VARIABLE]
  if (profile === undefined || profile === 'normal') return 'normal'
  if (profile === 'nightly') return 'nightly'
  throw new Error(`Unsupported ${PROFILE_ENVIRONMENT_VARIABLE}: ${profile}`)
}

const readFastCheckSeed = (): number => {
  const configuredSeed = process.env[SEED_ENVIRONMENT_VARIABLE]
  if (configuredSeed === undefined) return DEFAULT_FAST_CHECK_SEED
  const seed = Number(configuredSeed)
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`${SEED_ENVIRONMENT_VARIABLE} must be a safe integer`)
  }
  return seed
}

const PROPERTY_PROFILE = readPropertyProfile()

/** Shared fast-check defaults; failing output includes the seed and shrink path. */
export const getPropertyTestParameters = () => ({
  numRuns: PROPERTY_PROFILE === 'nightly' ? NIGHTLY_PROPERTY_RUNS : NORMAL_PROPERTY_RUNS,
  seed: readFastCheckSeed(),
  path: process.env[PATH_ENVIRONMENT_VARIABLE] || undefined,
  verbose: 2 as const,
})

/** Vitest test timeout matched to the selected property profile. */
export const getPropertyTestTimeoutMs = (): number =>
  PROPERTY_PROFILE === 'nightly' ? NIGHTLY_PROPERTY_TIMEOUT_MS : NORMAL_PROPERTY_TIMEOUT_MS
