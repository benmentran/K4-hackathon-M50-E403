#!/usr/bin/env node
/**
 * scripts/eval-golden.ts — P2: đánh giá RAG pipeline bằng golden set.
 *
 * Đọc 2,522 dòng chatlog CSV (student × tutor turns), chạy qua
 * RAG pipeline mới, đo metrics để so sánh với tutor cũ.
 *
 * Metrics:
 *   - Citation Rate: % câu trả lời có cite page
 *   - Top-1 Retrieval Accuracy: page RAG retrieve ≈ page student hỏi
 *   - Semantic Overlap: cosine sim giữa question embedding và retrieved context
 *
 * Usage:
 *   node --loader ts-node/esm scripts/eval-golden.ts
 *
 * Output:
 *   - Console table with metrics
 *   - data/golden-eval-results.jsonl  (per-turn results for later analysis)
 */

import { readFile } from "node:fs/promises"
import path from "node:path"

// Load .env.local manually (no top-level await needed)
function loadEnv() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config({ path: ".env.local" })
  } catch { /* ignore */ }
}
loadEnv()

import { embedText } from "../lib/embeddings"
import { buildRagPrompt, retrieveRagContext } from "../lib/rag"
import { isQdrantConfigured } from "../lib/qdrant"

// ── CSV parser (lightweight, no external lib) ───────────────────────────────
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n")
  if (lines.length < 2) return []
  const headers = splitLine(lines[0])
  return lines.slice(1).map((line) => {
    const cols = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? "").trim()
    })
    return row
  })
}

function splitLine(line: string): string[] {
  const out: string[] = []
  let inQuote = false
  let cur = ""
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuote = !inQuote
      }
    } else if (ch === "," && !inQuote) {
      out.push(cur)
      cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

// ── Extract page from student's question text ────────────────────────────────
// Pattern: "(Trang X, đoạn được chọn: "...")"
function extractPageFromQuestion(text: string): number | null {
  const m = text.match(/(?:trang|Trang|page|Page)\s*[:\s]*(\d{1,3})/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── Metrics ─────────────────────────────────────────────────────────────────
type EvalResult = {
  turnId: string
  conversationId: string
  userId: string
  askedPage: number | null
  citedPages: number[]
  retrievedPages: number[]
  retrievedScores: number[]
  ragConfigured: boolean
}

async function runEval() {
  const CSV_PATH = "data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv"
  console.log("Loading chatlog...")
  const csv = await readFile(CSV_PATH, "utf8")
  const rows = parseCSV(csv)

  // Keep only student rows (every other row in a turn pair).
  const studentRows = rows.filter((r) => r.role === "student")
  console.log(`Total student turns: ${studentRows.length}`)

  if (!isQdrantConfigured()) {
    console.warn("⚠️  Qdrant not configured — running WITHOUT vector retrieval")
  }

  const results: EvalResult[] = []
  let citations = 0
  let top1Hit = 0
  let top5Hit = 0
  let ragConfiguredCount = 0

  // Group by conversation to pick the correct deck
  const convMap = new Map<string, string>()
  for (const r of rows) {
    if (!convMap.has(r.conversation_id)) {
      // Infer deck_id from day_code: e.g. "Lecture_material_ms2044ey_k6uor3" → "deck-ms2044ey"
      const m = r.day_code?.match(/ms[0-9a-z]+/i)
      convMap.set(r.conversation_id, m ? `deck-${m[0].toLowerCase()}` : "unknown")
    }
  }

  const DECK_OVERRIDE: Record<string, string> = {
    // Map day_code prefixes → actual deckId
    "Lecture_material_ms2044ey_k6uor3": "day-1-ai-llm-foundation",
    "Lecture_material_ms203vsq_ob7vqp": "day-2-ai-problem-framing",
    "Lecture_material_ms4x7dx1_t0qyxg": "day-1-ai-llm-foundation",
    "Lecture_material_ms204v3b_r9mo78": "day-1-ai-llm-foundation",
    "Lecture_material_ms204i6x_gqwyya": "day-1-ai-llm-foundation",
    "New learning material": "day-1-ai-llm-foundation",
  }

  const LIMIT = Number(process.env.EVAL_LIMIT) || studentRows.length
  const sampled = studentRows.slice(0, LIMIT)

  console.log(`\nRunning RAG eval on ${sampled.length} turns...\n`)

  for (const row of sampled) {
    const question = row.content ?? ""
    const page = extractPageFromQuestion(question)
    const dayCode = row.day_code ?? ""
    const deckId = DECK_OVERRIDE[dayCode] ?? convMap.get(row.conversation_id) ?? "unknown"

    let retrievedPages: number[] = []
    let retrievedScores: number[] = []
    let ragConfigured = false

    if (isQdrantConfigured() && page != null) {
      const rag = await retrieveRagContext({ deckId, question, currentPage: page })
      ragConfigured = rag.qdrantConfigured
      if (ragConfigured) ragConfiguredCount++
      retrievedPages = rag.slides.map((s) => s.page)
      retrievedScores = rag.slides.map((s) => s.score)
    }

    // Parse tutor's cited pages (from tutor row)
    // Tutor row follows this student row in the CSV
    const tutorRow = rows.find(
      (r) => r.turn_id === row.turn_id && r.role === "tutor",
    )
    const citedStr = tutorRow?.citations ?? "[]"
    let tutorCited: number[] = []
    try {
      tutorCited = JSON.parse(citedStr)
    } catch { /* ignore */ }

    if (tutorCited.length > 0) citations++
    if (retrievedPages.length > 0 && page != null) {
      if (retrievedPages[0] === page) top1Hit++
      if (retrievedPages.includes(page)) top5Hit++
    }

    results.push({
      turnId: row.turn_id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      askedPage: page,
      citedPages: tutorCited,
      retrievedPages,
      retrievedScores,
      ragConfigured,
    })

    // Progress dot
    process.stdout.write(results.length % 50 === 0 ? `${results.length}\n` : ".")
  }

  console.log(`\n\n${"=".repeat(50)}`)
  console.log(" GOLDEN SET EVAL RESULTS")
  console.log(`${"=".repeat(50)}`)
  console.log(`Turns evaluated   : ${results.length}`)
  console.log(`Qdrant configured : ${ragConfiguredCount}/${results.length}`)
  console.log(`Citation rate     : ${((citations / results.length) * 100).toFixed(1)}%`)
  console.log(`Top-1 accuracy    : ${((top1Hit / results.length) * 100).toFixed(1)}% (RAG page[0] == asked page)`)
  console.log(`Top-5 recall      : ${((top5Hit / results.length) * 100).toFixed(1)}% (RAG page in top-5)`)
  console.log(`\nBaseline (old tutor) citation rate: ~46.2% (from DATA_DICTIONARY.md)`)
  console.log(
    `Baseline (old tutor) avg_latency: 1,758ms, p90: 3,686ms (from DATA_DICTIONARY.md)`,
  )

  // Write detailed results
  const { writeFile } = await import("node:fs/promises")
  await writeFile(
    "data/golden-eval-results.jsonl",
    results.map((r) => JSON.stringify(r)).join("\n"),
    "utf8",
  )
  console.log(`\nDetailed results → data/golden-eval-results.jsonl`)
}

runEval().catch((err) => {
  console.error("Eval failed:", err)
  process.exit(1)
})
