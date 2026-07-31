/**
 * Slide PDF → Qdrant ingestion pipeline.
 *
 * Strategy:
 *   1. Extract text per page from PDF using pdfjs
 *   2. Merge all lines from same page into single chunk
 *   3. For overlap context: prepend previous page's last N chars + append next page's first N chars
 *   4. Embed page-level chunk → store in "slides" collection (1 vector per page)
 *   5. Retrieval: page window filter + optional merge of nearby pages
 *
 * Chunk config: TARGET_CHARS=1500, OVERLAP_CHARS=1000
 * Overlap means we extend each page's text with context from adjacent pages.
 */

import { embedTexts } from "@/lib/embeddings"
import {
  SLIDES_COLLECTION,
  ensureCollections,
  isQdrantConfigured,
  upsertSlideChunks,
  type SlideChunkPayload,
} from "@/lib/qdrant"

type PdfPageText = {
  page: number
  lines: string[]
}

type IngestResult = {
  collection: string
  pages: number
  chunks: number
  usedMockEmbeddings: number
}

const TARGET_CHARS = 1500
const OVERLAP_CHARS = 1000
const CONTEXT_OVERLAP = 300 // chars from prev/next page for context

export function getPageText(pages: PdfPageText[], pageNum: number): string {
  const p = pages.find((pg) => pg.page === pageNum)
  if (!p) return ""
  return p.lines.join(" ").replace(/\s+/g, " ").trim()
}

export function buildPageChunk(
  pages: PdfPageText[],
  pageNum: number,
  enableOverlap = true,
): string {
  const current = getPageText(pages, pageNum)
  if (!current) return ""

  if (!enableOverlap) return current.slice(0, TARGET_CHARS)

  // Prepend last N chars of previous page
  const prevText = getPageText(pages, pageNum - 1)
  const prevContext = prevText.slice(-CONTEXT_OVERLAP)

  // Append first N chars of next page
  const nextText = getPageText(pages, pageNum + 1)
  const nextContext = nextText.slice(0, CONTEXT_OVERLAP)

  // Full chunk with overlap context
  let chunk = `${prevContext ? `[Trang ${pageNum - 1}]: ${prevContext}...\n\n` : ""}${current}${nextContext ? `\n\n...[Trang ${pageNum + 1}]: ${nextContext}` : ""}`

  // Trim to target if too long
  if (chunk.length > TARGET_CHARS * 1.5) {
    chunk = chunk.slice(0, TARGET_CHARS)
  }

  return chunk
}

/**
 * Extract text per page from a PDF buffer.
 * Uses pdfjs-dist with Node.js built-in support.
 */
export async function extractPdfPages(buffer: ArrayBuffer | Uint8Array): Promise<PdfPageText[]> {
  // Use legacy build with proper worker setup for Node.js
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")

  const data = new Uint8Array(buffer instanceof Uint8Array ? buffer : buffer)

  const loadingTask = pdfjs.getDocument({ data })
  const doc = await loadingTask.promise

  const pages: PdfPageText[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()

    const rows = new Map<number, { x: number; text: string }[]>()
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const y = Math.round((item.transform?.[5] ?? 0) / 4)
      const row = rows.get(y) ?? []
      row.push({ x: item.transform?.[4] ?? 0, text: item.str })
      rows.set(y, row)
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((r) => r.text)
          .join(" "),
      )
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 1)

    pages.push({ page: pageNumber, lines })
    page.cleanup()
  }

  return pages
}

export async function ingestDeck(opts: {
  deckId: string
  pdfBuffer: ArrayBuffer | Uint8Array
  /** When true, call LLM to summarise each page. Off by default (cost). */
  enableSummaries?: boolean
}): Promise<IngestResult> {
  if (!isQdrantConfigured()) {
    throw new Error("Qdrant chưa cấu hình — kiểm tra QDRANT_URL / QDRANT_API_KEY trong .env.local")
  }

  // Ensure collections exist
  await ensureCollections()

  const pages = await extractPdfPages(opts.pdfBuffer)

  // Build page-level chunks (1 page = 1 vector with overlap context)
  type PageChunk = { page: number; text: string; summary?: string }
  const chunks: PageChunk[] = []

  for (const p of pages) {
    const text = buildPageChunk(pages, p.page, true)
    if (text) {
      chunks.push({ page: p.page, text })
    }
  }

  // Optional LLM summaries
  if (opts.enableSummaries && process.env.OPENROUTER_API_KEY) {
    for (const chunk of chunks) {
      try {
        const summary = await maybeSummarisePage(chunk.text)
        if (summary) chunk.summary = summary
      } catch {
        // best effort
      }
    }
  }

  if (chunks.length === 0) {
    return { collection: SLIDES_COLLECTION, pages: pages.length, chunks: 0, usedMockEmbeddings: 0 }
  }

  // Embed all chunks
  const embedInputs = chunks.map((c) =>
    c.summary ? `${c.summary}\n\n${c.text}` : c.text,
  )
  const embeddings = await embedTexts(embedInputs)

  let mockCount = 0
  const payloads = chunks.map((c, i) => {
    const e = embeddings[i]
    if (e.usedMock) mockCount++
    return {
      page: c.page,
      text: c.text.slice(0, 2000), // Store truncated for payload
      vector: e.vector,
      slideSummary: c.summary,
    }
  })

  await upsertSlideChunks(opts.deckId, payloads)

  return {
    collection: SLIDES_COLLECTION,
    pages: pages.length,
    chunks: chunks.length,
    usedMockEmbeddings: mockCount,
  }
}

async function maybeSummarisePage(text: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": "VLearn Ingest",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content:
              "Tóm tắt slide dưới 1 câu tiếng Việt (≤ 25 từ), giữ các thuật ngữ quan trọng. Trả về DUY NHẤT câu tóm tắt, không tiền tố, không giải thích.",
          },
          { role: "user", content: text.slice(0, 1200) },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}
