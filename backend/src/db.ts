// Tiện ích gọn nhẹ bọc Supabase client: gỡ {data,error} và ném lỗi thống nhất.
// Dùng kiểu lỏng (any) vì chưa sinh type schema từ Supabase — đủ cho phạm vi đồ án.
import { supabase } from "./supabase";
import { ApiError } from "./lib/http";

export { supabase };

/** Lấy danh sách row. */
export async function many(query: any): Promise<any[]> {
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/** Lấy 1 row hoặc null (dùng với .maybeSingle() hoặc .single()). */
export async function maybe(query: any): Promise<any> {
  const { data, error } = await query;
  if (error) throw new ApiError(500, error.message);
  return data ?? null;
}

/** Đếm theo khóa từ một mảng row (gom nhóm phía JS). */
export function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) { const k = key(r); m[k] = (m[k] ?? 0) + 1; }
  return m;
}
