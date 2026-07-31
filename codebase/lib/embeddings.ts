/**
 * Embeddings via Mistral (primary) or OpenRouter (fallback).
 * Falls back to deterministic mock vectors when no API key is available.
 *
 * Vector dimensions:
 *   - Mistral: 1024d → padded to 1536d for Qdrant
 *   - OpenRouter: 1536d
 *   - Mock: 1536d
 */

const MISTRAL_EMBED_MODEL = "mistral-embed"
const OPENROUTER_EMBED_MODEL = "openai/text-embedding-3-small"
const VECTOR_SIZE = 1536

type EmbeddingResult = {
  vector: number[]
  model: string
  usedMock: boolean
}

/** Pad 1024d Mistral vectors to 1536d for Qdrant compatibility */
function padTo1536(vector: number[]): number[] {
  if (vector.length === VECTOR_SIZE) return vector
  const padded = new Array(VECTOR_SIZE).fill(0)
  for (let i = 0; i < vector.length; i++) {
    padded[i] = vector[i]
  }
  return padded
}

export async function embedTexts(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  // Try Mistral first (primary) - uses "input" (singular), returns 1024d
  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    try {
      const res = await fetch("https://api.mistral.ai/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mistralKey}`,
        },
        body: JSON.stringify({
          model: MISTRAL_EMBED_MODEL,
          input: texts.map((t) => t.slice(0, 8000)), // Mistral uses "input", not "inputs"
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { data: { embedding: number[]; index: number }[] }
        return data.data
          .sort((a, b) => a.index - b.index)
          .map((d) => ({
            vector: padTo1536(d.embedding),
            model: MISTRAL_EMBED_MODEL,
            usedMock: false,
          }))
      }
      const errText = await res.text().catch(() => "")
      console.warn(`[embeddings] Mistral ${res.status}: ${errText.slice(0, 100)}`)
    } catch (err) {
      console.warn("[embeddings] Mistral failed:", err)
    }
  }

  // Try OpenRouter as fallback
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: OPENROUTER_EMBED_MODEL,
          input: texts.map((t) => t.slice(0, 8000)),
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { data: { embedding: number[]; index: number }[] }
        return data.data
          .sort((a, b) => a.index - b.index)
          .map((d) => ({ vector: d.embedding, model: OPENROUTER_EMBED_MODEL, usedMock: false }))
      }
      const errText = await res.text().catch(() => "")
      console.warn(`[embeddings] OpenRouter ${res.status}: ${errText.slice(0, 100)}`)
    } catch (err) {
      console.warn("[embeddings] OpenRouter failed:", err)
    }
  }

  // Fallback to mock vectors
  console.warn("[embeddings] No API keys available — using mock vectors")
  return texts.map((t) => ({
    vector: mockVector(t),
    model: "mock-fnv",
    usedMock: true,
  }))
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
