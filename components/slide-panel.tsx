import { FileText } from "lucide-react"
import { LESSON } from "@/lib/tutor-data"

export function SlidePanel({ page }: { page: number }) {
  const slide = LESSON.slides.find((s) => s.page === page) ?? LESSON.slides[0]

  return (
    <section aria-label="Slide bài giảng" className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
        <span>
          {LESSON.session} · Slide {slide.page}
        </span>
      </div>

      <div className="flex aspect-16/10 flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-balance text-xl font-semibold leading-snug text-card-foreground">{slide.title}</h2>
        <ul className="flex flex-col gap-3">
          {slide.bullets.map((b) => (
            <li key={b} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-pretty">{b}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Các trang trong buổi học">
        {LESSON.slides.map((s) => (
          <span
            key={s.page}
            className={
              s.page === slide.page
                ? "rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
            }
          >
            Trang {s.page}
          </span>
        ))}
      </div>
    </section>
  )
}
