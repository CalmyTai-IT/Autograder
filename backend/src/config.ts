import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  appUrl: process.env.APP_URL ?? "http://localhost:5173",

  // Kết nối Supabase bằng API key (đơn giản: chỉ cần URL + service_role key)
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "AutoGrade <no-reply@autograde.local>",
  },

  // (giữ lại cho tương thích cũ — không bắt buộc dùng nữa)
  gradingApiKey: process.env.GRADING_API_KEY ?? "",

  // ─── MÔ ĐUN CHẤM ĐIỂM ───
  // Module 3 (phong cách code) → Google Gemini
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? process.env.GRADING_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
  // Module 5 (tổng kết & nhận xét) → Groq (OpenAI-compatible)
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  },
  // Sandbox chạy code (module 1 & 2)
  sandbox: {
    runTimeoutMs: Number(process.env.SANDBOX_TIMEOUT_MS ?? 5000),
    compileTimeoutMs: Number(process.env.SANDBOX_COMPILE_TIMEOUT_MS ?? 15000),
    memoryMb: Number(process.env.SANDBOX_MEMORY_MB ?? 256),
    maxOutputBytes: Number(process.env.SANDBOX_MAX_OUTPUT ?? 1_000_000),
  },
  // Thời gian chờ tối đa khi gọi LLM (ms)
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 30000),
};
