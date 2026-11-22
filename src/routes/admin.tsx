import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, CircleAlert, LogOut, Package, Plus, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/product-format";
import type { NewProduct, Product } from "@/lib/products";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard | Common Goods" },
      { name: "description", content: "Manage Common Goods products, prices, images, and availability." },
      { property: "og:title", content: "Admin Dashboard | Common Goods" },
      { property: "og:description", content: "Manage Common Goods products, prices, images, and availability." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    void import("@/lib/supabase")
      .then(({ supabase }) => {
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (active) {
            setUser(session?.user ?? null);
            setAuthReady(true);
            setAuthError(null);
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
        void supabase.auth.getSession().then(({ data: sessionData, error }) => {
          if (!active) return;
          if (error) setAuthError(error.message);
          setUser(sessionData.session?.user ?? null);
          setAuthReady(true);
        });
      })
      .catch((loadError: unknown) => {
        if (active) {
          setAuthError(getErrorMessage(loadError));
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }

    let active = true;
    setProductsLoading(true);
    setPageError(null);
    void import("@/lib/products")
      .then(({ listProducts }) => listProducts())
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch((loadError: unknown) => {
        if (active) setPageError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setProductsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");

    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (signInError: unknown) {
      setAuthError(getErrorMessage(signInError));
    }
  }

  async function handleSignOut() {
    const { supabase } = await import("@/lib/supabase");
    const { error } = await supabase.auth.signOut();
    if (error) setPageError(error.message);
  }

  async function handleAddProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setPageError(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    const product: NewProduct = {
      name: String(values.get("name") ?? "").trim(),
      category: String(values.get("category") ?? "").trim(),
      price: Number(values.get("price")),
      description: String(values.get("description") ?? "").trim(),
      image_url: String(values.get("image_url") ?? "").trim() || null,
      is_available: available,
    };

    if (!product.name || !product.category || !Number.isFinite(product.price) || product.price < 0) {
      setPageError("Enter a product name, category, and a valid price.");
      setSaving(false);
      return;
    }

    try {
      const { createProduct, listProducts } = await import("@/lib/products");
      await createProduct(product, imageFile);
      setProducts(await listProducts());
      form.reset();
      setImageFile(null);
      setAvailable(true);
    } catch (saveError: unknown) {
      setPageError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvailabilityChange(product: Product, nextValue: boolean) {
    setPageError(null);
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, is_available: nextValue } : item)),
    );
    try {
      const { updateProductAvailability } = await import("@/lib/products");
      await updateProductAvailability(product.id, nextValue);
    } catch (updateError: unknown) {
      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, is_available: product.is_available } : item,
        ),
      );
      setPageError(getErrorMessage(updateError));
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete “${product.name}”?`)) return;
    setRemovingId(product.id);
    setPageError(null);
    try {
      const { deleteProduct, listProducts } = await import("@/lib/products");
      await deleteProduct(product.id);
      setProducts(await listProducts());
    } catch (deleteError: unknown) {
      setPageError(getErrorMessage(deleteError));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 text-foreground no-underline">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Package className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate text-lg font-semibold">Common Goods</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft aria-hidden="true" /> Back to catalog
            </Link>
          </Button>
        </div>
      </header>

      {!authReady ? (
        <div className="mx-auto max-w-7xl px-5 py-14 text-sm text-muted-foreground sm:px-8">
          Checking your account…
        </div>
      ) : !user ? (
        <section className="mx-auto max-w-lg px-5 py-12 sm:px-8 sm:py-16">
          <p className="text-xs font-semibold uppercase text-primary">Product management</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use an existing account for the Supabase project connected to this catalog.
          </p>
          <form onSubmit={(event) => void handleSignIn(event)} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {authError ? <ErrorNotice message={authError} /> : null}
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </section>
      ) : (
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">Product management</p>
              <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">Admin dashboard</h1>
              <p className="mt-2 text-sm text-muted-foreground">Signed in as {user.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void handleSignOut()}>
              <LogOut aria-hidden="true" /> Sign out
            </Button>
          </div>

          <div className="mt-8 grid gap-12 border-t border-border pt-8 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)] lg:gap-16">
            <section aria-labelledby="add-product-heading">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-primary" aria-hidden="true" />
                <h2 id="add-product-heading" className="text-lg font-semibold text-foreground">Add a product</h2>
              </div>
              <form onSubmit={(event) => void handleAddProduct(event)} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="product-name">Name</Label>
                  <Input id="product-name" name="name" placeholder="Product name" required />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="product-category">Category</Label>
                    <Input id="product-category" name="category" placeholder="e.g. Home" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product-price">Price (THB)</Label>
                    <Input id="product-price" name="price" type="number" min="0" step="0.01" placeholder="0.00" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-description">Description</Label>
                  <Textarea id="product-description" name="description" placeholder="A short description" rows={4} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-image-file">Product image</Label>
                  <Input
                    id="product-image-file"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className="h-auto min-h-10 py-2"
                  />
                  {imageFile ? <p className="text-xs text-muted-foreground">Selected: {imageFile.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-image-url">Image URL</Label>
                  <Input id="product-image-url" name="image_url" type="url" placeholder="https://…" />
                  <p className="text-xs text-muted-foreground">Use a URL, or upload a file above.</p>
                </div>
                <div className="flex items-center justify-between border-y border-border py-4">
                  <Label htmlFor="product-available" className="cursor-pointer">Available for purchase</Label>
                  <Switch id="product-available" checked={available} onCheckedChange={setAvailable} />
                </div>
                {pageError ? <ErrorNotice message={pageError} /> : null}
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? <Upload aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  {saving ? "Saving product…" : "Add product"}
                </Button>
              </form>
            </section>

            <section aria-labelledby="product-list-heading">
              <div className="flex items-end justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 id="product-list-heading" className="text-lg font-semibold text-foreground">Products</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{products.length} in the catalog</p>
                </div>
                <Badge variant="secondary">{products.filter((product) => product.is_available).length} available</Badge>
              </div>
              {pageError ? <div className="mt-4"><ErrorNotice message={pageError} /></div> : null}
              {productsLoading ? (
                <p className="py-8 text-sm text-muted-foreground">Loading products…</p>
              ) : products.length ? (
                <ul className="divide-y divide-border">
                  {products.map((product) => (
                    <li key={product.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        {product.image_url ? (
                          <img src={product.image_url} alt="" className="size-16 shrink-0 rounded-md bg-muted object-cover" />
                        ) : (
                          <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                            <Package className="size-5" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{product.name}</p>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {product.category} · {formatPrice(product.price)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={product.is_available}
                            onCheckedChange={(nextValue) => void handleAvailabilityChange(product, nextValue)}
                            aria-label={`Mark ${product.name} ${product.is_available ? "unavailable" : "available"}`}
                          />
                          <span className="w-20 text-sm text-muted-foreground">
                            {product.is_available ? "Available" : "Unavailable"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Delete ${product.name}`}
                          aria-label={`Delete ${product.name}`}
                          disabled={removingId === product.id}
                          onClick={() => void handleDelete(product)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-10 text-center">
                  <Package className="mx-auto size-7 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-foreground">No products to manage</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add the first product using the form.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="break-words">{message}</span>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}