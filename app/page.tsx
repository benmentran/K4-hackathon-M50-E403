"use client"

import { useState } from "react"
import { GraduationCap, Bot, Sparkles } from "lucide-react"
import { SlidePanel } from "@/components/slide-panel"
import { TutorChat } from "@/components/tutor-chat"
import { LESSON } from "@/lib/tutor-data"
import { cn } from "@/lib/utils"

export default function Page() {
  const [page, setPage] = useState(7)
  const [chatOpen, setChatOpen] = useState(true)
  const [zoomIndex, setZoomIndex] = useState(2)

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
            <span className="text-xs text-muted-foreground">{LESSON.course}</span>
          </div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Demo · Follow-up Q</span>
      </header>

      <main
        className={cn(
          "mx-auto grid w-full flex-1 gap-6 px-4 py-6 md:px-8",
          chatOpen ? "max-w-6xl lg:grid-cols-[minmax(0,1fr)_380px]" : "max-w-5xl grid-cols-1 pb-28",
        )}
      >
        <SlidePanel
          page={page}
          onPageChange={setPage}
          zoomIndex={zoomIndex}
          onZoomIndexChange={setZoomIndex}
          wide={!chatOpen}
        />

        <div
          className={cn(
            "flex min-h-[560px] flex-col lg:sticky lg:top-6 lg:h-[calc(100svh-9rem)]",
            !chatOpen && "hidden",
          )}
        >
          <TutorChat onPageChange={setPage} onCollapse={collapseChat} />
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
