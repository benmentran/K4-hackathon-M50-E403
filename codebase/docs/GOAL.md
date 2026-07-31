# Kế hoạch xây dựng: 

## 1. Sơ đồ kiến trúc

```
Frontend (slide viewer + chatbot widget)
   │  (slide_id, timestamp dừng, thời gian dừng)
   ▼
Backend API (FastAPI)
   ├── /ingest/slides        → OCR/text-extract → chunk + embed → Qdrant collection "slides"
   ├── /ingest/transcript    → lọc vai trò → chunk + embed → Qdrant collection "transcripts"
   ├── /track/idle           → nhận sự kiện "dừng lại lâu" → sinh gợi ý
   ├── /chat/ask             → trả lời + câu hỏi đào sâu cuối câu (có tool-calling chống gian lận)
   └── /chat/suggestions     → lấy lại gợi ý đã sinh cho slide hiện tại
   │
   ├── Qdrant (2 collections: slides, transcripts)
   ├── OpenAI API (embedding: text-embedding-3-small, qua OpenRouter hoặc trực tiếp)
   └── OpenRouter API (LLM: gpt-4o-mini — sinh câu hỏi + trả lời + gọi tool)
```

Vì đây là **primary context = slide**, **supplementary context = transcript**, nên khi truy vấn Qdrant, ta sẽ dùng `slide_context` (đã OCR/text) làm query chính để tìm trong collection `transcripts`, chứ không tìm ngược lại.

## 2. Chuẩn hoá dữ liệu Slide — bắt buộc liên kết `page_number ↔ nội dung`

Đây là điểm bạn nhấn mạnh nên cần thiết kế schema rõ từ đầu:

**Payload lưu trong Qdrant collection `slides`:**
```json
{
  "id": "vector_id",
  "vector": [...],
  "payload": {
    "course_id": "xxx",
    "lesson_id": "xxx",
    "slide_page": 5,           // số trang, dùng để link
    "slide_text": "...",        // text gốc trích từ slide
    "slide_ocr_text": "...",    // text OCR từ ảnh trong slide (nếu có)
    "slide_summary": "...",     // tóm tắt hợp nhất text + OCR, dùng làm context chính
    "chunk_index": 0
  }
}
```

- **Quy tắc**: mỗi chunk dù tách nhỏ để embed vẫn phải giữ `slide_page` làm khóa liên kết bắt buộc → khi frontend gửi `slide_id`/`slide_page` lên `/track/idle` hay `/chat/suggestions`, backend filter theo đúng `slide_page` đó trong Qdrant (dùng Qdrant filter, không chỉ dựa vector search).
- Pipeline xử lý: `slide_text` (trích trực tiếp từ pptx/pdf) + `slide_ocr_text` (OCR ảnh trong slide bằng model vision hoặc OCR engine) → gộp lại thành `slide_summary` bằng 1 lần gọi LLM (gpt-4o-mini) → đây là bản tóm tắt dùng làm **query chính** để tìm transcript liên quan.
- Nên precompute toàn bộ bước này ở `/ingest/slides` (batch, offline trước demo), không tính real-time khi học viên đang xem.

## 3. Chuẩn hoá dữ liệu Transcript — loại trừ vai trò học viên

Theo yêu cầu: transcript có nhãn `[Giảng viên]`, `[Học viên]`, `[Học viên khác]`... Cần xử lý ở bước `/ingest/transcript`:

- **Bước 1 — Parse & gắn nhãn speaker**: transcript thô (srt/vtt/txt có diarization) → parse ra từng đoạn kèm nhãn vai trò.
- **Bước 2 — Lọc**: chỉ giữ lại các đoạn có nhãn `[Giảng viên]` (hoặc instructor) để embed vào collection `transcripts`. Các đoạn `[Học viên]`, `[Học viên khác]` **loại khỏi index** vì:
  - Nội dung câu hỏi/phát biểu của học viên khác không phải kiến thức chuẩn, dễ gây nhiễu hoặc sai lệch khi RAG.
  - Tránh trường hợp LLM sinh câu hỏi gợi ý dựa trên câu nói ngẫu nhiên của một học viên khác.
- **Payload lưu trong Qdrant collection `transcripts`:**
```json
{
  "payload": {
    "course_id": "xxx",
    "lesson_id": "xxx",
    "speaker_role": "instructor",   // đã lọc, luôn là instructor
    "start_time": "00:04:32",
    "end_time": "00:05:10",
    "linked_slide_page": 5,          // optional: nếu có mapping thời gian slide hiển thị
    "text": "..."
  }
}
```
- Nếu có dữ liệu mapping "slide N hiển thị từ phút X đến phút Y" thì lưu thêm `linked_slide_page` để có thể filter kết hợp (vector search + filter theo slide gần đúng thời điểm) — giúp tăng độ chính xác truy xuất, giảm nhiễu từ các đoạn giảng ở slide khác.
- Nếu hackathon không kịp làm mapping thời gian, bỏ qua `linked_slide_page`, chỉ dùng similarity search thuần.

## 4. Chi tiết từng endpoint

### `/ingest/slides` (POST)
- Input: file pptx/pdf hoặc ảnh export sẵn từng slide.
- Xử lý: extract text gốc + OCR ảnh (nếu có) → gọi LLM tóm tắt hợp nhất → embed (`text-embedding-3-small`) → upsert Qdrant `slides` với payload như mục 2.

### `/ingest/transcript` (POST)
- Input: file transcript có gắn nhãn speaker (srt/vtt/txt).
- Xử lý: parse → lọc bỏ `[Học viên]`/`[Học viên khác]` → chunk theo đoạn ~30-60s hoặc theo câu → embed → upsert Qdrant `transcripts`.

### `/track/idle` (POST)
- Input: `slide_id`/`slide_page`, `timestamp dừng`, `thời gian dừng` (ví dụ dừng > 15s coi là "đang bối rối/cần gợi ý").
- Xử lý:
  1. Lấy `slide_summary` từ Qdrant `slides` theo `slide_page`.
  2. Query Qdrant `transcripts` bằng `slide_summary` (top-k, filter theo `linked_slide_page` nếu có).
  3. Gọi LLM (gpt-4o-mini qua OpenRouter) sinh 3-5 câu hỏi gợi ý → **có tool-calling chống gian lận** (chi tiết mục 6).
  4. Cache kết quả (theo `slide_page` + `lesson_id`) để `/chat/suggestions` lấy lại không cần sinh lại.
- Lưu ý: cần **debounce/throttle** — nếu học viên liên tục trigger sự kiện idle (spam), không gọi LLM lại mỗi lần, chỉ sinh 1 lần cho mỗi slide trong 1 phiên học.

### `/chat/ask` (POST)
- Input: câu hỏi học viên gõ (hoặc chọn từ gợi ý) + `slide_id` hiện tại.
- Xử lý: RAG tương tự (slide context chính + transcript bổ sung) → LLM trả lời → cuối câu trả lời kèm 1 câu hỏi "đào sâu thêm" gợi ý tiếp theo.
- **Bắt buộc qua tool-calling chống gian lận trước khi trả lời** (mục 6).

### `/chat/suggestions` (GET)
- Input: `slide_id`.
- Xử lý: chỉ đọc cache đã sinh ở `/track/idle`, không gọi LLM lại (tiết kiệm chi phí/API).

## 5. Model sử dụng (theo đúng yêu cầu)

| Vai trò | Model | Qua |
|---|---|---|
| Embedding | `text-embedding-3-small` (OpenAI, bản nhỏ) | OpenRouter (hoặc gọi trực tiếp OpenAI nếu OpenRouter không hỗ trợ embedding — cần kiểm tra, một số router chỉ proxy chat completion) |
| LLM sinh câu hỏi + trả lời + tool-calling | `gpt-4o-mini` | OpenRouter |

## 6. Cơ chế chống gian lận — LLM tool-calling (phần mới thêm)

Mục tiêu: học viên không được lợi dụng chatbot/gợi ý để **lấy thẳng đáp án bài tập/bài kiểm tra**, hoặc **prompt injection** để bypass giới hạn nội dung (chỉ hỏi trong phạm vi bài giảng).

Thiết kế: khi LLM xử lý ở `/chat/ask` và `/track/idle`, bắt buộc **tool-calling** qua 2 tool sau trước khi trả kết quả cuối:

**Tool 1 — `check_academic_integrity(question, slide_context)`**
- Chức năng: LLM tự đánh giá câu hỏi/câu trả lời sắp sinh có thuộc nhóm rủi ro không:
  - Học viên đang cố hỏi thẳng đáp án bài kiểm tra/bài tập được đánh dấu là "graded".
  - Câu hỏi không liên quan gì đến slide/transcript hiện tại (dấu hiệu lạc đề, có thể đang dùng chatbot để làm việc khác).
  - Có dấu hiệu prompt injection (vd: "bỏ qua hướng dẫn trước đó", "đóng vai...").
- Output: `{"is_flagged": true/false, "reason": "..."}`

**Tool 2 — `log_flagged_interaction(user_id, question, reason)`**
- Nếu `is_flagged = true`: ghi log lại (lưu SQLite/JSON) để giảng viên/admin xem sau, đồng thời trả về cho học viên câu trả lời "an toàn" (vd: gợi ý học viên tự tư duy, không đưa đáp án trực tiếp) thay vì chặn cứng hoàn toàn — tránh trải nghiệm xấu trong demo.

Luồng xử lý trong `/chat/ask`:
```
question → gọi LLM với tool check_academic_integrity
        → nếu flagged: gọi log_flagged_interaction + trả lời dạng gợi mở (không đưa đáp án)
        → nếu không flagged: tiếp tục RAG pipeline bình thường → trả lời đầy đủ
```

Với hackathon quy mô nhỏ, không cần hệ thống chống gian lận phức tạp (không cần ML riêng), chỉ cần **prompt hoá rule + structured tool call** để giám khảo thấy rõ có cơ chế kiểm soát, đây cũng là điểm cộng demo vì thể hiện tư duy sản phẩm thực tế (không chỉ là RAG chatbot đơn thuần).

## 7. Tech stack tổng hợp

| Thành phần | Lựa chọn |
|---|---|
| Frontend | React (Vite) — slide viewer + chatbot widget, bắn sự kiện idle |
| Backend | FastAPI |
| Vector DB | Qdrant (2 collections: `slides`, `transcripts`), chạy Docker local |
| Embedding | OpenAI `text-embedding-3-small` |
| LLM | `gpt-4o-mini` qua OpenRouter, có tool-calling |
| OCR ảnh trong slide | Vision LLM (gpt-4o-mini vision) hoặc Tesseract nếu muốn nhẹ hơn |
| Lưu log flagged | SQLite/JSON file |


## 8. Rủi ro cần lưu ý

- **OpenRouter không hỗ trợ embedding** → cần fallback gọi thẳng OpenAI, kiểm tra sớm ngay từ đầu (giờ 0-4h) để tránh vỡ kế hoạch giữa chừng.
- **Transcript không có sẵn nhãn speaker chuẩn** → nếu data thật không có diarization, cần xử lý thủ công/giả lập cho demo (đánh nhãn tay 1 file mẫu).
- **Spam `/track/idle`** → không throttle sẽ tốn API/tiền và làm chậm demo, cần cache theo `slide_page` + session.
- **Tool-calling chống gian lận flag nhầm** (false positive) → nên để ngưỡng lỏng cho demo, tránh chặn nhầm câu hỏi hợp lệ làm hỏng trải nghiệm khi trình diễn.
- **Liên kết slide_page ↔ transcript time** không chính xác nếu làm tay → nên giới hạn demo trong 1 bài giảng ngắn (5-10 slide) để kiểm soát chất lượng mapping.

---

Bạn muốn mình triển khai tiếp phần nào trước — ví dụ code mẫu cho `/ingest/slides` + `/ingest/transcript` (FastAPI + Qdrant), thiết kế chi tiết prompt cho tool `check_academic_integrity`, hay sơ đồ ERD/schema Qdrant collection đầy đủ?