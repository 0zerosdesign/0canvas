import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";
import { AGENTS, getAgent } from "./agents.config";
import type { FeedField } from "./types";
import type { OutputItem } from "./types";
import { useConversations } from "./useConversations";
import { useMessages } from "./useMessages";
import { useOutputItems } from "./useOutputItems";
import { InternalNav } from "./InternalNav";
import { ConversationList } from "./ConversationList";
import { ChatPanel } from "./ChatPanel";
import { OutputPanel } from "./OutputPanel";
import { ResizeHandle } from "./ResizeHandle";

const MIN_COL = 120;
const DEFAULT_CONVS_W = 220;
const DEFAULT_OUTPUT_W = 320;

function createOutputItem(): OutputItem {
  return {
    id: crypto.randomUUID(),
    directusId: null,
    fields: new Map(),
    savedFields: null,
    status: "draft",
    title: "New Shot",
    createdAt: Date.now(),
  };
}

export function WorkspaceLayout() {
  const { user } = useZerosAuth();
  const userId = user?.id;

  const [selectedAgentId, setSelectedAgentId] = useState(AGENTS[0].id);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const autoCreatingRef = useRef(false);

  // Resizable column widths
  const [convsW, setConvsW] = useState(DEFAULT_CONVS_W);
  const [outputW, setOutputW] = useState(DEFAULT_OUTPUT_W);

  // Multi-item output (persisted to Supabase)
  const {
    items: outputItems,
    loading: outputLoading,
    setItems: setOutputItems,
    saveItem: persistOutputItem,
    removeItem: persistRemoveItem,
    removeAll: persistRemoveAll,
  } = useOutputItems(selectedConvId);
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null);
  // Track whether local changes have been made (vs hook-loaded data)
  const hasLocalChangesRef = useRef(false);

  const selectedItem = useMemo(
    () => outputItems.find((i) => i.id === selectedOutputId) ?? null,
    [outputItems, selectedOutputId],
  );
  const pushedFieldKeys = useMemo(
    () => new Set(selectedItem?.fields.keys() ?? []),
    [selectedItem],
  );

  // Persist output items to Supabase on changes (skip while loading to avoid race condition)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!selectedConvId || outputLoading || !hasLocalChangesRef.current) return;
    clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      for (const item of outputItems) {
        persistOutputItem(item);
      }
      hasLocalChangesRef.current = false;
    }, 500);
    return () => clearTimeout(persistTimerRef.current);
  }, [outputItems, selectedConvId, persistOutputItem, outputLoading]);

  const agent = getAgent(selectedAgentId)!;
  const { conversations, loading: convsLoading, create, rename, remove, touch } =
    useConversations(selectedAgentId, userId);
  const { messages, addUserMessage, addAssistantMessage } =
    useMessages(selectedConvId);

  // ── Conversation handlers ──────────────────────────────────────

  const handleAgentSelect = useCallback((id: string) => {
    setSelectedAgentId(id);
    setSelectedConvId(null);
    setOutputItems([]);
    setSelectedOutputId(null);
  }, []);

  const handleConvSelect = useCallback((id: string) => {
    setSelectedConvId(id);
    setSelectedOutputId(null);
  }, []);

  const handleConvCreate = useCallback(async () => {
    const conv = await create();
    setSelectedConvId(conv.id);
    setOutputItems([]);
    setSelectedOutputId(null);
  }, [create]);

  const handleConvDelete = useCallback(
    async (id: string) => {
      await remove(id);
      if (selectedConvId === id) {
        setSelectedConvId(null);
        setOutputItems([]);
        setSelectedOutputId(null);
      }
    },
    [remove, selectedConvId],
  );

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (selectedConvId) return selectedConvId;
    if (autoCreatingRef.current) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (!autoCreatingRef.current) {
            clearInterval(check);
            resolve(selectedConvId!);
          }
        }, 50);
      });
    }
    autoCreatingRef.current = true;
    try {
      const conv = await create();
      setSelectedConvId(conv.id);
      return conv.id;
    } finally {
      autoCreatingRef.current = false;
    }
  }, [selectedConvId, create]);

  const handleUserMessage = useCallback(
    async (content: string, images?: string[], convId?: string, metadata?: Record<string, unknown>) => {
      const id = convId || selectedConvId;
      await addUserMessage(content, images, id || undefined, metadata);
      if (id) await touch(id);
    },
    [addUserMessage, touch, selectedConvId],
  );

  const handleAssistantMessage = useCallback(
    async (content: string, convId?: string) => {
      await addAssistantMessage(content, convId || undefined);
    },
    [addAssistantMessage],
  );

  const handleFirstMessage = useCallback(
    (title: string) => {
      if (selectedConvId) rename(selectedConvId, title);
    },
    [selectedConvId, rename],
  );

  // ── Output item handlers ───────────────────────────────────────

  const handlePushField = useCallback((field: FeedField) => {
    hasLocalChangesRef.current = true;
    let newItemId: string | null = null;

    setOutputItems((prev) => {
      let items = [...prev];
      let targetId = selectedOutputId;

      if (!targetId || !items.find((i) => i.id === targetId)) {
        const newItem = createOutputItem();
        items = [...items, newItem];
        targetId = newItem.id;
        newItemId = newItem.id;
      }

      return items.map((item) => {
        if (item.id !== targetId) return item;
        const nextFields = new Map(item.fields);
        nextFields.set(field.key, field);
        const title = field.key === "title" ? field.content : item.title;
        const isDirty = item.savedFields
          ? item.savedFields.get(field.key)?.content !== field.content
          : true;
        return {
          ...item,
          fields: nextFields,
          title: title === "New Shot" && field.key === "title" ? field.content : title,
          status: item.status === "saved" && isDirty ? "modified" as const : item.status,
        };
      });
    });

    // Auto-select new item outside the setter to avoid nested state updates
    if (newItemId || !selectedOutputId) {
      // Use requestAnimationFrame to defer selection after state settles
      requestAnimationFrame(() => {
        setOutputItems((prev) => {
          if (prev.length > 0) {
            const id = newItemId || prev[prev.length - 1].id;
            setSelectedOutputId(id);
          }
          return prev;
        });
      });
    }
  }, [selectedOutputId]);

  const handleUnpushField = useCallback((fieldKey: string) => {
    hasLocalChangesRef.current = true;
    setOutputItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedOutputId) return item;
        const nextFields = new Map(item.fields);
        nextFields.delete(fieldKey);
        const wasSaved = item.savedFields?.has(fieldKey);
        return {
          ...item,
          fields: nextFields,
          status: wasSaved ? "modified" as const : item.status,
        };
      }),
    );
  }, [selectedOutputId]);

  const handleCreateOutputItem = useCallback(() => {
    hasLocalChangesRef.current = true;
    const newItem = createOutputItem();
    setOutputItems((prev) => [...prev, newItem]);
    setSelectedOutputId(newItem.id);
  }, []);

  const handleSelectOutputItem = useCallback((id: string) => {
    setSelectedOutputId(id);
  }, []);

  const handleRemoveOutputItem = useCallback((id: string) => {
    setOutputItems((prev) => prev.filter((i) => i.id !== id));
    persistRemoveItem(id);
    if (selectedOutputId === id) {
      setSelectedOutputId(null);
    }
  }, [selectedOutputId, persistRemoveItem]);

  const handleClearAllOutputItems = useCallback(() => {
    setOutputItems([]);
    setSelectedOutputId(null);
    persistRemoveAll();
  }, [persistRemoveAll]);

  const handleSaveResult = useCallback((itemId: string, directusId: string) => {
    hasLocalChangesRef.current = true;
    setOutputItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          directusId,
          savedFields: new Map(item.fields),
          status: "saved" as const,
        };
      }),
    );
  }, []);

  const handleImportItem = useCallback((imported: OutputItem) => {
    hasLocalChangesRef.current = true;
    setOutputItems((prev) => [...prev, imported]);
    setSelectedOutputId(imported.id);
  }, []);

  // Fork-to-chat: inject content from output into the chat input
  const [forkSuggestion, setForkSuggestion] = useState<string | undefined>();
  const handleForkToChat = useCallback((text: string, _images: string[]) => {
    setForkSuggestion(text);
    // Clear after a tick so ChatInput picks it up
    setTimeout(() => setForkSuggestion(undefined), 100);
  }, []);

  const handleUpdateField = useCallback((fieldKey: string, updates: Partial<FeedField>) => {
    hasLocalChangesRef.current = true;
    setOutputItems((prev) =>
      prev.map((item) => {
        if (item.id !== selectedOutputId) return item;
        const existingField = item.fields.get(fieldKey);
        const nextFields = new Map(item.fields);

        // If field doesn't exist yet (e.g., default media field), create it from updates
        const baseField: FeedField = existingField || {
          key: fieldKey,
          label: fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1).replace(/_/g, " "),
          kind: (updates as FeedField).kind || "text",
          content: "",
        };

        const updated = { ...baseField, ...updates };
        nextFields.set(fieldKey, updated);
        return {
          ...item,
          fields: nextFields,
          title: fieldKey === "title" && updates.content ? updates.content : item.title,
          status: item.status === "saved" ? "modified" as const : item.status,
        };
      }),
    );
  }, [selectedOutputId]);

  // ── Resize handlers ────────────────────────────────────────────

  const resizeConvs = useCallback((d: number) => {
    setConvsW((w) => Math.max(MIN_COL, w + d));
  }, []);
  const resizeOutput = useCallback((d: number) => {
    setOutputW((w) => Math.max(MIN_COL, w - d));
  }, []);

  return (
    <div className="oai-workspace">
      <InternalNav
        agents={AGENTS}
        selectedAgentId={selectedAgentId}
        onAgentSelect={handleAgentSelect}
      />

      <div className="oai-col-conversations" style={{ width: convsW }}>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConvId}
          loading={convsLoading}
          agentName={agent.name}
          onSelect={handleConvSelect}
          onCreate={handleConvCreate}
          onDelete={handleConvDelete}
        />
      </div>
      <ResizeHandle onResize={resizeConvs} />

      <ChatPanel
        agent={agent}
        messages={messages}
        conversationId={selectedConvId}
        onUserMessage={handleUserMessage}
        onAssistantMessage={handleAssistantMessage}
        onFirstMessage={handleFirstMessage}
        ensureConversation={ensureConversation}
        onPushField={handlePushField}
        pushedFields={pushedFieldKeys}
        forkSuggestion={forkSuggestion}
      />

      <ResizeHandle onResize={resizeOutput} />
      <div className="oai-col-output" style={{ width: outputW }}>
        <OutputPanel
          agentName={agent.name}
          items={outputItems}
          selectedId={selectedOutputId}
          onSelect={handleSelectOutputItem}
          onCreate={handleCreateOutputItem}
          onRemove={handleRemoveOutputItem}
          onClearAll={handleClearAllOutputItems}
          onUnpushField={handleUnpushField}
          onUpdateField={handleUpdateField}
          onSaveResult={handleSaveResult}
          onForkToChat={handleForkToChat}
          onImport={handleImportItem}
        />
      </div>
    </div>
  );
}
