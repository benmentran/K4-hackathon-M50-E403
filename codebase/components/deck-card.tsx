"use client"

import Link from "next/link"
import { FileText, Sparkles } from "lucide-react"
import type { Deck } from "@/lib/deck-types"
import { cn } from "@/lib/utils"

const FALLBACK_GRADIENTS = [
  "from-indigo-500 via-violet-500 to-fuchsia-500",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-amber-500 via-orange-500 to-rose-500",
  "from-sky-500 via-blue-500 to-indigo-500",
  "from-rose-500 via-pink-500 to-purple-500",
]

function pickGradient(deck: Deck, index: number) {
  if (deck.cover) return deck.cover
  return FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]
}

export function DeckCard({ deck, index }: { deck: Deck; index: number }) {
  const gradient = pickGradient(deck, index)
  const tag = deck.tag ?? (deck.kind === "sample" ? "Mẫu" : "Tài liệu")
  const description = deck.description ?? deck.outline[0]?.title ?? deck.title
  const firstSlide = deck.outline[0]?.title ?? ""

  return (
    <Link
      href={`/deck/${deck.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className={cn("relative aspect-[16/9] overflow-hidden bg-gradient-to-br", gradient)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_85%,rgba(0,0,0,0.18),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-4">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {deck.kind === "sample" ? (
              <Sparkles className="size-3" aria-hidden="true" />
            ) : (
              <FileText className="size-3" aria-hidden="true" />
            )}
            {tag}
          </span>
          <div className="flex flex-col gap-1">
            <span className="line-clamp-2 text-base font-semibold leading-snug text-white drop-shadow-sm">
              {deck.title}
            </span>
            {firstSlide && firstSlide !== deck.title ? (
              <span className="line-clamp-1 text-xs text-white/85">{firstSlide}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{deck.course}</span>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
            {deck.pageCount} trang
          </span>
        </div>
        <p className="line-clamp-2 text-pretty text-sm text-card-foreground">{description}</p>
      </div>
    </Link>
  )
}