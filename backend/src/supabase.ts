import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// Client phía server dùng SERVICE ROLE KEY → toàn quyền, bỏ qua RLS.
// TUYỆT ĐỐI không để lộ key này ra frontend; nó chỉ sống trong backend.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
