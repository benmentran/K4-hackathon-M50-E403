/**
 * POST /api/track/idle — GOAL.md §4 `/track/idle`
 *
 * Called by the frontend when the user pauses on a slide for > 15s.
 * Generates 3–5 smart follow-up questions (RAG + LLM), caches them
 * in-memory (module-level Map) so /api/chat/suggestions can read them
 * without regenerating.
 *
 * Module-level cache is fine for a hackathon demo — each Node.js worker
 * holds its own cache, and sessions are short.
 *
 * Debounce logic is also here: if the same (deckId, page) was generated
 * in the last SUGGESTION_TTL_MS, we return the cached set instead of
 * calling the LLM again.
 */

import { NextResponse } from "next/server"
import { buildRagPrompt, retrieveRagContext } from "@/lib/rag"
import { checkAcademicIntegrity } from "@/lib/tools/anti-cheat"
import {
  cacheKey,
  isDebounced,
  markDebounced,
  getCached,
  setCached,
} from "@/lib/suggestion-cache"

export const runtime = "nodejs"

type IdleBody = {
  deckId: string
  page: number
  idleSeconds?: number
  sessionId?: string
}

type Provider = "gemini" | "mistral" | "openrouter"

function resolveProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase()
  if (raw === "mistral") return "mistral"
  if (raw === "openrouter") return "openrouter"
  return "gemini"
}
function getApiKey(p: Provider): string | undefined {
  if (p === "mistral") return process.env.MISTRAL_API_KEY
  if (p === "openrouter") return process.env.OPENROUTER_API_KEY
  return process.env.GEMINI_API_KEY
}

function getApiBase(provider: Provider): { base: string; model: string } {
  if (provider === "openrouter")
    return { base: "https://openrouter.ai/api/v1/chat/completions", model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini" }
  if (provider === "mistral")
    return { base: "https://api.mistral.ai/v1/chat/completions", model: process.env.MISTRAL_MODEL ?? "mistral-small-latest" }
  return { base: "N/A", model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash" }
}

async function callLLMSuggestions(
  provider: Provider,
  apiKey: string,
  prompt: string,
): Promise<string[]> {
  if (provider === "gemini") {
    // Gemini uses a different API shape — inline it here.
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const res = await fetch(`${endpoint}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 256 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini ${res.status}`)
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
    return parseSuggestions(text)
  }

  const { base, model } = getApiBase(provider)
  const isOpenRouter = provider === "openrouter"
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(isOpenRouter
        ? {
            "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
            "X-Title": "VLearn Idle",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 256,
    }),
  })
  if (!res.ok) throw new Error(`${provider} ${res.status}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const text = data.choices?.[0]?.message?.content ?? ""
  return parseSuggestions(text)
}

function parseSuggestions(raw: string): string[] {
  const lines = raw.split("\n").filter((l) => l.trim())
  const out: string[] = []
  for (const line of lines) {
    // Accept numbered (1. ...) or bullet (- ...) or plain lines
    const cleaned = line.replace(/^[1-5][\.\)]\s*[-]?\s*/, "").trim()
    if (cleaned.length > 10) out.push(cleaned)
    if (out.length >= 5) break
  }
  return out
}

export async function POST(req: Request) {
  const provider = resolveProvider()
  const apiKey = getApiKey(provider)
  if (!apiKey) {
    return NextResponse.json({ error: "Thiếu API key." }, { status: 500 })
  }

  let body: IdleBody
  try {
    body = (await req.json()) as IdleBody
  } catch {
    return NextResponse.json({ error: "Body không phải JSON hợp lệ." }, { status: 400 })
  }

  const { deckId, page } = body
  if (!deckId || !page) {
    return NextResponse.json({ error: "Thiếu deckId hoặc page." }, { status: 400 })
  }

  const key = cacheKey(deckId, page)

  // Debounce rapid calls
  if (isDebounced(key)) {
    const cached = getCached(key)
    return NextResponse.json({
      suggestions: cached?.questions ?? [],
      source: "debounced",
      page,
    })
  }

  // Check cache
  const cached = getCached(key)
  if (cached) {
    return NextResponse.json({
      suggestions: cached.questions,
      source: "cache",
      page,
      citations: cached.citations,
    })
  }

  markDebounced(key)

  // ── RAG: retrieve slide context as anchor for suggestion generation ──────
  const rag = await retrieveRagContext({ deckId, question: "tóm tắt nội dung slide này", currentPage: page })
  const { slideContext, transcriptContext, citationPages } = buildRagPrompt(rag)

  // Quick integrity check (skip if page is off-topic)
  const integrity = await checkAcademicIntegrity(
    `gợi ý câu hỏi cho slide ${page}`,
    page,
    slideContext,
  )
  if (integrity.is_flagged) {
    // Trả về câu hỏi gợi ý mở thay vì empty — lịch sự redirect
    const safeQuestions = [
      "Bạn đang thắc mắc về phần nào trong slide này?",
      "Hãy thử đặt câu hỏi cụ thể hơn về nội dung đang học nhé!",
      "Bạn có muốn ôn lại khái niệm chính trong slide không?",
    ]
    setCached(key, safeQuestions)
    return NextResponse.json({
      suggestions: safeQuestions,
      source: "safe_redirect",
      page,
      reason: integrity.reason,
    })
  }

  // ── LLM: generate 3–5 follow-up questions ─────────────────────────────────
  const citedPages = citationPages.length > 0 ? citationPages.join(", ") : `trang ${page}`
  const systemInstruction = `Bạn là VLearn AI Tutor. Dựa trên nội dung slide ${page} (${citedPages}), sinh 3–5 câu hỏi ngắn tiếng Việt giúp học viên đào sâu bài học.
Yêu cầu:
- Mỗi câu hỏi 1 dòng, bắt đầu bằng số hoặc gạch đầu dòng
- Xen kẽ các loại: ôn tập (lại khái niệm), đào sâu (tại sao / so sánh / ngoại lệ), ví dụ (cho ví dụ thực tế)
- Câu hỏi phải bám sát nội dung slide, KHÔNG hỏi ngoài phạm vi bài giảng
- Trả về DUY NHẤT danh sách câu hỏi, không giải thích, không tiền tố
Ngữ cảnh slide:\n${slideContext}${transcriptContext ? `\nBổ sung:\n${transcriptContext}` : ""}`

  try {
    const questions = await callLLMSuggestions(provider, apiKey, systemInstruction)
    setCached(key, questions, citationPages)
    return NextResponse.json({
      suggestions: questions,
      source: "generated",
      page,
      citations: citationPages,
      ragConfigured: rag.qdrantConfigured,
    })
  } catch (err) {
    console.error("[track/idle] LLM failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi khi sinh gợi ý" },
      { status: 502 },
    )
  }
}
