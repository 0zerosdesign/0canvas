"use client";

import { useState, useCallback, useRef } from "react";

/**
 * MediaField — handles media upload for the output panel.
 *
 * WORKFLOW:
 * - User uploads a file → stored locally as base64 (NOT uploaded to Directus yet)
 * - Preview shows immediately from local data
 * - Media type auto-detected from file (image/* → "image", video/* → "video")
 * - Only when the parent calls Save/Update to Directus does the actual upload happen
 *   (handled by directus-proxy.ts saveFieldsToDirectus)
 * - User can remove media and upload a new one
 * - Switching media replaces the previous one entirely
 */

interface Props {
  mediaId?: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
  /** Local base64 data (not yet uploaded to Directus) */
  localBase64?: string;
  onChange: (updates: {
    mediaId?: string;
    mediaType: "image" | "video";
    mediaUrl?: string;
    localBase64?: string;
  }) => void;
  onClear: () => void;
}

export function MediaField({ mediaId, mediaType, mediaUrl, localBase64, onChange, onClear }: Props) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);

      const isVideo = file.type.startsWith("video/");
      const detectedType: "image" | "video" = isVideo ? "video" : "image";

      // Read as base64 for local preview + later upload
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        onChange({
          mediaId: undefined, // No Directus ID yet — will be created on Save
          mediaType: detectedType,
          mediaUrl: undefined,
          localBase64: base64,
        });
      };
      reader.onerror = () => setError("Failed to read file");
      reader.readAsDataURL(file);

      // Reset input so same file can be re-selected
      e.target.value = "";
    },
    [onChange],
  );

  const handleReplace = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClear = useCallback(() => {
    setError(null);
    onClear();
  }, [onClear]);

  // Determine what to show: Directus URL or local base64
  const previewSrc = localBase64 || mediaUrl;
  const currentType = mediaType || "image";
  const isUploaded = !!mediaId; // Has a Directus file ID = already saved
  const hasMedia = !!previewSrc;

  return (
    <div className="oai-media-field">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {hasMedia ? (
        <div className="oai-media-field__preview-wrap">
          {currentType === "video" ? (
            <video className="oai-media-field__preview" src={previewSrc} controls />
          ) : (
            <img className="oai-media-field__preview" src={previewSrc} alt="Media preview" />
          )}
          <div className="oai-media-field__actions">
            <div className="oai-media-field__info">
              <span className="oai-media-field__type-label">{currentType}</span>
              {!isUploaded && <span className="oai-media-field__local-badge">Local</span>}
            </div>
            <div className="oai-media-field__btns">
              <button type="button" className="oai-media-field__replace" onClick={handleReplace}>
                Replace
              </button>
              <button type="button" className="oai-media-field__remove" onClick={handleClear}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="oai-media-field__upload" onClick={() => fileInputRef.current?.click()}>
          <span className="oai-media-field__upload-text">Upload image or video</span>
        </button>
      )}
      {error && <div className="oai-media-field__error">{error}</div>}
    </div>
  );
}
