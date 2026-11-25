/**
 * @version 3.6.0 (2026-11-24)
 * @summary
 * - เพิ่มหน้าต่าง/ฟอร์มแก้ไขรายละเอียดรายการสินค้า (ชื่อ, หมวดหมู่, ราคา, รายละเอียด, ลิงก์ Drive, หน้า Flipbook และสถานะพร้อมจำหน่าย)
 * - บันทึกการแก้ไขลง localStorage และเรียก PATCH /api/drive-catalog/:id บนเซิร์ฟเวอร์
 * - คงหน้าต่างยืนยันก่อนลบรายการ, ลบถาวรทั้งฝั่ง client/server และ ?login=1 ตาม v3.5.5
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FolderPlus,
  KeyRound,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  price?: number;
  description?: string;
  mimeType: string;
  previewUrl: string;
  viewUrl: string;
  downloadUrl: string;
  pages?: string[];
  available?: boolean;
}

interface DriveSubfolder {
  id: string;
  name: string;
  url?: string;
}

interface AdminSearch {
  login?: string;
}

const STORAGE_KEY = "common_goods_admin_catalog_items";
const DELETED_IDS_KEY = "common_goods_admin_deleted_ids";
const AUTH_TOKEN_KEY = "common_goods_admin_token";
const CATALOG_ENDPOINT = "/api/drive-catalog";
const LOGIN_ENDPOINT = "/api/login";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => {
    const login =
      typeof search["login"] === "string" ? search["login"] : undefined;
    return login ? { login } : {};
  },
  head: () => ({
    meta: [
      { title: "แผงควบคุมแอดมิน | Sale Catalog Hub" },
      { name: "description", content: "จัดการรายการสินค้าและชุดหน้า Flipbook จาก Google Drive" },
    ],
  }),
  component: AdminRoutePage,
});

function readDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeDeletedIds(ids: string[]): void {
  try {
    localStorage.setItem(
      DELETED_IDS_KEY,
      JSON.stringify(Array.from(new Set(ids)))
    );
  } catch {
    // ignore storage quota errors
  }
}

function readLocalItems(): CatalogItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const deletedSet = new Set<string>(readDeletedIds());
    return parsed.filter(
      (entry): entry is CatalogItem =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as CatalogItem).id === "string" &&
        typeof (entry as CatalogItem).title === "string" &&
        !deletedSet.has((entry as CatalogItem).id)
    );
  } catch {
    return [];
  }
}

function writeLocalItems(items: CatalogItem[]): void {
  try {
    const deletedSet = new Set<string>(readDeletedIds());
    const cleaned = items.filter((item) => !deletedSet.has(item.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // ignore storage quota errors
  }
}

function extractDriveId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const fileMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];
  return trimmed;
}

function buildDriveViewUrl(rawUrl: string): string {
  const id = extractDriveId(rawUrl);
  if (!id) return "";
  if (rawUrl.startsWith("http")) return rawUrl;
  return `https://drive.google.com/file/d/${id}/view`;
}

function buildDrivePreviewUrl(rawUrl: string): string {
  const id = extractDriveId(rawUrl);
  if (!id) return "";
  if (rawUrl.startsWith("http") && !rawUrl.includes("drive.google.com")) {
    return rawUrl;
  }
  return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
}

function buildDriveDownloadUrl(rawUrl: string): string {
  const id = extractDriveId(rawUrl);
  if (!id) return "";
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

function parsePagesInput(rawText: string): string[] {
  return rawText
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((entry) => {
      const id = extractDriveId(entry);
      if (id && entry.includes("drive.google.com")) {
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
      }
      return entry;
    });
}

function AdminRoutePage() {
  const search = Route.useSearch();
  const forceLogin = search.login === "1";

  const [authChecking, setAuthChecking] = useState<boolean>(() => !forceLogin);
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  useEffect(() => {
    if (forceLogin) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      setToken("");
      setAuthChecking(false);
      return;
    }

    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
    if (!savedToken) {
      setAuthChecking(false);
      return;
    }

    let active = true;
    async function checkSavedToken() {
      try {
        const res = await fetch("/api/verify-auth", {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (!active) return;
        if (res.ok) {
          setToken(savedToken);
        } else {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setToken("");
        }
      } catch {
        if (!active) return;
        setToken(savedToken);
      } finally {
        if (active) setAuthChecking(false);
      }
    }

    void checkSavedToken();
    return () => {
      active = false;
    };
  }, [forceLogin]);

  async function handleLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");

    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      setLoginError("กรุณากรอกรหัสผ่านแอดมิน");
      return;
    }

    setLoggingIn(true);
    try {
      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPassword }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        error?: string;
      };

      if (res.ok && data.success && data.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        setToken(data.token);
        setPassword("");
      } else {
        setLoginError(data.error || "รหัสผ่านไม่ถูกต้อง");
      }
    } catch {
      setLoginError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์เพื่อตรวจสอบรหัสผ่านได้");
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken("");
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 text-sm text-muted-foreground">
        กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...
      </div>
    );
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Lock className="size-6" />
            </div>
            <h1 className="text-lg font-bold text-foreground">เข้าสู่ระบบแอดมิน</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Sale Catalog Hub · กรุณายืนยันตัวตนก่อนจัดการรายการสินค้า
            </p>
          </div>

          <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <KeyRound className="size-3.5 text-emerald-700" /> รหัสผ่านแอดมิน
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน..."
                autoFocus
              />
            </div>

            {loginError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {loginError}
              </div>
            )}

            <Button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-emerald-700 hover:bg-emerald-800"
            >
              {loggingIn ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบแผงควบคุม"}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-3 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> กลับหน้าแคตตาล็อก
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <AdminDashboard authToken={token} onLogout={handleLogout} />;
}

interface AdminDashboardProps {
  authToken: string;
  onLogout: () => void;
}

function AdminDashboard({ authToken, onLogout }: AdminDashboardProps) {
  const [items, setItems] = useState<CatalogItem[]>(() => readLocalItems());
  const [subfolders, setSubfolders] = useState<DriveSubfolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [priceText, setPriceText] = useState<string>("0.00");
  const [description, setDescription] = useState<string>("");
  const [driveUrlInput, setDriveUrlInput] = useState<string>("");
  const [pagesInput, setPagesInput] = useState<string>("");
  const [available, setAvailable] = useState<boolean>(true);

  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editPriceText, setEditPriceText] = useState<string>("0.00");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editDriveUrl, setEditDriveUrl] = useState<string>("");
  const [editPagesText, setEditPagesText] = useState<string>("");
  const [editAvailable, setEditAvailable] = useState<boolean>(true);
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const [pendingDeleteItem, setPendingDeleteItem] = useState<CatalogItem | null>(
    null
  );
  const [deletingItem, setDeletingItem] = useState<boolean>(false);

  const [bannerMessage, setBannerMessage] = useState<string>("");
  const [bannerType, setBannerType] = useState<"success" | "error">("success");
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [fetchingFolderPages, setFetchingFolderPages] = useState<boolean>(false);

  const showNotice = useCallback(
    (msg: string, type: "success" | "error" = "success") => {
      setBannerMessage(msg);
      setBannerType(type);
    },
    []
  );

  const fetchCatalogItems = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(CATALOG_ENDPOINT, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await res.json()) as { items?: CatalogItem[] };
      const deletedSet = new Set<string>(readDeletedIds());
      const serverItems = (Array.isArray(data.items) ? data.items : []).filter(
        (item) => !deletedSet.has(item.id)
      );
      const localItems = readLocalItems().filter(
        (item) => !deletedSet.has(item.id)
      );

      const merged = new Map<string, CatalogItem>();
      for (const item of serverItems) merged.set(item.id, item);
      for (const item of localItems) merged.set(item.id, item);

      const finalList = Array.from(merged.values());
      setItems(finalList);
      writeLocalItems(finalList);
    } catch {
      const localFallback = readLocalItems();
      setItems(localFallback);
    } finally {
      setLoadingList(false);
    }
  }, [authToken]);

  const fetchSubfolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch(`${CATALOG_ENDPOINT}?type=subfolders`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = (await res.json()) as {
        subfolders?: DriveSubfolder[];
        folders?: DriveSubfolder[];
      };
      const list = Array.isArray(data.subfolders)
        ? data.subfolders
        : Array.isArray(data.folders)
        ? data.folders
        : [];
      setSubfolders(list);
      const firstId = list[0]?.id;
      if (firstId) {
        setSelectedFolderId((prev) => prev || firstId);
      }
    } catch {
      // ignore subfolder fetch errors
    } finally {
      setLoadingFolders(false);
    }
  }, [authToken]);

  useEffect(() => {
    void fetchCatalogItems();
    void fetchSubfolders();
  }, [fetchCatalogItems, fetchSubfolders]);

  const availableCount = useMemo(
    () => items.filter((item) => item.available !== false).length,
    [items]
  );

  const selectedFolder = useMemo(
    () => subfolders.find((f) => f.id === selectedFolderId) ?? null,
    [subfolders, selectedFolderId]
  );

  async function pullFolderImages(folderId: string): Promise<string[]> {
    if (!folderId) return [];
    setFetchingFolderPages(true);
    try {
      const res = await fetch(
        `${CATALOG_ENDPOINT}?type=images&folderId=${encodeURIComponent(
          folderId
        )}`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      const data = (await res.json()) as {
        pages?: string[];
        images?: string[];
      };
      if (Array.isArray(data.pages) && data.pages.length > 0) return data.pages;
      if (Array.isArray(data.images) && data.images.length > 0) return data.images;
      return [];
    } catch {
      return [];
    } finally {
      setFetchingFolderPages(false);
    }
  }

  async function handleFillFromSubfolder() {
    if (!selectedFolder) return;
    setTitle(selectedFolder.name);
    if (!category.trim()) {
      setCategory("การ์ตูน");
    }
    const pulled = await pullFolderImages(selectedFolder.id);
    if (pulled.length > 0) {
      setPagesInput(pulled.join("\n"));
      const firstImg = pulled[0];
      if (firstImg) {
        setDriveUrlInput(firstImg);
      }
      showNotice(
        `ดึงรูปภาพจากโฟลเดอร์ "${selectedFolder.name}" จำนวน ${pulled.length} หน้าแล้ว`
      );
    } else {
      showNotice(
        `เติมชื่อ "${selectedFolder.name}" ลงฟอร์มแล้ว (ไม่พบรูปอัตโนมัติในโฟลเดอร์นี้)`
      );
    }
  }

  async function handleCreateFromSubfolderInstant() {
    if (!selectedFolder) return;
    const pulled = await pullFolderImages(selectedFolder.id);
    const coverUrl =
      pulled[0] ??
      `https://drive.google.com/thumbnail?id=${selectedFolder.id}&sz=w1200`;
    const folderUrl = `https://drive.google.com/drive/folders/${selectedFolder.id}`;
    const cleanDesc = description.trim();

    const newItem: CatalogItem = {
      id: `item-${Date.now()}`,
      title: selectedFolder.name,
      category: category.trim() || "การ์ตูน",
      price: Number.parseFloat(priceText) || 0,
      ...(cleanDesc ? { description: cleanDesc } : {}),
      mimeType: "application/vnd.google-apps.folder",
      previewUrl: coverUrl,
      viewUrl: folderUrl,
      downloadUrl: folderUrl,
      ...(pulled.length > 0 ? { pages: pulled } : {}),
      available: true,
    };

    writeDeletedIds(readDeletedIds().filter((id) => id !== newItem.id));
    const nextItems = [newItem, ...items];
    setItems(nextItems);
    writeLocalItems(nextItems);

    try {
      await fetch(CATALOG_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newItem),
      });
    } catch {
      // ignore network errors
    }

    showNotice(`สร้างรายการ Flipbook "${newItem.title}" เรียบร้อยแล้ว`);
  }

  async function handleAddItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showNotice("กรุณากรอกชื่อสินค้าก่อนเพิ่มรายการ", "error");
      return;
    }

    const parsedPages = parsePagesInput(pagesInput);
    const rawCover = driveUrlInput.trim() || parsedPages[0] || "";
    const previewUrl = buildDrivePreviewUrl(rawCover);
    const viewUrl = buildDriveViewUrl(rawCover);
    const downloadUrl = buildDriveDownloadUrl(rawCover);
    const cleanDesc = description.trim();

    const newItem: CatalogItem = {
      id: `item-${Date.now()}`,
      title: cleanTitle,
      category: category.trim() || "ทั่วไป",
      price: Number.parseFloat(priceText) || 0,
      ...(cleanDesc ? { description: cleanDesc } : {}),
      mimeType: parsedPages.length > 0 ? "image/flipbook" : "image/jpeg",
      previewUrl,
      viewUrl,
      downloadUrl,
      ...(parsedPages.length > 0 ? { pages: parsedPages } : {}),
      available,
    };

    writeDeletedIds(readDeletedIds().filter((id) => id !== newItem.id));
    const nextItems = [newItem, ...items];
    setItems(nextItems);
    writeLocalItems(nextItems);

    try {
      await fetch(CATALOG_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(newItem),
      });
    } catch {
      // ignore network errors
    }

    setTitle("");
    setCategory("");
    setPriceText("0.00");
    setDescription("");
    setDriveUrlInput("");
    setPagesInput("");
    setAvailable(true);
    showNotice(`เพิ่มสินค้า "${cleanTitle}" เรียบร้อยแล้ว`);
  }

  function handleOpenEdit(item: CatalogItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditPriceText((item.price ?? 0).toFixed(2));
    setEditDescription(item.description ?? "");
    setEditDriveUrl(item.viewUrl || item.previewUrl || "");
    setEditPagesText(Array.isArray(item.pages) ? item.pages.join("\n") : "");
    setEditAvailable(item.available !== false);
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingItem) return;

    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      showNotice("กรุณากรอกชื่อสินค้า", "error");
      return;
    }

    setSavingEdit(true);
    const parsedPages = parsePagesInput(editPagesText);
    const rawCover = editDriveUrl.trim() || parsedPages[0] || editingItem.previewUrl || "";
    const previewUrl = rawCover
      ? buildDrivePreviewUrl(rawCover) || editingItem.previewUrl
      : editingItem.previewUrl;
    const viewUrl = rawCover
      ? buildDriveViewUrl(rawCover) || editingItem.viewUrl
      : editingItem.viewUrl;
    const downloadUrl = rawCover
      ? buildDriveDownloadUrl(rawCover) || editingItem.downloadUrl
      : editingItem.downloadUrl;
    const cleanDesc = editDescription.trim();

    const updatedItem: CatalogItem = {
      ...editingItem,
      title: cleanTitle,
      category: editCategory.trim() || "ทั่วไป",
      price: Number.parseFloat(editPriceText) || 0,
      ...(cleanDesc ? { description: cleanDesc } : { description: "" }),
      mimeType: parsedPages.length > 0 ? "image/flipbook" : editingItem.mimeType,
      previewUrl,
      viewUrl,
      downloadUrl,
      ...(parsedPages.length > 0 ? { pages: parsedPages } : { pages: [] }),
      available: editAvailable,
    };

    const nextItems = items.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    setItems(nextItems);
    writeLocalItems(nextItems);
    setEditingItem(null);

    try {
      const patchRes = await fetch(
        `${CATALOG_ENDPOINT}/${encodeURIComponent(updatedItem.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updatedItem),
        }
      );

      if (!patchRes.ok) {
        await fetch(CATALOG_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(updatedItem),
        });
      }

      showNotice(`บันทึกการแก้ไข "${cleanTitle}" เรียบร้อยแล้ว`);
    } catch {
      showNotice(
        `บันทึกการแก้ไข "${cleanTitle}" ในเครื่องแล้ว (ไม่สามารถติดต่อเซิร์ฟเวอร์ได้)`,
        "error"
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleAvailable(targetId: string) {
    const targetItem = items.find((item) => item.id === targetId);
    const nextAvailable = targetItem ? targetItem.available === false : true;

    const nextItems = items.map((item) =>
      item.id === targetId ? { ...item, available: nextAvailable } : item
    );
    setItems(nextItems);
    writeLocalItems(nextItems);

    try {
      await fetch(`${CATALOG_ENDPOINT}/${encodeURIComponent(targetId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ available: nextAvailable }),
      });
    } catch {
      // ignore network errors
    }

    showNotice("อัปเดตสถานะพร้อมจำหน่ายเรียบร้อยแล้ว");
  }

  function handleRequestDelete(item: CatalogItem) {
    setPendingDeleteItem(item);
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteItem) return;
    const target = pendingDeleteItem;
    setDeletingItem(true);

    const nextDeleted = Array.from(new Set([...readDeletedIds(), target.id]));
    writeDeletedIds(nextDeleted);

    const nextItems = items.filter((item) => item.id !== target.id);
    setItems(nextItems);
    writeLocalItems(nextItems);
    setPendingDeleteItem(null);

    try {
      const res = await fetch(
        `${CATALOG_ENDPOINT}/${encodeURIComponent(target.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      if (res.ok) {
        showNotice(`ลบรายการ "${target.title}" เรียบร้อยแล้ว`);
      } else {
        showNotice(
          `ลบ "${target.title}" ในเครื่องแล้ว แต่ลบฝั่งเซิร์ฟเวอร์ไม่สำเร็จ`,
          "error"
        );
      }
    } catch {
      showNotice(
        `ลบ "${target.title}" ในเครื่องแล้ว (ไม่สามารถติดต่อเซิร์ฟเวอร์ได้)`,
        "error"
      );
    } finally {
      setDeletingItem(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      {/* Edit item modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="size-4 text-emerald-700" />
                <h3 className="text-base font-bold text-foreground">
                  แก้ไขรายละเอียดสินค้า
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ปิด
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveEdit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">ชื่อสินค้า</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="ชื่อสินค้า"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">หมวดหมู่</label>
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="หมวดหมู่"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">ราคา (บาท)</label>
                  <Input
                    type="text"
                    value={editPriceText}
                    onChange={(e) => setEditPriceText(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">รายละเอียดสินค้า</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="รายละเอียดสินค้า..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  ลิงก์รูปภาพหรือไฟล์จาก Google Drive (URL)
                </label>
                <Input
                  value={editDriveUrl}
                  onChange={(e) => setEditDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  ลิงก์รูปภาพแต่ละหน้าสำหรับโหมด Flipbook
                </label>
                <textarea
                  rows={4}
                  value={editPagesText}
                  onChange={(e) => setEditPagesText(e.target.value)}
                  placeholder="วางลิงก์รูปภาพทีละบรรทัด หรือคั่นด้วยจุลภาค"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold">พร้อมจำหน่าย</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={editAvailable}
                  onClick={() => setEditAvailable((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    editAvailable ? "bg-emerald-700" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition ${
                      editAvailable ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingEdit}
                  onClick={() => setEditingItem(null)}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEdit}
                  className="bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  {savingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {pendingDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  ยืนยันการลบรายการสินค้า
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  ต้องการลบ{" "}
                  <span className="font-semibold text-foreground">
                    “{pendingDeleteItem.title}”
                  </span>{" "}
                  ออกจากแคตตาล็อกใช่หรือไม่? เมื่อลบแล้วจะไม่แสดงในหน้าแคตตาล็อกอีก
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deletingItem}
                onClick={() => setPendingDeleteItem(null)}
              >
                ยกเลิก
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={deletingItem}
                onClick={() => void handleConfirmDelete()}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deletingItem ? "กำลังลบ..." : "ยืนยันลบรายการ"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="border-b border-border bg-background px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> กลับหน้าแคตตาล็อก
            </Link>
            <h1 className="text-xl font-bold tracking-tight">แผงควบคุมแอดมิน</h1>
            <p className="text-xs text-muted-foreground">
              จัดการรายการสินค้าและชุดหน้า Flipbook จาก Google Drive (v3.6.0)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingFolders}
              onClick={() => void fetchSubfolders()}
            >
              <FolderPlus className="mr-1.5 size-4" /> รีเฟรชโฟลเดอร์
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingList}
              onClick={() => void fetchCatalogItems()}
            >
              <RefreshCw className="mr-1.5 size-4" /> รีเฟรชรายการ
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="mr-1.5 size-4" /> ออกจากระบบ
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        {bannerMessage && (
          <div
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium ${
              bannerType === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-800"
            }`}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              {bannerMessage}
            </span>
            <button
              type="button"
              onClick={() => setBannerMessage("")}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ปิด
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* Left column: Add item form */}
          <section className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-emerald-700" /> เพิ่มสินค้าใหม่
            </h2>

            <form onSubmit={(e) => void handleAddItem(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">ชื่อสินค้า</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น มหาเวทย์ผนึกมาร เล่ม 00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">หมวดหมู่</label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="เช่น การ์ตูน, ของใช้"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">ราคา (บาท)</label>
                  <Input
                    type="text"
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">รายละเอียดสินค้า</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดเพิ่มเติมของสินค้า..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  ลิงก์รูปภาพหรือไฟล์จาก Google Drive (URL)
                </label>
                <Input
                  value={driveUrlInput}
                  onChange={(e) => setDriveUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
                <p className="text-[11px] text-muted-foreground">
                  วางลิงก์แชร์จาก Google Drive ระบบจะแปลงลิงก์สำหรับเปิดดูและดาวน์โหลดให้อัตโนมัติ
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold">
                    ลิงก์รูปภาพแต่ละหน้าสำหรับโหมด Flipbook (ไม่บังคับ)
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!selectedFolder || fetchingFolderPages}
                    onClick={() => void handleFillFromSubfolder()}
                    className="h-7 border-emerald-200 bg-emerald-50/70 px-2.5 text-[11px] text-emerald-800 hover:bg-emerald-100"
                  >
                    {fetchingFolderPages ? "กำลังดึง..." : "ดึงรูปจากโฟลเดอร์ที่เลือก"}
                  </Button>
                </div>
                <textarea
                  rows={4}
                  value={pagesInput}
                  onChange={(e) => setPagesInput(e.target.value)}
                  placeholder="วางลิงก์รูปภาพทีละบรรทัด หรือคั่นด้วยจุลภาค (รองรับลิงก์ Google Drive)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold">พร้อมจำหน่าย</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={available}
                  onClick={() => setAvailable((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    available ? "bg-emerald-700" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition ${
                      available ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800"
              >
                <Plus className="mr-1.5 size-4" /> เพิ่มสินค้า
              </Button>
            </form>
          </section>

          {/* Right column: Subfolder Flipbook builder + Item list */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-bold">
                  <FolderPlus className="size-4 text-emerald-700" /> สร้างรายการ Flipbook จากโฟลเดอร์ย่อย
                </h2>
                <span className="text-xs text-muted-foreground">
                  พบ {subfolders.length} โฟลเดอร์
                </span>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {subfolders.length === 0 ? (
                    <option value="">ไม่พบโฟลเดอร์ย่อยจาก Google Drive</option>
                  ) : (
                    subfolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))
                  )}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedFolder || fetchingFolderPages}
                  onClick={() => void handleFillFromSubfolder()}
                >
                  ดึงเข้าฟอร์ม
                </Button>

                <Button
                  type="button"
                  disabled={!selectedFolder || fetchingFolderPages}
                  onClick={() => void handleCreateFromSubfolderInstant()}
                  className="bg-emerald-700 hover:bg-emerald-800"
                >
                  <Plus className="mr-1.5 size-4" /> สร้างรายการทันที
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">รายการสินค้าทั้งหมด</h2>
                  <p className="text-xs text-muted-foreground">
                    ทั้งหมด {items.length} รายการในแคตตาล็อก
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  พร้อมจำหน่าย {availableCount} รายการ
                </span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีรายการสินค้าในแคตตาล็อก
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => {
                    const isAvailable = item.available !== false;
                    const pageCount = Array.isArray(item.pages) ? item.pages.length : 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3 transition hover:border-emerald-200"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {item.previewUrl ? (
                              <img
                                src={item.previewUrl}
                                alt={item.title}
                                className="size-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{item.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.category} · ฿{(item.price ?? 0).toFixed(2)}
                              {pageCount > 0 ? ` · Flipbook ${pageCount} หน้า` : ""}
                            </p>
                            {item.description ? (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isAvailable}
                              onClick={() => void handleToggleAvailable(item.id)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                                isAvailable ? "bg-emerald-700" : "bg-muted"
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow transition ${
                                  isAvailable ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                            <span className="hidden text-xs font-medium sm:inline">
                              {isAvailable ? "พร้อมจำหน่าย" : "ปิดชั่วคราว"}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="แก้ไขรายละเอียด"
                          >
                            <Pencil className="size-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDelete(item)}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                            title="ลบรายการ"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}