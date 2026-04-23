// ============================================
// SCRIPT: Bulk Sync Directus → Supabase
// PURPOSE: Pulls all published feeds from Directus CMS and writes them
//          to Supabase Postgres (feeds, feed_sections, feed_blocks).
// USAGE:   pnpm sync:directus
// ============================================

import { createDirectus, rest, readItems, readFiles } from "@directus/sdk";
import { createClient } from "@supabase/supabase-js";

// --- CONFIG ---
const DIRECTUS_URL =
  process.env.DIRECTUS_URL || "https://cms.0research.zeros.design";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!R2_PUBLIC_URL) {
  console.error("Missing R2_PUBLIC_URL in .env");
  process.exit(1);
}

// --- CLIENTS ---
const directus = createDirectus(DIRECTUS_URL).with(rest());
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- FILE LOOKUP ---
const fileLookup = new Map<string, string>();

function assetUrl(assetId: string | null | undefined): string | null {
  if (!assetId) return null;
  const filename = fileLookup.get(assetId);
  if (filename) {
    return `${R2_PUBLIC_URL}/${filename}`;
  }
  console.warn(`  WARN: file ${assetId} not in lookup, falling back to Directus proxy`);
  return `${DIRECTUS_URL}/assets/${assetId}`;
}

// --- BLOCK TRANSFORMER ---
function transformBlock(block: any): {
  sort: number;
  block_type: string;
  title: string | null;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  side_media_url: string | null;
  side_media_caption: string | null;
  code_content: string | null;
  language: string | null;
  table_data: any;
  tag_list: string[];
  quote_author: string | null;
} {
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
        ...base, block_type: "text", body: item.body || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };
    case "block_rich_text":
      return {
        ...base, block_type: "rich_text", title: item.title || null, body: item.body || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };
    case "block_media":
      return {
        ...base, block_type: "media",
        media_url: assetUrl(item.file), media_type: item.media_type || "image",
        caption: item.caption || null,
        side_media_url: assetUrl(item.side_media),
        side_media_caption: item.side_media_caption || null,
      };
    case "block_code":
      return {
        ...base, block_type: "code_block", title: item.title || null,
        code_content: item.code || null, language: item.language || null,
      };
    case "block_table":
      return {
        ...base, block_type: "table", title: item.title || null,
        table_data: transformTableData(item.table_data),
      };
    case "block_quote":
      return {
        ...base, block_type: "quotation", body: item.body || null,
        quote_author: item.attribution || null,
      };
    case "block_tags":
      return { ...base, block_type: "tags", tag_list: item.tags || [] };
    case "block_transcript":
      return {
        ...base, block_type: "video_transcript_section",
        title: item.title || null, body: item.body || null,
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

// --- M2M NAME EXTRACTORS ---
function extractNames(items: any[], foreignKey: string): string[] {
  return (items || [])
    .map((item: any) => item?.[foreignKey]?.name || "")
    .filter(Boolean);
}

// --- MAIN SYNC ---
async function syncAll() {
  console.log("=== Directus → Supabase Bulk Sync (Feeds) ===\n");
  console.log(`R2 base URL: ${R2_PUBLIC_URL}\n`);

  // 0. Build file lookup
  console.log("Building file lookup from Directus...");
  const allFiles = (await directus.request(
    readFiles({ limit: -1, fields: ["id", "filename_disk"] })
  )) as any[];
  for (const f of allFiles) {
    fileLookup.set(f.id, f.filename_disk);
  }
  console.log(`Loaded ${fileLookup.size} file records\n`);

  // 1. Fetch all published feeds from Directus
  console.log("Fetching feeds from Directus...");
  const rawFeeds = (await directus.request(
    readItems("feeds" as any, {
      limit: -1,
      sort: ["-date_created"],
      filter: { status: { _eq: "published" } },
      fields: [
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
        // M2M relations
        "applications.applications_id.name",
        "psychology.taxonomy_id.name",
        "industries.taxonomy_id.name",
        "ai_patterns.taxonomy_id.name",
        "ui_elements.taxonomy_id.name",
        // Sections + blocks
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
      ],
    })
  )) as any[];

  console.log(`Found ${rawFeeds.length} published feeds\n`);

  // 2. Clear existing data
  console.log("Clearing existing Supabase data...");
  await supabase.from("feed_blocks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("feed_sections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("feeds").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Cleared.\n");

  // 3. Transform and insert
  let feedCount = 0;
  let sectionCount = 0;
  let blockCount = 0;

  for (const raw of rawFeeds) {
    // Extract taxonomy arrays (denormalized)
    const applications = extractNames(raw.applications, "applications_id");
    const psychology = extractNames(raw.psychology, "taxonomy_id");
    const industries = extractNames(raw.industries, "taxonomy_id");
    const ai_patterns = extractNames(raw.ai_patterns, "taxonomy_id");
    const ui_elements = extractNames(raw.ui_elements, "taxonomy_id");

    // Tags is now a JSON array of strings directly on the feed
    const tags: string[] = Array.isArray(raw.tags) ? raw.tags : [];

    // Media URL from the feed-level media field
    const mediaUrl = assetUrl(raw.media);

    // Insert feed
    const { error: feedError } = await supabase.from("feeds").insert({
      id: raw.id,
      title: raw.title,
      slug: raw.slug || null,
      description: raw.description || null,
      status: raw.status,
      module: raw.module || "shots",
      publish_date: raw.publish_date || null,
      read_time_minutes: raw.read_time_minutes || null,
      media_url: mediaUrl,
      media_type: raw.media_type || "image",
      tags,
      applications,
      psychology,
      industries,
      ai_patterns,
      ui_elements,
      created_at: raw.date_created,
      updated_at: raw.date_created,
      directus_synced_at: new Date().toISOString(),
    });

    if (feedError) {
      console.error(`  ERROR inserting feed "${raw.title}":`, feedError.message);
      continue;
    }
    feedCount++;

    // Insert sections + blocks
    const sortedSections = (raw.sections || []).sort(
      (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0)
    );

    for (const section of sortedSections) {
      const { error: secError } = await supabase
        .from("feed_sections")
        .insert({
          id: section.id,
          feed_id: raw.id,
          sort: section.sort ?? 0,
          title: section.title || null,
        });

      if (secError) {
        console.error(`  ERROR inserting section:`, secError.message);
        continue;
      }
      sectionCount++;

      const blocks = (section.blocks || []).sort(
        (a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0)
      );

      for (const block of blocks) {
        const transformed = transformBlock(block);
        const blockId = block.item?.id || crypto.randomUUID();

        const { error: blockError } = await supabase
          .from("feed_blocks")
          .insert({
            id: blockId,
            section_id: section.id,
            ...transformed,
          });

        if (blockError) {
          console.error(`  ERROR inserting block:`, blockError.message);
          continue;
        }
        blockCount++;
      }
    }

    console.log(`  ✓ ${raw.title} (${sortedSections.length} sections, ${applications.join(", ") || "no apps"})`);
  }

  console.log(`\n=== Sync Complete ===`);
  console.log(`Feeds:    ${feedCount}`);
  console.log(`Sections: ${sectionCount}`);
  console.log(`Blocks:   ${blockCount}`);
}

syncAll().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
