"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, Sparkles, X, BookOpen, Bot, User, PanelRightClose } from "lucide-react"
import type { Deck } from "@/lib/deck-types"
import { ANSWERS, FALLBACK, OPENING_SUGGESTIONS, type Suggestion, type Turn } from "@/lib/tutor-data"

const SAMPLE_INITIAL: Turn[] = [
  {
    id: "t1",
    role: "user",
    content: "Attention trong Transformer là gì?",
  },
  {
    id: "t2",
    role: "tutor",
    page: 7,
    content:
      "Attention là cơ chế cho phép mô hình gán trọng số liên quan giữa các token trong chuỗi, thay vì đọc tuần tự từng từ. Nhờ đó mỗi token có thể lấy thông tin từ bất kỳ token nào khác trong câu.",
    suggestions: OPENING_SUGGESTIONS,
  },
]

/** Builds an opening turn + suggestions from any uploaded deck's text outline. */
function buildDeckIntro(deck: Deck): { turns: Turn[]; answers: Record<string, Answerish> } {
  const pages = deck.outline.filter((s) => s.bullets.length > 0 || s.title)
  const picks = [pages[0], pages[Math.floor(pages.length / 2)], pages[pages.length - 1]].filter(
    (s, i, arr) => s && arr.findIndex((x) => x?.page === s.page) === i,
  )

  const answers: Record<string, Answerish> = {}
  const suggestions: Suggestion[] = picks.map((slide, i) => {
    const id = `deck-${deck.id}-${slide.page}`
    answers[id] = {
      page: slide.page,
      content: slide.bullets.length
        ? `Trang ${slide.page} — "${slide.title}". Các ý chính trong slide: ${slide.bullets.join(" · ")}`
        : `Trang ${slide.page} có tiêu đề "${slide.title}", nhưng phần nội dung chủ yếu là hình ảnh nên không trích được text.`,
      suggestions: [],
    }
    return {
      id,
      question: `Nội dung chính của trang ${slide.page} là gì?`,
      page: slide.page,
      tag: i === 1 ? "Đào sâu" : "Ôn nhanh",
    }
  })

  for (const id of Object.keys(answers)) {
    answers[id].suggestions = suggestions.filter((s) => s.id !== id)
  }

  return {
    turns: [
      {
        id: `intro-${deck.id}`,
        role: "tutor",
        page: deck.firstPage,
        content: `Đã nạp "${deck.title}" với ${deck.pageCount} trang. Bạn có thể hỏi về bất kỳ trang nào, hoặc chọn một gợi ý bên dưới.`,
        suggestions,
      },
    ],
    answers,
  }
}

type TutorApiResponse = {
  content?: string
  page?: number | null
  citations?: number[]
  flagged?: boolean
  reason?: string
  ragConfigured?: boolean
  error?: string
}

type IdleSuggestion = {
  suggestions?: string[]
  citations?: number[]
  questions?: string[]
}

type Answerish = { content: string; page: number; suggestions: Suggestion[] }

const IDLE_THRESHOLD_MS = 15_000

export function TutorChat({
  deck,
  currentPage,
  onPageChange,
  onCollapse,
}: {
  deck: Deck
  currentPage?: number
  onPageChange: (page: number) => void
  onCollapse: () => void
}) {
  const isBuiltin = deck.kind === "pdf" && deck.source === "builtin"
  const usePreset = deck.kind === "sample" || isBuiltin
  const intro = useMemo(() => (usePreset ? null : buildDeckIntro(deck)), [deck, usePreset])

  const [turns, setTurns] = useState<Turn[]>(SAMPLE_INITIAL)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState("")
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idleSuggestions, setIdleSuggestions] = useState<string[]>([])
  const [idlePending, setIdlePending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Idle detection: reset timer on page change ───────────────────────────────
  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (deck.kind === "pdf" && currentPage && !idlePending) {
      idleTimerRef.current = setTimeout(() => {
        void triggerIdle(deck.id, currentPage)
      }, IDLE_THRESHOLD_MS)
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [currentPage, deck.kind, deck.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerIdle(deckId: string, page: number) {
    setIdlePending(true)
    try {
      const res = await fetch("/api/track/idle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId, page, idleSeconds: IDLE_THRESHOLD_MS / 1000 }),
      })
      if (res.ok) {
        const data = (await res.json()) as IdleSuggestion
        const items = data.suggestions ?? data.questions ?? []
        if (items.length) {
          setIdleSuggestions(items)
        }
      }
    } catch {
      // best effort — don't bother the user
    } finally {
      setIdlePending(false)
    }
  }

  // ── Show idle suggestions as a dismissible banner above the input ────────────
  function pickIdleSuggestion(q: string) {
    setIdleSuggestions([])
    void ask(q)
  }

  useEffect(() => {
    setTurns(intro ? intro.turns : SAMPLE_INITIAL)
    setDismissed({})
    setThinking(false)
    setError(null)
    setIdleSuggestions([])
  }, [intro])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns, thinking])

  function deckFallback(question: string): Answerish {
    const match = question.match(/\b(\d{1,3})\b/)
    const wanted = match ? Number(match[1]) : null
    const slide = deck.outline.find((s) => s.page === wanted) ?? deck.outline[0]

    return {
      page: slide.page,
      content: slide.bullets.length
        ? `Theo trang ${slide.page} ("${slide.title}"): ${slide.bullets.join(" · ")}`
        : `Trang ${slide.page} ("${slide.title}") không trích được nhiều text — bạn xem trực tiếp slide bên cạnh nhé.`,
      suggestions: intro?.turns[0].suggestions?.slice(0, 2) ?? [],
    }
  }

  async function ask(question: string, id?: string) {
    const stamp = Date.now()
    setTurns((prev) => [...prev, { id: `u${stamp}`, role: "user", content: question }])
    setThinking(true)
    setError(null)
    setIdleSuggestions([])

    const presetAnswer =
      usePreset
        ? id
          ? ANSWERS[id]
          : undefined
        : id
          ? intro?.answers[id]
          : undefined

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          page: currentPage,
          deck: {
            id: deck.id,
            title: deck.title,
            course: deck.course,
            outline: deck.outline.map((s) => ({ page: s.page, title: s.title, bullets: [] })),
            pageCount: deck.pageCount,
          },
        }),
      })
      const data = (await res.json()) as TutorApiResponse

      if (!res.ok || !data.content) {
        throw new Error(data.error ?? "Tutor không phản hồi.")
      }

      const answerPage =
        typeof data.page === "number" && data.page > 0 ? data.page : presetAnswer?.page ?? 1

      onPageChange(answerPage)
      setTurns((prev) => [
        ...prev,
        {
          id: `a${stamp}`,
          role: "tutor",
          content: data.content!,
          page: answerPage,
          citations: data.citations,
          suggestions: presetAnswer?.suggestions ?? [],
        },
      ])
    } catch (err) {
      console.warn("[tutor] API failed, dùng fallback:", err)
      const fallback = presetAnswer ?? deckFallback(question)
      onPageChange(fallback.page)
      setTurns((prev) => [
        ...prev,
        {
          id: `a${stamp}`,
          role: "tutor",
          content: fallback.content,
          page: fallback.page,
          suggestions: fallback.suggestions,
        },
      ])
      setError(err instanceof Error ? err.message : "Đã dùng câu trả lời dự phòng.")
    } finally {
      setThinking(false)
    }
  }

  function submit() {
    const q = draft.trim()
    if (!q || thinking) return
    setDraft("")
    void ask(q)
  }

  const lastTurn = turns[turns.length - 1]

  return (
    <section aria-label="AI Tutor" className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-card-foreground">VLearn AI Tutor</span>
          <span className="truncate text-xs text-muted-foreground">{deck.title}</span>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          title="Thu nhỏ tutor"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="size-4" aria-hidden="true" />
          <span className="sr-only">Thu nhỏ tutor để phóng to slide</span>
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            {turn.role === "user" ? (
              <div className="flex justify-end">
                <p className="flex max-w-[85%] items-start gap-2 rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                  <User className="mt-0.5 size-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="text-pretty">{turn.content}</span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <p className="text-pretty text-sm leading-relaxed text-foreground">{turn.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {turn.page ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="size-3.5" aria-hidden="true" />
                        Slide {turn.page}
                      </p>
                    ) : null}
                    {turn.citations && turn.citations.length > 0 ? (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <BookOpen className="size-3.5" aria-hidden="true" />
                        Cited: {turn.citations.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </div>

                {turn.suggestions && turn.id === lastTurn.id && !dismissed[turn.id] && !thinking ? (
                  <SuggestionBlock
                    suggestions={turn.suggestions}
                    onPick={(s) => ask(s.question, s.id)}
                    onDismiss={() => setDismissed((d) => ({ ...d, [turn.id]: true }))}
                  />
                ) : null}
              </div>
            )}
          </div>
        ))}

        {thinking ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Tutor đang trả lời…
          </p>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            {error} (đã dùng câu trả lời dự phòng)
          </p>
        ) : null}

        {idleSuggestions.length > 0 ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/40">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Gợi ý sau khi dừng lại 15s
            </div>
            <ul className="flex flex-col gap-1.5">
              {idleSuggestions.map((q, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickIdleSuggestion(q)}
                    className="w-full text-left text-sm text-violet-800 dark:text-violet-200 hover:underline"
                  >
                    → {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2">
          <label htmlFor="tutor-input" className="sr-only">
            Nhập câu hỏi cho tutor
          </label>
          <textarea
            id="tutor-input"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Hoặc tự nhập câu hỏi…"
            className="max-h-24 flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || thinking}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
            <span className="sr-only">Gửi câu hỏi</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function SuggestionBlock({
  suggestions,
  onPick,
  onDismiss,
}: {
  suggestions: Suggestion[]
  onPick: (s: Suggestion) => void
  onDismiss: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-accent p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Hỏi tiếp gì đây?
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          <X className="size-3.5" aria-hidden="true" />
          Bỏ qua
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {suggestions.slice(0, 3).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm leading-relaxed text-card-foreground transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="text-pretty">{s.question}</span>
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {s.tag} · tr.{s.page}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
