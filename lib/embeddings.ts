/**
 * Embeddings via OpenRouter.
 * Uses text-embedding-3-small compatible model via OpenRouter.
 * Falls back to deterministic mock vectors when OPENROUTER_API_KEY is missing.
 */

const EMBEDDING_MODEL = "openai/text-embedding-3-small"
const VECTOR_SIZE = 1536

type EmbeddingResult = {
  vector: number[]
  model: string
  usedMock: boolean
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return texts.map((t) => ({
      vector: mockVector(t),
      model: "mock-fnv",
      usedMock: true,
    }))
  }

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map((t) => t.slice(0, 8000)),
    }),
  })

  if (!res.ok) {
    // Fallback to mock on auth/billing errors
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      console.warn(`[embeddings] OpenRouter ${res.status} — falling back to mock vectors`)
      return texts.map((t) => ({
        vector: mockVector(t),
        model: "mock-fnv",
        usedMock: true,
      }))
    }
    const errText = await res.text().catch(() => "")
    throw new Error(`OpenRouter embeddings ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { data: { embedding: number[]; index: number }[] }
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => ({ vector: d.embedding, model: EMBEDDING_MODEL, usedMock: false }))
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const [r] = await embedTexts([text])
  return r
}

/**
 * Deterministic mock embedding: hashed bag-of-words projected to VECTOR_SIZE.
 * Quality is intentionally poor — only for dev without an API key. The RAG
 * pipeline will still retrieve something, but cosine similarity scores will
 * be much weaker than OpenAI's.
 */
function mockVector(text: string): number[] {
  const v = new Float32Array(VECTOR_SIZE)
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean)
  for (const tok of tokens) {
    let h = 0x811c9dc5
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    const idx = h % VECTOR_SIZE
    v[idx] += 1
    const idx2 = (h ^ 0x9e3779b9) % VECTOR_SIZE
    v[idx2] += 0.5
  }
  // L2 normalise to mimic cosine-friendly vectors
  let norm = 0
  for (let i = 0; i < VECTOR_SIZE; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm) || 1
  const out = new Array(VECTOR_SIZE)
  for (let i = 0; i < VECTOR_SIZE; i++) out[i] = v[i] / norm
  return out
}

export const EMBEDDING_DIM = VECTOR_SIZE
