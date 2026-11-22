import { supabase } from "@/lib/supabase";

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

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price, description, image_url, is_available, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function createProduct(product: NewProduct, imageFile: File | null): Promise<Product> {
  let imageUrl = product.image_url;
  let uploadedPath: string | null = null;

  if (imageFile) {
    const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    uploadedPath = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(uploadedPath, imageFile);

    if (uploadError) throw uploadError;
    imageUrl = supabase.storage.from("product-images").getPublicUrl(uploadedPath).data.publicUrl;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...product, image_url: imageUrl })
    .select("id, name, category, price, description, image_url, is_available, created_at")
    .single();

  if (error) {
    if (uploadedPath) await supabase.storage.from("product-images").remove([uploadedPath]);
    throw error;
  }

  return data as Product;
}

export async function updateProductAvailability(id: string, isAvailable: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_available: isAvailable }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}