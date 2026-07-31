/**
 * Transcript .md → Qdrant ingestion.
 *
 * Reads files from data/vlearn-pack/transcript/transcript-0X-clean.md,
 * parses each **[Txx-NNN]** block, drops student + activity turns
 * (per GOAL.md §3), chunks long turns, embeds, upserts.
 */

import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

import { embedTexts } from "@/lib/embeddings"
import {
  TRANSCRIPTS_COLLECTION,
  ensureCollections,
  isQdrantConfigured,
  upsertTranscriptTurns,
  type TranscriptTurnPayload,
} from "@/lib/qdrant"
import {
  chunkTurn,
  deckIdFromTranscriptFile,
  parseTranscriptMarkdown,
} from "@/lib/transcript-parser"

type IngestTranscriptsResult = {
  collection: string
  files: number
  turnsKept: number
  turnsDropped: number
  usedMockEmbeddings: number
}

const TRANSCRIPT_DIR_DEFAULT = "data/vlearn-pack/transcript"
const EMBEDDING_BATCH_SIZE = 20 // Process in small batches to avoid token limits

export async function ingestAllTranscripts(opts?: {
  dir?: string
}): Promise<IngestTranscriptsResult> {
  if (!isQdrantConfigured()) {
    throw new Error("Qdrant chưa cấu hình — kiểm tra QDRANT_URL / QDRANT_API_KEY trong .env.local")
  }

  const dir = opts?.dir ?? TRANSCRIPT_DIR_DEFAULT
  await ensureCollections()

  const files = (await readdir(dir)).filter((n) => n.endsWith("-clean.md")).sort()
  let kept = 0
  let dropped = 0
  let mockCount = 0

  for (const file of files) {
    const deckId = deckIdFromTranscriptFile(file)
    const md = await readFile(path.join(dir, file), "utf8")
    const turns = parseTranscriptMarkdown(md, deckId)

    const keptTurns = turns.filter((t) => t.speaker === "instructor")
    dropped += turns.length - keptTurns.length

    if (keptTurns.length === 0) continue

    const chunks: { id: string; text: string; page: number | null; blockId: string }[] = []
    for (const t of keptTurns) {
      const pieces = chunkTurn(t)
      pieces.forEach((text, i) => {
        chunks.push({
          id: `${t.blockId}-c${i}`,
          text,
          page: t.pageEst,
          blockId: t.blockId,
        })
      })
    }

    // Process in batches to avoid token limits
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
      try {
        const embeddings = await embedTexts(batch.map((c) => c.text))

        const payloads = batch.map((c, j) => {
          const e = embeddings[j]
          if (e.usedMock) mockCount++
          const payload: TranscriptTurnPayload = {
            deck_id: deckId,
            page: c.page,
            block_id: c.blockId,
            speaker: "instructor",
            text: c.text,
            source: "transcript",
          }
          return { id: c.id, vector: e.vector, payload }
        })

        await upsertTranscriptTurns(payloads)
        kept += batch.length
        console.log(`  [${file}] embedded ${i + batch.length}/${chunks.length} chunks`)
      } catch (err) {
        console.warn(`  [${file}] batch ${i} failed: ${err instanceof Error ? err.message : "unknown"}, skipping remaining batches`)
        break // Skip remaining batches for this file
      }
    }
  }

  return {
    collection: TRANSCRIPTS_COLLECTION,
    files: files.length,
    turnsKept: kept,
    turnsDropped: dropped,
    usedMockEmbeddings: mockCount,
  }
}
