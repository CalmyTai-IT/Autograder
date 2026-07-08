import express from "express";
import cors from "cors";
import path from "path";
import { config } from "./config";
import { errorHandler } from "./lib/http";
import { authRouter } from "./routes/auth";
import { coursesRouter } from "./routes/courses";
import { assignmentsRouter } from "./routes/assignments";
import { submissionsRouter } from "./routes/submissions";
import { problemsRouter } from "./routes/problems";
import { gradingRouter } from "./routes/grading";

const app = express();

app.use(cors());                       // cho phép frontend gọi (cấu hình origin chặt hơn khi production)
app.use(express.json({ limit: "2mb" }));

// File upload tĩnh
app.use("/uploads", express.static(path.resolve(config.uploadDir)));

// Kiểm tra sức khỏe
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/assignments", assignmentsRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/problems", problemsRouter);
app.use("/api/grading", gradingRouter);

// Xử lý lỗi (đặt cuối)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[autograde] backend chạy tại http://localhost:${config.port}`);
});
