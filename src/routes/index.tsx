import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, PackageOpen, Search, ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrice } from "@/lib/product-format";
import type { Product } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Product Catalog | Common Goods" },
      { name: "description", content: "Browse products, categories, prices, and availability at Common Goods." },
      { property: "og:title", content: "Product Catalog | Common Goods" },
      { property: "og:description", content: "Browse products, categories, prices, and availability at Common Goods." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductCatalogPage,
});

function ProductCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void import("@/lib/products")
      .then(({ listProducts }) => listProducts())
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return products.filter((product) => {
      const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
      const matchesSearch =
        !query ||
        [product.name, product.category, product.description].some((value) =>
          value.toLocaleLowerCase().includes(query),
        );
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, products, searchTerm]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3 text-foreground no-underline">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <span className="truncate text-lg font-semibold">Common Goods</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin">
              Manage products <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase text-primary">The collection</p>
            <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              Product catalog
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Browse products, compare details, and check what’s available.
            </p>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Loading products…" : `${filteredProducts.length} items`}
          </p>
        </div>

        <div className="mt-8 grid gap-3 border-y border-border py-4 sm:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              className="pl-9"
            />
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="mt-10 border-l-2 border-destructive pl-4" role="alert">
            <h2 className="font-medium text-foreground">Products couldn’t be loaded</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Check the Supabase table and access rules, then refresh this page.
            </p>
            <p className="mt-2 break-words text-xs text-muted-foreground">{error}</p>
          </div>
        ) : loading ? (
          <div className="mt-10 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="Loading products">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[4/3] rounded-md bg-muted" />
                <div className="mt-4 h-4 w-2/3 rounded bg-muted" />
                <div className="mt-3 h-3 w-1/3 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length ? (
          <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <PackageOpen className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              {products.length ? "No matching products" : "No products yet"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {products.length
                ? "Try a different search or category."
                : "Products added to the catalog will appear here."}
            </p>
            {products.length ? (
              <Button
                variant="link"
                className="mt-2"
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-secondary">
        {product.image_url && !imageFailed ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="size-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-primary/70">
            <PackageOpen className="size-10" aria-hidden="true" />
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 border border-border bg-card/95 text-foreground"
        >
          {product.is_available ? "Available" : "Unavailable"}
        </Badge>
      </div>
      <div className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">{product.category}</p>
            <h2 className="mt-1 truncate text-base font-semibold text-foreground">{product.name}</h2>
          </div>
          <p className="shrink-0 text-sm font-semibold text-foreground">{formatPrice(product.price)}</p>
        </div>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {product.description || "No description provided."}
        </p>
      </div>
    </article>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}