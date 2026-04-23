// ============================================
// COMPONENT: MobileBottomSheet
// PURPOSE: Swipe-up bottom sheet for mobile (≤640px).
//          Shows active item's side feed content.
//          3 snap points: collapsed (title+tags), half-screen, full-screen.
//
// GESTURES:
//   - Drag handle up/down to resize
//   - Swipe velocity determines snap target
//   - Content area scrollable when sheet is expanded
//   - Touch outside (on carousel) collapses sheet
//
// USED IN: FeedExperience (mobile breakpoint only)
// ============================================

import { useRef, useEffect, useCallback, useState } from "react";
import type { FeedSection, ContentBlock } from "../../types";
import { ImageWithFallback } from "../shared/ImageWithFallback";

interface MobileBottomSheetProps {
  title: string;
  description: string;
  tags: string[];
  sections: FeedSection[];
  activeSectionIndex: number;
}

// Snap points as percentage of viewport height from bottom
const SNAP_COLLAPSED = 0.12; // ~12vh — title + tags peek
const SNAP_HALF = 0.45;      // ~45vh — half screen
const SNAP_FULL = 0.88;      // ~88vh — near full (leave top bar visible)

export function MobileBottomSheet({
  title,
  description,
  tags,
  sections,
  activeSectionIndex,
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    isDragging: false,
    startY: 0,
    startHeight: 0,
    currentHeight: 0,
    velocity: 0,
    lastY: 0,
    lastTime: 0,
  });

  const [sheetHeight, setSheetHeight] = useState(SNAP_COLLAPSED);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset to collapsed when content changes (new item)
  useEffect(() => {
    snapTo(SNAP_COLLAPSED);
  }, [title]);

  // Sync scroll to active section when expanded
  useEffect(() => {
    if (sheetHeight < SNAP_HALF || !contentRef.current || activeSectionIndex < 0) return;
    const el = contentRef.current.querySelector(
      `[data-mobile-section="${activeSectionIndex}"]`
    ) as HTMLElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [activeSectionIndex, sheetHeight]);

  const snapTo = useCallback((target: number) => {
    setIsTransitioning(true);
    setSheetHeight(target);
    setTimeout(() => setIsTransitioning(false), 350);
  }, []);

  const getNearestSnap = useCallback((height: number, velocity: number): number => {
    // If velocity is strong enough, snap in that direction
    if (velocity > 0.5) {
      // Swiping up — snap to next higher point
      if (height < SNAP_HALF) return SNAP_HALF;
      return SNAP_FULL;
    }
    if (velocity < -0.5) {
      // Swiping down — snap to next lower point
      if (height > SNAP_HALF) return SNAP_HALF;
      return SNAP_COLLAPSED;
    }

    // Otherwise snap to nearest
    const snaps = [SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL];
    let nearest = snaps[0];
    let minDist = Math.abs(height - snaps[0]);
    for (const snap of snaps) {
      const dist = Math.abs(height - snap);
      if (dist < minDist) {
        minDist = dist;
        nearest = snap;
      }
    }
    return nearest;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current = {
      isDragging: true,
      startY: touch.clientY,
      startHeight: sheetHeight,
      currentHeight: sheetHeight,
      velocity: 0,
      lastY: touch.clientY,
      lastTime: Date.now(),
    };
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.isDragging) return;

    const touch = e.touches[0];
    const dy = dragRef.current.startY - touch.clientY;
    const vh = window.innerHeight;
    const deltaHeight = dy / vh;
    const newHeight = Math.max(0.08, Math.min(0.92, dragRef.current.startHeight + deltaHeight));

    // Track velocity
    const now = Date.now();
    const dt = now - dragRef.current.lastTime;
    if (dt > 0) {
      const dyFrame = dragRef.current.lastY - touch.clientY;
      dragRef.current.velocity = (dyFrame / vh) / (dt / 1000);
    }
    dragRef.current.lastY = touch.clientY;
    dragRef.current.lastTime = now;
    dragRef.current.currentHeight = newHeight;

    setSheetHeight(newHeight);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    const target = getNearestSnap(dragRef.current.currentHeight, dragRef.current.velocity);
    snapTo(target);
  }, [getNearestSnap, snapTo]);

  // Block renderer (simplified for mobile)
  const renderBlock = useCallback((block: ContentBlock) => {
    switch (block.block_type) {
      case "heading":
        return (
          <div className="zeros-block-heading">
            <h3>{block.title}</h3>
          </div>
        );
      case "rich_text":
        return (
          <div className="zeros-block-richtext">
            {block.title && <h4 className="zeros-block-richtext-title">{block.title}</h4>}
            {block.rich_text_content && (
              <div
                className="zeros-block-richtext-content"
                dangerouslySetInnerHTML={{ __html: block.rich_text_content }}
              />
            )}
          </div>
        );
      case "text":
        return (
          <div className="zeros-block-text">
            <p className="zeros-block-text-content">{block.text_content}</p>
          </div>
        );
      case "media":
        return (
          <div className="zeros-block-media">
            {(block.side_media_url || block.media_url) && (
              <ImageWithFallback
                src={block.side_media_url || block.media_url || ""}
                alt={block.side_media_caption || block.caption || ""}
              />
            )}
          </div>
        );
      case "quotation":
        return (
          <div className="zeros-block-quote">
            <blockquote>
              <p className="zeros-block-quote-text">&ldquo;{block.quote_text}&rdquo;</p>
              {block.quote_author && (
                <cite className="zeros-block-quote-author">— {block.quote_author}</cite>
              )}
            </blockquote>
          </div>
        );
      case "code_block":
        return (
          <div className="zeros-block-code">
            {block.language && <span className="zeros-block-code-lang">{block.language}</span>}
            <pre><code>{block.code_content}</code></pre>
          </div>
        );
      case "table":
        return (
          <div className="zeros-block-table">
            {block.title && <h4 className="zeros-block-table-title">{block.title}</h4>}
            {block.table_data && Array.isArray(block.table_data) && block.table_data.length > 0 && (
              <div className="zeros-block-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {block.table_data[0].map((h: string, i: number) => <th key={i}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {block.table_data.slice(1).map((row: string[], ri: number) => (
                      <tr key={ri}>
                        {row.map((cell: string, ci: number) => <td key={ci}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      case "tags":
        return (
          <div className="zeros-block-tags flex flex-wrap gap-1.5">
            {block.tag_list?.map((tag, ti) => (
              <span key={ti} className="zeros-block-tag">{tag}</span>
            ))}
          </div>
        );
      case "video_transcript_section":
        return (
          <div className="zeros-block-transcript">
            <p className="zeros-block-transcript-content">{block.transcript_text}</p>
          </div>
        );
      default:
        return null;
    }
  }, []);

  const isExpanded = sheetHeight > SNAP_COLLAPSED + 0.05;

  return (
    <div
      ref={sheetRef}
      className="zeros-bottom-sheet"
      style={{
        height: `${sheetHeight * 100}vh`,
        transition: isTransitioning
          ? "height 0.35s var(--ease-emphasized)"
          : "none",
      }}
    >
      {/* Drag handle */}
      <div
        className="zeros-bottom-sheet-handle"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Header — always visible */}
      <div className="zeros-bottom-sheet-header">
        <h3>{title || "Select an item"}</h3>
        {tags.length > 0 && (
          <div className="zeros-bottom-sheet-tags">
            {tags.slice(0, 4).map((tag, i) => (
              <span
                key={i}
                className="zeros-block-tag zeros-bottom-sheet-tag"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content — visible when expanded */}
      {isExpanded && (
        <div
          ref={contentRef}
          className="zeros-bottom-sheet-content zeros-scroll-hidden"
          style={{ maxHeight: `calc(${sheetHeight * 100}vh - 100px)` }}
        >
          {description && (
            <p className="zeros-bottom-sheet-description mb-3">
              {description}
            </p>
          )}

          {sections.map((section, idx) => (
            <div
              key={section.id}
              data-mobile-section={idx}
              className="flex flex-col gap-3 mb-4"
            >
              {section.title && (
                <div className="zeros-block-heading">
                  <h3>{section.title}</h3>
                </div>
              )}
              {section.blocks.map((block) => (
                <div key={block.block_id}>{renderBlock(block)}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
