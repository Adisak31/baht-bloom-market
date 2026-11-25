/**
 * @version 1.1.0 (2026-11-23)
 * @summary
 * - v1.0.0: สร้าง Supabase client ด้วย URL และ publishable key ของโปรเจกต์
 * - v1.1.0: เพิ่ม header เวอร์ชันและสรุปการเปลี่ยนแปลงด้านบนไฟล์
 */

import { createClient } from "@supabase/supabase-js";

// This publishable key is intended for browser use; access is enforced by project policies.
export const supabase = createClient(
  "https://gqcbwexhcnlcgazmmpscv.supabase.co",
  "sb_publishable_FO7v0TcUa8BjEgcJh0VKmg_ytWl9GFG",
);