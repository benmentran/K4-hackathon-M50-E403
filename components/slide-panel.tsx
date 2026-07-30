"use client"

import { useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight, FileText, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { LESSON } from "@/lib/tutor-data"
import { cn } from "@/lib/utils"

const ZOOM_STEPS = [0.75, 0.9, 1, 1.25, 1.5, 1.75, 2]
const DEFAULT_ZOOM_INDEX = 2

export function SlidePanel({
  page,
  onPageChange,
  zoomIndex,
  onZoomIndexChange,
  wide,
}: {
  page: number
  onPageChange: (page: number) => void
  zoomIndex: number
  onZoomIndexChange: (index: number) => void
  wide: boolean
}) {
  const slides = LESSON.slides
  const index = Math.max(
    0,
    slides.findIndex((s) => s.page === page),
  )
  const slide = slides[index]
  const zoom = ZOOM_STEPS[zoomIndex]
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    canvasRef.current?.scrollTo({ top: 0 })
  }, [page])

  function goTo(i: number) {
    const next = slides[Math.min(slides.length - 1, Math.max(0, i))]
    if (next) onPageChange(next.page)
  }

  return (
    <section aria-label="Slide bài giảng" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{LESSON.session}</span>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
            {index + 1}/{slides.length}
          </span>
        </div>

        <div
          role="group"
          aria-label="Phóng to, thu nhỏ slide"
          className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"
        >
          <IconButton
            label="Thu nhỏ slide"
            disabled={zoomIndex === 0}
            onClick={() => onZoomIndexChange(zoomIndex - 1)}
          >
            <ZoomOut className="size-4" aria-hidden="true" />
          </IconButton>
          <span className="min-w-11 text-center text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            label="Phóng to slide"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => onZoomIndexChange(zoomIndex + 1)}
          >
            <ZoomIn className="size-4" aria-hidden="true" />
          </IconButton>
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
          <IconButton
            label="Đặt lại cỡ mặc định"
            disabled={zoomIndex === DEFAULT_ZOOM_INDEX}
            onClick={() => onZoomIndexChange(DEFAULT_ZOOM_INDEX)}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </IconButton>
        </div>
      </div>

      <div
        ref={canvasRef}
        className={cn(
          "overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-card shadow-sm",
          wide ? "h-[clamp(340px,58svh,620px)]" : "h-[clamp(320px,46svh,520px)]",
        )}
      >
        <div className="p-6 md:p-8" style={{ zoom }}>
          <p className="text-xs font-medium uppercase tracking-wide text-primary">Trang {slide.page}</p>
          <h2 className="mt-2 text-balance text-2xl font-semibold leading-snug text-card-foreground">{slide.title}</h2>
          <ul className="mt-5 flex flex-col gap-3">
            {slide.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-base leading-relaxed text-muted-foreground">
                <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-pretty">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <IconButton label="Slide trước" disabled={index === 0} onClick={() => goTo(index - 1)} bordered>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </IconButton>

        <label htmlFor="slide-range" className="sr-only">
          Kéo để chuyển slide
        </label>
        <input
          id="slide-range"
          type="range"
          min={0}
          max={slides.length - 1}
          step={1}
          value={index}
          onChange={(e) => goTo(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />

        <IconButton
          label="Slide sau"
          disabled={index === slides.length - 1}
          onClick={() => goTo(index + 1)}
          bordered
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Danh sách trang trong buổi học">
        {slides.map((s) => (
          <button
            key={s.page}
            type="button"
            onClick={() => onPageChange(s.page)}
            aria-current={s.page === slide.page ? "true" : undefined}
            className={cn(
              "flex w-32 shrink-0 flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-colors",
              s.page === slide.page
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-medium",
                s.page === slide.page ? "text-primary" : "text-muted-foreground",
              )}
            >
              Trang {s.page}
            </span>
            <span className="truncate text-xs text-card-foreground">{s.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  bordered,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  bordered?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-35",
        bordered && "border border-border bg-card",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}
