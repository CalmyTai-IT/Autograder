import { Router } from "express";
import bcrypt from "bcryptjs";
import { many, maybe, supabase } from "../db";
import { ApiError, asyncHandler } from "../lib/http";
import { signJwt, randomCode } from "../lib/tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email";
import { sUser } from "../lib/serialize";
import { requireAuth } from "../middleware/auth";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", asyncHandler(async (req, res) => {
  const { fullName, email, password, role, studentCode } = req.body ?? {};
  if (!fullName || !email || !password) throw new ApiError(400, "Thiếu thông tin");
  if (role !== "student" && role !== "lecturer") throw new ApiError(400, "Vai trò không hợp lệ");
  if (String(password).length < 6) throw new ApiError(400, "Mật khẩu tối thiểu 6 ký tự");

  // Chỉ chặn khi email ĐÃ xác nhận. Nếu email tồn tại nhưng CHƯA xác nhận
  // → coi như đăng ký dang dở: ghi đè lại thông tin & gửi mã mới (cho phép đăng ký lại).
  const existing = await maybe(supabase.from("users").select("id, email_verified").eq("email", email).maybeSingle());
  if (existing && existing.email_verified) throw new ApiError(409, "Email đã được đăng ký");

  const hash = await bcrypt.hash(password, 10);
  const code = randomCode();

  if (existing) {
    await many(supabase.from("users").update({
      password_hash: hash, full_name: fullName, role,
      student_code: studentCode || null, verify_token: code,
    }).eq("id", existing.id));
  } else {
    await many(supabase.from("users").insert({
      email, password_hash: hash, full_name: fullName, role,
      student_code: studentCode || null, verify_token: code,
    }));
  }
  await sendVerificationEmail(email, code);
  res.status(201).json({ message: "Đăng ký thành công. Vui lòng nhập mã xác nhận đã gửi tới email của bạn." });
}));

// POST /api/auth/verify-email  { email, code }
// Idempotent: nếu email đã xác nhận rồi thì vẫn trả thành công (tránh báo lỗi giả
// khi trang gọi xác nhận 2 lần — vd React StrictMode — hoặc bấm xác nhận lại).
authRouter.post("/verify-email", asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const code = String(req.body?.code ?? "").trim();
  if (!email || !code) throw new ApiError(400, "Thiếu email hoặc mã xác nhận");
  const user = await maybe(supabase.from("users").select("id, email_verified, verify_token").eq("email", email).maybeSingle());
  if (!user) throw new ApiError(400, "Email chưa được đăng ký");
  if (user.email_verified) return res.json({ message: "Email đã được xác nhận. Bạn có thể đăng nhập." });
  if (!user.verify_token || user.verify_token !== code) throw new ApiError(400, "Mã xác nhận không đúng");
  await many(supabase.from("users").update({ email_verified: true, verify_token: null }).eq("id", user.id));
  res.json({ message: "Xác nhận email thành công. Bạn có thể đăng nhập." });
}));

// POST /api/auth/resend-verification  { email }
authRouter.post("/resend-verification", asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  const user = await maybe(supabase.from("users").select("id, email_verified").eq("email", email).maybeSingle());
  if (user && !user.email_verified) {
    const code = randomCode();
    await many(supabase.from("users").update({ verify_token: code }).eq("id", user.id));
    await sendVerificationEmail(email, code);
  }
  res.json({ message: "Nếu email tồn tại và chưa xác nhận, mã mới đã được gửi." });
}));

// POST /api/auth/login  { email, password }
authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await maybe(supabase.from("users").select("*").eq("email", email).maybeSingle());
  if (!user) throw new ApiError(401, "Email hoặc mật khẩu không đúng");
  const okPw = await bcrypt.compare(String(password ?? ""), user.password_hash);
  if (!okPw) throw new ApiError(401, "Email hoặc mật khẩu không đúng");
  if (!user.email_verified) throw new ApiError(403, "Email chưa được xác nhận");
  const token = signJwt({ sub: user.id, role: user.role });
  res.json({ token, user: sUser(user) });
}));

// POST /api/auth/forgot-password  { email }
authRouter.post("/forgot-password", asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  const user = await maybe(supabase.from("users").select("id").eq("email", email).maybeSingle());
  if (user) {
    const code = randomCode();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 giờ
    await many(supabase.from("users").update({ reset_token: code, reset_expires: expires }).eq("id", user.id));
    await sendPasswordResetEmail(email, code);
  }
  res.json({ message: "Nếu email tồn tại, mã đặt lại đã được gửi." });
}));

// POST /api/auth/reset-password  { email, code, newPassword }
authRouter.post("/reset-password", asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const code = String(req.body?.code ?? "").trim();
  const { newPassword } = req.body ?? {};
  if (!email || !code || !newPassword) throw new ApiError(400, "Thiếu thông tin");
  if (String(newPassword).length < 6) throw new ApiError(400, "Mật khẩu tối thiểu 6 ký tự");
  const user = await maybe(
    supabase.from("users").select("id, reset_token, reset_expires").eq("email", email).maybeSingle()
  );
  if (!user || !user.reset_token || user.reset_token !== code) throw new ApiError(400, "Mã không đúng");
  if (!user.reset_expires || new Date(user.reset_expires).getTime() < Date.now()) throw new ApiError(400, "Mã đã hết hạn");
  const hash = await bcrypt.hash(newPassword, 10);
  await many(supabase.from("users").update({ password_hash: hash, reset_token: null, reset_expires: null }).eq("id", user.id));
  res.json({ message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập." });
}));

// GET /api/auth/me
authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await maybe(supabase.from("users").select("*").eq("id", req.user!.id).maybeSingle());
  if (!user) throw new ApiError(404, "Không tìm thấy người dùng");
  res.json(sUser(user));
}));

// PATCH /api/auth/me  { fullName?, avatarUrl? }
authRouter.patch("/me", requireAuth, asyncHandler(async (req, res) => {
  const { fullName, avatarUrl } = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if (fullName !== undefined) patch.full_name = fullName;
  if (avatarUrl !== undefined) patch.avatar_url = avatarUrl;
  const user = await maybe(supabase.from("users").update(patch).eq("id", req.user!.id).select().single());
  res.json(sUser(user));
}));
