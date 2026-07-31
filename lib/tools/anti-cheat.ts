/**
 * Anti-cheat tools — GOAL.md §6.
 *
 * Implements two tools as async helpers (not real OpenAI function-calling,
 * because we want the logic to be provider-agnostic — works with Gemini/Mistral too):
 *
 * 1. checkAcademicIntegrity()  — flags questions that look like:
 *       - asking for direct exam/homework answers
 *       - completely off-topic from the current slide
 *       - prompt injection attempts
 *       - general chat / personal questions unrelated to learning
 *
 * 2. logFlaggedInteraction()   — persists flagged events to data/flagged-log.jsonl
 *                                so instructors can audit them.
 *
 * The actual tool-calling enforcement happens in the tutor API route: we call
 * checkAcademicIntegrity() BEFORE the RAG pipeline, and if is_flagged=true we
 * short-circuit with a safe response instead of calling the LLM for a real answer.
 */

import { appendFile, mkdir } from "node:fs/promises"
import path from "node:path"

export type IntegrityResult = {
  is_flagged: boolean
  reason: string
  risk_level: "none" | "low" | "medium" | "high"
}

/**
 * Patterns for questions that are clearly off-topic / not learning-related.
 * These questions should be politely declined regardless of slide context.
 */
const OFF_TOPIC_PATTERNS = [
  // Time/date unrelated to course content
  /ngày\s*(mai|mùng|hôm qua|thứ|mới)/i,
  /mấy\s*giờ|rời\s*giờ|giờ\s*(hiện|là)/i,
  /hôm\s*(nay|nào)|tháng\s*nào/i,
  /năm\s*(nay|nào)|ngày\s*sinh/i,

  // General chat / greetings / small talk
  /^(chào|hi|hello|hey|xin\s*chào)/i,
  /^(cảm\s*ơn|camon|cám\s*ơn|cảm ơn)/i,
  /^(tạm\s*biệt|bye|tạm\s*nói\s*sau)/i,
  /bạn\s+(khỏe|ở\s*đâu|làm\s*gì)/i,

  // Personal / lifestyle questions
  /bạn\s+(tên|gọi|là)\s*(gì|ai)/i,
  /(mưa|nắng|thời\s*tiết)\s*(hôm|ngày| mai)/i,
  /món\s*(ăn|vn)|quán\s*(cà\s*phê|cafe|nhậu)/i,

  // Math / calculator requests
  /tính\s*(giúp|tôi)\s*[\d+\-*/=]/i,
  /=\s*[\d+\-*/()]+/i,
  /cộng\s*(với|dương)|trừ\s*(đi|bớt)/i,

  // Non-learning questions
  /tỷ\s*lệ\s*(thắng|chiến\s*thắng|score)/i,
  /(trận|đội|tuyển)\s*(nào|bóng\s*đá)/i,
  /giá\s*(vàng|xu|bitcoin|crypto)/i,
  /tin\s*(tức|mới|nóng)\s*(hôm|nay)/i,
]

/**
 * Check if a question is "gibberish" — only random characters / no real words.
 * Catches: "hgfghgfgf", "asdfasdf", "aaaa", "123456", "....", "@#$%^"
 */
function isGibberish(question: string): boolean {
  const stripped = question.replace(/[\s\u200b\u200c\u200d\ufeff]/g, "")
  if (stripped.length < 3) return true

  // Strip all Vietnamese diacritics/tone marks to count base letters
  const normalized = stripped
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
  const letters = normalized.replace(/[^a-zA-ZÀ-ỹ]/g, "")
  const onlySpecial = normalized.replace(/[a-zA-ZÀ-ỹ]/g, "")

  // Only special chars (no letters at all)
  if (letters.length === 0 && stripped.length > 0) return true

  // Same character repeated 5+ times: "aaaaaaa", "1111111"
  if (/^(.)\1{4,}$/.test(stripped)) return true

  // Same 2-char pattern repeated: "ababab", "121212"
  if (/^(..)\1{3,}$/.test(stripped)) return true

  // Keyboard mashing: too many consecutive consonants with no vowels
  const vowels = stripped.match(/[aeiouyăâêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi)
  const vowelRatio = vowels ? vowels.length / letters.length : 0
  if (letters.length >= 6 && vowelRatio < 0.15) return true

  // Mostly repeated keystrokes / no Word boundaries
  if (letters.length > 0 && onlySpecial.length / letters.length > 0.6) return true

  return false
}

/**
 * Lightweight heuristic checker — no LLM needed.
 * For production, replace with a real LLM call using the current provider.
 */
export async function checkAcademicIntegrity(
  question: string,
  currentPage: number | null,
  slideContext: string,
): Promise<IntegrityResult> {
  const q = question.toLowerCase().trim()

  // ── Prompt injection patterns ───────────────────────────────────────────────
  const injectionPatterns = [
    /^(bỏ qua|hủy|bỏ)\s+(hướng dẫn|system|prompt|luật)/i,
    /^(ignore|disregard|forget)\s+(previous|system|instructions)/i,
    /^(bạn\s+là\s+|you\s+are\s+now\s+)/i,
    /^(act\s+as|pretend\s+to\s+be)/i,
    /^dưới\s+vai\s*trò\s+/i,
  ]
  for (const pat of injectionPatterns) {
    if (pat.test(q)) {
      return {
        is_flagged: true,
        reason: "Phát hiện prompt injection — câu hỏi cố gắng thay đổi hành vi của tutor.",
        risk_level: "high",
      }
    }
  }

  // ── Direct exam / graded-assignment patterns ───────────────────────────────
  const examPatterns = [
    /đáp án\s+(bài|đề|kiểm\s*tra|quiz|thi|exam)/i,
    /giải\s+(bài|đề|toán|bài\s*tập)\s+[aăâáàẳẵẳắấậ]/i,
    /làm\s+(thay|bài|hộ)\s+(tôi|bạn|mình)/i,
    /chép\s+(bài|đáp án)/i,
    /bài\s+(kiểm\s*tra|quiz|thi)\s+(số|mấy)/i,
    /(viết|làm)\s+bài\s+\d+/i,
  ]
  for (const pat of examPatterns) {
    if (pat.test(q)) {
      return {
        is_flagged: true,
        reason: "Câu hỏi yêu cầu đáp án bài kiểm tra / bài tập — không đưa đáp án trực tiếp.",
        risk_level: "high",
      }
    }
  }

  // ── Off-topic: clearly not learning-related ─────────────────────────────────
  for (const pat of OFF_TOPIC_PATTERNS) {
    if (pat.test(q)) {
      return {
        is_flagged: true,
        reason: "Câu hỏi không liên quan đến nội dung bài học — vui lòng hỏi về slide hoặc chủ đề đang học nhé.",
        risk_level: "low",
      }
    }
  }

  // ── Gibberish: random characters, no real words ────────────────────────────
  if (isGibberish(question)) {
    return {
      is_flagged: true,
      reason: "Câu hỏi không có nội dung rõ ràng — vui lòng nhập câu hỏi bằng tiếng Việt để mình hỗ trợ nhé.",
      risk_level: "low",
    }
  }

  // ── Off-topic: question has no overlap with slide context ──────────────────
  // We use a cheap word-overlap check (in production: embed both and cosine-sim).
  if (slideContext && currentPage != null) {
    const contextTokens = new Set(slideContext.toLowerCase().split(/\s+/).filter((t) => t.length > 3))
    const questionTokens = q.split(/\s+/).filter((t) => t.length > 3)
    const overlap = questionTokens.filter((t) => contextTokens.has(t)).length
    const coverage = overlap / questionTokens.length
    if (coverage < 0.15 && questionTokens.length > 3) {
      return {
        is_flagged: true,
        reason:
          "Câu hỏi có vẻ không liên quan đến nội dung slide hiện tại — có thể đang hỏi về chủ đề khác.",
        risk_level: "medium",
      }
    }
  }

  // ── Sensitive / personal data request ──────────────────────────────────────
  const sensitivePatterns = [
    /(\d{9,12}|cccd|cmnd|passport)/i,
    /(sdt|số\s*điện\s*thoại|email|zalo|telegram)/i,
    /(địa\s*chỉ|mật\s*khẩu|password)/i,
  ]
  for (const pat of sensitivePatterns) {
    if (pat.test(q)) {
      return {
        is_flagged: true,
        reason: "Câu hỏi có thể yêu cầu thông tin nhạy cảm cá nhân.",
        risk_level: "medium",
      }
    }
  }

  return { is_flagged: false, reason: "", risk_level: "none" }
}

export type FlaggedLog = {
  timestamp: string
  question: string
  reason: string
  risk_level: IntegrityResult["risk_level"]
  current_page: number | null
}

const FLAG_LOG_PATH = "data/flagged-log.jsonl"

export async function logFlaggedInteraction(
  question: string,
  reason: string,
  risk_level: IntegrityResult["risk_level"],
  currentPage: number | null,
): Promise<void> {
  const entry: FlaggedLog = {
    timestamp: new Date().toISOString(),
    question,
    reason,
    risk_level,
    current_page: currentPage,
  }
  try {
    await mkdir(path.dirname(FLAG_LOG_PATH), { recursive: true })
    await appendFile(FLAG_LOG_PATH, JSON.stringify(entry) + "\n", "utf8")
  } catch {
    // best effort — don't crash the response if logging fails
    console.warn("[anti-cheat] Failed to write flagged log:", FLAG_LOG_PATH)
  }
}

/**
 * Returns a safe response when a question is flagged.
 * Per GOAL.md §6: "gợi ý học viên tự tư duy, không đưa đáp án trực tiếp".
 */
export function safeResponse(page: number | null): string {
  return page != null
    ? `Câu hỏi của bạn có thể nằm ngoài nội dung slide ${page}. Hãy thử đặt câu hỏi cụ thể hơn về nội dung đang học, hoặc nhắn lại để mình hỗ trợ đúng trọng tâm nhé.`
    : `Câu hỏi của bạn có thể nằm ngoài nội dung bài giảng hiện tại. Hãy thử đặt câu hỏi cụ thể hơn để mình hỗ trợ đúng trọng tâm nhé.`
}
