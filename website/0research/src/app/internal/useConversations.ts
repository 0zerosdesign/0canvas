import { useState, useEffect, useCallback } from "react";
import type { InternalConversation } from "./types";
import {
  fetchConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  touchConversation,
} from "./supabase-internal";

interface UseConversationsResult {
  conversations: InternalConversation[];
  loading: boolean;
  create: (title?: string) => Promise<InternalConversation>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  touch: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useConversations(
  agentId: string,
  userId: string | undefined,
): UseConversationsResult {
  const [conversations, setConversations] = useState<InternalConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await fetchConversations(agentId);
      setConversations(data);
    } catch (err) {
      console.error("[useConversations] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [agentId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (title?: string) => {
      if (!userId) throw new Error("Not authenticated");
      const conv = await createConversation(agentId, userId, title);
      setConversations((prev) => [conv, ...prev]);
      return conv;
    },
    [agentId, userId],
  );

  const rename = useCallback(async (id: string, title: string) => {
    await updateConversationTitle(id, title);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const touch = useCallback(async (id: string) => {
    await touchConversation(id);
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, updated_at: new Date().toISOString() } : c,
      );
      return updated.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    });
  }, []);

  return { conversations, loading, create, rename, remove, touch, refresh: load };
}
