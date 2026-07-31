/**
 * Parser for the vlearn transcript .md files.
 *
 * The cleaned files flag three kinds of content:
 *   - Instructor narration: regular paragraphs starting with **[Txx-NNN]**
 *   - Student speech: paragraphs starting with **[Txx-NNN]** followed by [học viên]
 *   - Classroom activity: paragraphs starting with **[Txx-NNN]** followed by [Hoạt động lớp: ...]
 *   - "[không nghe rõ]" appears inline
 *
 * Per GOAL.md §3 we keep only instructor turns. Student speech is filtered
 * out so the tutor doesn't "cite" random learner chatter as ground truth.
 *
 * We also emit a synthetic, monotonic page hint based on the position of
 * the block in the file (10 blocks ≈ 1 slide). This is a low-confidence
 * mapping — when actual slide->transcript alignment is built later, replace
 * with that. The point of the hint is to enable Qdrant page-window filters.
 */

export type ParsedTurn = {
  blockId: string // e.g. "T04-013"
  speaker: "instructor" | "student" | "activity"
  text: string
  /** Best-effort page; 1-based. May be null if we can't infer. */
  pageEst: number | null
}

const TURN_RE = /\*\*\[(T\d{2}-\d{3,4})\]\*\*\s+([^\n]+)/g

export function parseTranscriptMarkdown(md: string, deckId: string): ParsedTurn[] {
  const turns: ParsedTurn[] = []
  let totalTurns = 0

  for (const match of md.matchAll(TURN_RE)) {
    const blockId = match[1]
    const firstLine = match[2].trim()
    totalTurns++

    let speaker: ParsedTurn["speaker"] = "instructor"
    let text = firstLine

    if (firstLine.startsWith("[học viên]")) {
      speaker = "student"
      text = firstLine.replace(/^\[học viên\]\s*/, "")
    } else if (firstLine.startsWith("[Hoạt động lớp:")) {
      speaker = "activity"
      text = firstLine.replace(/^\[Hoạt động lớp:[^\]]+\]\s*/, "")
    } else if (firstLine.startsWith("[giảng viên]")) {
      speaker = "instructor"
      text = firstLine.replace(/^\[giảng viên\]\s*/, "")
    }

    // Heuristic: ~10 transcript turns per slide
    const pageEst = Math.max(1, Math.floor((totalTurns - 1) / 10) + 1)

    turns.push({
      blockId: `${deckId}-${blockId}`,
      speaker,
      text: cleanText(text),
      pageEst,
    })
  }

  return turns
}

function cleanText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\[không nghe rõ\]/g, "(…)")
    .trim()
}

/** Splits each turn into 1-2 sentence chunks to keep vector size manageable. */
export function chunkTurn(turn: ParsedTurn): string[] {
  if (turn.text.length <= 320) return [turn.text]
  const sentences = turn.text.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length <= 2) return [turn.text]
  const mid = Math.ceil(sentences.length / 2)
  return [
    sentences.slice(0, mid).join(" "),
    sentences.slice(mid).join(" "),
  ]
}

export function deckIdFromTranscriptFile(fileName: string): string {
  // transcript-04-clean.md -> "deck-transcript-04"
  const m = fileName.match(/transcript-(\d{1,2})/i)
  return m ? `transcript-${m[1].padStart(2, "0")}` : "transcript-unknown"
}
