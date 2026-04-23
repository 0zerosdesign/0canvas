// ============================================
// COMPONENT: ListFeedItem
// PURPOSE: Individual item in the left sidebar list — square card design.
//          Clean, minimal design with subtle active state.
// USED IN: FeedExperience (left sidebar)
// ============================================

import { ImageWithFallback } from "../shared/ImageWithFallback";
import type { ListFeedItemProps } from "../../types";

export function ListFeedItem({
  title,
  subcategory,
  mediaUrl,
  tags,
  selected,
  onClick,
}: ListFeedItemProps) {
  return (
    <button
      onClick={onClick}
      className={`zeros-list-item${selected ? " active" : ""}`}
    >
      {/* Thumbnail */}
      <div className="zeros-list-thumb">
        <ImageWithFallback
          src={mediaUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Title */}
      <p
        className={`zeros-list-item-title w-full ${selected ? "text-left mt-2.5" : "text-center mt-1.5"}`}
      >
        {title}
      </p>

      {/* Active-only: subcategory */}
      {subcategory && (
        <p
          className="zeros-list-item-text zeros-list-active-content zeros-list-subcategory w-full text-left"
        >
          {subcategory}
        </p>
      )}

      {/* Active-only: tags */}
      {tags.length > 0 && (
        <div className="zeros-list-item-text zeros-list-active-content zeros-list-tags">
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
            {tags.map((tag, i) => (
              <span key={i} className="zeros-list-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  );
}
