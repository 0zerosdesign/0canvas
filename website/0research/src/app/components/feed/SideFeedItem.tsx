// ============================================
// COMPONENT: SideFeedItem
// PURPOSE: Displays the active feed item's content as scrollable sections
//          in the right sidebar. Clean typography, minimal spacing.
//
// SYNC (one-way: carousel → side feed):
//   Receives activeSectionIndex → auto-scrolls to that section.
//
// USED IN: FeedExperience (right sidebar)
// ============================================

import { useRef, useEffect, useCallback } from "react";
import { ImageWithFallback } from "../shared/ImageWithFallback";
import type { SideFeedItemProps, ContentBlock } from "../../types";

export function SideFeedItem({
  title,
  description,
  module,
  author,
  mediaUrl,
  mediaType,
  sections,
  applications,
  psychology,
  industries,
  ai_patterns,
  ui_elements,
  tags,
}: SideFeedItemProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset scroll on new item
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [sections]);

  // Side media renderer
  const renderSideMedia = useCallback((block: ContentBlock) => {
    if (!block.side_media_url) return null;
    return (
      <div className="zeros-block-side-media mt-2.5">
        <ImageWithFallback
          src={block.side_media_url}
          alt={block.side_media_caption || ""}
        />
        {block.side_media_caption && (
          <p className="zeros-block-side-media-caption">
            {block.side_media_caption}
          </p>
        )}
      </div>
    );
  }, []);

  // Block renderer
  const renderBlock = useCallback((block: ContentBlock) => {
    switch (block.block_type) {
      case "media":
        return (
          <div className="zeros-block-media">
            {block.side_media_url ? (
              <div>
                <ImageWithFallback
                  src={block.side_media_url}
                  alt={block.side_media_caption || ""}
                />
                {block.side_media_caption && (
                  <p className="zeros-block-media-caption">
                    {block.side_media_caption}
                  </p>
                )}
              </div>
            ) : block.media_url ? (
              <div>
                <ImageWithFallback
                  src={block.media_url}
                  alt={block.caption || ""}
                />
                {block.caption && (
                  <p className="zeros-block-media-caption">
                    {block.caption}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );

      case "heading":
        return (
          <div className="zeros-block-heading">
            <h3>{block.title}</h3>
          </div>
        );

      case "rich_text":
        return (
          <div className="zeros-block-richtext">
            {block.title && (
              <h4 className="zeros-block-richtext-title">{block.title}</h4>
            )}
            {block.rich_text_content && (
              <div
                className="zeros-block-richtext-content"
                dangerouslySetInnerHTML={{ __html: block.rich_text_content }}
              />
            )}
            {renderSideMedia(block)}
          </div>
        );

      case "text":
        return (
          <div className="zeros-block-text">
            <p className="zeros-block-text-content">{block.text_content}</p>
            {renderSideMedia(block)}
          </div>
        );

      case "video_transcript_section":
        return (
          <div className="zeros-block-transcript">
            <p className="zeros-block-transcript-content">
              {block.transcript_text}
            </p>
          </div>
        );

      case "quotation":
        return (
          <div className="zeros-block-quote">
            <blockquote>
              <p className="zeros-block-quote-text">
                &ldquo;{block.quote_text}&rdquo;
              </p>
              {block.quote_author && (
                <cite className="zeros-block-quote-author">
                  — {block.quote_author}
                </cite>
              )}
            </blockquote>
          </div>
        );

      case "code_block":
        return (
          <div className="zeros-block-code">
            {block.language && (
              <span className="zeros-block-code-lang">{block.language}</span>
            )}
            <pre>
              <code>{block.code_content}</code>
            </pre>
          </div>
        );

      case "table":
        return (
          <div className="zeros-block-table">
            {block.title && (
              <h4 className="zeros-block-table-title">{block.title}</h4>
            )}
            {block.table_data && Array.isArray(block.table_data) && block.table_data.length > 0 && (
              <div className="zeros-block-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {block.table_data[0].map((header: string, hi: number) => (
                        <th key={hi}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.table_data.slice(1).map((row: string[], ri: number) => (
                      <tr key={ri}>
                        {row.map((cell: string, ci: number) => (
                          <td key={ci}>{cell}</td>
                        ))}
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
              <span key={ti} className="zeros-block-tag">
                {tag}
              </span>
            ))}
          </div>
        );

      default:
        return null;
    }
  }, [renderSideMedia]);

  return (
    <div className="h-full flex flex-col gap-2 overflow-hidden">
      <div
        ref={containerRef}
        className="zeros-side-card flex flex-col gap-4 overflow-y-auto zeros-scroll-hidden"
      >
        {/* Title */}
        <h2 className="zeros-side-title">{title || "Select an item"}</h2>

        {/* App name */}
        {applications.length > 0 && (
          <div className="zeros-side-meta">
            {applications.map((a) => (
              <span key={a} className="zeros-side-meta-item">{a}</span>
            ))}
          </div>
        )}

        {/* Industry pills */}
        {industries.length > 0 && (
          <div className="zeros-side-industry-pills">
            {industries.map((i) => (
              <span key={i} className="zeros-taxonomy-pill">{i}</span>
            ))}
          </div>
        )}

        {/* Description (HTML — inline rich text from Directus) */}
        {description && (
          <div
            className="zeros-side-description"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}

        {/* Author */}
        {author && (
          <div className="flex items-center gap-2">
            <div
              className="zeros-side-author-avatar w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <span className="zeros-side-author-initial">
                {author.charAt(0)}
              </span>
            </div>
            <span className="zeros-side-author-name">
              {author}
            </span>
          </div>
        )}

        {/* Sections */}
        {sections.map((section, sectionIdx) => (
          <div
            key={section.id}
            data-section-index={sectionIdx}
            className="zeros-block-section flex flex-col gap-3"
          >
            {section.title && (
              <div className="zeros-block-heading">
                <h3>{section.title}</h3>
              </div>
            )}
            {section.blocks.map((block) => (
              <div key={block.block_id}>
                {renderBlock(block)}
              </div>
            ))}
          </div>
        ))}

        {/* Taxonomy tags — below all content */}
        {(psychology.length > 0 || ai_patterns.length > 0 || ui_elements.length > 0 || tags.length > 0) && (
          <div className="zeros-side-taxonomy">
            {psychology.length > 0 && (
              <div className="zeros-taxonomy-group">
                <span className="zeros-taxonomy-label">Psychology</span>
                <div className="zeros-taxonomy-pills">
                  {psychology.map((p) => <span key={p} className="zeros-taxonomy-pill">{p}</span>)}
                </div>
              </div>
            )}
            {ai_patterns.length > 0 && (
              <div className="zeros-taxonomy-group">
                <span className="zeros-taxonomy-label">AI Patterns</span>
                <div className="zeros-taxonomy-pills">
                  {ai_patterns.map((p) => <span key={p} className="zeros-taxonomy-pill">{p}</span>)}
                </div>
              </div>
            )}
            {ui_elements.length > 0 && (
              <div className="zeros-taxonomy-group">
                <span className="zeros-taxonomy-label">UI Elements</span>
                <div className="zeros-taxonomy-pills">
                  {ui_elements.map((e) => <span key={e} className="zeros-taxonomy-pill">{e}</span>)}
                </div>
              </div>
            )}
            {tags.length > 0 && (
              <div className="zeros-taxonomy-group">
                <span className="zeros-taxonomy-label">Tags</span>
                <div className="zeros-taxonomy-pills">
                  {tags.map((t) => <span key={t} className="zeros-taxonomy-pill">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
