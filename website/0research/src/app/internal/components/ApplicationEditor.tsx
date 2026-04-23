"use client";

import { useState, useCallback } from "react";
import type { M2MItem } from "../types";

/**
 * Application fields from Directus applications collection:
 * - name (required) — already in M2MItem
 * - short_description — brief tagline
 * - website_url — official URL
 * - company — parent company
 * - platform — multi-select: web, ios, android, macos, windows, linux, api, cli, ide_extension
 * - logo — file upload (handled separately via Directus)
 * - description — rich text (skipped for inline editor, can be added in Directus CMS)
 */

export interface ApplicationData {
  name: string;
  short_description?: string;
  website_url?: string;
  company?: string;
  platform?: string[];
  logo?: string; // Directus file UUID — auto-fetched from favicon
}

interface Props {
  item: M2MItem;
  initialData?: ApplicationData;
  onSave: (data: ApplicationData) => void;
  onCancel: () => void;
}

const PLATFORM_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
  { value: "macos", label: "macOS" },
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
  { value: "api", label: "API" },
  { value: "cli", label: "CLI" },
  { value: "ide_extension", label: "IDE Extension" },
];

export function ApplicationEditor({ item, initialData, onSave, onCancel }: Props) {
  const [data, setData] = useState<ApplicationData>({
    name: initialData?.name || item.name,
    short_description: initialData?.short_description || "",
    website_url: initialData?.website_url || "",
    company: initialData?.company || "",
    platform: initialData?.platform || [],
  });

  const update = useCallback((key: keyof ApplicationData, value: string | string[]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const togglePlatform = useCallback((platform: string) => {
    setData((prev) => {
      const platforms = prev.platform || [];
      return {
        ...prev,
        platform: platforms.includes(platform)
          ? platforms.filter((p) => p !== platform)
          : [...platforms, platform],
      };
    });
  }, []);

  return (
    <div className="oai-app-editor">
      <div className="oai-app-editor__header">
        <span className="oai-app-editor__title">
          {item.id ? "Edit Application" : "New Application"}
        </span>
      </div>

      <div className="oai-app-editor__fields">
        <div className="oai-app-editor__field">
          <label className="oai-app-editor__label">Name *</label>
          <input
            className="oai-app-editor__input"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Application name..."
          />
        </div>

        <div className="oai-app-editor__field">
          <label className="oai-app-editor__label">Short Description</label>
          <input
            className="oai-app-editor__input"
            value={data.short_description || ""}
            onChange={(e) => update("short_description", e.target.value)}
            placeholder="What the app does in one sentence..."
          />
        </div>

        <div className="oai-app-editor__row">
          <div className="oai-app-editor__field">
            <label className="oai-app-editor__label">Company</label>
            <input
              className="oai-app-editor__input"
              value={data.company || ""}
              onChange={(e) => update("company", e.target.value)}
              placeholder="e.g., OpenAI, Anthropic..."
            />
          </div>
          <div className="oai-app-editor__field">
            <label className="oai-app-editor__label">Website URL</label>
            <input
              className="oai-app-editor__input"
              value={data.website_url || ""}
              onChange={(e) => update("website_url", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="oai-app-editor__field">
          <label className="oai-app-editor__label">Platforms</label>
          <div className="oai-app-editor__platforms">
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`oai-app-editor__platform ${(data.platform || []).includes(opt.value) ? "oai-app-editor__platform--active" : ""}`}
                onClick={() => togglePlatform(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="oai-app-editor__actions">
        <button type="button" className="oai-app-editor__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="oai-app-editor__save"
          onClick={() => onSave(data)}
          disabled={!data.name.trim()}
        >
          {item.id ? "Update" : "Add Application"}
        </button>
      </div>
    </div>
  );
}
