"use client"

import { useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { GraduationCap, Library, Search, Sparkles, Upload } from "lucide-react"
import { DeckCard } from "@/components/deck-card"
import { BUILTIN_DECKS } from "@/lib/builtin-decks"
import type { Deck } from "@/lib/deck-types"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function HomePage() {
  const { data, isLoading, mutate } = useSWR<{ decks: Deck[] }>("/api/decks", fetcher)
  const [query, setQuery] = useState("")
  const [uploading, setUploading] = useState<{ name: string; step: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const decks = useMemo<Deck[]>(() => [...BUILTIN_DECKS, ...(data?.decks ?? [])], [data])
  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return decks
    return decks.filter((deck) => {
      return (
        deck.title.toLowerCase().includes(q) ||
        deck.course.toLowerCase().includes(q) ||
        deck.outline.some((s) => s.title.toLowerCase().includes(q))
      )
    })
  }, [decks, query])

  function handleUploadClick() {
    fileInputRef.current?.click()
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    )
    if (pdfs.length === 0) {
      setError("Chỉ hỗ trợ file PDF")
      return
    }
    setError(null)
    for (const file of pdfs) {
      try {
        setUploading({ name: file.name, step: "Đang tải lên…" })
        const formData = new FormData()
        formData.append("file", file)
        formData.append("title", file.name.replace(/\.pdf$/i, ""))
        const res = await fetch("/api/decks", { method: "POST", body: formData })
        const payload = await res.json()
        if (!res.ok) throw new Error(payload?.error ?? "Tải lên thất bại")
        setUploading({ name: file.name, step: "Hoàn tất" })
        void mutate()
      } catch (err) {
        console.error("[home] upload failed:", err)
        setError(err instanceof Error ? err.message : "Tải lên thất bại")
      } finally {
        setTimeout(() => setUploading(null), 1200)
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-4 md:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">VLearn</span>
              <span className="text-xs text-muted-foreground">AI in Action</span>
            </div>
          </div>

          <div className="order-3 flex w-full md:order-2 md:flex-1 md:justify-center">
            <label htmlFor="deck-search" className="sr-only">
              Tìm slide
            </label>
            <div className="relative w-full md:max-w-xl">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="deck-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm slide theo chủ đề…"
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="order-2 flex items-center gap-2 md:order-3">
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline">
              {decks.length} bộ slide
            </span>
            <button
              type="button"
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Upload className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Nạp slide</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => void handleFiles(e.target.files)}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-balance text-2xl font-semibold text-foreground md:text-3xl">
            Khoá học của bạn
          </h1>
          <p className="text-sm text-muted-foreground">
            {decks.length} bộ slide sẵn sàng — bấm vào thẻ để mở AI tutor.
          </p>
        </div>

        {uploading ? (
          <p
            className="mb-4 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground"
            aria-live="polite"
          >
            <Sparkles className="size-4 animate-pulse text-primary" aria-hidden="true" />
            <span className="truncate">
              {uploading.name} — {uploading.step}
            </span>
          </p>
        ) : null}
        {error ? (
          <p
            className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {isLoading ? <p className="text-sm text-muted-foreground">Đang tải thư viện…</p> : null}

        {!isLoading && filteredDecks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
            <Library className="size-6 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Không tìm thấy slide nào</p>
              <p className="text-xs text-muted-foreground">
                Thử từ khoá khác, hoặc nạp file PDF mới.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUploadClick}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Upload className="size-4" aria-hidden="true" />
              Nạp slide PDF
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDecks.map((deck, index) => (
              <DeckCard key={deck.id} deck={deck} index={index} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}