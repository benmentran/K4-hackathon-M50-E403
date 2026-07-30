"use client"

import { useState } from "react"
import { GraduationCap } from "lucide-react"
import { SlidePanel } from "@/components/slide-panel"
import { TutorChat } from "@/components/tutor-chat"
import { LESSON } from "@/lib/tutor-data"

export default function Page() {
  const [page, setPage] = useState(7)

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

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 md:px-8 lg:grid-cols-[1fr_400px]">
        <SlidePanel page={page} />
        <div className="flex min-h-[560px] flex-col lg:h-[calc(100svh-9rem)] lg:sticky lg:top-6">
          <TutorChat onPageChange={setPage} />
        </div>
      </main>
    </div>
  )
}
