"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react"
import type { Deck } from "@/lib/deck-types"
import { extractOutline, openPdf } from "@/lib/pdf-client"
import { cn } from "@/lib/utils"

type UploadState = { name: string; step: string } | null

export function DeckLibrary({
  decks,
  activeId,
  loading,
  onSelect,
  onUploaded,
  onDeleted,
  onClose,
}: {
  decks: Deck[]
  activeId: string
  loading: boolean
  onSelect: (deck: Deck) => void
  onUploaded: (deck: Deck) => void
  onDeleted: (id: string) => void
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState<UploadState>(null)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"))

    if (pdfs.length === 0) {
      setError("Chỉ hỗ trợ file PDF")
      return
    }

    setError(null)

    for (const file of pdfs) {
      try {
        setUploading({ name: file.name, step: "Đang đọc nội dung…" })

        const buffer = await file.arrayBuffer()
        const doc = await openPdf(buffer.slice(0))
        const outline = await extractOutline(doc, (done, total) => {
          setUploading({ name: file.name, step: `Đang đọc trang ${done}/${total}…` })
        })
        void doc.destroy()

        setUploading({ name: file.name, step: "Đang lưu vào thư viện…" })

        const body = new FormData()
        body.append("file", file)
        body.append("title", file.name.replace(/\.pdf$/i, ""))
        body.append("outline", JSON.stringify(outline))

        const res = await fetch("/api/decks", { method: "POST", body })
        const data = await res.json()

        if (!res.ok) throw new Error(data?.error ?? "Tải lên thất bại")

        onUploaded(data.deck as Deck)
      } catch (err) {
        console.error("[v0] deck upload error:", err)
        setError(err instanceof Error ? err.message : "Tải lên thất bại")
      } finally {
        setUploading(null)
      }
    }

    if (inputRef.current) inputRef.current.value = ""
  }

  async function handleDelete(deck: Deck) {
    setDeletingId(deck.id)
    try {
      const res = await fetch(`/api/decks/${deck.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Xoá thất bại")
      onDeleted(deck.id)
    } catch (err) {
      console.error("[v0] deck delete error:", err)
      setError("Không xoá được slide này")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <aside
      aria-label="Thư viện slide"
      className="flex min-h-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold text-card-foreground">Thư viện slide</h2>
        <button
          type="button"
          onClick={onClose}
          title="Đóng thư viện"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Đóng thư viện</span>
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border bg-muted/40",
        )}
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          Kéo file PDF vào đây hoặc chọn từ máy. Có thể nạp nhiều file.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(uploading)}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Chọn file PDF
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => void handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {uploading ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
          <span className="truncate">
            {uploading.name} — {uploading.step}
          </span>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {loading ? (
          <p className="px-1 text-xs text-muted-foreground">Đang tải thư viện…</p>
        ) : null}

        {decks.map((deck) => {
          const active = deck.id === activeId
          return (
            <div
              key={deck.id}
              className={cn(
                "group flex items-start gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40 hover:bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(deck)}
                aria-current={active ? "true" : undefined}
                className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {deck.kind === "sample" ? (
                    <Sparkles className="size-3.5" aria-hidden="true" />
                  ) : (
                    <FileText className="size-3.5" aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-card-foreground">{deck.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {deck.kind === "sample"
                      ? "Slide mẫu"
                      : deck.source === "builtin"
                        ? `${deck.pageCount} trang · Kèm sẵn`
                        : `${deck.pageCount} trang`}
                  </span>
                </span>
              </button>

              {deck.kind === "pdf" && deck.source !== "builtin" ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(deck)}
                  disabled={deletingId === deck.id}
                  title={`Xoá ${deck.title}`}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                >
                  {deletingId === deck.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  )}
                  <span className="sr-only">Xoá {deck.title}</span>
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
