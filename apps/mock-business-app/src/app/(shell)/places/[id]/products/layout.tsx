"use client";

// PRODUCTS' FRAME (MESITA-1986). The index lives here rather than in the page so
// that `/products` and `/setup/<product>` are the same screen with a different
// pane — not two screens that happen to look alike.
import { ProductShell } from "@/components/console/ProductShell";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProductShell half="products">{children}</ProductShell>;
}
