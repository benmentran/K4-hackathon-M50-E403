/**
 * Qdrant Cloud client + collection helpers.
 *
 * Collections:
 *   - slides        : text from PDF slides (page-merged chunks), payload { deck_id, page, text, source="slide" }
 *   - transcripts   : instructor/student utterances, payload { deck_id, page, block_id, text, source="transcript" }
 *
 * Vectors use OpenAI text-embedding-3-small (1536 dims) via OpenRouter.
 *
 * Per GOAL.md: "page_number" is the canonical join key. We also keep deck_id
 * to scope queries to a single deck.
 */

import { QdrantClient } from "@qdrant/js-client-rest"

const VECTOR_SIZE = 1536 // text-embedding-3-small
const DISTANCE = "Cosine"

let _client: QdrantClient | null = null

export function getQdrant(): QdrantClient {
  if (_client) return _client
  const url = process.env.QDRANT_URL
  const apiKey = process.env.QDRANT_API_KEY
  if (!url) {
    throw new Error("QDRANT_URL chưa đặt — xem .env.local")
  }
  if (!apiKey) {
    throw new Error("QDRANT_API_KEY chưa đặt — xem .env.local")
  }
  _client = new QdrantClient({ url, apiKey, checkCompatibility: false })
  return _client
}

export function isQdrantConfigured(): boolean {
  return Boolean(process.env.QDRANT_URL && process.env.QDRANT_API_KEY)
}

// Fixed collection names
export const SLIDES_COLLECTION = "slides"
export const TRANSCRIPTS_COLLECTION = "transcripts"

export async function ensureCollections(): Promise<void> {
  const client = getQdrant()

  // Ensure slides collection
  if (!(await client.collectionExists(SLIDES_COLLECTION))) {
    await client.createCollection(SLIDES_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE },
      optimizers_config: { default_segment_number: 2 },
    })
    await client.createPayloadIndex(SLIDES_COLLECTION, {
      field_name: "page",
      field_schema: "integer",
    })
    await client.createPayloadIndex(SLIDES_COLLECTION, {
      field_name: "deck_id",
      field_schema: "keyword",
    })
    console.log(`[qdrant] Created collection: ${SLIDES_COLLECTION}`)
  }

  // Ensure transcripts collection
  if (!(await client.collectionExists(TRANSCRIPTS_COLLECTION))) {
    await client.createCollection(TRANSCRIPTS_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: DISTANCE },
      optimizers_config: { default_segment_number: 2 },
    })
    await client.createPayloadIndex(TRANSCRIPTS_COLLECTION, {
      field_name: "page",
      field_schema: "integer",
    })
    await client.createPayloadIndex(TRANSCRIPTS_COLLECTION, {
      field_name: "deck_id",
      field_schema: "keyword",
    })
    await client.createPayloadIndex(TRANSCRIPTS_COLLECTION, {
      field_name: "speaker",
      field_schema: "keyword",
    })
    console.log(`[qdrant] Created collection: ${TRANSCRIPTS_COLLECTION}`)
  }
}

export type SlideChunkPayload = {
  deck_id: string
  page: number
  text: string
  source: "slide"
  slide_summary?: string
}

export type TranscriptTurnPayload = {
  deck_id: string
  page: number | null
  block_id: string
  speaker: "instructor" | "student" | "activity"
  text: string
  source: "transcript"
}

export async function upsertSlideChunk(
  deckId: string,
  page: number,
  text: string,
  vector: number[],
  slideSummary?: string,
): Promise<void> {
  const client = getQdrant()
  const payload: SlideChunkPayload = {
    deck_id: deckId,
    page,
    text,
    source: "slide",
  }
  if (slideSummary) payload.slide_summary = slideSummary

  await client.upsert(SLIDES_COLLECTION, {
    wait: true,
    points: [
      {
        id: hashId(`${deckId}-${page}`),
        vector,
        payload,
      },
    ],
  })
}

export async function upsertSlideChunks(
  deckId: string,
  payloads: { page: number; text: string; vector: number[]; slideSummary?: string }[],
): Promise<void> {
  if (payloads.length === 0) return
  const client = getQdrant()
  await client.upsert(SLIDES_COLLECTION, {
    wait: true,
    points: payloads.map((p) => ({
      id: hashId(`${deckId}-${p.page}`),
      vector: p.vector,
      payload: {
        deck_id: deckId,
        page: p.page,
        text: p.text,
        source: "slide",
        ...(p.slideSummary ? { slide_summary: p.slideSummary } : {}),
      } satisfies SlideChunkPayload,
    })),
  })
}

export async function upsertTranscriptTurns(
  payloads: { id: string; vector: number[]; payload: TranscriptTurnPayload }[],
): Promise<void> {
  if (payloads.length === 0) return
  const client = getQdrant()
  await client.upsert(TRANSCRIPTS_COLLECTION, {
    wait: true,
    points: payloads.map((p) => ({
      id: hashId(p.id),
      vector: p.vector,
      payload: p.payload,
    })),
  })
}

export async function searchSlides(opts: {
  deckId: string
  vector: number[]
  page?: number | null
  /** Page window for retrieval (default: 2 pages before/after) */
  pageWindow?: number
  limit?: number
}): Promise<{ id: string | number; score: number; payload: SlideChunkPayload }[]> {
  const limit = opts.limit ?? 3
  const client = getQdrant()

  const must: unknown[] = [{ key: "deck_id", match: { value: opts.deckId } }]
  if (typeof opts.page === "number") {
    const win = opts.pageWindow ?? 2
    must.push({
      key: "page",
      range: { gte: Math.max(1, opts.page - win), lte: opts.page + win },
    })
  }

  const res = await client.search(SLIDES_COLLECTION, {
    vector: opts.vector,
    limit,
    with_payload: true,
    filter: { must },
  })

  return res.map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload as unknown as SlideChunkPayload,
  }))
}

export async function searchTranscripts(opts: {
  vector: number[]
  page?: number | null
  deckId?: string
  limit?: number
}): Promise<{ id: string | number; score: number; payload: TranscriptTurnPayload }[]> {
  const limit = opts.limit ?? 5
  const client = getQdrant()
  const must: unknown[] = []
  if (opts.deckId) {
    must.push({ key: "deck_id", match: { value: opts.deckId } })
  }
  if (typeof opts.page === "number") {
    must.push({
      key: "page",
      range: { gte: Math.max(1, opts.page - 3), lte: opts.page + 3 },
    })
  }

  const res = await client.search(TRANSCRIPTS_COLLECTION, {
    vector: opts.vector,
    limit,
    with_payload: true,
    filter: must.length ? { must } : undefined,
  })

  return res.map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload as unknown as TranscriptTurnPayload,
  }))
}

export async function deleteDeckSlides(deckId: string): Promise<void> {
  const client = getQdrant()
  await client.delete(SLIDES_COLLECTION, {
    filter: { must: [{ key: "deck_id", match: { value: deckId } }] },
  })
}

export async function deleteDeckTranscripts(deckId: string): Promise<void> {
  const client = getQdrant()
  await client.delete(TRANSCRIPTS_COLLECTION, {
    filter: { must: [{ key: "deck_id", match: { value: deckId } }] },
  })
}

/** FNV-1a 32-bit — stable id for Qdrant unsigned-integer ids. */
function hashId(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return (h || 1) >>> 0
}
