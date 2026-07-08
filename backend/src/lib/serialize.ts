// Chuyển row DB (snake_case) → DTO trả về cho frontend (camelCase, khớp src/types).
export const sUser = (r: any) => r && ({
  id: r.id, fullName: r.full_name, email: r.email, role: r.role,
  studentCode: r.student_code ?? undefined, avatarUrl: r.avatar_url ?? undefined,
});

export const sCourse = (r: any) => ({
  id: r.id, name: r.name, description: r.description ?? "",
  academicYear: r.academic_year, semester: r.semester,
  startDate: r.start_date, endDate: r.end_date,
  lecturerId: r.lecturer_id, lecturerName: r.lecturer_name ?? "",
  joinCode: r.join_code, studentCount: Number(r.student_count ?? 0),
  createdAt: r.created_at,
});

export const sTestcase = (r: any) => ({
  id: r.id, input: r.input, expectedOutput: r.expected_output, hidden: r.is_hidden,
});

export const sAssignment = (r: any) => ({
  id: r.id, courseId: r.course_id, title: r.title, source: r.source,
  description: r.description ?? undefined, pdfUrl: r.pdf_path ?? undefined,
  section: r.section ?? undefined,
  deadline: r.deadline, rubric: r.rubric,
  testcases: (r.testcases ?? []).map(sTestcase), createdAt: r.created_at,
});

export const sMaterial = (r: any) => ({
  id: r.id, courseId: r.course_id, title: r.title, fileUrl: r.file_path,
  section: r.section ?? undefined, uploadedAt: r.uploaded_at,
});

export const sSubmission = (r: any) => {
  const hasB = !(r.testcase_pct == null && r.complexity_pct == null && r.similarity_pct == null);
  return {
    id: r.id, assignmentId: r.assignment_id, studentId: r.student_id,
    studentName: r.student_name ?? "", studentCode: r.student_code ?? "",
    fileName: r.file_name, code: r.code ?? "", submittedAt: r.submitted_at, status: r.status,
    score: r.score == null ? undefined : Number(r.score),
    breakdown: hasB ? {
      testcase: Number(r.testcase_pct ?? 0), complexity: Number(r.complexity_pct ?? 0), similarity: Number(r.similarity_pct ?? 0),
    } : undefined,
    aiComment: r.ai_comment ?? undefined,
    flaggedCheating: r.flagged_cheating ?? false,
    lecturerOverridden: r.lecturer_overridden ?? false,
    published: r.published ?? false,
  };
};

export const sProblem = (r: any) => ({
  id: r.id, title: r.title, difficulty: r.difficulty, description: r.description,
  testcases: (r.testcases ?? []).map(sTestcase), createdById: r.created_by, createdAt: r.created_at,
});

export const sProblemSub = (r: any) => ({
  id: r.id, problemId: r.problem_id, userId: r.user_id, language: r.language, code: r.code,
  submittedAt: r.submitted_at, score: r.score == null ? 0 : Number(r.score),
  passedTests: r.passed_tests ?? 0, totalTests: r.total_tests ?? 0, aiComment: r.ai_comment ?? "",
});
