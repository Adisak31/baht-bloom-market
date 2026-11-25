/**
 * @version 1.3.1 (2026-11-24)
 * @summary
 * - ผสาน /api/login และ /api/verify-auth เข้ากับ TanStack Start createServerEntry (fetch Request/Response)
 * - คงเส้นทาง /api/drive-catalog (รองรับ ?type=subfolders และ ?type=images) และ handler.fetch เดิมครบถ้วน
 */

import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { handleDriveCatalogRequest } from "./lib/google-drive-catalog";

const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "admin1234";
const ADMIN_SESSION_TOKEN =
  process.env["ADMIN_SESSION_TOKEN"] || "catalog-admin-session-token";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function handleLogin(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { password?: unknown };
    const inputPassword =
      typeof body?.password === "string" ? body.password : "";

    if (inputPassword === ADMIN_PASSWORD) {
      return jsonResponse({ success: true, token: ADMIN_SESSION_TOKEN }, 200);
    }

    return jsonResponse(
      { success: false, error: "รหัสผ่านไม่ถูกต้อง" },
      401
    );
  } catch {
    return jsonResponse(
      { success: false, error: "รูปแบบข้อมูลไม่ถูกต้อง" },
      400
    );
  }
}

function handleVerifyAuth(request: Request): Response {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${ADMIN_SESSION_TOKEN}`) {
    return jsonResponse({ authenticated: true }, 200);
  }
  return jsonResponse({ authenticated: false }, 401);
}

export default createServerEntry({
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request);
    }

    if (url.pathname === "/api/verify-auth" && request.method === "GET") {
      return handleVerifyAuth(request);
    }

    if (url.pathname.startsWith("/api/drive-catalog")) {
      return handleDriveCatalogRequest(request);
    }

    return handler.fetch(request);
  },
});