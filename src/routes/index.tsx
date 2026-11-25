/**
 * @version 4.2.4 (2026-11-24)
 * @summary
 * - กดปุ่ม Admin แล้วส่งไปหน้า /admin?login=1 เพื่อเข้าสู่หน้า Login ก่อนเสมอ
 * - คง TypeScript strict safety, โหมดพลิกหน้า Flipbook, ซูม และเต็มหน้าจอเบราว์เซอร์จริงตาม v4.2.3
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Grid,
  LayoutPanelLeft,
  Maximize2,
  Minimize2,
  Search,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
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

const CATALOG_ENDPOINT = "/api/drive-catalog";
const STORAGE_KEY = "common_goods_admin_catalog_items";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sale Catalog Hub | Common Goods" },
      { name: "description", content: "แคตตาล็อกสินค้าและโหมดพลิกหน้า Flipbook สำหรับทีมขาย" },
    ],
  }),
  component: CatalogHomePage,
});

function CatalogHomePage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ทั้งหมด");
  const [layoutMode, setLayoutMode] = useState<"split" | "grid">("split");
  const [viewMode, setViewMode] = useState<"flipbook" | "file">("flipbook");
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      let localList: CatalogItem[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localList = parsed as CatalogItem[];
          }
        }
      } catch {
        // ignore storage errors
      }

      try {
        const res = await fetch(CATALOG_ENDPOINT, { cache: "no-store" });
        const data = (await res.json()) as { items?: CatalogItem[] };
        const apiList = Array.isArray(data.items) ? data.items : [];

        const merged = new Map<string, CatalogItem>();
        for (const item of localList) {
          if (item.available !== false) merged.set(item.id, item);
        }
        for (const item of apiList) {
          if (item.available !== false) merged.set(item.id, item);
        }

        const list = Array.from(merged.values());
        if (!active) return;
        setItems(list);
        const firstId = list[0]?.id;
        if (firstId) {
          setSelectedId((prev) => prev || firstId);
        }
      } catch {
        if (!active) return;
        const filteredLocal = localList.filter((item) => item.available !== false);
        setItems(filteredLocal);
        const firstLocalId = filteredLocal[0]?.id;
        if (firstLocalId) {
          setSelectedId((prev) => prev || firstLocalId);
        }
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>(["ทั้งหมด"]);
    for (const item of items) {
      if (item.category?.trim()) set.add(item.category.trim());
    }
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchCat =
        selectedCategory === "ทั้งหมด" || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.category ?? "").toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [items, searchQuery, selectedCategory]);

  const activeItem = useMemo(() => {
    return (
      filteredItems.find((item) => item.id === selectedId) ??
      filteredItems[0] ??
      null
    );
  }, [filteredItems, selectedId]);

  const pages = useMemo(() => {
    if (!activeItem) return [];
    if (Array.isArray(activeItem.pages) && activeItem.pages.length > 0) {
      return activeItem.pages;
    }
    return activeItem.previewUrl ? [activeItem.previewUrl] : [];
  }, [activeItem]);

  useEffect(() => {
    setCurrentPage(0);
    setZoomPercent(100);
  }, [activeItem?.id]);

  useEffect(() => {
    if (pages.length <= 1) return;
    const candidates = [pages[currentPage - 1], pages[currentPage + 1]].filter(
      (src): src is string => Boolean(src)
    );
    for (const src of candidates) {
      const img = new Image();
      img.src = src;
    }
  }, [pages, currentPage]);

  async function handleToggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
        return;
      }

      const target = stageRef.current;
      if (target && typeof target.requestFullscreen === "function") {
        await target.requestFullscreen();
        setIsFullscreen(true);
      } else {
        setIsFullscreen((prev) => !prev);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  }

  async function handleCopyShareText(item: CatalogItem) {
    const pageInfo =
      item.pages && item.pages.length > 0 ? ` (${item.pages.length} หน้า)` : "";
    const text = `${item.title}${pageInfo}\nหมวดหมู่: ${item.category}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  const totalPages = pages.length;
  const currentImageSrc = pages[currentPage] ?? activeItem?.previewUrl ?? "";

  return (
    <div className="min-h-screen bg-muted/20 text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-700 text-white">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Common Goods</h1>
              <p className="text-xs text-muted-foreground">Sale Catalog Hub v4.2.4</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={layoutMode === "split" ? "default" : "outline"}
              size="sm"
              onClick={() => setLayoutMode("split")}
              className={
                layoutMode === "split" ? "bg-emerald-700 hover:bg-emerald-800" : ""
              }
            >
              <LayoutPanelLeft className="mr-1.5 size-4" /> โหมดเปิดดูไฟล์
            </Button>
            <Button
              variant={layoutMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setLayoutMode("grid")}
              className={
                layoutMode === "grid" ? "bg-emerald-700 hover:bg-emerald-800" : ""
              }
            >
              <Grid className="mr-1.5 size-4" /> โหมดตารางการ์ด
            </Button>
            <Link
              to="/admin"
              search={{ login: "1" }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50/80 px-3 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
              title="ไปหน้าเข้าสู่ระบบแอดมิน"
            >
              <ShieldCheck className="size-4 text-emerald-700" />
              <span>Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Search & Category filter */}
      <div className="border-b border-border bg-background/80 px-4 py-3 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อเล่ม หรือหมวดหมู่..."
              className="bg-background pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">หมวดหมู่:</span>
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-emerald-700 text-white"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        {layoutMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setLayoutMode("split");
                }}
                className="cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-emerald-600"
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="size-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Sidebar list */}
            <aside className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2.5 px-1 text-xs font-medium text-muted-foreground">
                พบ {filteredItems.length} รายการ
              </p>

              <div className="space-y-1.5">
                {filteredItems.map((item) => {
                  const isSelected = activeItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/70"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <FileText className="size-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{item.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Viewer stage */}
            <section
              ref={stageRef}
              className={`flex flex-col rounded-xl border border-border bg-card shadow-sm ${
                isFullscreen ? "fixed inset-0 z-50 rounded-none border-0 bg-neutral-950" : ""
              }`}
            >
              {activeItem ? (
                <>
                  {/* Top action bar */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 ${
                      isFullscreen
                        ? "border-neutral-800 bg-neutral-900 text-white"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        {activeItem.category}
                      </span>
                      <h2 className="text-sm font-bold">{activeItem.title}</h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCopyShareText(activeItem)}
                        className={
                          isFullscreen
                            ? "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700"
                            : ""
                        }
                      >
                        {copiedId === activeItem.id ? (
                          <>
                            <Check className="mr-1.5 size-3.5 text-emerald-600" /> คัดลอกแล้ว
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 size-3.5" /> ก๊อปข้อความส่งแชท
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleToggleFullscreen()}
                        className={
                          isFullscreen
                            ? "border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700"
                            : ""
                        }
                      >
                        {isFullscreen ? (
                          <>
                            <Minimize2 className="mr-1.5 size-3.5" /> ออกเต็มจอ
                          </>
                        ) : (
                          <>
                            <Maximize2 className="mr-1.5 size-3.5" /> เปิดเต็มจอ
                          </>
                        )}
                      </Button>

                      {activeItem.downloadUrl && (
                        <a
                          href={activeItem.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-md bg-emerald-700 px-3 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          <Download className="mr-1.5 size-3.5" /> ดาวน์โหลด
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Mode & Zoom sub-bar */}
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs ${
                      isFullscreen
                        ? "border-neutral-800 bg-neutral-900/80 text-neutral-300"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setViewMode((prev) =>
                          prev === "flipbook" ? "file" : "flipbook"
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ${
                        viewMode === "flipbook"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-border bg-background text-foreground"
                      }`}
                    >
                      <BookOpen className="size-3.5" />
                      {viewMode === "flipbook"
                        ? "โหมดพลิกหน้า (Flipbook)"
                        : "สลับกลับโหมดพลิกหน้า"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setZoomPercent((z) => Math.max(50, z - 25))}
                        className="rounded p-1 hover:bg-muted"
                        title="ซูมออก"
                      >
                        <ZoomOut className="size-4" />
                      </button>
                      <span className="w-11 text-center font-medium">{zoomPercent}%</span>
                      <button
                        type="button"
                        onClick={() => setZoomPercent((z) => Math.min(200, z + 25))}
                        className="rounded p-1 hover:bg-muted"
                        title="ซูมเข้า"
                      >
                        <ZoomIn className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Preview viewport */}
                  <div
                    className={`flex flex-1 items-center justify-center overflow-auto p-4 ${
                      isFullscreen ? "bg-neutral-950" : "bg-neutral-800/90"
                    }`}
                  >
                    {currentImageSrc ? (
                      <img
                        src={currentImageSrc}
                        alt={`${activeItem.title} หน้า ${currentPage + 1}`}
                        style={{
                          transform: `scale(${zoomPercent / 100})`,
                          transformOrigin: "center center",
                        }}
                        className="max-h-[75vh] w-auto rounded shadow-2xl transition-transform duration-150"
                      />
                    ) : (
                      <p className="text-sm text-neutral-300">ไม่มีรูปภาพตัวอย่าง</p>
                    )}
                  </div>

                  {/* Bottom pagination bar */}
                  <div className="flex items-center justify-between gap-4 bg-neutral-900 px-4 py-2.5 text-xs text-white">
                    <button
                      type="button"
                      disabled={currentPage <= 0}
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" /> หน้าก่อนหน้า
                    </button>

                    <span className="font-medium">
                      หน้า {totalPages > 0 ? currentPage + 1 : 0} / {totalPages}
                    </span>

                    <button
                      type="button"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                    >
                      หน้าถัดไป <ChevronRight className="size-4" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center p-6 text-sm text-muted-foreground">
                  ไม่พบรายการแคตตาล็อกที่ตรงกับเงื่อนไข
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}