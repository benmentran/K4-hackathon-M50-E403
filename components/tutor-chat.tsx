"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Sparkles, X, BookOpen, Bot, User, PanelRightClose } from "lucide-react"
import { ANSWERS, FALLBACK, OPENING_SUGGESTIONS, type Suggestion, type Turn } from "@/lib/tutor-data"

const INITIAL: Turn[] = [
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

export function TutorChat({
  onPageChange,
  onCollapse,
}: {
  onPageChange: (page: number) => void
  onCollapse: () => void
}) {
  const [turns, setTurns] = useState<Turn[]>(INITIAL)
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState("")
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [turns, thinking])

  function ask(question: string, id?: string) {
    const answer = (id && ANSWERS[id]) || FALLBACK
    const stamp = Date.now()

    setTurns((prev) => [...prev, { id: `u${stamp}`, role: "user", content: question }])
    setThinking(true)
    onPageChange(answer.page)

    setTimeout(() => {
      setTurns((prev) => [
        ...prev,
        {
          id: `a${stamp}`,
          role: "tutor",
          content: answer.content,
          page: answer.page,
          suggestions: answer.suggestions,
        },
      ])
      setThinking(false)
    }, 650)
  }

  function submit() {
    const q = draft.trim()
    if (!q || thinking) return
    setDraft("")
    ask(q)
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
          <span className="text-xs text-muted-foreground">Tự gợi ý câu hỏi tiếp theo</span>
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
                  {turn.page ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="size-3.5" aria-hidden="true" />
                      Tham khảo slide {turn.page}
                    </p>
                  ) : null}
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
