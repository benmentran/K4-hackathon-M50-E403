"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { GraduationCap, Bot, Sparkles, Library } from "lucide-react"
import { DeckLibrary } from "@/components/deck-library"
import { SlidePanel } from "@/components/slide-panel"
import { TutorChat } from "@/components/tutor-chat"
import type { Deck } from "@/lib/deck-types"
import { SAMPLE_DECK } from "@/lib/tutor-data"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function Page() {
  const { data, isLoading, mutate } = useSWR<{ decks: Deck[] }>("/api/decks", fetcher)

  const [activeId, setActiveId] = useState(SAMPLE_DECK.id)
  const [page, setPage] = useState(7)
  const [chatOpen, setChatOpen] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(2)

  const decks = useMemo<Deck[]>(() => [SAMPLE_DECK, ...(data?.decks ?? [])], [data])
  const activeDeck = decks.find((d) => d.id === activeId) ?? SAMPLE_DECK

  function selectDeck(deck: Deck) {
    setActiveId(deck.id)
    setPage(deck.firstPage)
    setLibraryOpen(false)
  }

  function handleUploaded(deck: Deck) {
    void mutate()
    selectDeck(deck)
  }

  function handleDeleted(id: string) {
    void mutate()
    if (activeId === id) selectDeck(SAMPLE_DECK)
  }

  function collapseChat() {
    setChatOpen(false)
    setZoomIndex((z) => (z === 2 ? 3 : z))
  }

  function openChat() {
    setChatOpen(true)
    setZoomIndex((z) => (z === 3 ? 2 : z))
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-4" aria-hidden="true" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">VLearn</span>
            <span className="text-xs text-muted-foreground">{activeDeck.course}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">
            {decks.length} bộ slide
          </span>
          <button
            type="button"
            onClick={() => setLibraryOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Library className="size-4" aria-hidden="true" />
            Nạp slide
          </button>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto grid w-full flex-1 gap-6 px-4 py-6 md:px-8",
          libraryOpen
            ? "max-w-[104rem] lg:grid-cols-[280px_minmax(0,1fr)_380px]"
            : chatOpen
              ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px]"
              : "max-w-5xl grid-cols-1 pb-28",
        )}
      >
        <div className={cn("min-h-0 lg:sticky lg:top-6 lg:max-h-[calc(100svh-9rem)]", !libraryOpen && "hidden")}>
          <DeckLibrary
            decks={decks}
            activeId={activeDeck.id}
            loading={isLoading}
            onSelect={selectDeck}
            onUploaded={handleUploaded}
            onDeleted={handleDeleted}
            onClose={() => setLibraryOpen(false)}
          />
        </div>

        <SlidePanel
          deck={activeDeck}
          page={page}
          onPageChange={setPage}
          zoomIndex={zoomIndex}
          onZoomIndexChange={setZoomIndex}
          wide={!chatOpen}
          onOpenLibrary={() => setLibraryOpen(true)}
        />

        <div
          className={cn(
            "flex min-h-[560px] flex-col lg:sticky lg:top-6 lg:h-[calc(100svh-9rem)]",
            !chatOpen && "hidden",
          )}
        >
          <TutorChat deck={activeDeck} onPageChange={setPage} onCollapse={collapseChat} />
        </div>
      </main>

      {!chatOpen ? (
        <button
          type="button"
          onClick={openChat}
          title="Mở AI Tutor"
          className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Bot className="size-6" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-card text-primary shadow-sm"
          >
            <Sparkles className="size-3" />
          </span>
          <span className="sr-only">Mở AI Tutor</span>
        </button>
      ) : null}
    </div>
  )
}
