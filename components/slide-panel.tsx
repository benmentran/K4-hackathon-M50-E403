"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, LogOut, Mic, RotateCcw, VolumeX, ZoomIn, ZoomOut } from "lucide-react"
import { PdfPageView } from "@/components/pdf-page-view"
import type { FocusIncident, MicrophoneState } from "@/components/focus-tracker"
import { type Deck, pdfFileUrl } from "@/lib/deck-types"
import { cn } from "@/lib/utils"

const ZOOM_STEPS = [0.75, 0.9, 1, 1.25, 1.5, 1.75, 2]
const DEFAULT_ZOOM_INDEX = 2

export function SlidePanel({
  deck,
  page,
  onPageChange,
  zoomIndex,
  onZoomIndexChange,
  wide,
  focusIncidents,
  activeFocusIncident,
  sessionStartedAt,
  microphoneState,
  simulationSilence,
  onEnableMicrophone,
  onSimulationSilenceChange,
  onOpenLibrary,
}: {
  deck: Deck
  page: number
  onPageChange: (page: number) => void
  zoomIndex: number
  onZoomIndexChange: (index: number) => void
  wide: boolean
  focusIncidents: FocusIncident[]
  activeFocusIncident: FocusIncident | null
  sessionStartedAt: number
  microphoneState: MicrophoneState
  simulationSilence: boolean
  onEnableMicrophone: () => Promise<void>
  onSimulationSilenceChange: (enabled: boolean) => void
  onOpenLibrary: () => void
}) {
  const slides = deck.outline
  const index = Math.max(
      0,
      slides.findIndex((s) => s.page === page),
  )
  const slide = slides[index]
  const zoom = ZOOM_STEPS[zoomIndex]
  const canvasRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(720)

  useEffect(() => {
      canvasRef.current?.scrollTo({ top: 0 })
  }, [page, deck.id])

  useLayoutEffect(() => {
      const el = canvasRef.current
      if (!el) return

      const observer = new ResizeObserver(([entry]) => {
          const width = entry.contentRect.width
          if (width > 0) setContainerWidth(width)
      })
      observer.observe(el)
      return () => observer.disconnect()
  }, [])

  function goTo(i: number) {
      const next = slides[Math.min(slides.length - 1, Math.max(0, i))]
      if (next) onPageChange(next.page)
  }

  if (!slide) {
      return (
          <section aria-label="Slide bài giảng" className="flex min-w-0 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <FileText className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Bộ slide này chưa có trang nào.</p>
          </section>
      )
  }

  return (
      <section aria-label="Slide bài giảng" className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{deck.title}</span>
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground">
                      {index + 1}/{slides.length}
                  </span>
              </div>

              <div className="flex items-center gap-2">
                  <button
                      type="button"
                      onClick={onOpenLibrary}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive lg:hidden"
                  >
                      <LogOut className="size-3.5" aria-hidden="true" />
                      Thoát
                  </button>

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
                      <span
                          className="min-w-11 text-center text-xs font-medium tabular-nums text-muted-foreground"
                          aria-live="polite"
                      >
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
          </div>

          <div
              ref={canvasRef}
              className={cn(
                  "overflow-auto rounded-xl border border-border bg-card shadow-sm",
                  wide ? "h-[clamp(340px,58svh,620px)]" : "h-[clamp(320px,46svh,520px)]",
              )}
          >
              {deck.kind === "pdf" ? (
                  <div className="p-4" style={{ width: `${Math.max(100, zoom * 100)}%` }}>
                      <PdfPageView
                          key={deck.id}
                          fileUrl={pdfFileUrl(deck.id)}
                          page={slide.page}
                          renderWidth={Math.max(320, (containerWidth - 32) * zoom)}
                      />
                  </div>
              ) : (
                  <div className="origin-top-left p-6 md:p-8" style={{ width: `${100 / zoom}%`, transform: `scale(${zoom})` }}>
                      <p className="text-xs font-medium uppercase tracking-wide text-primary">Trang {slide.page}</p>
                      <h2 className="mt-2 text-balance text-2xl font-semibold leading-snug text-card-foreground">
                          {slide.title}
                      </h2>
                      <ul className="mt-5 flex flex-col gap-3">
                          {slide.bullets.map((b) => (
                              <li key={b} className="flex gap-3 text-base leading-relaxed text-muted-foreground">
                                  <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                  <span className="text-pretty">{b}</span>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}
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
                  max={Math.max(0, slides.length - 1)}
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

          <FocusTimeline
              incidents={focusIncidents}
              activeIncident={activeFocusIncident}
              sessionStartedAt={sessionStartedAt}
              microphoneState={microphoneState}
              simulationSilence={simulationSilence}
              onEnableMicrophone={onEnableMicrophone}
              onSimulationSilenceChange={onSimulationSilenceChange}
          />
      </section>
  )
}

function FocusTimeline({
  incidents,
  activeIncident,
  sessionStartedAt,
  microphoneState,
  simulationSilence,
  onEnableMicrophone,
  onSimulationSilenceChange,
}: {
  incidents: FocusIncident[]
  activeIncident: FocusIncident | null
  sessionStartedAt: number
  microphoneState: MicrophoneState
  simulationSilence: boolean
  onEnableMicrophone: () => Promise<void>
  onSimulationSilenceChange: (enabled: boolean) => void
}) {
  const allIncidents = activeIncident ? [...incidents, activeIncident] : incidents

  return (
      <section aria-label="Focus Timeline" className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                  <h2 className="text-sm font-semibold text-card-foreground">Focus Timeline</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Các khoảng cần nghỉ hoặc quay lại bài học.</p>
              </div>
              <div className="flex items-center gap-2">
                  {microphoneState !== "ready" ? (
                      <button
                          type="button"
                          onClick={() => void onEnableMicrophone()}
                          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                      >
                          <Mic className="size-3.5" aria-hidden="true" />
                          {microphoneState === "unavailable" ? "Mic không khả dụng" : "Bật mic"}
                      </button>
                  ) : null}
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                          type="checkbox"
                          checked={simulationSilence}
                          onChange={(event) => onSimulationSilenceChange(event.target.checked)}
                          className="accent-primary"
                      />
                      Mô phỏng silence
                  </label>
              </div>
          </div>

          {allIncidents.length === 0 ? (
              <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Chưa ghi nhận khoảng mất tập trung trong phiên này.
              </p>
          ) : (
              <ol className="mt-4 flex flex-col gap-2">
                  {allIncidents.map((incident) => {
                      const startMinute = Math.max(0, Math.floor((incident.startMs - sessionStartedAt) / 60_000))
                      const endMinute = incident.endMs
                          ? Math.max(startMinute + 1, Math.ceil((incident.endMs - sessionStartedAt) / 60_000))
                          : null
                      const label = endMinute ? `phút ${startMinute}–${endMinute}` : `từ phút ${startMinute}`
                      return (
                          <li key={incident.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                              {incident.kind === "lost-focus" ? (
                                  <VolumeX className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                              ) : (
                                  <span className="size-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                              )}
                              <span className="text-xs text-foreground">
                                  Bạn mất tập trung {label}
                                  <span className="ml-1 text-muted-foreground">
                                      ({incident.kind === "lost-focus" ? "silence + không tương tác" : "không tương tác"})
                                  </span>
                              </span>
                          </li>
                      )
                  })}
              </ol>
          )}
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
