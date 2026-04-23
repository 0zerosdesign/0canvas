// ============================================
// EDGE FUNCTION: sync-content
// PURPOSE: Receives Directus webhook events and syncs content
//          (feeds, sections, blocks) to Supabase Postgres.
// TRIGGERED BY: Directus Flows on items.create/update/delete
//               for "feeds" and "feed_sections" collections.
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Configuration (set via `supabase secrets set`) ---
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DIRECTUS_URL = Deno.env.get("DIRECTUS_URL")!;
const DIRECTUS_ADMIN_TOKEN = Deno.env.get("DIRECTUS_ADMIN_TOKEN")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Fields to request when fetching a full feed from Directus ---
const FEED_FIELDS = [
  "id",
  "title",
  "slug",
  "description",
  "status",
  "module",
  "publish_date",
  "read_time_minutes",
  "media",
  "media_type",
  "tags",
  "date_created",
  "applications.applications_id.name",
  "psychology.taxonomy_id.name",
  "industries.taxonomy_id.name",
  "ai_patterns.taxonomy_id.name",
  "ui_elements.taxonomy_id.name",
  "sections.id",
  "sections.sort",
  "sections.title",
  "sections.blocks.collection",
  "sections.blocks.sort",
  "sections.blocks.item:block_heading.*",
  "sections.blocks.item:block_text.*",
  "sections.blocks.item:block_rich_text.*",
  "sections.blocks.item:block_media.*",
  "sections.blocks.item:block_code.*",
  "sections.blocks.item:block_table.*",
  "sections.blocks.item:block_quote.*",
  "sections.blocks.item:block_tags.*",
  "sections.blocks.item:block_transcript.*",
].join(",");

// ============================================
// FILE LOOKUP — maps Directus file UUIDs to R2 URLs
// ============================================

const fileLookup = new Map<string, string>();

async function resolveFileIds(ids: string[]): Promise<void> {
  const unresolved = ids.filter((id) => id && !fileLookup.has(id));
  if (unresolved.length === 0) return;

  const res = await fetch(
    `${DIRECTUS_URL}/files?filter[id][_in]=${unresolved.join(",")}&fields=id,filename_disk&limit=-1`,
    { headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` } }
  );
  if (!res.ok) {
    console.error(`[sync-content] Failed to resolve file IDs: ${res.status}`);
    return;
  }
  const json = await res.json();
  for (const f of json.data || []) {
    fileLookup.set(f.id, f.filename_disk);
  }
}

function assetUrl(assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  const filename = fileLookup.get(assetId);
  if (filename) return `${R2_PUBLIC_URL}/${filename}`;
  console.warn(`[sync-content] File ${assetId} not in lookup, falling back to Directus proxy`);
  return `${DIRECTUS_URL}/assets/${assetId}`;
}

function collectFileIds(raw: any): string[] {
  const ids: string[] = [];
  // Feed-level media
  if (raw.media) ids.push(raw.media);
  // Block-level media
  for (const section of raw.sections || []) {
    for (const block of section.blocks || []) {
      const item = block.item;
      if (!item) continue;
      if (item.file) ids.push(item.file);
      if (item.side_media) ids.push(item.side_media);
    }
  }
  return ids.filter(Boolean);
}

// ============================================
// M2M HELPERS — extract taxonomy names from Directus M2M fields
// ============================================

function extractM2MNames(
  items: any[] | null | undefined,
  nestedKey: string
): string[] {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((entry: any) => {
      // Navigate nested keys like "applications_id.name" or "taxonomy_id.name"
      const parts = nestedKey.split(".");
      let value: any = entry;
      for (const part of parts) {
        value = value?.[part];
      }
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean);
}

// ============================================
// BLOCK TRANSFORMER — same logic as bulk sync script
// ============================================

function transformBlock(block: any): any {
  const item = block.item;
  const base = {
    sort: block.sort ?? 0,
    title: null as string | null,
    body: null as string | null,
    media_url: null as string | null,
    media_type: null as string | null,
    caption: null as string | null,
    side_media_url: null as string | null,
    side_media_caption: null as string | null,
    code_content: null as string | null,
    language: null as string | null,
    table_data: null as any,
    tag_list: [] as string[],
    quote_author: null as string | null,
  };

  switch (block.collection) {
    case "block_heading":
      return { ...base, block_type: "heading", title: item.title || null };

    case "block_text":
      return {
        ...base,
        block_type: "text",
        body: item.body || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };

    case "block_rich_text":
      return {
        ...base,
        block_type: "rich_text",
        title: item.title || null,
        body: item.body || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };

    case "block_media":
      return {
        ...base,
        block_type: "media",
        media_url: assetUrl(item.file),
        media_type: item.media_type || "image",
        caption: item.caption || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };

    case "block_code":
      return {
        ...base,
        block_type: "code_block",
        title: item.title || null,
        code_content: item.code || null,
        language: item.language || null,
      };

    case "block_table":
      return {
        ...base,
        block_type: "table",
        title: item.title || null,
        table_data: transformTableData(item.table_data),
      };

    case "block_quote":
      return {
        ...base,
        block_type: "quotation",
        body: item.body || null,
        quote_author: item.attribution || null,
      };

    case "block_tags":
      return { ...base, block_type: "tags", tag_list: item.tags || [] };

    case "block_transcript":
      return {
        ...base,
        block_type: "video_transcript_section",
        title: item.title || null,
        body: item.body || null,
      };

    default:
      return { ...base, block_type: "text" };
  }
}

function transformTableData(data: any): string[][] | null {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  if (Array.isArray(data[0])) return data;
  return data.map((row: Record<string, string>) => {
    const vals: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const v = row[`col_${i}`];
      if (v !== undefined && v !== null && v !== "") vals.push(v);
    }
    return vals;
  });
}

// ============================================
// DIRECTUS API — fetch full feed data
// ============================================

async function fetchFeed(feedId: string): Promise<any | null> {
  const url = `${DIRECTUS_URL}/items/feeds/${feedId}?fields=${encodeURIComponent(FEED_FIELDS)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${DIRECTUS_ADMIN_TOKEN}` },
  });
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) return null;
    console.error(`[sync-content] Directus fetch failed for feed ${feedId}: ${res.status}`);
    return null;
  }
  const json = await res.json();
  return json.data;
}

// ============================================
// SUPABASE SYNC — write feed data to Postgres
// ============================================

async function syncFeed(feedId: string): Promise<{ ok: boolean; action: string; error?: string }> {
  const raw = await fetchFeed(feedId);

  // Feed not found in Directus — remove from Supabase if it was previously synced
  if (!raw) {
    await deleteFeed(feedId);
    return { ok: true, action: "deleted_not_found" };
  }

  // Unpublished/draft — remove from public Supabase if previously published
  if (raw.status !== "published") {
    await deleteFeed(feedId);
    return { ok: true, action: "removed_unpublished" };
  }

  // Resolve file IDs for R2 URLs
  const fileIds = collectFileIds(raw);
  await resolveFileIds(fileIds);

  // Extract tags (now a JSON array of strings directly on the feed)
  const tags: string[] = Array.isArray(raw.tags) ? raw.tags : [];

  // Extract M2M taxonomy arrays
  const applications = extractM2MNames(raw.applications, "applications_id.name");
  const psychology = extractM2MNames(raw.psychology, "taxonomy_id.name");
  const industries = extractM2MNames(raw.industries, "taxonomy_id.name");
  const ai_patterns = extractM2MNames(raw.ai_patterns, "taxonomy_id.name");
  const ui_elements = extractM2MNames(raw.ui_elements, "taxonomy_id.name");

  // Resolve media_url from the feed-level media field
  const mediaUrl = assetUrl(raw.media);

  // Sort sections
  const sortedSections = (raw.sections || []).sort(
    (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0)
  );

  // Delete existing sections for this feed (blocks cascade-deleted by Postgres FK)
  await supabase.from("feed_sections").delete().eq("feed_id", feedId);

  // Upsert the feed record
  const { error: feedError } = await supabase.from("feeds").upsert({
    id: raw.id,
    title: raw.title,
    slug: raw.slug || null,
    description: raw.description || null,
    status: raw.status,
    module: raw.module || null,
    publish_date: raw.publish_date || null,
    read_time_minutes: raw.read_time_minutes || null,
    tags,
    media_url: mediaUrl,
    media_type: raw.media_type || null,
    applications,
    psychology,
    industries,
    ai_patterns,
    ui_elements,
    created_at: raw.date_created,
    updated_at: new Date().toISOString(),
    directus_synced_at: new Date().toISOString(),
  });

  if (feedError) {
    return { ok: false, action: "upsert", error: `Feed upsert failed: ${feedError.message}` };
  }

  // Insert sections + blocks
  let sectionCount = 0;
  let blockCount = 0;

  for (const section of sortedSections) {
    const { error: secError } = await supabase.from("feed_sections").insert({
      id: section.id,
      feed_id: raw.id,
      sort: section.sort ?? 0,
      title: section.title || null,
    });

    if (secError) {
      console.error(`[sync-content] Section insert error: ${secError.message}`);
      continue;
    }
    sectionCount++;

    const blocks = (section.blocks || []).sort(
      (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0)
    );

    for (const block of blocks) {
      if (!block.item) continue;
      const transformed = transformBlock(block);
      const blockId = block.item?.id || crypto.randomUUID();

      const { error: blockError } = await supabase.from("feed_blocks").insert({
        id: blockId,
        section_id: section.id,
        ...transformed,
      });

      if (blockError) {
        console.error(`[sync-content] Block insert error: ${blockError.message}`);
        continue;
      }
      blockCount++;
    }
  }

  console.log(
    `[sync-content] Synced "${raw.title}": ${sectionCount} sections, ${blockCount} blocks`
  );
  return { ok: true, action: "synced" };
}

async function deleteFeed(feedId: string): Promise<{ ok: boolean; error?: string }> {
  // CASCADE on feeds -> feed_sections -> feed_blocks handles cleanup
  const { error } = await supabase.from("feeds").delete().eq("id", feedId);
  if (error) return { ok: false, error: error.message };
  console.log(`[sync-content] Deleted feed ${feedId}`);
  return { ok: true };
}

// ============================================
// SECTION EVENTS — find parent feed and re-sync
// ============================================

async function findFeedIdForSection(sectionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("feed_sections")
    .select("feed_id")
    .eq("id", sectionId)
    .single();
  return data?.feed_id || null;
}

// ============================================
// PARSE KEYS — handle Directus trigger formats
// ============================================

function parseKeys(payload: any): string[] {
  // items.create uses "key" (singular)
  // items.update/delete uses "keys" (plural array)
  if (payload.keys && Array.isArray(payload.keys)) {
    return payload.keys;
  }
  if (payload.keys && typeof payload.keys === "string") {
    // Might be comma-separated or JSON string
    try {
      const parsed = JSON.parse(payload.keys);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return payload.keys.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (payload.key) {
    return [payload.key];
  }
  return [];
}

// ============================================
// MAIN REQUEST HANDLER
// ============================================

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  // Validate webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const payload = await req.json();
    const event: string = payload.event || "";
    const collection: string = payload.collection || "";
    const itemKeys = parseKeys(payload);

    console.log(
      `[sync-content] Event: ${event}, Collection: ${collection}, Keys: [${itemKeys.join(", ")}]`
    );

    if (itemKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "No keys in payload" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    if (collection === "feeds") {
      for (const feedId of itemKeys) {
        if (event === "items.delete") {
          results.push(await deleteFeed(feedId));
        } else {
          // items.create or items.update — fetch + sync
          results.push(await syncFeed(feedId));
        }
      }
    } else if (collection === "feed_sections") {
      // Find parent feed(s) and re-sync them
      const feedIdsToSync = new Set<string>();

      for (const sectionId of itemKeys) {
        if (event !== "items.delete" && payload.payload?.feed_id) {
          feedIdsToSync.add(payload.payload.feed_id);
        } else {
          const feedId = await findFeedIdForSection(sectionId);
          if (feedId) feedIdsToSync.add(feedId);
        }
      }

      for (const feedId of feedIdsToSync) {
        results.push(await syncFeed(feedId));
      }

      if (feedIdsToSync.size === 0) {
        console.warn(`[sync-content] Could not resolve parent feed for sections: ${itemKeys}`);
      }
    } else {
      console.warn(`[sync-content] Unhandled collection: ${collection}`);
    }

    return new Response(
      JSON.stringify({ ok: true, event, collection, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[sync-content] Unhandled error:`, err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
