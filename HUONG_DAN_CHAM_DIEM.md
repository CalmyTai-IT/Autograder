# HƯỚNG DẪN MÔ ĐUN CHẤM ĐIỂM — AutoGrade

Tài liệu này mô tả **mô hình chấm điểm** đã hoàn thiện (5 mô đun), **cách chạy**, và
**cách thay thế / đổi API**. Toàn bộ mã chấm nằm ở `backend/src/grading/`.

---

## 1. Tổng quan 5 mô đun & luồng xử lý

| # | Mô đun | File | Kỹ thuật | Có gọi API? |
|---|--------|------|----------|-------------|
| 1 | Testcase | `testcase.ts` + `sandbox.ts` | Biên dịch + chạy trong sandbox, so output | Không |
| 2 | Độ phức tạp | `complexity.ts` | Phân tích tĩnh cấu trúc (vòng lặp / sort / đệ quy) → map theo rubric | Không |
| 3 | Phong cách code | `style.ts` | **Gemini** đọc code → nhận xét / tìm lỗi | Có (Gemini) |
| 4 | Gian lận | `plagiarism.ts` | k-gram + winnowing (kiểu MOSS) → % giống cao nhất | Không |
| 5 | Tổng kết | `aggregate.ts` | Tính điểm theo rubric (tất định) + **Groq** viết nhận xét | Có (Groq) |

`pipeline.ts` lắp ráp đúng luồng trong đề:

```
            ┌──────────────────────────────────────────────┐
            │ (1) GIAN LẬN (so tất cả bài với nhau)         │
            └───────────────┬──────────────────────────────┘
            vượt ngưỡng?  ┌──┴──┐  không
                 ▼ có     │     │     ▼
        0 điểm + chỉ ra   │     │  (2) TESTCASE (sandbox)
        giống bài nào.    │     │        │
        DỪNG, không qua   │     │   code có lỗi?  ┌─────────────┐
        mô đun nào khác.  │     │   ───────────►  │ STYLE(debug)│→ tìm lỗi & hướng dẫn
                          │     │   (compile lỗi /│             │  → XONG (không tổng kết)
                          │     │    crash toàn bộ)└─────────────┘
                          │     │        │ chạy được
                          │     │        ▼
                          │     │   (3a) COMPLEXITY ∥ (3b) STYLE(review)   ← chạy SONG SONG
                          │     │        │
                          │     │        ▼
                          │     │   (5) TỔNG KẾT (Groq): điểm theo rubric + nhận xét
                          └─────┴──────────────────────────────────────────►  Kết quả
```

**Phân biệt 2 loại bài** (ảnh hưởng prompt nhận xét):
- `mode = "assignment"` (bài nộp deadline): style chỉ ra điểm **giảng viên nên kiểm tra**; tổng kết kèm vài **thống kê nhỏ**.
- `mode = "practice"` (bài tự do): style đưa **định hướng cải tiến**; tổng kết mang tính **dạy học, định hướng**.

**Quy tắc điểm:** chỉ **testcase** và **độ phức tạp** có trọng số (mặc định 70/30, do rubric của đề quy định, tổng = 100%).
Phong cách (style) **không vào điểm**, chỉ phục vụ nhận xét. Gian lận là **cổng chặn (GATE)**: vượt ngưỡng → 0 điểm ngay.

> Ví dụ map độ phức tạp: lời giải `O(n²)`, rubric `[O(n log n)=100, O(n²)=80, O(n³)=50]` → **80%**.

---

## 2. Yêu cầu hệ thống

- **Node.js ≥ 18** (khuyến nghị 20+).
- Toolchain để chạy code sinh viên (mô đun 1 & 2) — **chỉ cần ngôn ngữ nào bạn định chấm**:
  - **Python**: lệnh `python3` (Linux/macOS) hoặc `python`/`py` (Windows). Hệ thống **tự dò** lệnh phù hợp; nếu cần ép, đặt `PYTHON_CMD` trong `.env`.
  - **C++**: `g++` (Windows: cài **MinGW-w64** rồi thêm `...\mingw64\bin` vào PATH, hoặc dùng WSL; Ubuntu: `build-essential`).
  - **Java**: `javac` + `java` (JDK 17+).

Cài nhanh:
- **Ubuntu/WSL**: `sudo apt update && sudo apt install -y python3 build-essential default-jdk`
- **macOS**: `brew install python gcc openjdk`
- **Windows**: cài [Python](https://www.python.org/downloads/) (nhớ tick **“Add python.exe to PATH”**), [MSYS2/MinGW-w64](https://www.msys2.org/) cho C++, và [JDK 17+](https://adoptium.net/). Mở **PowerShell mới** sau khi cài để PATH cập nhật.

Kiểm tra nhanh bằng `npm run selftest` (mục 3.3) — nó sẽ báo rõ thiếu công cụ nào.

> **Lưu ý Windows:** hệ thống chạy code **trực tiếp**, KHÔNG qua `bash`/WSL — nên không cần cài WSL. (Nếu trước đây bạn thấy lỗi *“Windows Subsystem for Linux has no installed distributions”* thì bản này đã xử lý.) Bạn chỉ cần cài đúng Python/g++/Java và thêm vào PATH.

---

## 3. Cài đặt & chạy

### 3.1 Backend
```bash
cd backend
cp .env.example .env          # rồi điền giá trị (xem mục 4)
npm install
npm run dev                   # chạy ở http://localhost:4000
```
Lần đầu cần tạo bảng trong Supabase: mở **SQL Editor** trên Supabase và chạy nội dung `backend/db/schema.sql`.

### 3.2 Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

### 3.3 Tự kiểm tra mô đun chấm (rất nên chạy trước khi nộp/demo)
```bash
cd backend
npm run selftest
```
Script `scripts/selftest-grading.ts` sẽ: kiểm tra toolchain, chạy thử cả 5 mô đun với code thật, và **ping thử Gemini/Groq nếu đã có key** để xác nhận key hoạt động.

---

## 4. Cấu hình API (đặt trong `backend/.env`)

Hai mô đun dùng LLM, **mỗi cái một nhà cung cấp**:

### 4.1 Mô đun 3 — Phong cách code → **Google Gemini**
1. Lấy API key miễn phí: https://aistudio.google.com/apikey
2. Điền vào `.env`:
   ```bash
   GEMINI_API_KEY=AIza...your_key...
   GEMINI_MODEL=gemini-2.5-flash      # mặc định; có thể đổi sang bản mới hơn, vd gemini-3.5-flash
   ```
   > Nếu gặp `HTTP 503 / UNAVAILABLE` ("high demand") → là Gemini **quá tải tạm thời**, không phải lỗi code. Hệ thống **tự thử lại 3 lần**; nếu vẫn lỗi thì dùng nhận xét dự phòng. Có thể chờ lát rồi chạy lại, hoặc đổi `GEMINI_MODEL=gemini-3.5-flash`.

### 4.2 Mô đun 5 — Tổng kết & nhận xét → **Groq**
1. Lấy API key miễn phí: https://console.groq.com/keys
2. Điền vào `.env`:
   ```bash
   GROQ_API_KEY=gsk_...your_key...
   GROQ_MODEL=openai/gpt-oss-120b     # mặc định (chất lượng cao). Nhẹ/nhanh hơn: openai/gpt-oss-20b
   ```
   > ⚠️ Tránh dùng `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` — Groq đã thông báo ngừng hỗ trợ.

**Không có key cũng chạy được:** nếu để trống, mô đun 3 & 5 tự động dùng **nhận xét dự phòng** (ghép từ số liệu thật, không cần mạng) — điểm vẫn được tính bình thường. Tuy nhiên để đúng yêu cầu đề, **nên điền cả hai key**.

---

## 5. Cách THAY THẾ API (đổi nhà cung cấp / model)

### 5.1 Đổi nhanh model (cùng nhà cung cấp)
Chỉ cần sửa `GEMINI_MODEL` hoặc `GROQ_MODEL` trong `.env`. Không phải sửa code.

### 5.2 Đổi nhà cung cấp khác cho **mô đun phong cách** (`backend/src/grading/style.ts`)
Mô đun này chỉ cần một hàm "đưa prompt → nhận chuỗi văn bản". Để dùng nhà cung cấp khác,
thay phần gọi `fetch` trong `reviewStyle`. Ví dụ chuyển sang **OpenAI** (tương thích nhiều API khác):

```ts
const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.openaiKey}` },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  }),
});
const data = await res.json();
const text = data.choices?.[0]?.message?.content ?? "";   // rồi parseJson(text) như cũ
```
Giữ nguyên `buildPrompt(...)` và `parseJson(...)` — chỉ đổi đúng đoạn HTTP và cách lấy `text`.

### 5.3 Đổi nhà cung cấp khác cho **mô đun tổng kết** (`backend/src/grading/aggregate.ts`)
Groq vốn **tương thích chuẩn OpenAI**, nên đổi sang OpenAI/OpenRouter/Together… chỉ cần đổi
`ENDPOINT`, header `Authorization`, và `model`. Cấu trúc `messages` (system + user) giữ nguyên.
Lưu ý: **điểm số được tính tất định bằng `computeRubricScore` — LLM chỉ viết lời văn**, nên đổi
nhà cung cấp không làm sai lệch điểm.

### 5.4 Thêm biến môi trường cho nhà cung cấp mới
Khai báo trong `backend/src/config.ts` (theo mẫu khối `gemini` / `groq` sẵn có), rồi thêm dòng tương ứng vào `.env`.

---

## 6. Chi tiết & giới hạn từng mô đun

**1) Testcase (`testcase.ts`, `sandbox.ts`)** — biên dịch (C++/Java) hoặc kiểm cú pháp (Python),
chạy từng testcase với giới hạn thời gian & RAM, so output đã chuẩn hoá (bỏ khoảng trắng thừa /
dòng trống cuối). Cờ `fatal=true` khi **không biên dịch được** hoặc **mọi testcase đều crash/timeout** →
pipeline rẽ sang nhánh "tìm lỗi".

**2) Độ phức tạp (`complexity.ts`)** — **phân tích tĩnh** (chọn vì cần **kết quả tái lập**, chấm lại
cùng bài phải ra cùng điểm): độ sâu vòng lặp lồng nhau, vòng lặp nhân/chia 2 & binary-search (log),
gọi `sort` (n log n), hàm tổng hợp tuyến tính (`sum/max/min/sorted/accumulate…`), và đệ quy
(tuyến tính → n, chia-để-trị có chia đôi → n log n, nhiều nhánh không chia đôi → mũ).
*Giới hạn:* là **ước lượng theo cấu trúc**, có thể lệch với code rất "thủ thuật"; vì vậy hệ thống cho phép
**giảng viên override điểm**. (Nếu muốn dùng cách **đo thời gian thực nghiệm** thay thế, xem ghi chú dưới.)

**3) Phong cách (`style.ts`, Gemini)** — 2 chế độ: `review` (chấm phong cách + định hướng/kiểm tra theo loại bài)
và `debug` (khi code lỗi → tìm lỗi & hướng dẫn sửa). Trả `{ stylePct, notes }`; `stylePct` **không vào điểm**.

**4) Gian lận (`plagiarism.ts`)** — chuẩn hoá token (đổi tên biến/số → ký hiệu chung, bỏ comment),
băm **k-gram** rồi **winnowing** lấy "vân tay", đo **containment** = trùng / min(|A|,|B|).
Bền với đổi tên biến, format lại, thêm/bớt comment. Lấy **bài giống nhất** trong các peer; vượt
`plagiarismThreshold` → 0 điểm (GATE). *Giới hạn:* không phát hiện được chép có **viết lại logic** sâu.

**5) Tổng kết (`aggregate.ts`, Groq)** — `computeRubricScore` tính điểm **tất định** theo trọng số rubric;
Groq chỉ viết **nhận xét** (kèm "footer" thống kê tất định luôn hiển thị kể cả khi API lỗi).

---

## 7. Bảng biến môi trường (mô đun chấm)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `GEMINI_API_KEY` | (trống) | Key Gemini cho mô đun style |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model Gemini |
| `GROQ_API_KEY` | (trống) | Key Groq cho mô đun tổng kết |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Model Groq |
| `LLM_TIMEOUT_MS` | `30000` | Timeout mỗi lần gọi LLM (ms) |
| `PYTHON_CMD` | (tự dò) | Ép lệnh Python (vd `python` trên Windows) |
| `SANDBOX_TIMEOUT_MS` | `5000` | Giới hạn thời gian chạy 1 testcase |
| `SANDBOX_COMPILE_TIMEOUT_MS` | `15000` | Giới hạn thời gian biên dịch |
| `SANDBOX_MEMORY_MB` | `256` | Giới hạn RAM mỗi tiến trình |
| `SANDBOX_MAX_OUTPUT` | `1000000` | Giới hạn byte stdout/stderr thu thập |

---

## 8. ⚠️ Bảo mật sandbox (quan trọng khi triển khai thật)

Mô đun 1 chạy **code không tin cậy của sinh viên**. Hiện tại dùng tiến trình tách + `timeout` + `ulimit`/`-Xmx`,
đủ cho **đồ án / môi trường tin cậy / máy chấm nội bộ**. Khi đưa lên server thật, hãy cô lập mạnh hơn —
chỉ cần đổi phần `spawn` trong `sandbox.ts` để chạy qua:
- **Docker** (container dùng-một-lần, `--network none`, giới hạn CPU/RAM), hoặc
- **nsjail / firejail / isolate** (bộ chấm của IOI/Codeforces dùng `isolate`).

---

## 9. Ghi chú: phương án đo độ phức tạp bằng thực nghiệm (tuỳ chọn)

Bản hiện tại dùng **phân tích tĩnh** để đảm bảo tái lập. Nếu muốn **đo thời gian thực nghiệm** (chạy với N
tăng dần rồi khớp đường cong `n, n log n, n², n³`), cần lưu ý: chi phí khởi động trình thông dịch và I/O đọc
N phần tử tạo "sàn O(n)" gây nhiễu, nên phải **trừ baseline** và dùng N đủ lớn; đồng thời kết quả có thể
**đổi giữa các lần chạy** (không tái lập) — không lý tưởng cho việc chấm điểm công bằng. Vì vậy bản giao nộp
chọn phân tích tĩnh làm mặc định.
