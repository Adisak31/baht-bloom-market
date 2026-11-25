import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DriveCatalogItem {
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
  updatedAt?: string;
}

export interface DriveSubfolderItem {
  id: string;
  name: string;
  url: string;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

interface GoogleDriveListResponse {
  files?: GoogleDriveFile[];
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOM_ITEMS_FILE = path.join(DATA_DIR, "catalog-items.json");
const DELETED_IDS_FILE = path.join(DATA_DIR, "deleted-catalog-items.json");

function extractFolderId(rawValue: string): string {
  const trimmed = rawValue.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? trimmed;
}

async function readCustomItems(): Promise<DriveCatalogItem[]> {
  try {
    const raw = await readFile(CUSTOM_ITEMS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DriveCatalogItem[]) : [];
  } catch {
    return [];
  }
}

async function writeCustomItems(items: DriveCatalogItem[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CUSTOM_ITEMS_FILE, JSON.stringify(items, null, 2), "utf8");
}

async function readDeletedIds(): Promise<string[]> {
  try {
    const raw = await readFile(DELETED_IDS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeDeletedIds(ids: string[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    DELETED_IDS_FILE,
    JSON.stringify(Array.from(new Set(ids)), null, 2),
    "utf8"
  );
}

async function listDriveFiles(params: {
  folderId: string;
  apiKey: string;
  extraFilter: string;
  fields: string;
}): Promise<GoogleDriveFile[]> {
  const { folderId, apiKey, extraFilter, fields } = params;
  const query = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and ${extraFilter}`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${encodeURIComponent(
    fields
  )}&orderBy=name&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as GoogleDriveListResponse;
  return Array.isArray(data.files) ? data.files : [];
}

export async function fetchDriveCatalogItems(params: {
  folderIdOrUrl: string;
  apiKey: string;
  defaultCategory?: string;
}): Promise<DriveCatalogItem[]> {
  const folderId = extractFolderId(params.folderIdOrUrl);
  const apiKey = params.apiKey.trim();
  const defaultCategory = params.defaultCategory?.trim() || "แคตตาล็อก";

  if (!folderId || !apiKey) {
    throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID or GOOGLE_DRIVE_API_KEY");
  }

  const files = await listDriveFiles({
    folderId,
    apiKey,
    extraFilter: "mimeType != 'application/vnd.google-apps.folder'",
    fields: "files(id,name,mimeType,modifiedTime)",
  });

  const deletedSet = new Set<string>(await readDeletedIds());

  const driveItems: DriveCatalogItem[] = files
    .filter((file) => !deletedSet.has(file.id))
    .map((file) => {
      const isImage = file.mimeType.startsWith("image/");
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

      return {
        id: file.id,
        title: cleanTitle || file.name,
        category: defaultCategory,
        mimeType: file.mimeType,
        previewUrl: isImage
          ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w1400`
          : `https://drive.google.com/file/d/${file.id}/preview`,
        viewUrl: `https://drive.google.com/file/d/${file.id}/view`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
        available: true,
        ...(file.modifiedTime ? { updatedAt: file.modifiedTime } : {}),
      };
    });

  const customItems = (await readCustomItems()).filter(
    (item) => !deletedSet.has(item.id)
  );
  const mergedMap = new Map<string, DriveCatalogItem>();
  for (const item of customItems) {
    mergedMap.set(item.id, item);
  }
  for (const item of driveItems) {
    if (!mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }

  return Array.from(mergedMap.values());
}

export async function fetchDriveSubfolders(params: {
  folderIdOrUrl: string;
  apiKey: string;
}): Promise<DriveSubfolderItem[]> {
  const folderId = extractFolderId(params.folderIdOrUrl);
  const apiKey = params.apiKey.trim();

  if (!folderId || !apiKey) {
    throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID or GOOGLE_DRIVE_API_KEY");
  }

  const folders = await listDriveFiles({
    folderId,
    apiKey,
    extraFilter: "mimeType = 'application/vnd.google-apps.folder'",
    fields: "files(id,name)",
  });

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    url: `https://drive.google.com/drive/folders/${folder.id}`,
  }));
}

export async function fetchDriveFolderImages(params: {
  folderIdOrUrl: string;
  apiKey: string;
}): Promise<string[]> {
  const folderId = extractFolderId(params.folderIdOrUrl);
  const apiKey = params.apiKey.trim();

  if (!folderId || !apiKey) {
    throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID or GOOGLE_DRIVE_API_KEY");
  }

  const files = await listDriveFiles({
    folderId,
    apiKey,
    extraFilter: "mimeType contains 'image/'",
    fields: "files(id,name,mimeType)",
  });

  return files.map(
    (file) => `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`
  );
}

export async function handleDriveCatalogRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/drive-catalog")) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const idMatch = url.pathname.match(/^\/api\/drive-catalog\/([^/]+)$/);
  const targetId = idMatch?.[1] ? decodeURIComponent(idMatch[1]) : null;

  if (req.method === "POST") {
    try {
      const body = (await req.json()) as DriveCatalogItem;
      if (!body?.id || !body?.title) {
        return new Response(JSON.stringify({ error: "Invalid item payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const deletedIds = await readDeletedIds();
      if (deletedIds.includes(body.id)) {
        await writeDeletedIds(deletedIds.filter((id) => id !== body.id));
      }
      const existing = await readCustomItems();
      const filtered = existing.filter((item) => item.id !== body.id);
      const next = [body, ...filtered];
      await writeCustomItems(next);
      return new Response(JSON.stringify({ ok: true, item: body }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save item";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (req.method === "PATCH" && targetId) {
    try {
      const patch = (await req.json()) as Partial<DriveCatalogItem>;
      const existing = await readCustomItems();
      const next = existing.map((item) =>
        item.id === targetId ? { ...item, ...patch } : item
      );
      await writeCustomItems(next);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to update item";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (req.method === "DELETE" && targetId) {
    try {
      const existing = await readCustomItems();
      const next = existing.filter((item) => item.id !== targetId);
      await writeCustomItems(next);

      const deletedIds = await readDeletedIds();
      if (!deletedIds.includes(targetId)) {
        await writeDeletedIds([...deletedIds, targetId]);
      }

      return new Response(JSON.stringify({ ok: true, deletedId: targetId }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete item";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rootFolderIdOrUrl = process.env["GOOGLE_DRIVE_FOLDER_ID"] || "";
  const apiKey = process.env["GOOGLE_DRIVE_API_KEY"] || "";
  const defaultCategory = process.env["CATALOG_DEFAULT_CATEGORY"] || "แคตตาล็อก";
  const typeParam = url.searchParams.get("type");
  const targetFolderParam = url.searchParams.get("folderId") || rootFolderIdOrUrl;

  try {
    if (typeParam === "subfolders") {
      const subfolders = await fetchDriveSubfolders({
        folderIdOrUrl: rootFolderIdOrUrl,
        apiKey,
      });
      return new Response(JSON.stringify({ subfolders }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    if (typeParam === "images") {
      const pages = await fetchDriveFolderImages({
        folderIdOrUrl: targetFolderParam,
        apiKey,
      });
      return new Response(JSON.stringify({ pages }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    const items = await fetchDriveCatalogItems({
      folderIdOrUrl: rootFolderIdOrUrl,
      apiKey,
      defaultCategory,
    });

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch Drive catalog";
    return new Response(JSON.stringify({ error: message, items: [] }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}