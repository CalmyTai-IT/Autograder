import fs from "fs";
import path from "path";
import multer from "multer";
import { config } from "../config";
import { supabase } from "../supabase";

// Giữ file trong RAM rồi đẩy lên Supabase Storage → file BỀN VỮNG qua mọi lần
// restart / build lại từ zip (không còn cảnh "có tên trong DB mà mất file trên đĩa").
// Nếu Storage chưa sẵn sàng vì lý do gì đó, tự fallback lưu xuống đĩa local để app vẫn chạy.
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const BUCKET = process.env.STORAGE_BUCKET ?? "uploads";
const LEGACY_DIR = path.resolve(config.uploadDir); // chỉ dùng cho fallback + phục vụ file cũ
fs.mkdirSync(LEGACY_DIR, { recursive: true });

/** Multer/busboy giải mã tên file gốc theo latin1 → decode lại UTF-8 để tên tiếng Việt
 *  (vd "Thuyết trình.pdf") không bị biến dạng. */
export const origName = (file: { originalname: string }) =>
  Buffer.from(file.originalname, "latin1").toString("utf8");

// Tạo bucket công khai 1 lần (idempotent). Cache promise để không gọi lặp.
let bucketReady: Promise<void> | null = null;
function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      try {
        const { data } = await supabase.storage.getBucket(BUCKET);
        if (data) return;
      } catch { /* chưa có → tạo bên dưới */ }
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (error && !/exist/i.test(error.message)) throw error;
    })().catch((e) => { bucketReady = null; throw e; });
  }
  return bucketReady;
}

const keyFor = (file: { originalname: string }) =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${origName(file).replace(/[^\w.\-]+/g, "_")}`;

/** Lưu 1 file (đang ở RAM nhờ memoryStorage) và trả về URL mở được.
 *  Ưu tiên Supabase Storage (https công khai, bền vững); lỗi thì fallback đĩa local. */
export async function saveFile(file: Express.Multer.File): Promise<string> {
  const key = keyFor(file);
  try {
    await ensureBucket();
    const { error } = await supabase.storage.from(BUCKET).upload(key, file.buffer, {
      contentType: file.mimetype || "application/octet-stream", upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  } catch (e) {
    console.warn(`[upload] Supabase Storage chưa dùng được, lưu tạm xuống đĩa local (file sẽ mất nếu build lại từ zip). Lý do: ${(e as Error).message}`);
    fs.writeFileSync(path.join(LEGACY_DIR, key), file.buffer);
    return `/uploads/${key}`;
  }
}
