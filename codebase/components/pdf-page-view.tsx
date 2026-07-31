"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"

export function PdfPageView({
  fileUrl,
  page,
}: {
  fileUrl: string
  page: number
  renderWidth: number
}) {
  const [isLoading, setIsLoading] = useState(true)

  const fullSrc = `${fileUrl}#page=${page}&zoom=page-width&toolbar=0&navpanes=0&statusbar=0&scrollbar=0&view=FitH`

  return (
    <div className="relative" style={{ minHeight: 240 }}>
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-card text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang tải slide…
        </div>
      ) : null}
      <iframe
        key={`${fileUrl}-${page}`}
        src={fullSrc}
        title={`Trang ${page}`}
        onLoad={() => setIsLoading(false)}
        className="block w-full rounded-lg border-0 bg-card"
        style={{ height: "min(80vh, 900px)", display: "block" }}
      />
    </div>
  )
}