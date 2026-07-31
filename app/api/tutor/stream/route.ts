import { StreamingTextResponse } from "ai"
import type { Deck } from "@/lib/deck-types"
import { buildRagPrompt, retrieveRagContext } from "@/lib/rag"
import { checkAcademicIntegrity, logFlaggedInteraction, safeResponse } from "@/lib/tools/anti-cheat"

export const runtime = "nodejs"

type AskBody = {
  question: string
  deck?: Pick<Deck, "id" | "title" | "course" | "outline" | "pageCount">
  page?: number
  history?: { role: "user" | "tutor"; content: string }[]
}

function buildSystemPrompt(
  deck: AskBody["deck"],
  currentPage: number | null,
  rag: { slideContext: string; transcriptContext: string; citationPages: number[] },
): string {
  const deckContext = deck
    ? `Bạn đang dạy một bộ slide "${deck.title}" (khoá "${deck.course}"), gồm ${deck.pageCount} trang.\n` +
      `Nội dung slide gần nhất (context từ vector search):\n${rag.slideContext}\n` +
      (rag.transcriptContext ? `\nBổ sung từ transcript giảng viên:\n${rag.transcriptContext}\n` : "")
    : "Bạn là AI tutor hỗ trợ học slide."

  const pageNote = currentPage ? `Học viên đang xem trang ${currentPage}.` : ""

  const citationNote = rag.citationPages.length > 0 ? `Trang được trích dẫn: ${rag.citationPages.join(", ")}.` : ""

  return [
    "Bạn là VLearn AI Tutor — trợ lý học tập bằng tiếng Việt.",
    "Nguyên tắc:",
    "- Trả lời ngắn gọn (2-5 câu), dễ hiểu, đúng trọng tâm.",
    "- Khi tham chiếu slide, ghi rõ 'Trang X' và để hệ thống nhảy tới trang đó.",
    "- Nếu không chắc chắn, nói thẳng là chưa rõ và hướng dẫn xem slide.",
    "- Trả lời bằng Markdown thuần, KHÔNG bọc trong code block.",
    deckContext,
    pageNote,
    citationNote,
  ]
    .filter(Boolean)
    .join("\n")
}

function extractPageFromText(text: string): number | null {
  const m = text.match(/trang\s+(\d{1,3})/i) ?? text.match(/\bpage\s+(\d{1,3})\b/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

type Provider = "gemini" | "mistral" | "openrouter"

function resolveProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? "gemini").toLowerCase()
  if (raw === "mistral") return "mistral"
  if (raw === "openrouter") return "openrouter"
  return "gemini"
}

function getApiKey(provider: Provider): string | undefined {
  if (provider === "mistral") return process.env.MISTRAL_API_KEY
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY
  return process.env.GEMINI_API_KEY
}

async function streamMistral(
  apiKey: string,
  systemInstruction: string,
  question: string,
  history: AskBody["history"],
) {
  const model = process.env.MISTRAL_MODEL ?? "mistral-small-latest"
  const endpoint = "https://api.mistral.ai/v1/chat/completions"

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemInstruction },
    ...(history ?? []).map((h) => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: question },
  ]

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 512,
      stream: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Mistral ${res.status}: ${errText.slice(0, 200) || res.statusText}`)
  }

  return res.body
}

async function streamOpenRouter(
  apiKey: string,
  systemInstruction: string,
  question: string,
  history: AskBody["history"],
) {
  const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"
  const endpoint = "https://openrouter.ai/api/v1/chat/completions"

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemInstruction },
    ...(history ?? []).map((h) => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: question },
  ]

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "VLearn Tutor",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 512,
      stream: true,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200) || res.statusText}`)
  }

  return res.body
}

export async function POST(req: Request) {
  const provider = resolveProvider()
  const apiKey = getApiKey(provider)

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          provider === "mistral"
            ? "Thiếu MISTRAL_API_KEY — đặt vào .env.local rồi restart dev server."
            : provider === "openrouter"
              ? "Thiếu OPENROUTER_API_KEY — đặt vào .env.local rồi restart dev server."
              : "Thiếu GEMINI_API_KEY — đặt vào .env.local rồi restart dev server.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }

  let body: AskBody
  try {
    body = (await req.json()) as AskBody
  } catch {
    return new Response(JSON.stringify({ error: "Body không phải JSON hợp lệ." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const question = body.question?.trim()
  if (!question) {
    return new Response(JSON.stringify({ error: "Câu hỏi trống." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const currentPage = typeof body.page === "number" && body.page > 0 ? body.page : null
  const deckId = body.deck?.id ?? "unknown"

  // ── Anti-cheat (GOAL.md §6) ────────────────────────────────────────────────
  const ragForIntegrity = await retrieveRagContext({ deckId, question, currentPage })
  const { slideContext } = buildRagPrompt(ragForIntegrity)
  const integrity = await checkAcademicIntegrity(question, currentPage, slideContext)

  if (integrity.is_flagged) {
    await logFlaggedInteraction(question, integrity.reason, integrity.risk_level, currentPage)
    return new Response(
      JSON.stringify({
        content: safeResponse(currentPage),
        page: currentPage,
        provider,
        flagged: true,
        reason: integrity.reason,
        citations: [],
        ragConfigured: ragForIntegrity.qdrantConfigured,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }

  // ── RAG retrieval ────────────────────────────────────────────────────────
  const rag = buildRagPrompt(ragForIntegrity)
  const systemInstruction = buildSystemPrompt(body.deck ?? undefined, currentPage, rag)

  try {
    let streamBody: ReadableStream<Uint8Array> | null = null

    if (provider === "mistral") {
      const body = await streamMistral(apiKey, systemInstruction, question, body.history)
      if (body) streamBody = body
    } else if (provider === "openrouter") {
      const body = await streamOpenRouter(apiKey, systemInstruction, question, body.history)
      if (body) streamBody = body
    }

    if (streamBody) {
      const citationPages = rag.citationPages.length > 0 ? rag.citationPages : []
      return new StreamingTextResponse(streamBody, {
        headers: {
          "X-Page": String(currentPage ?? ""),
          "X-Citations": citationPages.join(","),
          "X-Rag-Configured": String(ragForIntegrity.qdrantConfigured),
          "X-Provider": provider,
        },
      })
    }

    // Fallback to non-streaming if provider doesn't support
    const { NextResponse } = await import("next/server")
    return NextResponse.json({
      content: "Streaming không khả dụng cho provider này. Vui lòng thử lại.",
      page: currentPage,
      provider,
      citations: rag.citationPages,
      ragConfigured: ragForIntegrity.qdrantConfigured,
    })
  } catch (err) {
    console.error(`[tutor/stream] ${provider} failed:`, err)
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Không gọi được LLM streaming",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }
}
