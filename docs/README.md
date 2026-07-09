# Tài liệu đồ án AutoGrade

Thư mục này chứa toàn bộ tài liệu của đồ án **AutoGrade — Hệ thống chấm điểm code tự động** (môn Công nghệ phần mềm cho AI, HCMUS).

Quay lại [README chính](../README.md) · Demo: <https://autograder-gamma.vercel.app/login>

---

## Nên đọc theo thứ tự nào?

Các tài liệu bám theo tiến trình **RUP** (Vision → Use-Case → Architecture → Quality → Evaluation). Nếu đọc lần đầu, đi theo thứ tự dưới đây:

| # | Tài liệu | Trả lời câu hỏi | Độ dài |
|---|----------|-----------------|--------|
| 1 | [`AutoGrade_Vision_Document.pdf`](AutoGrade_Vision_Document.pdf) | Vì sao cần hệ thống này? Cho ai? Khác gì Moodle / LeetCode / MOSS? | 7 trang |
| 2 | [`AutoGrade_UseCase_Specification.pdf`](AutoGrade_UseCase_Specification.pdf) | Hệ thống **làm gì**? 14 use case (Basic/Alternative Flow, Pre-/Post-conditions) + sơ đồ use case | 17 trang |
| 3 | [`AutoGrade_Software_Architecture_Document.pdf`](AutoGrade_Software_Architecture_Document.pdf) | Hệ thống **được xây thế nào**? SAD rút gọn RUP: 6 component, Deployment, Implementation View | 11 trang |
| 4 | [`AutoGrade_KienTruc.pdf`](AutoGrade_KienTruc.pdf) | Bức tranh kiến trúc **tổng thể**: 4 phân hệ, hai luồng chấm (A: bài tập lớp · B: bài tự luyện), luồng dữ liệu | 8 trang |
| 5 | [`AutoGrade_NonFunctional_Requirements.pdf`](AutoGrade_NonFunctional_Requirements.pdf) | Hệ thống **làm tốt tới mức nào**? 26 NFR theo ISO/IEC 25010, mỗi NFR kèm bằng chứng trong mã nguồn | 14 trang |
| 6 | [`Model_Evaluation_AutoGrade.pdf`](Model_Evaluation_AutoGrade.pdf) | Pipeline chấm **chính xác đến đâu**? Thiết kế thí nghiệm, bộ dữ liệu đối kháng, độ đo, kết quả, hạn chế | — |
| 7 | [`HUONG_DAN_CHAM_DIEM.md`](HUONG_DAN_CHAM_DIEM.md) | **Tài liệu kỹ thuật**: cách 5 mô-đun chấm hoạt động, cách đổi model/API, prompt, self-test | — |

---

## Bản đồ tài liệu ↔ mã nguồn

| Khái niệm trong tài liệu | Vị trí trong repo |
|--------------------------|-------------------|
| Component *Auth* | `backend/src/routes/auth.ts`, `middleware/auth.ts`, `lib/tokens.ts`, `lib/email.ts` |
| Component *Course & Assignment* | `backend/src/routes/{courses,assignments,problems}.ts` |
| Component *Submission* | `backend/src/routes/{submissions,grading}.ts` |
| Component *Grading Engine* | `backend/src/services/gradingService.ts`, `backend/src/grading/*` |
| Component *Database* | `backend/db/schema.sql` (10 bảng) |
| Component *Frontend (React SPA)* | `frontend/src/` |
| Pipeline 5 mô-đun | `backend/src/grading/pipeline.ts` |
| UC «include» Phát hiện gian lận | `backend/src/grading/plagiarism.ts` |
| UC «include» Chạy testcase (sandbox) | `backend/src/grading/{testcase,sandbox}.ts` |
| UC «include» Phân tích độ phức tạp | `backend/src/grading/complexity.ts` |
| UC «include» Chấm phong cách code | `backend/src/grading/style.ts` → Gemini API |
| UC «include» Tổng hợp điểm & nhận xét | `backend/src/grading/aggregate.ts` → Groq API |
| UC «extend» Gợi ý sửa lỗi (AI) | `backend/src/grading/style.ts` (`purpose = 'debug'`) |
| UC Xuất bảng điểm ra Excel | `frontend` — thư viện `xlsx`, xử lý hoàn toàn phía client |

---

## Ghi chú về phiên bản

- Các tài liệu phản ánh trạng thái **as-built** của mã nguồn trong repo này: mọi NFR đều trỏ tới vị trí cụ thể trong code thay vì là danh sách kỳ vọng lý thuyết.
- Một vài chi tiết vận hành có thể khác giữa tài liệu và bản deploy (ví dụ file upload đã chuyển sang **Supabase Storage** với fallback xuống đĩa local). Khi có mâu thuẫn, **mã nguồn là nguồn sự thật**.
- Các tài liệu tham chiếu lẫn nhau bằng tên `.docx` (bản gốc dùng để nộp); trong repo chúng được lưu dưới dạng `.pdf` cùng tên.
