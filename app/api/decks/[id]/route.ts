import { del, list } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return NextResponse.json({ error: "Mã slide không hợp lệ" }, { status: 400 })
  }

  try {
    const { blobs } = await list({ prefix: `decks/${id}/` })
    if (blobs.length === 0) {
      return NextResponse.json({ error: "Không tìm thấy slide" }, { status: 404 })
    }

    await del(blobs.map((b) => b.url))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] delete deck failed:", error)
    return NextResponse.json({ error: "Xoá slide thất bại" }, { status: 500 })
  }
}
