# VLearn AI Tutor

Prototype hackathon cho trải nghiệm học slide với AI Tutor, Focus Timeline và Smart Reminder.

## Thành viên và phân công

| STT | Mã HV | Họ và tên | Phân công |
| --- | --- | --- | --- |
| 1 | 2A202601434 | Trần Bình Minh | Canvas + Evidence |
| 2 | 2A202601760 | Trần Kiều Hạnh | Mining số liệu |
| 3 | 2A202601682 | Lương Bảo Long | Prompt + Build |
| 4 | 2A202601772 | Tạ Đăng Đức | Spec + Golden set |
| 5 | 2A202601756 | Trần An Thắng | Validation + Slide |

## Cấu trúc nộp bài

- `spec.md`: AI Spec và quality bar.
- `demo-slides.pdf`: slide demo 6 trang.
- `codebase/`: prototype Next.js chạy được.
- `eval/`: golden set và kết quả các lượt chạy.
- `validation/`: feedback log từ user test.
- `reflection/`: reflection riêng của từng thành viên.

## Chạy prototype

```powershell
cd codebase
pnpm install
pnpm dev
```

Mở `http://localhost:3000`, chọn một bộ slide rồi mở Focus Timeline.

Kiểm tra nhanh:

```powershell
cd codebase
pnpm exec tsc --noEmit
pnpm build
```

## Phần thật và phần mock

- **Thật:** Next.js UI, slide viewer, gọi tutor/LLM, RAG Qdrant khi được cấu hình, anti-cheat, Focus Timeline, mouse/keyboard tracking và microphone Web Audio.
- **Mock/demo:** checkbox `Mô phỏng silence` thay cho microphone; suggestion cache là module-level memory; ngưỡng idle cố định 15 giây; timeline chỉ tồn tại trong phiên hiện tại.
- Microphone cần quyền trình duyệt. Từ chối quyền không làm hỏng luồng học và không tự gắn nhãn `lost focus`.

## Tài liệu

Tài liệu hướng dẫn nội bộ được giữ trong `codebase/docs/` để không lẫn với artifact nộp bài.
