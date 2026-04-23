// ============================================
// COMPONENT: ProductGrid
// PURPOSE: Renders all Zero products in a responsive grid
// USED IN: DashboardPage
// ============================================

import ProductCard from "./ProductCard";
import type { ProductWithAccess } from "../../types";
import "./ProductGrid.css";

// --- ATTRIBUTES ---
interface ProductGridProps {
  // List of products with access status
  products: ProductWithAccess[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="product-grid-empty">
        <p>No products available yet.</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.product_id} product={product} />
      ))}
    </div>
  );
}
