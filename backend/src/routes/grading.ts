// Kích hoạt chấm. Logic mô hình nằm ở src/grading (nhóm tự cài) — ở đây chỉ gọi service.
import { Router } from "express";
import { asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { gradeAssignment, gradeProblemSubmission } from "../services/gradingService";

export const gradingRouter = Router();
gradingRouter.use(requireAuth);

// POST /api/grading/assignment/:assignmentId  (lecturer) — chấm hàng loạt sau deadline
gradingRouter.post("/assignment/:assignmentId", requireRole("lecturer"), asyncHandler(async (req, res) => {
  const result = await gradeAssignment(req.params.assignmentId);
  res.json(result);
}));

// POST /api/grading/problem-submission/:id — chấm ngay 1 lần nộp bài tự do
gradingRouter.post("/problem-submission/:id", asyncHandler(async (req, res) => {
  const result = await gradeProblemSubmission(req.params.id);
  res.json(result);
}));
