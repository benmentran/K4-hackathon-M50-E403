#!/usr/bin/env node
/**
 * scripts/ingest-builtin.ts — chạy 1 lần để ingest 2 built-in PDF + 6 transcript.
 *
 * Usage:
 *   node --loader ts-node/esm scripts/ingest-builtin.ts
 * hoặc: npx ts-node scripts/ingest-builtin.ts
 *
 * Prerequisites:
 *   1. Qdrant Cloud cluster + paste URL + API key vào .env.local
 *   2. OPENAI_API_KEY hoặc OPENROUTER_API_KEY trong .env.local
 *   3. npm install @qdrant/js-client-rest openai dotenv
 */

import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"

// Load .env.local manually (no top-level await needed)
function loadEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: ".env.local" })
  } catch { /* ignore */ }
}
loadEnv()

import {
  isQdrantConfigured,
  deleteDeckSlides,
} from "../lib/qdrant"
import { ingestDeck } from "../lib/ingest-deck"
import { ingestAllTranscripts } from "../lib/ingest-transcripts"

const SLIDE_DIR = "data/vlearn-pack/slides"
const TRANSCRIPT_DIR = "data/vlearn-pack/transcript"

async function ingestBuiltinSlides() {
  console.log("\n📄 Ingesting built-in slides...")
  const files = (await readdir(SLIDE_DIR)).filter((n) => n.endsWith(".pdf"))

  // deckId mapping mirrors lib/builtin-decks.ts
  const DECK_MAP: Record<string, string> = {
    "d1-slide-hackathon.pdf": "day-1-ai-llm-foundation",
    "d2-slide-hackathon.pdf": "day-2-ai-problem-framing",
  }

  for (const file of files) {
    const deckId = DECK_MAP[file]
    if (!deckId) {
      console.log(`  ⚠️  Unknown file ${file} — skipping`)
      continue
    }

    const filePath = path.join(SLIDE_DIR, file)
    const stats = await stat(filePath)
    console.log(`  [${deckId}] ${file} (${(stats.size / 1024).toFixed(0)} KB)...`)

    try {
      // Re-ingest: delete old slides first so we get a clean slate.
      await deleteDeckSlides(deckId)
      const buf = await readFile(filePath)
      const result = await ingestDeck({
        deckId,
        pdfBuffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        enableSummaries: Boolean(process.env.ENABLE_LLM_SUMMARY),
      })
      console.log(
        `  ✅  collection=${result.collection} pages=${result.pages} chunks=${result.chunks}` +
          (result.usedMockEmbeddings > 0 ? ` [MOCK embeddings=${result.usedMockEmbeddings}]` : ""),
      )
    } catch (err) {
      console.error(`  ❌  Failed to ingest ${deckId}:`, err)
    }
  }
}

async function ingestTranscripts() {
  console.log("\n🎤 Ingesting transcripts...")
  if (!isQdrantConfigured()) {
    console.log("  ⏭️  Qdrant not configured — skipping transcripts")
    return
  }
  try {
    const result = await ingestAllTranscripts({ dir: TRANSCRIPT_DIR })
    console.log(
      `  ✅  collection=${result.collection} files=${result.files}` +
        ` turns_kept=${result.turnsKept} dropped=${result.turnsDropped}` +
        (result.usedMockEmbeddings > 0 ? ` [MOCK embeddings=${result.usedMockEmbeddings}]` : ""),
    )
  } catch (err) {
    console.error("  ❌  Transcript ingest failed:", err)
  }
}

async function main() {
  console.log("==========================================")
  console.log(" VLearn RAG Ingest — built-in content")
  console.log("==========================================")

  if (!isQdrantConfigured()) {
    console.error(
      "❌ QDRANT_URL / QDRANT_API_KEY chưa đặt.\n" +
        "   Tạo cluster tại https://cloud.qdrant.io, rồi paste vào .env.local.",
    )
    process.exit(1)
  }

  const hasEmbeddingKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY
  if (!hasEmbeddingKey) {
    console.warn(
      "⚠️  OPENAI_API_KEY / OPENROUTER_API_KEY chưa đặt.\n" +
        "   Sẽ dùng mock embeddings (RAG sẽ kém).\n" +
        "   Paste OpenAI key vào .env.local để có embeddings thật.",
    )
  }

  await ingestBuiltinSlides()
  await ingestTranscripts()

  console.log("\n✅ Ingest hoàn tất.")
  console.log("   Khởi động lại dev server: npm run dev")
  console.log("   Sau đó mở http://localhost:3000 và thử chat.")
}

main().catch((err) => {
  console.error("Unexpected error:", err)
  process.exit(1)
})
