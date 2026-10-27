const MANAGEMENT_PATH = '/packages/management/pages/index/index?view=phrases'

export function buildSavedPhraseManagementUrl(lifeContext: string | null): string {
  return MANAGEMENT_PATH + (lifeContext === null
    ? ''
    : `&lifeContext=${encodeURIComponent(lifeContext)}`)
}

export function readSavedPhraseLifeContext(value?: string): string | null {
  // WeChat passes the encoded query through useRouter. Decode at this boundary
  // once: a literal "%20" category must not become a space. Missing and empty
  // parameters mean "all" and "uncategorized" respectively.
  if (value === undefined) return null
  try {
    return decodeURIComponent(value)
  } catch (_) {
    // Preserve malformed/legacy text instead of crashing or widening to "all".
    return value
  }
}
