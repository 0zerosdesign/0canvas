import { supabase } from "../lib/supabase";
import type { InternalConversation, InternalMessage } from "./types";

// ── Conversations ──────────────────────────────────────────────────

export async function fetchConversations(
  agentId: string,
): Promise<InternalConversation[]> {
  const { data, error } = await supabase
    .from("internal_conversations")
    .select("*")
    .eq("agent_id", agentId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createConversation(
  agentId: string,
  userId: string,
  title?: string,
): Promise<InternalConversation> {
  const { data, error } = await supabase
    .from("internal_conversations")
    .insert({ agent_id: agentId, user_id: userId, title: title || null })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateConversationTitle(
  id: string,
  title: string,
): Promise<void> {
  const { error } = await supabase
    .from("internal_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from("internal_conversations")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function touchConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from("internal_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// ── Messages ───────────────────────────────────────────────────────

export async function fetchMessages(
  conversationId: string,
): Promise<InternalMessage[]> {
  const { data, error } = await supabase
    .from("internal_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  images?: string[],
  metadata?: Record<string, unknown>,
): Promise<InternalMessage> {
  const { data, error } = await supabase
    .from("internal_messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      images: images?.length ? images : null,
      metadata: metadata ?? {},
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
