import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  onSend: (text: string, images: string[]) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  onSuggestion?: string;
  /** Regeneration tag shown as a pill inside the textarea area */
  regenerateTag?: string | null;
  onClearRegenerateTag?: () => void;
  /** Create vs Ask mode */
  mode: "create" | "ask";
  onModeChange: (mode: "create" | "ask") => void;
}

export function ChatInput({
  onSend,
  disabled,
  isStreaming,
  onStop,
  onSuggestion,
  regenerateTag,
  onClearRegenerateTag,
  mode,
  onModeChange,
}: Props) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle suggestion clicks
  useEffect(() => {
    if (onSuggestion) {
      setText(onSuggestion);
      textareaRef.current?.focus();
    }
  }, [onSuggestion]);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "36px";
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 36), 200) + "px";
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    onSend(trimmed, images);
    setText("");
    setImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, images, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled) handleSend();
      }
    },
    [disabled, handleSend],
  );

  const addImages = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith("image/"),
    );
    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Paste handler (for images from clipboard)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addImages(imageFiles);
      }
    },
    [addImages],
  );

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addImages(e.dataTransfer.files);
      }
    },
    [addImages],
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const placeholder =
    mode === "create"
      ? "Describe the UI or upload a screenshot..."
      : "Ask anything...";

  return (
    <div
      className={`oai-input-area ${isDragOver ? "oai-drop-active" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="oai-input-wrapper">
        {/* Image previews */}
        {images.length > 0 && (
          <div className="oai-input-images">
            {images.map((img, i) => (
              <div key={i} className="oai-input-image">
                <img src={img} alt={`Preview ${i + 1}`} />
                <button
                  className="oai-input-image__remove"
                  onClick={() => removeImage(i)}
                  type="button"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Regeneration tag (inside textarea area, above text) */}
        {regenerateTag && (
          <div className="oai-regen-tag">
            <span className="oai-regen-tag__label">{regenerateTag}</span>
            <button
              className="oai-regen-tag__close"
              onClick={onClearRegenerateTag}
              type="button"
            >
              &times;
            </button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addImages(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          className="oai-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
        />

        {/* Bottom bar: mode toggle (left) + actions (right) */}
        <div className="oai-input-bottom-bar">
          <div className="oai-mode-toggle">
            <button
              className={`oai-mode-btn ${mode === "create" ? "oai-mode-btn--active" : ""}`}
              onClick={() => onModeChange("create")}
              type="button"
            >
              Create
            </button>
            <button
              className={`oai-mode-btn ${mode === "ask" ? "oai-mode-btn--active" : ""}`}
              onClick={() => onModeChange("ask")}
              type="button"
            >
              Ask
            </button>
          </div>

          <div className="oai-input-actions">
            <button
              className="oai-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              type="button"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            {isStreaming ? (
              <button
                className="oai-send-btn oai-stop-btn"
                onClick={onStop}
                title="Stop generating"
                type="button"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                className="oai-send-btn"
                onClick={handleSend}
                disabled={disabled || (!text.trim() && images.length === 0)}
                title="Send message"
                type="button"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
