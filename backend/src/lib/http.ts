import type { NextFunction, Request, Response } from "express";

/** Lỗi có mã HTTP. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bọc handler async để tự bắt lỗi → next(err). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Middleware xử lý lỗi cuối cùng. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err instanceof Error ? err.message : "Lỗi máy chủ";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
}
