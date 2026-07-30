"use client"

import { useEffect, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { Loader2, TriangleAlert } from "lucide-react"
import { openPdf, renderPageToCanvas } from "@/lib/pdf-client"

export function PdfPageView({
  fileUrl,
  page,
  renderWidth,
}: {
  fileUrl: string
  page: number
  renderWidth: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<PDFDocumentProxy | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    docRef.current = null
    setStatus("loading")

    openPdf(fileUrl)
      .then((doc) => {
        if (cancelled) {
          void doc.destroy()
          return
        }
        docRef.current = doc
        setStatus("ready")
      })
      .catch((error) => {
        console.error("[v0] open pdf failed:", error)
        if (!cancelled) setStatus("error")
      })

    return () => {
      cancelled = true
      void docRef.current?.destroy()
      docRef.current = null
    }
  }, [fileUrl])

  useEffect(() => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (status !== "ready" || !doc || !canvas) return

    let cancelled = false
    renderPageToCanvas(doc, Math.min(Math.max(1, page), doc.numPages), canvas, renderWidth).catch((error) => {
      if (!cancelled) console.error("[v0] render page failed:", error)
    })

    return () => {
      cancelled = true
    }
  }, [status, page, renderWidth])

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <TriangleAlert className="size-5 text-destructive" aria-hidden="true" />
        Không mở được file PDF này.
      </div>
    )
  }

  return (
    <div className="relative">
      {status === "loading" ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải slide…
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        aria-label={`Trang ${page} của bài giảng`}
        className="block w-full rounded-lg"
        style={{ display: status === "ready" ? "block" : "none" }}
      />
    </div>
  )
}
