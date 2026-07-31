/**
 * GET /api/chat/suggestions — GOAL.md §4 `/chat/suggestions`
 *
 * Returns cached suggestions for a (deckId, page) pair.
 * Reads from the shared suggestion-cache module (same as /api/track/idle).
 */

import { NextResponse } from "next/server"
import { cacheKey, getCached } from "@/lib/suggestion-cache"

export const runtime = "nodejs"

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

  const key = cacheKey(deckId, page)
  const cached = getCached(key)

  if (!cached) {
    return NextResponse.json(
      {
        deckId,
        page,
        suggestions: [],
        message: "Gọi POST /api/track/idle trước để tạo suggestions.",
        cacheKey: key,
      },
      { status: 404 },
    )
  }

  return NextResponse.json({
    deckId,
    page,
    suggestions: cached.questions,
    citations: cached.citations,
    source: "cache",
  })
}
