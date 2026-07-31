import { del, get, list, put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import type { DeckMeta } from "@/lib/deck-types"
import type { Slide } from "@/lib/tutor-data"
import { ingestDeck } from "@/lib/ingest-deck"
import { isQdrantConfigured } from "@/lib/qdrant"

const PREFIX = "decks/"
const MAX_BYTES = 25 * 1024 * 1024

export async function GET() {
  try {
    const { blobs } = await list({ prefix: PREFIX })
    const metaBlobs = blobs.filter((b) => b.pathname.endsWith("/meta.json"))

    const decks = await Promise.all(
      metaBlobs.map(async (b) => {
        try {
          const result = await get(b.pathname, { access: "private" })
          if (!result) return null
          const text = await new Response(result.stream).text()
          return JSON.parse(text) as DeckMeta
        } catch {
          return null
        }
      }),
    )

    const valid = decks
      .filter((d): d is DeckMeta => Boolean(d?.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return NextResponse.json({ decks: valid })
  } catch (error) {
    console.error("[v0] list decks failed:", error)
    return NextResponse.json({ decks: [], error: "Không tải được danh sách slide" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const title = String(formData.get("title") ?? "").trim()
    const course = String(formData.get("course") ?? "").trim()
    const rawOutline = String(formData.get("outline") ?? "[]")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Chưa chọn file PDF" }, { status: 400 })
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Chỉ hỗ trợ file PDF" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File vượt quá 25MB" }, { status: 400 })
    }

    let outline: Slide[] = []
    try {
      const parsed = JSON.parse(rawOutline)
      if (Array.isArray(parsed)) {
        outline = parsed
          .filter((s) => s && typeof s.page === "number")
          .map((s) => ({
            page: s.page,
            title: typeof s.title === "string" ? s.title : `Trang ${s.page}`,
            bullets: Array.isArray(s.bullets) ? s.bullets.filter((b: unknown) => typeof b === "string") : [],
          }))
      }
    } catch {
      outline = []
    }

    if (outline.length === 0) {
      return NextResponse.json({ error: "Không đọc được nội dung PDF" }, { status: 400 })
    }

    const id = crypto.randomUUID()

    const stored = await put(`${PREFIX}${id}/source.pdf`, file, {
      access: "private",
      contentType: "application/pdf",
    })

    const meta: DeckMeta = {
      id,
      title: title || file.name.replace(/\.pdf$/i, "") || "Bài giảng mới",
      course: course || "Slide đã nạp",
      kind: "pdf",
      source: "upload",
      pageCount: outline.length,
      firstPage: outline[0].page,
      createdAt: new Date().toISOString(),
      fileName: file.name,
      filePathname: stored.pathname,
      outline,
    }

    await put(`${PREFIX}${id}/meta.json`, JSON.stringify(meta), {
      access: "private",
      contentType: "application/json",
    })

    // ── RAG ingest (GOAL.md §2) ─────────────────────────────────────────────
    // After storing the PDF, stream it into the RAG pipeline.
    // We re-fetch the blob to get the raw ArrayBuffer for pdfjs.
    let ingestResult: { pages: number; chunks: number } | null = null
    if (isQdrantConfigured()) {
      try {
        const blob = await get(`${PREFIX}${id}/source.pdf`, { access: "private" })
        if (blob) {
          // @vercel/blob v5: get() returns { statusCode, stream, headers, blob: { ... } }
          // Extract the inner blob object and use its downloadUrl
          const inner = (blob as unknown as { blob?: { downloadUrl?: string } }).blob
          const url = inner?.downloadUrl ?? (blob as unknown as { downloadUrl?: string }).downloadUrl
          if (url) {
            const resp = await fetch(url)
            const buf = await resp.arrayBuffer()
            ingestResult = await ingestDeck({ deckId: id, pdfBuffer: buf })
            console.log(`[ingest] deck=${id} pages=${ingestResult.pages} chunks=${ingestResult.chunks}`)
          }
        }
      } catch (ingestErr) {
        // Non-fatal: PDF is stored, RAG just won't work until next ingest attempt.
        console.error("[ingest] RAG ingest failed:", ingestErr)
      }
    }

    return NextResponse.json({
      deck: meta,
      ingest: ingestResult
        ? { collection: `slide_${id}`, pages: ingestResult.pages, chunks: ingestResult.chunks }
        : { skipped: "Qdrant not configured" },
    })
  } catch (error) {
    console.error("[v0] upload deck failed:", error)
    return NextResponse.json({ error: "Tải slide lên thất bại" }, { status: 500 })
  }
}
