import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/http";
import { verifyJwt } from "../lib/tokens";

// Bổ sung trường user vào Request
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: "student" | "lecturer" };
    }
  }
}

/** Bắt buộc đăng nhập: đọc Bearer token, gắn req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new ApiError(401, "Chưa đăng nhập"));
  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new ApiError(401, "Token không hợp lệ hoặc đã hết hạn"));
  }
}

/** Bắt buộc vai trò cụ thể (vd chỉ giảng viên). */
export function requireRole(role: "student" | "lecturer") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) return next(new ApiError(403, "Không có quyền"));
    next();
  };
}
