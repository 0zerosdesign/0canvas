import { useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { Eraser, GitFork } from "lucide-react";
import type { OutputItem, FeedField, M2MItem, InsightBlock } from "./types";
import { saveFieldsToDirectus, updateFieldsInDirectus, searchDirectusFeeds, getDirectusFeed, updateFeedStatus } from "./directus-proxy";

const TipTapEditor = lazy(() => import("./components/TipTapEditor").then((m) => ({ default: m.TipTapEditor })));
const BlockEditor = lazy(() => import("./components/BlockEditor").then((m) => ({ default: m.BlockEditor })));
const M2MTagPicker = lazy(() => import("./components/M2MTagPicker").then((m) => ({ default: m.M2MTagPicker })));
const MediaField = lazy(() => import("./components/MediaField").then((m) => ({ default: m.MediaField })));

interface Props {
  agentName: string;
  items: OutputItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onUnpushField: (fieldKey: string) => void;
  onUpdateField: (fieldKey: string, updates: Partial<FeedField>) => void;
  onSaveResult: (itemId: string, directusId: string) => void;
  onImport: (item: OutputItem) => void;
  onForkToChat?: (text: string, images: string[]) => void;
}

const FIELD_ORDER = [
  "module", "title", "description", "media", "insights",
  "applications", "psychology", "industries", "ai_patterns",
  "ui_elements", "tags",
];

const MANDATORY_FIELDS = ["title", "description"];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function OutputPanel({
  agentName,
  items,
  selectedId,
  onSelect,
  onCreate,
  onRemove,
  onClearAll,
  onUnpushField,
  onUpdateField,
  onSaveResult,
  onImport,
  onForkToChat,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [itemStatusDropdownOpen, setItemStatusDropdownOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const itemStatusRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchStatus, setSearchStatus] = useState("all");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    if (statusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [statusDropdownOpen]);

  const handleSave = useCallback(async (item: OutputItem) => {
    setSavingId(item.id);
    setSaveError(null);
    try {
      if (item.directusId) {
        await updateFieldsInDirectus(item.directusId, item.fields);
        onSaveResult(item.id, item.directusId);
      } else {
        const result = await saveFieldsToDirectus(item.fields);
        onSaveResult(item.id, result.id);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }, [onSaveResult]);

  const handleSearch = useCallback(async (query: string, forceList = false) => {
    setSearchQuery(query);
    if (!forceList && query.length < 2 && query.length > 0) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchDirectusFeeds(query, searchStatus);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchStatus]);

  const handleImport = useCallback(async (directusId: string) => {
    setImporting(true);
    setSearchResults([]);
    setSearchQuery("");
    try {
      const feedData = await getDirectusFeed(directusId);
      const fields = new Map<string, FeedField>();
      for (const [key, field] of Object.entries(feedData.fields)) {
        fields.set(key, field as FeedField);
      }
      const imported: OutputItem = {
        id: crypto.randomUUID(),
        directusId,
        fields,
        savedFields: new Map(fields),
        status: "saved",
        title: feedData.title || "Imported Feed",
        createdAt: Date.now(),
      };
      onImport(imported);
    } catch (err) {
      setSaveError(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [onImport]);

  const hasUnsavedChanges = items.some((item) => item.status !== "saved");

  const handleTabClose = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const item = items.find((i) => i.id === itemId);
    if (item && item.status !== "saved") {
      if (!window.confirm("You have unsaved changes. Discard?")) return;
    }
    onRemove(itemId);
  };

  const handleClearAll = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Discard?")) return;
    }
    onClearAll();
  };

  // Close item status dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (itemStatusRef.current && !itemStatusRef.current.contains(e.target as Node)) {
        setItemStatusDropdownOpen(false);
      }
    }
    if (itemStatusDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [itemStatusDropdownOpen]);

  const handleStatusChange = useCallback(async (item: OutputItem, newStatus: string) => {
    if (!item.directusId) return;
    setUpdatingStatus(true);
    setItemStatusDropdownOpen(false);
    try {
      await updateFeedStatus(item.directusId, newStatus);
      setSaveError(null);
    } catch (err) {
      setSaveError(`Status update failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingStatus(false);
    }
  }, []);

  const handleForkToChat = useCallback((item: OutputItem) => {
    if (!onForkToChat) return;
    // Build a text summary of all fields
    const parts: string[] = [];
    const images: string[] = [];

    for (const key of FIELD_ORDER) {
      if (key === "module") continue;
      const field = item.fields.get(key);
      if (!field) continue;

      if (field.kind === "media" && field.localBase64) {
        images.push(field.localBase64);
      } else if (field.kind === "media" && field.mediaUrl) {
        parts.push(`**Media**: ${field.mediaUrl}`);
      } else if (field.kind === "m2m" && field.items) {
        parts.push(`**${field.label}**: ${field.items.map((i) => i.name).join(", ")}`);
      } else if (field.kind === "tags" && field.tags) {
        parts.push(`**${field.label}**: ${field.tags.join(", ")}`);
      } else if (field.kind === "blocks" && field.blocks) {
        const blockText = field.blocks.map((b) => {
          const d = b.data;
          if (b.collection === "block_heading") return `### ${d.title || ""}`;
          if (d.body) return String(d.body);
          if (d.code) return `\`\`\`\n${d.code}\n\`\`\``;
          return "";
        }).filter(Boolean).join("\n");
        parts.push(`**${field.label}**:\n${blockText}`);
      } else if (field.content) {
        parts.push(`**${field.label}**: ${field.content}`);
      }
    }

    const text = `Here is the current shot content:\n\n${parts.join("\n\n")}\n\n---\n`;
    onForkToChat(text, images);
  }, [onForkToChat]);

  const canSave = (item: OutputItem) =>
    item.fields.has("title") && item.fields.has("description");

  const isFieldDirty = (item: OutputItem, key: string) => {
    if (!item.savedFields) return true;
    const saved = item.savedFields.get(key);
    const current = item.fields.get(key);
    if (!saved && current) return true;
    if (saved && !current) return true;
    if (!saved || !current) return false;
    // Compare by kind
    if (current.kind === "m2m") {
      return JSON.stringify(saved.items) !== JSON.stringify(current.items);
    }
    if (current.kind === "tags") {
      return JSON.stringify(saved.tags) !== JSON.stringify(current.tags);
    }
    if (current.kind === "media") {
      return saved.mediaId !== current.mediaId;
    }
    if (current.kind === "blocks") {
      return JSON.stringify(saved.blocks) !== JSON.stringify(current.blocks);
    }
    return saved.content !== current.content;
  };

  const currentStatusLabel = STATUS_OPTIONS.find((o) => o.value === searchStatus)?.label ?? "All";

  return (
    <div className="oai-col-output__inner">
      {/* Header */}
      <div className="oai-col-output__header">
        <span className="oai-col-output__title">Output</span>
        <div className="oai-col-output__actions">
          {items.length > 0 && (
            <span className="oai-col-output__count">{items.length}</span>
          )}
          <button className="oai-col-output__action-btn" onClick={onCreate} title="New output item" type="button">+</button>
          {items.length > 0 && (
            <button className="oai-col-output__action-btn" onClick={handleClearAll} title="Clear all" type="button">&times;</button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="oai-output-search">
        <input
          className="oai-output-search__input"
          placeholder={importing ? "Importing..." : searching ? "Searching..." : "Search feeds to import..."}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => { if (!searchQuery) handleSearch("", true); }}
          onBlur={() => { setTimeout(() => { if (!searchQuery) setSearchResults([]); }, 200); }}
          disabled={importing}
        />
        {/* Custom styled dropdown for status filter */}
        <div className="oai-custom-dropdown" ref={dropdownRef}>
          <button
            className="oai-custom-dropdown__btn"
            type="button"
            onClick={() => setStatusDropdownOpen((prev) => !prev)}
          >
            {currentStatusLabel}
          </button>
          {statusDropdownOpen && (
            <div className="oai-custom-dropdown__menu">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`oai-custom-dropdown__option ${opt.value === searchStatus ? "oai-custom-dropdown__option--active" : ""}`}
                  onClick={() => {
                    setSearchStatus(opt.value);
                    setStatusDropdownOpen(false);
                    if (searchQuery.length >= 2) handleSearch(searchQuery);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="oai-output-search__results">
            {searchResults.map((r) => (
              <button key={r.id} className="oai-output-search__result" onClick={() => handleImport(r.id)} type="button">
                <div className="oai-output-search__result-title">{r.title}</div>
                <div className="oai-output-search__result-status">{r.status}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      {items.length > 0 && (
        <div className="oai-output-tabs">
          {items.map((item) => (
            <button
              key={item.id}
              className={`oai-output-tab ${item.id === selectedId ? "oai-output-tab--active" : ""}`}
              onClick={() => onSelect(item.id)}
              type="button"
            >
              <span className="oai-output-tab__title">{item.title || "New Shot"}</span>
              <span className={`oai-output-tab__dot oai-output-tab__dot--${item.status}`} />
              <button
                className="oai-output-tab__close"
                onClick={(e) => handleTabClose(e, item.id)}
                type="button"
              >
                &times;
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Toolbar — contextual to selected shot */}
      {selectedItem && (
        <div className="oai-output-toolbar">
          <button
            type="button"
            className="oai-output-toolbar__btn"
            onClick={() => handleForkToChat(selectedItem)}
            title="Fork content to chat"
            disabled={!onForkToChat}
          >
            <GitFork size={13} />
            <span>Fork to Chat</span>
          </button>

          <div className="oai-output-toolbar__right">
            {selectedItem.directusId && (
              <div className="oai-custom-dropdown" ref={itemStatusRef}>
                <button
                  type="button"
                  className="oai-output-toolbar__status-btn"
                  onClick={() => setItemStatusDropdownOpen((p) => !p)}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? "Updating..." : "Status"}
                </button>
                {itemStatusDropdownOpen && (
                  <div className="oai-custom-dropdown__menu">
                    {["draft", "published", "archived"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="oai-custom-dropdown__option"
                        onClick={() => handleStatusChange(selectedItem, s)}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fields */}
      {items.length === 0 ? (
        <div className="oai-col-output__empty">
          <div className="oai-col-output__empty-icon">📤</div>
          <div className="oai-col-output__empty-text">
            Chat with the {agentName} agent to generate content.<br />Push fields to build output items.
          </div>
        </div>
      ) : !selectedItem ? (
        <div className="oai-col-output__empty">
          <div className="oai-col-output__empty-text">Select a tab above to view fields.</div>
        </div>
      ) : (() => {
        const item = selectedItem;
        const isSaving = savingId === item.id;

        return (<>
          <div className="oai-output-fields-scroll">
            {/* Module — always first, read-only */}
            <div className="oai-output-field oai-output-field--readonly">
              <div className="oai-output-field__label">Module</div>
              <div className="oai-output-field__content">Shots</div>
            </div>

            {/* Render fields in order — media always shown even if not yet pushed */}
            {FIELD_ORDER.filter((key) => key !== "module" && (item.fields.has(key) || key === "media")).map((key) => {
              // Create a default empty media field if not pushed yet
              if (key === "media" && !item.fields.has(key)) {
                return (
                  <div key={key} className="oai-output-field">
                    <div className="oai-output-field__row">
                      <div className="oai-output-field__label">Media</div>
                    </div>
                    <Suspense fallback={<div className="oai-text-muted">Loading...</div>}>
                      <FieldEditor
                        field={{ key: "media", label: "Media", kind: "media", content: "" }}
                        onUpdate={(updates) => onUpdateField(key, updates)}
                      />
                    </Suspense>
                  </div>
                );
              }
              if (!item.fields.has(key)) return null;
              const field = item.fields.get(key)!;
              const dirty = isFieldDirty(item, key);
              const isMandatory = MANDATORY_FIELDS.includes(key);

              return (
                <div key={key} className={`oai-output-field ${dirty ? "oai-output-field--modified" : ""}`}>
                  <div className="oai-output-field__row">
                    <div className="oai-output-field__label">{field.label}</div>
                    <button
                      className="oai-output-field__clear"
                      onClick={() => onUpdateField(key, { content: "" })}
                      title={isMandatory ? `Cannot clear mandatory field ${field.label}` : `Clear ${field.label}`}
                      type="button"
                      disabled={isMandatory}
                    >
                      <Eraser size={12} />
                    </button>
                  </div>
                  <Suspense fallback={<div className="oai-text-muted">Loading editor...</div>}>
                    <FieldEditor field={field} onUpdate={(updates) => onUpdateField(key, updates)} />
                  </Suspense>
                </div>
              );
            })}

            {/* Remaining fields hint */}
            {(() => {
              const remaining = FIELD_ORDER.filter((k) => k !== "module" && !item.fields.has(k));
              if (remaining.length === 0) return null;
              return (
                <div className="oai-output-field oai-output-field--pending">
                  <div className="oai-output-field__label">{remaining.length} remaining</div>
                  <div className="oai-output-field__content oai-text-muted">
                    {remaining.map((k) => k.replace(/_/g, " ")).join(", ")}
                  </div>
                </div>
              );
            })()}

          </div>

          {/* Save button — fixed at bottom, outside scroll */}
          {canSave(item) && (
            <div className="oai-output-footer">
              {saveError && (
                <div className="oai-output-footer__error">{saveError}</div>
              )}
              <button
                className="oai-save-btn"
                onClick={() => handleSave(item)}
                disabled={isSaving || item.status === "saved"}
                type="button"
              >
                {isSaving
                  ? "Saving..."
                  : item.directusId
                    ? item.status === "saved" ? "Saved" : "Update in Directus"
                    : "Save to Directus"}
              </button>
            </div>
          )}
        </>);
      })()}
    </div>
  );
}

// ── Field Editor by Kind ──────────────────────────────────────────

function FieldEditor({ field, onUpdate }: { field: FeedField; onUpdate: (updates: Partial<FeedField>) => void }) {
  switch (field.kind) {
    case "text":
      return (
        <input
          className="oai-output-field__input"
          value={field.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      );

    case "richtext":
      return (
        <TipTapEditor
          content={field.content}
          onChange={(html) => onUpdate({ content: html })}
          placeholder={`Write ${field.label.toLowerCase()}...`}
        />
      );

    case "media":
      return (
        <MediaField
          mediaId={field.mediaId}
          mediaType={field.mediaType}
          mediaUrl={field.mediaUrl}
          localBase64={field.localBase64}
          onChange={(updates) =>
            onUpdate({
              key: "media",
              label: "Media",
              kind: "media",
              mediaId: updates.mediaId,
              mediaType: updates.mediaType,
              mediaUrl: updates.mediaUrl,
              localBase64: updates.localBase64,
              content: updates.localBase64 || updates.mediaUrl || "",
            })
          }
          onClear={() => onUpdate({ kind: "media", mediaId: undefined, mediaType: undefined, mediaUrl: undefined, localBase64: undefined, content: "" })}
        />
      );

    case "blocks":
      return (
        <BlockEditor
          blocks={field.blocks || []}
          onChange={(blocks) => onUpdate({ blocks, content: `${blocks.length} blocks` })}
        />
      );

    case "m2m":
      return (
        <M2MTagPicker
          value={field.items || []}
          onChange={(items: M2MItem[]) =>
            onUpdate({ items, content: items.map((i) => i.name).join(", ") })
          }
          taxonomyType={
            field.key === "applications" ? undefined :
            field.key === "psychology" ? "Psychology" :
            field.key === "industries" ? "Industry" :
            field.key === "ai_patterns" ? "AI_Pattern" :
            field.key === "ui_elements" ? "UI_Element" : undefined
          }
          collection={field.key === "applications" ? "applications" : "taxonomy"}
          placeholder={`Add ${field.label.toLowerCase()}...`}
        />
      );

    case "tags":
      return <TagsInput tags={field.tags || []} onChange={(tags) => onUpdate({ tags, content: tags.join(", ") })} />;

    default:
      return <div className="oai-output-field__content">{field.content}</div>;
  }
}

// ── Simple Tags Input ─────────────────────────────────────────────

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const tag = input.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput("");
  };

  return (
    <div className="oai-tags-input">
      <div className="oai-tags-input__pills">
        {tags.map((tag, i) => (
          <span key={tag} className="oai-tag-pill">
            {tag}
            <button type="button" className="oai-tag-pill__remove" onClick={() => onChange(tags.filter((_, idx) => idx !== i))}>
              &times;
            </button>
          </span>
        ))}
        <input
          className="oai-tags-input__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addTag(); }
            if (e.key === "Backspace" && !input && tags.length > 0) {
            onChange(tags.slice(0, -1));
          }
        }}
        placeholder={tags.length === 0 ? "Add tags..." : ""}
      />
      </div>
    </div>
  );
}
