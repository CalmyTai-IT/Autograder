import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload { sub: string; role: "student" | "lecturer"; }

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

/** Token ngẫu nhiên dài (dùng cho link đặt lại mật khẩu). */
export function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Mã xác nhận 6 chữ số — dễ nhập tay, không phụ thuộc vào link trong email
 *  (tránh lỗi link hỏng khi mở ở trình duyệt/thiết bị khác). */
export function randomCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
