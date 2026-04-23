import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../api/config";
import type { FeedField, M2MItem, InsightBlock } from "./types";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/internal-directus-proxy`;

async function callProxy(action: string, payload?: unknown) {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Proxy error: ${res.status}`);
  }

  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getField(fields: Map<string, FeedField>, key: string): FeedField | undefined {
  return fields.get(key);
}

function buildSectionsPayload(blocks: InsightBlock[]): Array<{
  sort: number;
  title: string | null;
  blocks: Array<{ collection: string; sort: number; item: Record<string, unknown> }>;
}> {
  if (blocks.length === 0) return [];
  return [{
    sort: 1,
    title: null,
    blocks: blocks.map((b) => ({
      collection: b.collection,
      sort: b.sort,
      item: b.data,
    })),
  }];
}

function m2mItemsPayload(items: M2MItem[]): Array<{ id?: string; name: string; appData?: M2MItem["appData"] }> {
  return items.map((i) => ({ id: i.id || undefined, name: i.name, appData: i.appData }));
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Upload local base64 media to Directus if needed.
 * Returns the Directus file UUID, or null if no media.
 */
async function resolveMediaId(mediaField: FeedField | undefined): Promise<string | null> {
  if (!mediaField) return null;

  // If we already have a Directus file ID, use it
  if (mediaField.mediaId) return mediaField.mediaId;

  // If we have local base64 data, upload it now
  if (mediaField.localBase64) {
    const ext = mediaField.mediaType === "video" ? "mp4" : "jpg";
    const filename = `feed-media-${Date.now()}.${ext}`;
    const result = await uploadFile(mediaField.localBase64, filename);
    return result.id;
  }

  return null;
}

export async function saveFieldsToDirectus(
  fields: Map<string, FeedField>,
): Promise<{ id: string; title: string }> {
  const title = getField(fields, "title")?.content || "Untitled";
  const description = getField(fields, "description")?.content || "";
  const mediaField = getField(fields, "media");
  const insightsField = getField(fields, "insights");
  const tagsField = getField(fields, "tags");
  const appsField = getField(fields, "applications");
  const psychField = getField(fields, "psychology");
  const indField = getField(fields, "industries");
  const aiField = getField(fields, "ai_patterns");
  const uiField = getField(fields, "ui_elements");

  // Upload local media to Directus at save time
  const mediaId = await resolveMediaId(mediaField);

  const payload = {
    title,
    slug: slugify(title),
    description,
    media: mediaId,
    media_type: mediaField?.mediaType || "image",
    status: "draft",
    module: "shots",
    tags: tagsField?.tags || [],
    applications: appsField?.items ? m2mItemsPayload(appsField.items) : [],
    psychology: psychField?.items ? m2mItemsPayload(psychField.items) : [],
    industries: indField?.items ? m2mItemsPayload(indField.items) : [],
    ai_patterns: aiField?.items ? m2mItemsPayload(aiField.items) : [],
    ui_elements: uiField?.items ? m2mItemsPayload(uiField.items) : [],
    sections: insightsField?.blocks ? buildSectionsPayload(insightsField.blocks) : [],
  };

  return callProxy("create_feed", payload);
}

export async function updateFieldsInDirectus(
  directusId: string,
  fields: Map<string, FeedField>,
): Promise<{ id: string; title: string }> {
  const title = getField(fields, "title")?.content || "Untitled";
  const description = getField(fields, "description")?.content || "";
  const mediaField = getField(fields, "media");
  const insightsField = getField(fields, "insights");
  const tagsField = getField(fields, "tags");
  const appsField = getField(fields, "applications");
  const psychField = getField(fields, "psychology");
  const indField = getField(fields, "industries");
  const aiField = getField(fields, "ai_patterns");
  const uiField = getField(fields, "ui_elements");

  // Upload local media to Directus at update time
  const mediaId = await resolveMediaId(mediaField);

  const payload = {
    id: directusId,
    title,
    slug: slugify(title),
    description,
    media: mediaId,
    media_type: mediaField?.mediaType || "image",
    status: "draft",
    module: "shots",
    tags: tagsField?.tags || [],
    applications: appsField?.items ? m2mItemsPayload(appsField.items) : [],
    psychology: psychField?.items ? m2mItemsPayload(psychField.items) : [],
    industries: indField?.items ? m2mItemsPayload(indField.items) : [],
    ai_patterns: aiField?.items ? m2mItemsPayload(aiField.items) : [],
    ui_elements: uiField?.items ? m2mItemsPayload(uiField.items) : [],
    sections: insightsField?.blocks ? buildSectionsPayload(insightsField.blocks) : [],
  };

  return callProxy("update_feed", payload);
}

export async function updateFeedStatus(
  directusId: string,
  status: string,
): Promise<void> {
  await callProxy("update_feed_status", { id: directusId, status });
}

export async function searchDirectusFeeds(
  query: string,
  status?: string,
): Promise<Array<{ id: string; title: string; status: string }>> {
  return callProxy("search_feeds", { query, status, limit: 20 });
}

export async function getDirectusFeed(
  id: string,
): Promise<{ title: string; fields: Record<string, FeedField> }> {
  return callProxy("get_feed", { id });
}

export async function listPublishedFeeds(): Promise<
  Array<{
    id: string;
    title: string;
    description: string;
    applications: string[];
    psychology: string[];
    industries: string[];
    tags: string[];
  }>
> {
  return callProxy("list_published_feeds", { module: "shots", limit: 30 });
}

export async function searchTaxonomy(
  type: string,
  query: string,
): Promise<M2MItem[]> {
  return callProxy("search_taxonomy", { type, query });
}

export async function searchApplications(query: string): Promise<M2MItem[]> {
  return callProxy("search_applications", { query });
}

export async function uploadFile(
  base64Data: string,
  filename: string,
): Promise<{ id: string; url: string }> {
  return callProxy("upload_file", { data: base64Data, filename });
}
