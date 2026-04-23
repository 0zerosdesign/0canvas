import type { InternalConversation } from "./types";

interface Props {
  conversations: InternalConversation[];
  selectedId: string | null;
  loading: boolean;
  agentName: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  agentName,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <>
      <div className="oai-col-conversations__header">
        <span className="oai-col-conversations__title">{agentName}</span>
        <button
          className="oai-icon-btn"
          onClick={onCreate}
          title="New conversation"
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
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="oai-col-conversations__list">
        {loading && conversations.length === 0 ? (
          <div className="oai-col-conversations__empty">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="oai-col-conversations__empty">
            No conversations yet.
            <br />
            Click + to start one.
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              className={`oai-conv-item ${conv.id === selectedId ? "oai-conv-item--active" : ""}`}
              onClick={() => onSelect(conv.id)}
              type="button"
            >
              <div className="oai-conv-item__title">
                {conv.title || "New conversation"}
              </div>
              <div className="oai-conv-item__time">
                {formatTime(conv.updated_at)}
              </div>
              <button
                className="oai-conv-item__delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                title="Delete conversation"
                type="button"
              >
                &times;
              </button>
            </button>
          ))
        )}
      </div>
    </>
  );
}
