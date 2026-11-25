/**
 * @version 2.0.3 (2026-11-23)
 * @summary
 * - v2.0.0: เปลี่ยนมาจัดการข้อมูลสินค้าและรูปภาพในเครื่อง/เซิร์ฟเวอร์แทน Supabase
 * - v2.0.1: แก้ error `crypto.randomUUID is not a function` เมื่อเปิดผ่าน HTTP บน IP วงแลน
 * - v2.0.2: ปรับ `generateId()` ให้เรียบและไม่ใช้ bitwise เพื่อลด TypeScript/linter warning/error
 * - v2.0.3: แก้ `QuotaExceededError` บน `product_catalog_items_v1` โดยไม่เก็บ data URL รูปภาพลง `localStorage`
 *           และดักจับข้อผิดพลาดตอนบันทึก cache เพื่อไม่ให้ขัดจังหวะการใช้งาน
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
}

export type NewProduct = Omit<Product, "id" | "created_at">;

const LOCAL_STORAGE_KEY = "product_catalog_items_v1";
const UPLOAD_ENDPOINT = "/api/products/upload";
const PRODUCTS_ENDPOINT = "/api/products";

const memoryProducts = new Map<string, Product>();

function generateId(): string {
  const cryptoObj = globalThis.crypto;

  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }

  return `prod-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeProductForStorage(item: Product): Product {
  if (item.image_url && item.image_url.startsWith("data:")) {
    return { ...item, image_url: null };
  }
  return item;
}

function readLocalCache(): Product[] {
  if (typeof window === "undefined") {
    return Array.from(memoryProducts.values());
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return Array.from(memoryProducts.values());
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return Array.from(memoryProducts.values());
    }
    const items = parsed as Product[];
    for (const item of items) {
      if (!memoryProducts.has(item.id)) {
        memoryProducts.set(item.id, item);
      }
    }
    return Array.from(memoryProducts.values());
  } catch {
    return Array.from(memoryProducts.values());
  }
}

function writeLocalCache(items: Product[]): void {
  memoryProducts.clear();
  for (const item of items) {
    memoryProducts.set(item.id, item);
  }

  if (typeof window === "undefined") return;

  try {
    const safeItems = items.map(sanitizeProductForStorage);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(safeItems));
  } catch {
    try {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ข้ามหากไม่สามารถเขียนหรือลบ localStorage ได้
    }
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
      }
    };
    reader.onerror = () => reject(new Error("เกิดข้อผิดพลาดระหว่างอ่านไฟล์รูปภาพ"));
    reader.readAsDataURL(file);
  });
}

export async function listProducts(): Promise<Product[]> {
  try {
    const res = await fetch(PRODUCTS_ENDPOINT, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as Product[];
      writeLocalCache(data);
      return data;
    }
  } catch {
    // อ่านจากแคชเมื่อยังไม่มี API endpoint ฝั่งเซิร์ฟเวอร์
  }

  return readLocalCache().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function createProduct(product: NewProduct, imageFile: File | null): Promise<Product> {
  let imageUrl = product.image_url;

  if (imageFile) {
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadRes = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      if (uploadRes.ok) {
        const uploaded = (await uploadRes.json()) as { url?: string };
        if (uploaded.url) {
          imageUrl = uploaded.url;
        }
      } else {
        imageUrl = await fileToDataUrl(imageFile);
      }
    } catch {
      imageUrl = await fileToDataUrl(imageFile);
    }
  }

  const newItem: Product = {
    ...product,
    id: generateId(),
    image_url: imageUrl || null,
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(PRODUCTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newItem),
    });

    if (res.ok) {
      const saved = (await res.json()) as Product;
      const updated = [saved, ...readLocalCache().filter((item) => item.id !== saved.id)];
      writeLocalCache(updated);
      return saved;
    }
  } catch {
    // บันทึกลงแคชเมื่อยังไม่มี API endpoint ฝั่งเซิร์ฟเวอร์
  }

  const nextItems = [newItem, ...readLocalCache()];
  writeLocalCache(nextItems);
  return newItem;
}

export async function updateProductAvailability(id: string, isAvailable: boolean): Promise<void> {
  const currentItems = readLocalCache();
  const nextItems = currentItems.map((item) =>
    item.id === id ? { ...item, is_available: isAvailable } : item,
  );
  writeLocalCache(nextItems);

  try {
    await fetch(`${PRODUCTS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_available: isAvailable }),
    });
  } catch {
    // อัปเดตในแคชแล้ว
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const nextItems = readLocalCache().filter((item) => item.id !== id);
  writeLocalCache(nextItems);

  try {
    await fetch(`${PRODUCTS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // ลบออกจากแคชแล้ว
  }
}