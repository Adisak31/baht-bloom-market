import { useState } from "react";

interface DriveSubfolderOption {
  id: string;
  name: string;
  url: string;
}

interface DriveFlipbookImporterProps {
  onPagesImported: (pagesText: string) => void;
}

export function DriveFlipbookImporter({
  onPagesImported,
}: DriveFlipbookImporterProps) {
  const [subfolders, setSubfolders] = useState<DriveSubfolderOption[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleLoadSubfolders() {
    setLoadingFolders(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/drive-catalog?type=subfolders", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        subfolders?: DriveSubfolderOption[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "โหลดรายชื่อโฟลเดอร์ไม่สำเร็จ");
      }
      const list = Array.isArray(data.subfolders) ? data.subfolders : [];
      setSubfolders(list);
      const firstFolder = list[0];
      if (firstFolder && !selectedFolderId) {
        setSelectedFolderId(firstFolder.id);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการโหลดโฟลเดอร์"
      );
    } finally {
      setLoadingFolders(false);
    }
  }

  async function handleImportImages() {
    if (!selectedFolderId) return;
    setLoadingImages(true);
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/drive-catalog?type=images&folderId=${encodeURIComponent(
          selectedFolderId
        )}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as { pages?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "ดึงรูปภาพจากโฟลเดอร์ไม่สำเร็จ");
      }
      const pages = Array.isArray(data.pages) ? data.pages : [];
      onPagesImported(pages.join("\n"));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการดึงรูปภาพ"
      );
    } finally {
      setLoadingImages(false);
    }
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-700">
          ดึงรูปหน้า Flipbook จากโฟลเดอร์ย่อยใน Google Drive
        </span>
        <button
          type="button"
          onClick={handleLoadSubfolders}
          disabled={loadingFolders}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {loadingFolders ? "กำลังโหลด..." : "โหลดโฟลเดอร์ย่อย"}
        </button>
      </div>

      {subfolders.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            {subfolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleImportImages}
            disabled={!selectedFolderId || loadingImages}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {loadingImages ? "กำลังดึง..." : "ดึงรูปเข้า Flipbook"}
          </button>
        </div>
      )}

      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
    </div>
  );
}