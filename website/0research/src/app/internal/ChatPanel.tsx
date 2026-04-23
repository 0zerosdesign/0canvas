import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage as ChatMessageType, AiSettings } from "./types";
import type { AgentConfig } from "./agents.config";
import type { AgentDebug } from "./agent";
import type { FeedField } from "./types";
import { buildAgentMessages } from "./agent";
import { buildRegeneratePrompt, parseFeedFields } from "./parseFields";
import { streamChat } from "./openai";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { AgentDebugPanel } from "./AgentDebugPanel";
import { Settings } from "./Settings";
import { STYLE_GUIDE } from "./agent";

const STORAGE_KEY = "0internal-settings";

function loadSettings(): AiSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.provider) {
        parsed.provider = parsed.apiKey ? "openai" : "chatgpt";
      }
      if (!parsed.proxyUrl) {
        parsed.proxyUrl = parsed.gatewayUrl || "http://127.0.0.1:10531";
      }
      // Reset stale system prompt from old schema (v1 had "App", "Platform", "Summary", "Analysis")
      if (
        parsed.systemPrompt &&
        (parsed.systemPrompt.includes("**App**: The application name") ||
         parsed.systemPrompt.includes("**Platform**: Web / iOS / Android") ||
         parsed.systemPrompt.includes("**Summary**: What this pattern"))
      ) {
        parsed.systemPrompt = STYLE_GUIDE;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // ignore
  }
  return {
    provider: "chatgpt",
    proxyUrl: "http://127.0.0.1:10531",
    apiKey: "",
    model: "gpt-5.4",
    systemPrompt: STYLE_GUIDE,
    temperature: 0.7,
  };
}

function isConfigured(settings: AiSettings): boolean {
  if (settings.provider === "chatgpt") return !!settings.proxyUrl;
  return !!settings.apiKey;
}

interface Props {
  agent: AgentConfig;
  messages: ChatMessageType[];
  conversationId: string | null;
  onUserMessage: (content: string, images?: string[], convId?: string, metadata?: Record<string, unknown>) => Promise<void>;
  onAssistantMessage: (content: string, convId?: string) => Promise<void>;
  onFirstMessage?: (title: string) => void;
  ensureConversation: () => Promise<string>;
  /** Push a field to the output panel */
  onPushField?: (field: FeedField) => void;
  pushedFields?: Set<string>;
  forkSuggestion?: string;
}

export function ChatPanel({
  agent,
  messages,
  conversationId,
  onUserMessage,
  onAssistantMessage,
  onFirstMessage,
  ensureConversation,
  onPushField,
  pushedFields,
  forkSuggestion,
}: Props) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [settings, setSettings] = useState<AiSettings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<string | undefined>();
  const [debugLog, setDebugLog] = useState<AgentDebug[]>([]);
  const [chatMode, setChatMode] = useState<"create" | "ask">("create");
  const [localErrors, setLocalErrors] = useState<ChatMessageType[]>([]);

  // Regenerate state
  const [regenerateTag, setRegenerateTag] = useState<string | null>(null);
  const [regeneratingField, setRegeneratingField] = useState<FeedField | null>(null);
  const [fieldOverrides, setFieldOverrides] = useState<Map<string, string>>(new Map());

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const updateSettings = useCallback((next: AiSettings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Reset state when conversation changes, restore debug from persisted metadata
  useEffect(() => {
    setLocalErrors([]);
    setRegenerateTag(null);
    setRegeneratingField(null);
    setFieldOverrides(new Map());
    // Restore debug logs from message metadata
    const restored: AgentDebug[] = [];
    for (const msg of messages) {
      if (msg.role === "user" && msg.metadata?.agentDebug) {
        restored.push(msg.metadata.agentDebug as AgentDebug);
      }
    }
    setDebugLog(restored);
  }, [conversationId, messages.length]);

  // Find the last assistant shot message for field operations
  const lastShotMsgIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && parseFeedFields(messages[i].content)) {
        return i;
      }
    }
    return -1;
  })();

  // Get fields from the last shot message (for regenerate context)
  const lastFeedFields = lastShotMsgIndex >= 0
    ? parseFeedFields(messages[lastShotMsgIndex].content)
    : null;

  // Handle regenerate click on a field card
  const handleRegenerate = useCallback((field: FeedField) => {
    setRegenerateTag(field.label);
    setRegeneratingField(field);
  }, []);

  // Handle push click on a field card
  const handlePush = useCallback((field: FeedField) => {
    // Apply override if exists
    const override = fieldOverrides.get(field.key);
    const effectiveField = override ? { ...field, content: override } : field;
    onPushField?.(effectiveField);
  }, [onPushField, fieldOverrides]);

  const handleSend = useCallback(
    async (text: string, images: string[]) => {
      if (!isConfigured(settings)) {
        setIsSettingsOpen(true);
        return;
      }

      // Check if this is a regeneration request
      const isRegen = regeneratingField && regenerateTag;

      let convId: string;
      try {
        convId = await ensureConversation();
      } catch (err) {
        console.error("[ChatPanel] ensureConversation failed:", err);
        setLocalErrors((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: `**Error creating conversation:** ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      if (isRegen && lastFeedFields) {
        // ── Regeneration flow ──
        // Find the original user message with images (the source of truth)
        const originalUserMsg = [...messages].reverse().find(
          (m) => m.role === "user" && m.images && m.images.length > 0,
        );
        // Also find the original user text prompt (may be the same message)
        const originalUserText = [...messages].reverse().find(
          (m) => m.role === "user" && m.content && m.content.length > 10,
        );

        const field = regeneratingField;
        const allFields = lastFeedFields.map((f) => {
          const override = fieldOverrides.get(f.key);
          return override ? { ...f, content: override } : f;
        });
        const regenPrompt = buildRegeneratePrompt(field, text, allFields);

        setRegenerateTag(null);
        setRegeneratingField(null);

        const systemPrompt = settings.systemPrompt || agent.systemPromptTemplate;

        // Build regen debug info
        const regenDebug: AgentDebug = {
          query: `[Regenerate ${field.label}] ${text}`,
          kbSize: 0,
          examplesSelected: [],
          systemPromptTokens: Math.round(systemPrompt.length / 4),
          systemPromptPreview: `[Regeneration]\nField: ${field.label}\nInstructions: ${text}\nOriginal images included: ${!!originalUserMsg?.images}\n\nSystem prompt: ${systemPrompt.slice(0, 200)}...`,
          totalMessages: originalUserMsg?.images ? 4 : 2,
        };
        setDebugLog((prev) => [...prev, regenDebug]);

        // Persist the regen request as a user message with debug metadata
        try {
          await onUserMessage(
            `[Regenerate ${field.label}] ${text}`,
            images.length > 0 ? images : undefined,
            convId,
            { agentDebug: regenDebug },
          );
        } catch {
          // non-critical
        }

        setIsStreaming(true);
        setStreamingContent("");

        const controller = new AbortController();
        abortRef.current = controller;

        let accumulated = "";
        try {
          // Build messages WITH original visual context for proper regeneration
          type MsgPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "high" } };
          const regenMessages: Array<{ role: "system" | "user" | "assistant"; content: string | MsgPart[] }> = [
            { role: "system", content: systemPrompt },
          ];

          // Include original screenshot + prompt so AI has full visual context
          if (originalUserMsg?.images) {
            const parts: MsgPart[] = [
              { type: "text", text: `Original UI analysis request: ${originalUserText?.content || originalUserMsg.content || "Analyze this UI."}` },
              ...originalUserMsg.images.map((img) => ({
                type: "image_url" as const,
                image_url: { url: img, detail: "high" as const },
              })),
            ];
            regenMessages.push({ role: "user", content: parts });
          } else if (originalUserText) {
            regenMessages.push({ role: "user", content: `Original request: ${originalUserText.content}` });
          }

          // Include any new images the user attached for this regeneration
          if (images.length > 0) {
            const imgParts: MsgPart[] = [
              { type: "text", text: "Additional reference for regeneration:" },
              ...images.map((img) => ({
                type: "image_url" as const,
                image_url: { url: img, detail: "high" as const },
              })),
            ];
            regenMessages.push({ role: "user", content: imgParts });
          }

          // The regeneration instruction
          regenMessages.push({ role: "user", content: regenPrompt });

          for await (const chunk of streamChat({
            settings,
            messages: regenMessages,
            signal: controller.signal,
          })) {
            accumulated += chunk;
            setStreamingContent(`Regenerating **${field.label}**...\n\n${accumulated}`);
          }

          // Store the override
          setFieldOverrides((prev) => {
            const next = new Map(prev);
            next.set(field.key, accumulated.trim());
            return next;
          });

          // Persist as assistant message
          try {
            await onAssistantMessage(`[${field.label} regenerated]\n\n${accumulated.trim()}`, convId);
          } catch {
            // non-critical
          }
        } catch (error: unknown) {
          if (!(error instanceof Error && error.name === "AbortError")) {
            const errMsg = error instanceof Error ? error.message : "Unknown error";
            setLocalErrors((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "assistant" as const,
                content: `**Regeneration error:** ${errMsg}`,
                timestamp: Date.now(),
              },
            ]);
          }
        } finally {
          setIsStreaming(false);
          setStreamingContent("");
          abortRef.current = null;
        }
        return;
      }

      // ── Normal send flow ──
      if (messages.length === 0 && onFirstMessage) {
        const title = text.length > 60 ? text.slice(0, 57) + "..." : text;
        onFirstMessage(title);
      }

      const userMsg: ChatMessageType = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        images: images.length > 0 ? images : undefined,
        timestamp: Date.now(),
      };
      const allMsgs = [...messages, userMsg];

      // Build context based on mode
      const systemPrompt = settings.systemPrompt || agent.systemPromptTemplate;
      let finalMessages: import("./types").OpenAIMessage[];
      let debug: AgentDebug | undefined;

      if (chatMode === "ask") {
        // Ask mode: simple chat, no field transformation
        const askPrompt = "You are a helpful AI assistant specializing in UX design, AI interfaces, and product design. Answer questions directly and thoroughly. Use markdown for formatting. You can reference images the user shares.";
        finalMessages = [{ role: "system", content: askPrompt }];
        for (const msg of allMsgs) {
          if (msg.images && msg.images.length > 0) {
            finalMessages.push({
              role: msg.role,
              content: [
                { type: "text", text: msg.content || "Look at this." },
                ...msg.images.map((img) => ({
                  type: "image_url" as const,
                  image_url: { url: img, detail: "high" as const },
                })),
              ],
            });
          } else {
            finalMessages.push({ role: msg.role, content: msg.content });
          }
        }
      } else {
        // Create mode: full agent context with knowledge base + taxonomy + examples
        let agentResult;
        try {
          agentResult = await buildAgentMessages(systemPrompt, allMsgs);
        } catch (err) {
          console.error("[ChatPanel] buildAgentMessages failed:", err);
          setLocalErrors((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: `**Error building context:** ${err instanceof Error ? err.message : String(err)}`,
              timestamp: Date.now(),
            },
          ]);
          return;
        }
        finalMessages = agentResult.messages;
        debug = agentResult.debug;
      }

      if (debug) setDebugLog((prev) => [...prev, debug!]);

      // Persist user message WITH debug metadata
      try {
        await onUserMessage(text, images.length > 0 ? images : undefined, convId, debug ? { agentDebug: debug } : undefined);
      } catch (err) {
        console.error("[ChatPanel] onUserMessage failed:", err);
        setLocalErrors((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            content: `**Error saving message:** ${err instanceof Error ? err.message : String(err)}`,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setIsStreaming(true);
      setStreamingContent("");

      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = "";
      try {

        for await (const chunk of streamChat({
          settings,
          messages: finalMessages,
          signal: controller.signal,
        })) {
          accumulated += chunk;
          setStreamingContent(accumulated);
        }

        await onAssistantMessage(accumulated, convId);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          if (accumulated) {
            try {
              await onAssistantMessage(accumulated + "\n\n*(generation stopped)*", convId);
            } catch {
              // ignore
            }
          }
        } else {
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          setLocalErrors((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant" as const,
              content: `**Error:** ${errMsg}`,
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        abortRef.current = null;
      }
    },
    [messages, settings, agent, onUserMessage, onAssistantMessage, onFirstMessage, ensureConversation, regeneratingField, regenerateTag, lastFeedFields, fieldOverrides],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSuggestionClick = useCallback((text: string) => {
    setSuggestion(text);
    setTimeout(() => setSuggestion(undefined), 0);
  }, []);

  const displayMessages = [...messages, ...localErrors];
  const isEmpty = displayMessages.length === 0 && !isStreaming;
  const configured = isConfigured(settings);

  return (
    <div className="oai-col-chat">
      {/* Chat header */}
      <div className="oai-header">
        <div className="oai-header__left">
          <span className="oai-logo">0internal</span>
        </div>
        <div className="oai-header__right">
          <button
            className="oai-icon-btn"
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            type="button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="oai-messages">
        {isEmpty ? (
          <div className="oai-welcome">
            <div className="oai-welcome__title">{agent.name}</div>
            <div className="oai-welcome__subtitle">{agent.description}</div>
            <div className="oai-welcome__suggestions">
              {agent.suggestions.map((s) => (
                <button
                  key={s}
                  className="oai-suggestion"
                  onClick={() => handleSuggestionClick(s)}
                  type="button"
                >
                  {s}
                </button>
              ))}
            </div>
            {!configured && (
              <button
                className="oai-suggestion"
                onClick={() => setIsSettingsOpen(true)}
                style={{ borderStyle: "dashed" }}
                type="button"
              >
                {settings.provider === "chatgpt"
                  ? "Start the local proxy to get started"
                  : "Add your OpenAI API key to get started"}
              </button>
            )}
          </div>
        ) : (
          <>
            {displayMessages.map((msg, i) => {
              // Get debug from persisted metadata first, fall back to session debugLog
              let debug: AgentDebug | undefined;
              if (msg.role === "user") {
                if (msg.metadata?.agentDebug) {
                  debug = msg.metadata.agentDebug as AgentDebug;
                } else {
                  const userIndex = displayMessages
                    .slice(0, i + 1)
                    .filter((m) => m.role === "user").length;
                  debug = debugLog[userIndex - 1];
                }
              }

              // Only show field cards on the last shot message
              const isLastShot = i === lastShotMsgIndex;
              const isAssistant = msg.role === "assistant";

              return (
                <div key={msg.id}>
                  <ChatMessage
                    message={msg}
                    chatMode={chatMode}
                    pushedFields={isAssistant ? pushedFields : undefined}
                    regeneratingField={isAssistant && regeneratingField ? regeneratingField.key : null}
                    onRegenerate={isAssistant ? handleRegenerate : undefined}
                    onPush={isAssistant ? handlePush : undefined}
                    fieldOverrides={isLastShot ? fieldOverrides : undefined}
                  />
                  {debug && <AgentDebugPanel debug={debug} />}
                </div>
              );
            })}
            {isStreaming && (
              <div className="oai-msg oai-msg--assistant">
                <div className="oai-msg__label">0internal</div>
                <div className="oai-msg__bubble">
                  <div className="oai-typing">
                    <div className="oai-typing__dot" />
                    <div className="oai-typing__dot" />
                    <div className="oai-typing__dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        isStreaming={isStreaming}
        onStop={handleStop}
        onSuggestion={forkSuggestion || suggestion}
        regenerateTag={regenerateTag}
        onClearRegenerateTag={() => {
          setRegenerateTag(null);
          setRegeneratingField(null);
        }}
        mode={chatMode}
        onModeChange={setChatMode}
      />

      {/* Settings */}
      <Settings
        settings={settings}
        onUpdate={updateSettings}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
