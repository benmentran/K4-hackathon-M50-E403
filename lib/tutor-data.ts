export type Slide = {
  page: number
  title: string
  bullets: string[]
}

export type Suggestion = {
  id: string
  question: string
  page: number
  tag: "Đào sâu" | "Ví dụ" | "Ôn nhanh" | "Dễ nhầm"
}

export type Turn = {
  id: string
  role: "user" | "tutor"
  content: string
  page?: number
  suggestions?: Suggestion[]
}

export const LESSON = {
  course: "AI Foundation",
  session: "Buổi 4 — Transformer & Attention",
  slides: [
    {
      page: 5,
      title: "Vì sao cần Transformer?",
      bullets: [
        "Dịch máy trước 2017 dựa trên seq2seq + RNN, chất lượng giảm với câu dài",
        'Bài báo "Attention is All You Need" bỏ hẳn recurrence',
        "Kết quả: train nhanh hơn nhiều lần trên cùng phần cứng",
      ],
    },
    {
      page: 6,
      title: "Tổng quan kiến trúc",
      bullets: [
        "Gồm khối Encoder (hiểu đầu vào) và Decoder (sinh đầu ra)",
        "Mỗi khối lặp lại N lần (bài báo gốc: N = 6)",
        "Thành phần lõi: attention + feed-forward + residual + layer norm",
      ],
    },
    {
      page: 7,
      title: "Attention là gì?",
      bullets: [
        "Mỗi token được gán trọng số theo mức liên quan với các token khác",
        "Công thức: softmax(QKᵀ / √dk)·V",
        "Cho phép mô hình 'nhìn' toàn bộ câu thay vì đọc tuần tự",
      ],
    },
    {
      page: 8,
      title: "Multi-head Attention",
      bullets: [
        "Chia embedding thành nhiều head song song",
        "Mỗi head học một loại quan hệ khác nhau (cú pháp, ngữ nghĩa...)",
        "Kết quả các head được nối lại rồi chiếu qua ma trận Wo",
      ],
    },
    {
      page: 9,
      title: "Positional Encoding",
      bullets: [
        "Attention không có khái niệm thứ tự → cần thêm vị trí",
        "Dùng sin/cos theo tần số khác nhau cho từng chiều",
        "Biến thể hiện đại: RoPE, ALiBi",
      ],
    },
    {
      page: 10,
      title: "Encoder block",
      bullets: [
        "Self-attention → cộng residual → layer norm",
        "Feed-forward 2 lớp (mở rộng 4× rồi thu lại)",
        "Không có masking: mọi token thấy toàn bộ chuỗi",
      ],
    },
    {
      page: 11,
      title: "Decoder & masked attention",
      bullets: [
        "Masked self-attention: token chỉ thấy các token phía trước",
        "Cross-attention lấy K, V từ encoder",
        "Nhờ masking mà mô hình sinh văn bản được từng token",
      ],
    },
    {
      page: 12,
      title: "So sánh với RNN / LSTM",
      bullets: [
        "RNN xử lý tuần tự → khó song song hoá",
        "Transformer song song hoá toàn bộ chuỗi trên GPU",
        "Chi phí attention tăng theo O(n²) với độ dài chuỗi",
      ],
    },
    {
      page: 13,
      title: "Tóm tắt buổi 4",
      bullets: [
        "Attention = trung bình có trọng số theo mức liên quan",
        "Multi-head + positional encoding là hai mảnh ghép bắt buộc",
        "Bài tập: cài attention một head bằng NumPy cho câu 5 token",
      ],
    },
  ] satisfies Slide[],
}

const S = (id: string, question: string, page: number, tag: Suggestion["tag"]): Suggestion => ({
  id,
  question,
  page,
  tag,
})

export const OPENING_SUGGESTIONS: Suggestion[] = [
  S("s1", "Attention hoạt động như thế nào trong 1 câu ví dụ?", 7, "Ví dụ"),
  S("s2", "Tóm tắt nhanh slide 7–9 thành các ý chính", 9, "Ôn nhanh"),
  S("s3", "Vì sao Transformer thay thế được RNN?", 12, "Đào sâu"),
]

type Answer = { content: string; page: number; suggestions: Suggestion[] }

export const ANSWERS: Record<string, Answer> = {
  s1: {
    page: 7,
    content:
      'Với câu "Con mèo ngồi trên thảm vì nó êm", khi mô hình xử lý từ "nó", attention gán trọng số cao cho "thảm" (≈0.62) và thấp cho "mèo" (≈0.11). Trọng số này được tính bằng softmax(QKᵀ/√dk), sau đó dùng để lấy trung bình có trọng số các vector V — nhờ vậy biểu diễn của "nó" mang thông tin của "thảm".',
    suggestions: [
      S("s4", "Tại sao phải chia cho căn bậc hai của dk?", 7, "Dễ nhầm"),
      S("s5", "Multi-head khác gì so với 1 head duy nhất?", 8, "Đào sâu"),
    ],
  },
  s2: {
    page: 9,
    content:
      "Ý chính slide 7–9: (1) Attention gán trọng số liên quan giữa các token thay vì đọc tuần tự. (2) Multi-head cho phép nhiều head học các loại quan hệ khác nhau rồi nối lại. (3) Vì attention không biết thứ tự, ta cộng thêm positional encoding (sin/cos, hoặc RoPE trong các model mới).",
    suggestions: [
      S("s6", "Cho tôi 3 câu hỏi tự kiểm tra phần này", 9, "Ôn nhanh"),
      S("s7", "RoPE khác positional encoding gốc ở đâu?", 9, "Đào sâu"),
      S("s5", "Multi-head khác gì so với 1 head duy nhất?", 8, "Đào sâu"),
    ],
  },
  s3: {
    page: 12,
    content:
      "Ba lý do chính: RNN phải xử lý token tuần tự nên không song song hoá được trên GPU; đường truyền gradient dài gây vanishing; còn Transformer nối trực tiếp mọi cặp token nên quan hệ xa chỉ cách nhau 1 bước. Đổi lại, chi phí attention là O(n²) theo độ dài chuỗi.",
    suggestions: [
      S("s8", "O(n²) gây vấn đề gì với văn bản dài?", 12, "Dễ nhầm"),
      S("s4", "Tại sao phải chia cho căn bậc hai của dk?", 7, "Dễ nhầm"),
    ],
  },
  s4: {
    page: 7,
    content:
      "Khi dk lớn, tích vô hướng QKᵀ có phương sai tăng theo dk, đẩy softmax vào vùng bão hoà (một trọng số ≈1, còn lại ≈0) làm gradient gần như bằng 0. Chia cho √dk giữ phương sai ≈1 nên softmax mượt và học được.",
    suggestions: [
      S("s5", "Multi-head khác gì so với 1 head duy nhất?", 8, "Đào sâu"),
      S("s6", "Cho tôi 3 câu hỏi tự kiểm tra phần này", 9, "Ôn nhanh"),
    ],
  },
  s5: {
    page: 8,
    content:
      "Một head chỉ học được một kiểu quan hệ. Multi-head chia embedding (ví dụ 512 chiều thành 8 head × 64 chiều) để mỗi head chú ý một khía cạnh: head này bắt quan hệ chủ ngữ–động từ, head khác bắt đại từ–danh từ. Kết quả được nối lại và chiếu qua Wo.",
    suggestions: [
      S("s9", "Làm sao biết mỗi head học được gì?", 8, "Ví dụ"),
      S("s3", "Vì sao Transformer thay thế được RNN?", 12, "Đào sâu"),
    ],
  },
  s6: {
    page: 9,
    content:
      "Thử trả lời: (1) Viết lại công thức attention và giải thích vai trò của Q, K, V. (2) Nếu bỏ positional encoding thì mô hình mất khả năng gì? (3) Vì sao nối các head lại cần thêm ma trận Wo?",
    suggestions: [
      S("s7", "RoPE khác positional encoding gốc ở đâu?", 9, "Đào sâu"),
      S("s8", "O(n²) gây vấn đề gì với văn bản dài?", 12, "Dễ nhầm"),
    ],
  },
  s7: {
    page: 9,
    content:
      "Positional encoding gốc cộng vector sin/cos vào embedding đầu vào. RoPE thay vào đó xoay vector Q và K theo góc phụ thuộc vị trí, nên tích vô hướng chỉ phụ thuộc khoảng cách tương đối — nhờ vậy ngoại suy tốt hơn với chuỗi dài hơn lúc train.",
    suggestions: [
      S("s8", "O(n²) gây vấn đề gì với văn bản dài?", 12, "Dễ nhầm"),
      S("s2", "Tóm tắt nhanh slide 7–9 thành các ý chính", 9, "Ôn nhanh"),
    ],
  },
  s8: {
    page: 12,
    content:
      "Chuỗi 1.000 token cần 1 triệu điểm attention; 10.000 token cần 100 triệu — bộ nhớ và thời gian tăng gấp 100 lần khi độ dài tăng 10 lần. Đó là lý do có FlashAttention (tối ưu bộ nhớ) và sparse/linear attention (giảm số cặp phải tính).",
    suggestions: [
      S("s1", "Attention hoạt động như thế nào trong 1 câu ví dụ?", 7, "Ví dụ"),
      S("s6", "Cho tôi 3 câu hỏi tự kiểm tra phần này", 9, "Ôn nhanh"),
    ],
  },
  s9: {
    page: 8,
    content:
      "Cách phổ biến là vẽ heatmap trọng số attention của từng head trên một câu mẫu. Nhiều nghiên cứu thấy có head chuyên bám token liền trước, head khác bám dấu câu, head khác nối đại từ với danh từ tương ứng.",
    suggestions: [
      S("s5", "Multi-head khác gì so với 1 head duy nhất?", 8, "Đào sâu"),
      S("s3", "Vì sao Transformer thay thế được RNN?", 12, "Đào sâu"),
    ],
  },
}

export const FALLBACK: Answer = {
  page: 7,
  content:
    "Câu hỏi này liên quan tới phần Attention trong buổi học. Ý ngắn gọn: mô hình tính độ liên quan giữa các token rồi lấy trung bình có trọng số các biểu diễn của chúng. Bạn có thể hỏi tiếp theo các gợi ý bên dưới để đi sâu hơn.",
  suggestions: OPENING_SUGGESTIONS.slice(0, 2),
}
