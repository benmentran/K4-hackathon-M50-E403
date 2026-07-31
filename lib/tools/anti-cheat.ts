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
 * Lightweight heuristic checker — no LLM needed.
 * For production, replace with a real LLM call using the current provider.
 */
export async function checkAcademicIntegrity(
  question: string,
  currentPage: number | null,
  slideContext: string,
): Promise<IntegrityResult> {
  const q = question.toLowerCase()

  // ── Prompt injection patterns ───────────────────────────────────────────────
  const injectionPatterns = [
    /^(bỏ qua|hủy|bỏ)\s+(hướng dẫn|system|prompt|luật)/i,
    /^(ignore|disregard|forget)\s+(previous|system|instructions)/i,
    /^(bạn\s+là\s+|you\s+are\s+now\s+)/i,
    /^(act\s+as|pretend\s+to\s+be)/i,
    /^dưới\s+vai\s+trò\s+/i,
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
    /giải\s+(bài|đề|toán|bài\s+tập)\s+[aăâáàẳẵẳắấậ]/i,
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
