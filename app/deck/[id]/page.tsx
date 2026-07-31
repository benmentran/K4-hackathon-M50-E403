"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, GraduationCap, LogOut, Sparkles } from "lucide-react"
import { SlidePanel } from "@/components/slide-panel"
import { TutorChat } from "@/components/tutor-chat"
import { useFocusTracker } from "@/components/focus-tracker"
import { BUILTIN_DECKS } from "@/lib/builtin-decks"
import type { Deck } from "@/lib/deck-types"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useSWR<{ decks: Deck[] }>("/api/decks", fetcher)
  const uploadedDecks = data?.decks ?? []

  const decks = useMemo<Deck[]>(() => [...BUILTIN_DECKS, ...uploadedDecks], [uploadedDecks])
  const activeDeck = useMemo(() => decks.find((d) => d.id === id) ?? null, [decks, id])

  const [page, setPage] = useState(1)
  const [chatOpen, setChatOpen] = useState(true)
  const [zoomIndex, setZoomIndex] = useState(2)
  const focus = useFocusTracker({ page, deckId: activeDeck?.id ?? id })

  useEffect(() => {
      if (activeDeck) setPage(activeDeck.firstPage)
  }, [activeDeck?.id, activeDeck?.firstPage])

  if (!activeDeck) {
      return (
          <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6">
              <p className="text-sm text-muted-foreground">
                  {isLoading ? "Đang tải slide…" : "Không tìm thấy bộ slide này."}
              </p>
              <Link
                  href="/"
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Quay lại thư viện
              </Link>
          </div>
      )
  }

  return (
      <div className="flex min-h-svh flex-col bg-background">
          <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 md:px-8">
              <div className="flex items-center gap-2">
                  <Link
                      href="/"
                      aria-label="Về trang chủ"
                      className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                  >
                      <GraduationCap className="size-4" aria-hidden="true" />
                  </Link>
                  <div className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold text-foreground">VLearn</span>
                      <span className="text-xs text-muted-foreground">{activeDeck.course}</span>
                  </div>
                  <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
                  <nav
                      aria-label="Breadcrumb"
                      className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex"
                  >
                      <Link href="/" className="transition-colors hover:text-foreground">
                          Khoá học
                      </Link>
                      <span aria-hidden="true">/</span>
                      <span className="truncate font-medium text-foreground" title={activeDeck.title}>
                          {activeDeck.title}
                      </span>
                  </nav>
              </div>

              <div className="flex items-center gap-2">
                  <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">
                      {decks.length} bộ slide
                  </span>
                  <Link
                      href="/"
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                      <LogOut className="size-3.5" aria-hidden="true" />
                      Thoát
                  </Link>
              </div>
          </header>

          <main
              className={cn(
                  "mx-auto grid w-full flex-1 gap-6 px-4 py-6 md:px-8",
                  chatOpen
                      ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px]"
                      : "max-w-5xl grid-cols-1 pb-28",
              )}
          >
              <SlidePanel
                  deck={activeDeck}
                  page={page}
                  onPageChange={setPage}
                  zoomIndex={zoomIndex}
                  onZoomIndexChange={setZoomIndex}
                  wide={!chatOpen}
                  focusIncidents={focus.incidents}
                  activeFocusIncident={focus.activeIncident}
                  sessionStartedAt={focus.sessionStartedAt}
                  microphoneState={focus.microphoneState}
                  simulationSilence={focus.simulationSilence}
                  onEnableMicrophone={focus.enableMicrophone}
                  onSimulationSilenceChange={focus.setSimulationSilence}
                  onOpenLibrary={() => {
                      window.location.href = "/"
                  }}
              />

              <div
                  className={cn(
                      "flex min-h-[560px] flex-col lg:sticky lg:top-6 lg:h-[calc(100svh-9rem)]",
                      !chatOpen && "hidden",
                  )}
              >
                  <TutorChat
                      deck={activeDeck}
                      currentPage={page}
                      onPageChange={setPage}
                      focusIncident={focus.activeIncident}
                      onCollapse={() => {
                          setChatOpen(false)
                          setZoomIndex((z) => (z === 2 ? 3 : z))
                      }}
                  />
              </div>
          </main>

          {!chatOpen ? (
              <button
                  type="button"
                  onClick={() => {
                      setChatOpen(true)
                      setZoomIndex((z) => (z === 3 ? 2 : z))
                  }}
                  title="Mở AI Tutor"
                  className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
              >
                  <Sparkles className="size-6" aria-hidden="true" />
                  <span className="sr-only">Mở AI Tutor</span>
              </button>
          ) : null}
      </div>
  )
}