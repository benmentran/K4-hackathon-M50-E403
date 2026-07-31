/**
 * RAG pipeline: retrieve context + build LLM prompt.
 *
 * Per GOAL.md architecture:
 *   1. embed the user's question
 *   2. search Qdrant slides  (primary context)  — filtered by current slide_page
 *   3. search Qdrant transcripts (supplementary) — window ±3 pages around slide
 *   4. return formatted context strings ready to inject into a system/user prompt
 *
 * We intentionally do NOT merge slide + transcript into one retrieval call.
 * The two collections have different chunk semantics (page-anchored vs free-form
 * narration) and different payload shapes, so querying separately gives the
 * caller more control over how much context is used.
 */

import { embedText } from "@/lib/embeddings"
import {
  isQdrantConfigured,
  searchSlides,
  searchTranscripts,
  type SlideChunkPayload,
  type TranscriptTurnPayload,
} from "@/lib/qdrant"

export type SlideContext = {
  page: number
  text: string
  score: number
  isSummary: boolean
}

export type TranscriptContext = {
  blockId: string
  page: number | null
  text: string
  score: number
}

export type RagRetrieval = {
  slides: SlideContext[]
  transcripts: TranscriptContext[]
  usedMockEmbeddings: boolean
  qdrantConfigured: boolean
}

export type RagPromptParts = {
  slideContext: string
  transcriptContext: string
  citationPages: number[]
}

const MAX_SLIDE_CHUNKS = 5
const MAX_TRANSCRIPT_CHUNKS = 3
const SLIDE_WINDOW = 2 // ±2 pages around current slide
const TRANSCRIPT_WINDOW = 3 // ±3 pages

export async function retrieveRagContext(opts: {
  deckId: string
  question: string
  currentPage?: number | null
}): Promise<RagRetrieval> {
  if (!isQdrantConfigured()) {
    return {
      slides: [],
      transcripts: [],
      usedMockEmbeddings: false,
      qdrantConfigured: false,
    }
  }

  const { vector, usedMock } = await embedText(opts.question)

  const [slideResults, transcriptResults] = await Promise.all([
    searchSlides({
      deckId: opts.deckId,
      vector,
      page: opts.currentPage ?? undefined,
      pageWindow: opts.currentPage != null ? SLIDE_WINDOW : undefined,
      limit: MAX_SLIDE_CHUNKS,
    }),
    searchTranscripts({
      deckId: opts.deckId,
      vector,
      page: opts.currentPage ?? undefined,
      limit: MAX_TRANSCRIPT_CHUNKS,
    }),
  ])

  const slides: SlideContext[] = slideResults.map((r) => ({
    page: r.payload.page,
    text: r.payload.slide_summary
      ? `${r.payload.slide_summary}\n\n${r.payload.text}`
      : r.payload.text,
    score: r.score,
    isSummary: Boolean(r.payload.slide_summary),
  }))

  const transcripts: TranscriptContext[] = transcriptResults.map((r) => ({
    blockId: r.payload.block_id,
    page: r.payload.page,
    text: r.payload.text,
    score: r.score,
  }))

  return { slides, transcripts, usedMockEmbeddings: usedMock, qdrantConfigured: true }
}

/**
 * Formats retrieved chunks into prompt-ready strings.
 * Slide context is primary (GOAL.md §1), transcript is supplementary.
 */
export function buildRagPrompt(retrieved: RagRetrieval): RagPromptParts {
  const citationPages = new Set<number>()

  const slideContext = retrieved.slides
    .map((s, i) => {
      citationPages.add(s.page)
      return `[Slide ${s.page}${s.isSummary ? " (tóm tắt)" : ""}]\n${s.text}`
    })
    .join("\n\n")

  const transcriptContext = retrieved.transcripts
    .map((t, i) => {
      if (t.page != null) citationPages.add(t.page)
      const pageHint = t.page ? ` (phút ~slide ${t.page})` : ""
      return `[Trans${pageHint}]\n${t.text}`
    })
    .join("\n\n")

  return {
    slideContext: slideContext || "(không tìm thấy ngữ cảnh từ slide)",
    transcriptContext: transcriptContext || "",
    citationPages: [...citationPages].sort((a, b) => a - b),
  }
}
