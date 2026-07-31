import { createReadStream, statSync } from "node:fs"
import path from "node:path"
import { type NextRequest, NextResponse } from "next/server"
import { builtinPdfFileName } from "@/lib/builtin-decks"

const PDF_ROOT = path.join(process.cwd(), "data", "vlearn-pack", "slides")

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const fileName = builtinPdfFileName(id)

  if (!fileName) {
    return NextResponse.json({ error: "Không có slide kèm sẵn cho mã này" }, { status: 404 })
  }

  const filePath = path.join(PDF_ROOT, fileName)
  if (!filePath.startsWith(PDF_ROOT)) {
    return NextResponse.json({ error: "Đường dẫn không hợp lệ" }, { status: 400 })
  }

  try {
    const stat = statSync(filePath)
    if (!stat.isFile()) throw new Error("Not a file")
  } catch {
    return NextResponse.json({ error: "Không tìm thấy slide kèm sẵn" }, { status: 404 })
  }

  const stream = createReadStream(filePath) as unknown as ReadableStream
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(statSync(filePath).size),
      "Cache-Control": "public, max-age=3600, immutable",
    },
  })
}