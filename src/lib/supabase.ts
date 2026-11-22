import { createClient } from "@supabase/supabase-js";

// This publishable key is intended for browser use; access is enforced by project policies.
export const supabase = createClient(
  "https://gqcbwexhcnlcgazmmpscv.supabase.co",
  "sb_publishable_FO7v0TcUa8BjEgcJh0VKmg_ytWl9GFG",
);