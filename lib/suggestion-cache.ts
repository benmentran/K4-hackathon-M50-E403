/**
 * Shared suggestion cache — single module-level Map used by both:
 *   POST /api/track/idle  (writes)
 *   GET  /api/chat/suggestions (reads)
 *
 * In Next.js App Router, module scope is per-worker, which is fine for
 * a hackathon demo. Use Redis/KV in production.
 */

export type CachedSuggestion = { questions: string[]; generatedAt: number; citations?: number[] }

const _cache = new Map<string, CachedSuggestion>()

export const SUGGESTION_TTL_MS = 5 * 60 * 1000 // 5 minutes
export const DEBOUNCE_KEY_TTL_MS = 30 * 1000 // don't regenerate within 30s

const _debounce = new Map<string, number>()

export function cacheKey(deckId: string, page: number) {
  return `${deckId}::${page}`
}

export function isDebounced(key: string): boolean {
  const last = _debounce.get(key) ?? 0
  return Date.now() - last < DEBOUNCE_KEY_TTL_MS
}

export function markDebounced(key: string) {
  _debounce.set(key, Date.now())
}

export function getCached(key: string): CachedSuggestion | null {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.generatedAt > SUGGESTION_TTL_MS) {
    _cache.delete(key)
    return null
  }
  return entry
}

export function setCached(key: string, questions: string[], citations?: number[]) {
  _cache.set(key, { questions, generatedAt: Date.now(), citations })
}

export function deleteCached(key: string) {
  _cache.delete(key)
}
