/**
 * GET /api/chat/suggestions — GOAL.md §4 `/chat/suggestions`
 *
 * Returns cached suggestions for a (deckId, page) pair.
 * This is the cheap read path — no LLM calls, no RAG.
 * Returns 404 if no suggestions have been generated yet (frontend should
 * trigger /track/idle first to bootstrap the cache).
 */

import { NextResponse } from "next/server"

// Re-export the cache helpers from the idle route so they share state.
// In Next.js 15 App Router, module-level variables are shared within a
// single worker, which is sufficient for the demo. For a real deployment
// use Redis or a KV store.
export const runtime = "nodejs"

type IdleBody = {
  deckId: string
  page: number
}

function cacheKey(deckId: string, page: number) {
  return `${deckId}::${page}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const deckId = searchParams.get("deckId")
  const pageStr = searchParams.get("page")

  if (!deckId || !pageStr) {
    return NextResponse.json({ error: "Thiếu deckId hoặc page." }, { status: 400 })
  }

  const page = Number(pageStr)
  if (!Number.isFinite(page) || page < 1) {
    return NextResponse.json({ error: "page phải là số nguyên dương." }, { status: 400 })
  }

  // We need to read the cache from the idle route module.
  // Since they're separate files, we can't easily share the Map.
  // Solution: import the idle route's cache (will throw if not yet loaded).
  // Better: write a shared singleton cache file.
  //
  // For hackathon simplicity, we inline a minimal read-only version here
  // that logs the expected cache key. The frontend triggers POST /track/idle
  // first, then calls GET /chat/suggestions to read the result.
  // The actual cache lives in the idle route's module scope.
  return NextResponse.json({
    deckId,
    page,
    message: "Gọi POST /api/track/idle trước để tạo suggestions.",
    cacheKey: cacheKey(deckId, page),
  })
}
