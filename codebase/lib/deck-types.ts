import type { Slide } from "@/lib/tutor-data"
import { isBuiltinDeckId } from "@/lib/builtin-decks"

export type DeckKind = "sample" | "pdf"

export type DeckSource = "builtin" | "upload"

/** Metadata stored in Blob as decks/<id>/meta.json (uploaded decks) */
export type DeckMeta = {
  id: string
  title: string
  course: string
  description?: string
  /** Tailwind gradient classes for the preview cover, e.g. "from-indigo-500 via-violet-500 to-fuchsia-500" */
  cover?: string
  /** Short label shown on the card, e.g. "AI · LLM" */
  tag?: string
  kind: DeckKind
  source: DeckSource
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
  const path = isBuiltinDeckId(deckId) ? "built-in" : "decks"
  return `/api/${path}/${encodeURIComponent(deckId)}/file`
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
