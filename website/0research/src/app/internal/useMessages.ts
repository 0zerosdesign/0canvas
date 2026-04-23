import { useState, useEffect, useCallback } from "react";
import type { ChatMessage } from "./types";
import { fetchMessages, insertMessage } from "./supabase-internal";

interface UseMessagesResult {
  messages: ChatMessage[];
  loading: boolean;
  /** Pass explicit convId to avoid stale closure after auto-create */
  addUserMessage: (
    content: string,
    images?: string[],
    convId?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<ChatMessage>;
  addAssistantMessage: (content: string, convId?: string) => Promise<ChatMessage>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

function toChat(row: {
  id: string;
  role: "user" | "assistant";
  content: string;
  images: string[] | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    images: row.images ?? undefined,
    timestamp: new Date(row.created_at).getTime(),
    metadata: row.metadata ?? undefined,
  };
}

export function useMessages(
  conversationId: string | null,
): UseMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMessages(conversationId)
      .then((rows) => {
        if (!cancelled) setMessages(rows.map(toChat));
      })
      .catch((err) => console.error("[useMessages] fetch error:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const addUserMessage = useCallback(
    async (content: string, images?: string[], convId?: string, metadata?: Record<string, unknown>) => {
      const id = convId || conversationId;
      if (!id) throw new Error("No conversation selected");
      const row = await insertMessage(id, "user", content, images, metadata);
      const msg = toChat(row);
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [conversationId],
  );

  const addAssistantMessage = useCallback(
    async (content: string, convId?: string) => {
      const id = convId || conversationId;
      if (!id) throw new Error("No conversation selected");
      const row = await insertMessage(id, "assistant", content);
      const msg = toChat(row);
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [conversationId],
  );

  return { messages, loading, addUserMessage, addAssistantMessage, setMessages };
}
