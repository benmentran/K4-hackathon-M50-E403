import type { Slide } from "@/lib/tutor-data"

export type DeckKind = "sample" | "pdf"

/** Metadata stored in Blob as decks/<id>/meta.json */
export type DeckMeta = {
  id: string
  title: string
  course: string
  kind: DeckKind
  pageCount: number
  /** First page number (PDF decks always start at 1) */
  firstPage: number
  createdAt: string
  fileName?: string
  /** Blob pathname of the source PDF (private store) */
  filePathname?: string
  /** Text outline extracted per page — used for thumbnails and tutor context */
  outline: Slide[]
}

export type Deck = DeckMeta

export const SAMPLE_DECK_ID = "sample"

export function pdfFileUrl(deckId: string) {
  return `/api/decks/${encodeURIComponent(deckId)}/file`
}

/** Turn raw text lines of a PDF page into a title + bullet outline. */
export function outlineFromPageText(pageNumber: number, lines: string[]): Slide {
  const cleaned = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l.length > 1)

  const title = cleaned[0] ? truncate(cleaned[0], 90) : `Trang ${pageNumber}`
  const bullets = cleaned.slice(1, 9).map((l) => truncate(l, 180))

  return { page: pageNumber, title, bullets }
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value
}
