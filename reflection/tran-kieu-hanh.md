# Reflection — Trần Kiều Hạnh (2A202601760)

## Vai trò trong nhóm

Tôi phụ trách **Mining số liệu**. Công việc chính của tôi là thu thập và phân tích dữ liệu để nhóm có bằng chứng lựa chọn bài toán. Tôi thực hiện mining dữ liệu từ chatlog của VLearn, xây dựng khảo sát người dùng, tổng hợp kết quả và chuyển các số liệu thành insight để sử dụng trong AI Spec và slide thuyết trình.

## Phần mình đã làm cụ thể

- Đọc và tìm hiểu cấu trúc dữ liệu trong `data/vlearn-pack/chatlog`, đặc biệt là `DATA_DICTIONARY.md`, để hiểu ý nghĩa của từng trường dữ liệu.
- Mining các trường liên quan đến hành vi học tập như `follow_ups`, `citations`, `rating` và `asked_check_question`, sau đó thống kê và tổng hợp thành các số liệu định lượng.
- Phát hiện rằng **1.261/1.261 turn (100%)** chưa từng có `follow_ups`, mặc dù trường dữ liệu này đã tồn tại trong hệ thống. Đây là một trong những bằng chứng quan trọng để nhóm lựa chọn bài toán "Gợi ý câu hỏi tiếp theo".
- Thiết kế bảng khảo sát Google Forms nhằm kiểm chứng nhu cầu của người dùng đối với tính năng này. Khảo sát gồm các câu hỏi về thói quen sử dụng AI Tutor, nhu cầu hỏi tiếp sau khi AI trả lời và kỳ vọng đối với các câu hỏi gợi ý.
- Thu thập và phân tích **25 phản hồi**. Một số kết quả nổi bật:
  - **24/25 (96%)** người tham gia cho biết sẽ chắc chắn hoặc có thể sử dụng tính năng AI tự động gợi ý 1–3 câu hỏi tiếp theo.
  - **84%** cho biết đã từng muốn hỏi tiếp nhưng không biết nên hỏi gì.
  - **36%** mong muốn câu hỏi gợi ý bám sát nội dung vừa hỏi; **24%** ưu tiên ngắn gọn, dễ hiểu; **20%** muốn có thêm ví dụ hoặc hướng dẫn cụ thể.
  - Khi AI không gợi ý câu hỏi tiếp theo, **40%** thường tiếp tục học mà không hỏi thêm, còn **32%** phải tự nghĩ câu hỏi mới.
- Tổng hợp kết quả từ **hai nguồn dữ liệu** (chatlog và khảo sát người dùng) để xây dựng phần Pain Point trên slide, giúp chứng minh rằng bài toán nhóm lựa chọn vừa tồn tại trong dữ liệu hệ thống, vừa là nhu cầu thực tế của người học.

## AI hỗ trợ thế nào

Tôi sử dụng Claude Code để hỗ trợ đọc nhanh các file dữ liệu lớn như `DATA_DICTIONARY.md`, gợi ý cách thống kê các trường dữ liệu và tổng hợp kết quả khảo sát.

AI cũng hỗ trợ diễn giải các số liệu thành những insight ban đầu để dễ trình bày trên slide. Tuy nhiên, tôi không sử dụng trực tiếp kết luận của AI mà đều kiểm tra lại bằng dữ liệu thật và biểu đồ khảo sát trước khi đưa vào Spec hoặc slide. Những số liệu chưa đủ bằng chứng đều được giữ nguyên thay vì tự bổ sung.

## Một bài học từ quá trình mining dữ liệu

Điều tôi rút ra là **không nên chỉ dựa vào một nguồn dữ liệu để đưa ra quyết định**. Nếu chỉ nhìn vào chatlog, nhóm chỉ biết hệ thống hiện chưa sinh `follow_ups`. Ngược lại, nếu chỉ khảo sát người dùng thì chỉ biết đây là một nhu cầu được mong muốn. Khi kết hợp cả hai nguồn dữ liệu, nhóm mới có đủ bằng chứng rằng đây vừa là vấn đề đang tồn tại trong sản phẩm, vừa là tính năng người dùng thực sự cần.

Qua công việc này, tôi học được rằng việc kết hợp **dữ liệu hành vi thực tế** và **khảo sát người dùng** giúp các quyết định trong AI Spec có cơ sở thuyết phục hơn, thay vì chỉ dựa trên cảm nhận hoặc một vài ví dụ riêng lẻ.