// ============================================
// COMPONENT: ProductCard
// PURPOSE: Displays a single Zero product with access status
// USED IN: DashboardPage (ProductGrid)
// ============================================

import { ExternalLink, Check, Clock } from "lucide-react";
import type { ProductWithAccess } from "../../types";
import "./ProductCard.css";

// --- ATTRIBUTES ---
interface ProductCardProps {
  // The product data with access info
  product: ProductWithAccess;
}

export default function ProductCard({ product }: ProductCardProps) {
  // Whether the user has accessed this product before
  const hasAccessed = product.accessed;

  // Whether the product is coming soon (not yet available)
  const isComingSoon = product.status === "coming_soon";

  return (
    <div className={`product-card ${hasAccessed ? "accessed" : ""} ${isComingSoon ? "coming-soon" : ""}`}>
      <div className="product-card-header">
        <div className="product-card-icon">
          {product.display_name[0]}
        </div>
        <div className="product-card-info">
          <h3 className="product-card-name">{product.display_name}</h3>
          <span className="product-card-id">{product.name}</span>
        </div>
      </div>

      <div className="product-card-status">
        {isComingSoon ? (
          <span className="product-card-badge coming-soon">
            <Clock size={12} />
            Coming Soon
          </span>
        ) : hasAccessed ? (
          <span className="product-card-badge active">
            <Check size={12} />
            Active
          </span>
        ) : (
          <span className="product-card-badge not-accessed">
            Not Accessed
          </span>
        )}
      </div>

      {!isComingSoon && (
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className="product-card-link"
        >
          Go to {product.name}
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  );
}
