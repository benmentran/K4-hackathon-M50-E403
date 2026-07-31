import { get } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Mã slide không hợp lệ" }, { status: 400 })
  }

  try {
    const result = await get(`decks/${id}/source.pdf`, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    })

    if (!result) {
      return new NextResponse("Not found", { status: 404 })
    }

    if (result.statusCode === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: result.blob.etag, "Cache-Control": "private, no-cache" },
      })
    }

    return new NextResponse(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "application/pdf",
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    })
  } catch (error) {
    console.error("[v0] serve deck pdf failed:", error)
    return NextResponse.json({ error: "Không tải được file PDF" }, { status: 500 })
  }
}
