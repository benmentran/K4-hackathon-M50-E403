# Reflection — Trần Bình Minh (2A202601434), Nhóm trưởng

## Vai trò trong nhóm

Nhóm trưởng + phụ trách **Canvas + Evidence** — chốt hướng đi (Hướng A — VLearn), viết Canvas 7 dòng nộp tại CP1, và gom bằng chứng ban đầu cho pain của học viên.

## Phần mình đã làm cụ thể

- **Canvas 7 dòng:** xác định job executor ("học viên đang học buổi học AI trên VLearn"), pain một câu (sau khi tutor trả lời 1 câu thì muốn hỏi tiếp nhưng không biết hỏi gì, nên bỏ qua điểm chưa hiểu hoặc thoát ra), và lát cắt MỘT CÂU làm nền cho cả spec sau này.
- **Evidence ban đầu:** đọc mẫu chatlog VLearn, chọn ra 2 bằng chứng nguyên văn làm điểm tựa cho pain: `C0008/U0084` (tutor hỏi chung chung, không gợi câu cụ thể) và `C0018/U0221` (học viên hỏi xong, tutor trả lời, hội thoại kết thúc không có câu hỏi tiếp theo).
- **Vai trò nhóm trưởng:** chốt phân công 5 người (Canvas+Evidence / Mining số liệu / Prompt+Build / Spec+Golden set / Validation+Slide), giữ nhịp tiến độ theo 6 mốc của `04-rubric.md`.

## AI hỗ trợ thế nào

Dùng AI (ChatGPT/Claude...) để đọc nhanh chatlog và gợi ý cách diễn đạt pain statement / job statement theo đúng khung JTBD (`tham-khao/worksheet-jtbd-day-du.md`), nên ghi rõ: dùng AI để lọc nhanh ứng viên quote đáng chú ý trong hàng trăm dòng chatlog, nhưng người quyết định quote nào đủ mạnh để đưa vào evidence vẫn là mình, vì AI có thể chọn nhầm câu không đại diện nếu không đọc lại ngữ cảnh cả đoạn hội thoại.

## Một bài học từ case fail của chính nhóm

Phần Evidence do mình phụ trách hiện mới có **2/5 quote nguyên văn** cần thiết để đạt chuẩn B (tiêu chí nghiệm thu 2 yêu cầu ≥5 ví dụ nguyên văn). Bài học ở đây: **"đọc 30-50 mẫu trước, đếm sau"** (guide §1.3) nói dễ nhưng làm thật tốn thời gian hơn tưởng tượng — 2 quote đầu tìm khá nhanh vì đúng ngay điều mình đang tìm (tutor hỏi chung chung, hội thoại cụt sau 1 câu), nhưng 3 quote còn lại đòi hỏi đọc thêm nhiều hội thoại chỉ-có-1-turn trong CSV để không lặp lại đúng 1 kiểu bằng chứng — nếu để đến sát giờ chốt spec mới làm thì rất dễ bị hụt, ảnh hưởng thẳng đến điểm R1 (Bằng chứng & impact, 15 điểm — nặng nhất trong rubric). Lần sau, việc mining bằng chứng cần làm song song và sớm hơn, không dồn hết vào 1-2 quote "trúng ý" đầu tiên rồi dừng.
