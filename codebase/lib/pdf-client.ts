"use client"

import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { outlineFromPageText } from "@/lib/deck-types"
import type { Slide } from "@/lib/tutor-data"

type PdfModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")

let modulePromise: Promise<PdfModule> | null = null

async function loadPdfjs() {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      return mod
    })
  }
  return modulePromise
}

/**
 * Module-level cache for opened PDF documents. Each entry is the loading
 * promise so concurrent callers await the same request — repeated slide
 * navigation must NOT re-download the PDF.
 *
 * The cache is intentionally never cleared: a single deck's PDF stays in
 * memory for the lifetime of the page. Navigating between decks is cheap
 * because pdfjs streams the file once and reuses the parsed structure.
 */
const docCache = new Map<string, Promise<PDFDocumentProxy>>()

export async function openPdf(source: ArrayBuffer | string): Promise<PDFDocumentProxy> {
  const url = typeof source === "string" ? source : null
  if (url) {
    const cached = docCache.get(url)
    if (cached) return cached
  }

  const promise = (async () => {
    const pdfjs = await loadPdfjs()
    const params = typeof source === "string" ? { url: source } : { data: source }
    try {
      return await pdfjs.getDocument(params).promise
    } catch (error) {
      if (url) docCache.delete(url)
      throw error
    }
  })()

  if (url) docCache.set(url, promise)
  return promise
}

/**
 * Extracts a per-page text outline. Text items are grouped into lines by their
 * vertical position so the first line becomes the slide title.
 */
export async function extractOutline(doc: PDFDocumentProxy, onProgress?: (done: number, total: number) => void) {
  const slides: Slide[] = []

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()

    const rows = new Map<number, { x: number; text: string }[]>()
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue
      const y = Math.round((item.transform?.[5] ?? 0) / 4)
      const row = rows.get(y) ?? []
      row.push({ x: item.transform?.[4] ?? 0, text: item.str })
      rows.set(y, row)
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((r) => r.text)
          .join(" "),
      )

    slides.push(outlineFromPageText(pageNumber, lines))
    page.cleanup()
    onProgress?.(pageNumber, doc.numPages)
  }

  return slides
}

/**
 * Renders one page into a canvas at the given CSS width, honouring devicePixelRatio.
 * Returns a cancellation handle. Calling it will cancel the in-flight render so the
 * canvas is free for the next page.
 */
export function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): { cancel: () => void; promise: Promise<void> } {
  let task: RenderTask | null = null
  let cancelled = false
  let cleanupPage: (() => void) | null = null

  const promise = (async () => {
    const page = await doc.getPage(pageNumber)
    if (cancelled) {
      page.cleanup()
      return
    }
    cleanupPage = () => page.cleanup()
    const base = page.getViewport({ scale: 1 })
    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)
    const scale = (cssWidth / base.width) * dpr
    const viewport = page.getViewport({ scale })

    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = "100%"
    canvas.style.height = "auto"

    const context = canvas.getContext("2d")
    if (!context) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    task = page.render({ canvasContext: context, viewport, canvas })
    try {
      await task.promise
    } finally {
      cleanupPage?.()
    }
  })().catch((error) => {
    cleanupPage?.()
    throw error
  })

  return {
    promise,
    cancel() {
      if (cancelled) return
      cancelled = true
      try {
        task?.cancel()
      } catch {
        // ignore — task may have already finished
      }
    },
  }
}