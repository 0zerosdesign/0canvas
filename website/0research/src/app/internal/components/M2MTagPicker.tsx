"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { M2MItem } from "../types";
import { searchTaxonomy, searchApplications } from "../directus-proxy";
import { ApplicationEditor, type ApplicationData } from "./ApplicationEditor";

interface Props {
  value: M2MItem[];
  onChange: (items: M2MItem[]) => void;
  taxonomyType?: string;
  collection?: "applications" | "taxonomy";
  placeholder?: string;
}

export function M2MTagPicker({
  value,
  onChange,
  taxonomyType,
  collection = "taxonomy",
  placeholder,
}: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<M2MItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  const isApplications = collection === "applications";

  const search = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        let results: M2MItem[];
        if (isApplications) {
          results = await searchApplications(q);
        } else {
          results = await searchTaxonomy(taxonomyType || "", q);
        }
        const selectedIds = new Set(value.map((v) => v.id));
        const selectedNames = new Set(value.map((v) => v.name.toLowerCase()));
        setSuggestions(
          results.filter((r) => !selectedIds.has(r.id) && !selectedNames.has(r.name.toLowerCase())),
        );
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [isApplications, taxonomyType, value],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.length >= 1) {
      debounceRef.current = setTimeout(() => search(query), 300);
    } else {
      setSuggestions([]);
    }
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  const addItem = useCallback(
    (item: M2MItem) => {
      onChange([...value, item]);
      setQuery("");
      setSuggestions([]);
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const handleCreateNew = useCallback(() => {
    if (isApplications) {
      // Open the application editor for new app
      setCreatingNew(true);
      setShowDropdown(false);
    } else {
      // Simple add for taxonomy
      const name = query.trim();
      if (!name) return;
      if (value.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
      onChange([...value, { id: "", name, type: taxonomyType, isNew: true }]);
      setQuery("");
      setSuggestions([]);
    }
  }, [query, value, onChange, taxonomyType, isApplications]);

  const handleAppEditorSave = useCallback(
    (data: ApplicationData, index?: number) => {
      if (index !== undefined && index !== null) {
        // Editing existing
        const updated = [...value];
        updated[index] = {
          ...updated[index],
          name: data.name,
          appData: data,
        } as M2MItem & { appData: ApplicationData };
        onChange(updated);
        setEditingIndex(null);
      } else {
        // Creating new
        const newItem: M2MItem & { appData?: ApplicationData } = {
          id: "",
          name: data.name,
          isNew: true,
          appData: data,
        };
        onChange([...value, newItem]);
        setCreatingNew(false);
        setQuery("");
      }
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
      if (editingIndex === index) setEditingIndex(null);
    },
    [value, onChange, editingIndex],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (suggestions.length > 0) {
          addItem(suggestions[0]);
        } else if (query.trim()) {
          handleCreateNew();
        }
      }
      if (e.key === "Backspace" && !query && value.length > 0) {
        removeItem(value.length - 1);
      }
    },
    [query, suggestions, value, addItem, handleCreateNew, removeItem],
  );

  return (
    <div className="oai-m2m-picker">
      <div className="oai-m2m-picker__pills">
        {value.map((item, i) => (
          <span key={`${item.id || item.name}-${i}`} className={`oai-m2m-pill${item.isNew || !item.id ? " oai-m2m-pill--new" : ""}`}>
            {item.name}
            {(item.isNew || !item.id) && <span className="oai-field-card__new-badge">NEW</span>}
            {isApplications && (
              <button
                type="button"
                className="oai-m2m-pill__edit"
                onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                title="Edit application details"
              >
                &#9998;
              </button>
            )}
            <button
              type="button"
              className="oai-m2m-pill__remove"
              onClick={() => removeItem(i)}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="oai-m2m-picker__input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder || "Type to search..." : ""}
        />
      </div>

      {/* Dropdown suggestions */}
      {showDropdown && !creatingNew && editingIndex === null && (suggestions.length > 0 || (query.trim() && !loading)) && (
        <div className="oai-m2m-picker__dropdown">
          {suggestions.map((item) => (
            <button
              key={item.id || item.name}
              type="button"
              className="oai-m2m-picker__option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addItem(item)}
            >
              {item.name}
            </button>
          ))}
          {query.trim() &&
            !suggestions.some((s) => s.name.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                className="oai-m2m-picker__option oai-m2m-picker__option--create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreateNew}
              >
                {isApplications ? `Add "${query.trim()}" with details...` : `Create "${query.trim()}"`}
              </button>
            )}
          {loading && <div className="oai-m2m-picker__loading">Searching...</div>}
        </div>
      )}

      {/* Application editor for editing existing item */}
      {isApplications && editingIndex !== null && (
        <ApplicationEditor
          item={value[editingIndex]}
          initialData={(value[editingIndex] as M2MItem & { appData?: ApplicationData }).appData}
          onSave={(data) => handleAppEditorSave(data, editingIndex)}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {/* Application editor for creating new item */}
      {isApplications && creatingNew && (
        <ApplicationEditor
          item={{ id: "", name: query.trim() }}
          onSave={(data) => handleAppEditorSave(data)}
          onCancel={() => setCreatingNew(false)}
        />
      )}
    </div>
  );
}
