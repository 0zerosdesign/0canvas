import { useState, useEffect, useCallback } from "react";
import type { OutputItem, OutputItemSerialized, FeedField } from "./types";
import { supabase } from "../lib/supabase";

function serialize(item: OutputItem): OutputItemSerialized {
  // Strip localBase64 from fields before saving — it's too large for JSONB
  // and is only needed in the current browser session
  const cleanFields: Record<string, FeedField> = {};
  for (const [key, field] of item.fields) {
    if (field.localBase64) {
      const { localBase64, ...rest } = field;
      cleanFields[key] = rest;
    } else {
      cleanFields[key] = field;
    }
  }

  const cleanSavedFields: Record<string, FeedField> | null = item.savedFields
    ? Object.fromEntries(item.savedFields)
    : null;

  return {
    id: item.id,
    directusId: item.directusId,
    fields: cleanFields,
    savedFields: cleanSavedFields,
    status: item.status,
    title: item.title,
    createdAt: item.createdAt,
  };
}

function deserialize(row: {
  id: string;
  directus_id: string | null;
  fields: Record<string, FeedField>;
  saved_fields: Record<string, FeedField> | null;
  status: string;
  title: string;
  created_at: string;
}): OutputItem {
  return {
    id: row.id,
    directusId: row.directus_id,
    fields: new Map(Object.entries(row.fields || {})),
    savedFields: row.saved_fields ? new Map(Object.entries(row.saved_fields)) : null,
    status: row.status as OutputItem["status"],
    title: row.title,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function useOutputItems(conversationId: string | null) {
  const [items, setItems] = useState<OutputItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load items when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .from("internal_output_items")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("sort", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[useOutputItems] fetch error:", error);
          setItems([]);
        } else {
          setItems((data || []).map(deserialize));
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [conversationId]);

  // Save a single item (upsert)
  const saveItem = useCallback(
    async (item: OutputItem) => {
      if (!conversationId) return;
      const s = serialize(item);
      const { error } = await supabase
        .from("internal_output_items")
        .upsert({
          id: s.id,
          conversation_id: conversationId,
          directus_id: s.directusId,
          fields: s.fields,
          saved_fields: s.savedFields,
          status: s.status,
          title: s.title,
          sort: items.indexOf(item),
          updated_at: new Date().toISOString(),
        });
      if (error) console.error("[useOutputItems] save error:", error);
    },
    [conversationId, items],
  );

  // Remove a single item
  const removeItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("internal_output_items")
      .delete()
      .eq("id", id);
    if (error) console.error("[useOutputItems] delete error:", error);
  }, []);

  // Remove all items for this conversation
  const removeAll = useCallback(async () => {
    if (!conversationId) return;
    const { error } = await supabase
      .from("internal_output_items")
      .delete()
      .eq("conversation_id", conversationId);
    if (error) console.error("[useOutputItems] deleteAll error:", error);
  }, [conversationId]);

  return { items, loading, setItems, saveItem, removeItem, removeAll };
}
