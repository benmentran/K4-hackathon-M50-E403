# Reflection — Tạ Đăng Đức (2A202601772)

## Vai trò trong nhóm

Tôi phụ trách **Spec + Golden set** — viết `spec.md` theo `03-template-ai-spec.md` (§1-§9) và xây bộ kiểm thử `eval/golden-set.md`.

## Phần mình đã làm cụ thể

- **Spec:** ghép nội dung Canvas (hướng, job executor, pain, lát cắt) với dữ liệu mining thật từ `data/vlearn-pack/chatlog/DATA_DICTIONARY.md` thành đủ 9 phần của template — đặc biệt là bảng impact §2 (so 3 ứng viên bằng số: 100% turn thiếu follow-up vs 46.2% turn thiếu citation vs 0.12% turn có hỏi lại kiểm tra hiểu), và chốt quality bar ở §7.
- **Golden set:** xây 28 case (14 case lấy từ chatlog thật, 14 case tự tạo), phân vào đúng 4 lớp chỗ khó (①③④② theo taxonomy của khoá) để đảm bảo mỗi lớp có ≥2 case, không dồn hết vào case dễ.
- **Đọc kết quả run-01** và viết phần phân tích nguyên nhân ở §7 khi tỉ lệ pass chỉ đạt 57.1% (16/28), thấp hơn bar nhóm tự đặt (70%).

## AI hỗ trợ thế nào

Tôi dùng Claude Code để:
- Đọc chéo nhanh các file lớn (`DATA_DICTIONARY.md`, `eval/run-01-baseline.md`, code `lib/tools/anti-cheat.ts`, `lib/rag.ts`) và tổng hợp lại số liệu thay vì phải đếm tay từng dòng CSV.
- Rà lại toàn bộ spec cũ (chỉ có 7 dòng Canvas) so với template đầy đủ 9 phần, chỉ ra những phần còn thiếu (§3 nghiên cứu sản phẩm tương tự, đủ 5 quote nguyên văn ở §1) thay vì để trống mà không ai biết.
- Phát hiện một điểm bất thường: case G-11 (input chỉ có 1 ký tự "d") đáng lẽ phải bị hàm `isGibberish()` trong `anti-cheat.ts` chặn lại, nhưng kết quả run-01 vẫn ra một câu trả lời đầy đủ — nghĩa là **run-01 nhiều khả năng chưa được chạy qua đúng pipeline `/api/tutor` thật**, mà là test tay qua prompt nháp. Đây là gợi ý AI đưa ra dựa trên đối chiếu code với log, tôi phải tự đọc lại code để xác nhận logic đó đúng trước khi đưa vào spec.

## Một bài học từ case fail của chính nhóm

Case đáng nhớ nhất là **run-01 chỉ đạt 57.1%, thấp hơn hẳn quality bar 70%** mà nhóm tự đặt, và phần lớn case fail rơi vào đúng nhóm "input mơ hồ/ngoài phạm vi" (②③) — tức là chỗ mà lẽ ra một tutor tốt phải *thận trọng* nhất thì hệ thống lại trả lời tự tin nhất. Bài học tôi rút ra: **golden set và quality bar chỉ có giá trị nếu được đo trên đúng con đường sản phẩm thật sẽ chạy** — nếu test tay qua prompt nháp (bỏ qua lớp anti-cheat đã build) thì con số đo được sẽ đẹp/xấu sai lệch so với thực tế, và nhóm sẽ tự đánh lừa chính mình về việc tính năng đã "chắc" tới đâu. Lần sau, việc đầu tiên trước khi tin vào một con số % là hỏi lại: "case này chạy qua đúng API thật hay chỉ qua chat thử tay?" — chứ không nhận số liệu theo mặt chữ.
