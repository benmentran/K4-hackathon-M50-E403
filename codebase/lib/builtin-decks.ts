import type { Deck } from "@/lib/deck-types"
import type { Slide } from "@/lib/tutor-data"

const BUILTIN_PDF_FILES = {
  "day-1-ai-llm-foundation": "d1-slide-hackathon.pdf",
  "day-2-ai-problem-framing": "d2-slide-hackathon.pdf",
} as const

const DAY_1_TITLES = [
  "AI & LLM Foundation",
  "Agenda",
  "AI, ML, Deep Learning, GenAI và LLM",
  "Ba nhóm AI chính",
  "Lịch sử AI 70 năm",
  "1980: Hệ chuyên gia",
  "2009: Fei-Fei Li và ImageNet",
  "2017: Transformer",
  "2022: ChatGPT",
  "Một model nền, nhiều ứng dụng",
  "Transformer tạo phân bố xác suất",
  "Sinh văn bản: dự đoán token tiếp theo",
  "Token: model đọc các mảnh chữ",
  "Context: bàn làm việc có hạn của model",
  "Attention: mỗi từ nhìn sang từ quan trọng",
  "Quản lý context và attention",
  "Từ dense model đến Mixture of Experts",
  "LLM được tạo ra như thế nào?",
  "RLHF: uốn model thành trợ lý",
  "Những giới hạn của LLM",
  "Model học tương quan từ dữ liệu",
  "Suy luận và chuỗi tư duy",
  "Từ LLM đến AI Agent",
  "Giải phẫu một AI Agent",
  "Chi phí model giảm theo thời gian",
  "Chọn model theo tầng năng lực",
  "Token có giá",
  "Giải phẫu một prompt",
  "Temperature và top_p",
] as const

const DAY_2_TITLES = [
  "Xác định bài toán cho AI",
  "Agenda",
  "Tìm đúng vấn đề trước khi tìm giải pháp",
  "Diamond 1: Discover và Define",
  "Ba bài học từ sản phẩm thực tế",
  "Bốn lăng kính tìm bài toán AI",
  "Những sai lầm thường gặp",
  "PAIR: Reframe câu hỏi",
  "Cấu trúc Problem Statement",
  "Làm rõ quy trình và nút thắt",
  "Baseline và mục tiêu định lượng",
  "Thiết kế hệ chỉ số đo lường",
  "Giao điểm nhu cầu và thế mạnh AI",
  "Những nhóm tác vụ AI phù hợp",
  "Khi nào không nên dùng AI",
  "Các thành phần của hệ thống AI",
  "Automate hay Augment",
  "Rule, Workflow hay Agent",
  "Cấp độ 1: Luật tĩnh",
  "Workflow và Prompt Chaining",
  "Cây quyết định chọn cấp độ giải pháp",
  "Thiết kế Reward Function",
  "Precision và Recall",
  "Mẫu Reward Function",
  "Thiết lập đánh giá và đối chứng",
  "Từ Problem Statement đến quyết định",
  "Sáu yếu tố bài toán cốt lõi",
  "Go, Not Yet hay No-Go",
  "Tổng kết",
] as const

function makeOutline(titles: readonly string[]): Slide[] {
  return titles.map((title, index) => ({
    page: index + 1,
    title,
    bullets: [],
  }))
}

export const BUILTIN_DECKS: Deck[] = [
  {
    id: "day-1-ai-llm-foundation",
    title: "Day 1 — AI & LLM Foundation",
    course: "AI in Action",
    description: "Nền tảng về AI, LLM, Transformer và cách chúng hoạt động.",
    cover: "from-indigo-500 via-violet-500 to-fuchsia-500",
    tag: "AI · LLM",
    kind: "pdf",
    source: "builtin",
    pageCount: DAY_1_TITLES.length,
    firstPage: 1,
    createdAt: "2026-07-30T00:00:00.000Z",
    fileName: BUILTIN_PDF_FILES["day-1-ai-llm-foundation"],
    outline: makeOutline(DAY_1_TITLES),
  },
  {
    id: "day-2-ai-problem-framing",
    title: "Day 2 — Xác định bài toán cho AI",
    course: "AI in Action",
    description: "Khung tư duy để chọn đúng bài toán trước khi tìm giải pháp AI.",
    cover: "from-emerald-500 via-teal-500 to-cyan-500",
    tag: "AI · Problem",
    kind: "pdf",
    source: "builtin",
    pageCount: DAY_2_TITLES.length,
    firstPage: 1,
    createdAt: "2026-07-30T00:00:00.000Z",
    fileName: BUILTIN_PDF_FILES["day-2-ai-problem-framing"],
    outline: makeOutline(DAY_2_TITLES),
  },
]

export function builtinPdfFileName(deckId: string): string | null {
  return BUILTIN_PDF_FILES[deckId as keyof typeof BUILTIN_PDF_FILES] ?? null
}

export function isBuiltinDeckId(deckId: string): boolean {
  return builtinPdfFileName(deckId) !== null
}
