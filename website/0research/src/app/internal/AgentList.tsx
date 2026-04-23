import { AGENTS } from "./agents.config";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function AgentList({ selectedId, onSelect }: Props) {
  return (
    <>
      <div className="oai-col-agents__header">
        <span className="oai-col-agents__title">Agents</span>
      </div>
      <div className="oai-col-agents__list">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            className={`oai-agent-item ${agent.id === selectedId ? "oai-agent-item--active" : ""}`}
            onClick={() => onSelect(agent.id)}
            type="button"
          >
            <span className="oai-agent-item__icon">{agent.icon}</span>
            <div className="oai-agent-item__info">
              <span className="oai-agent-item__name">{agent.name}</span>
              <span className="oai-agent-item__desc">{agent.description}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
