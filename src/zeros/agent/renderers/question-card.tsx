// ──────────────────────────────────────────────────────────
// QuestionCard — agent asking the user something
// ──────────────────────────────────────────────────────────
//
// Renders any tool with kind="question". Today: Claude
// AskUserQuestion. Stage 7+ adds Gemini ask_user.
//
// AskUserQuestion's tool input has a structured payload:
//   {
//     questions: [{
//       question: string,
//       header?: string,            // ≤16 chars header
//       inputType?: "choice" | "multi_choice" | "text" | "yesno",
//       options?: [{ label, description?, preview? }],
//       multiSelect?: boolean
//     }, ...]
//   }
//
// On submit we route the answer back via ctx.respondToQuestion,
// which today dispatches a normal next-turn user prompt (the
// "inferred path" — see §2.4.9 of the roadmap). Once an adapter
// supports tool_result write-back to the running process, the
// hook flips to that path with no card-level change.
// ──────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";

import type { AgentToolMessage } from "../use-agent-session";
import type { Renderer } from "./types";

interface QuestionOption {
  label: string;
  description?: string;
  preview?: string;
}

type InputType = "choice" | "multi_choice" | "text" | "yesno";

interface ParsedQuestion {
  question: string;
  header?: string;
  inputType: InputType;
  options: QuestionOption[];
  multiSelect: boolean;
}

export const QuestionCard: Renderer<AgentToolMessage> = memo(
  function QuestionCard({ message, ctx }) {
    const tool = message;
    const questions = useMemo(
      () => parseQuestions(tool.rawInput),
      [tool.rawInput],
    );
    const [submitted, setSubmitted] = useState<string | null>(null);

    if (questions.length === 0) {
      // Adapter handed us a question tool we couldn't parse — fall back
      // to a minimal "agent asked something" hint so the user at least
      // sees a visible prompt to answer in the composer.
      return (
        <div className="oc-agent-tool oc-agent-tool-question">
          <div className="oc-agent-question-head">
            <HelpCircle className="oc-agent-tool-icon w-3.5 h-3.5" />
            <span className="oc-agent-question-title">
              Agent is asking a question
            </span>
          </div>
          <div className="oc-agent-question-empty">
            Reply in the composer below to continue.
          </div>
        </div>
      );
    }

    const onSubmit = (formattedAnswer: string) => {
      setSubmitted(formattedAnswer);
      ctx.respondToQuestion(formattedAnswer);
    };

    return (
      <div className="oc-agent-tool oc-agent-tool-question">
        <div className="oc-agent-question-head">
          <HelpCircle className="oc-agent-tool-icon w-3.5 h-3.5" />
          <span className="oc-agent-question-title">
            {questions.length === 1
              ? "Agent question"
              : `Agent has ${questions.length} questions`}
          </span>
          <span className="oc-agent-question-hint">
            replies are sent as your next prompt
          </span>
        </div>
        {submitted ? (
          <div className="oc-agent-question-sent">
            <span className="oc-agent-question-sent-label">Sent:</span>
            <span className="oc-agent-question-sent-text">{submitted}</span>
          </div>
        ) : (
          <QuestionForm questions={questions} onSubmit={onSubmit} />
        )}
      </div>
    );
  },
);

// ──────────────────────────────────────────────────────────
// QuestionForm — renders the questions[] payload as a stacked
// form with a single submit at the bottom.
// ──────────────────────────────────────────────────────────

interface FormState {
  // Per-question answer storage. For choice/yesno → single string;
  // for multi_choice → string[]; for text → string.
  [questionIdx: number]: string | string[];
}

function QuestionForm({
  questions,
  onSubmit,
}: {
  questions: ParsedQuestion[];
  onSubmit: (formatted: string) => void;
}) {
  const [state, setState] = useState<FormState>(() => {
    const init: FormState = {};
    for (let i = 0; i < questions.length; i++) {
      init[i] = questions[i].inputType === "multi_choice" ? [] : "";
    }
    return init;
  });

  const allAnswered = questions.every((q, i) => {
    const v = state[i];
    if (q.inputType === "multi_choice") return Array.isArray(v) && v.length > 0;
    return typeof v === "string" && v.trim().length > 0;
  });

  const handleSubmit = () => {
    const lines: string[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const v = state[i];
      const answer = Array.isArray(v) ? v.join(", ") : v;
      if (questions.length === 1) {
        lines.push(answer);
      } else {
        lines.push(`${q.header ?? `Q${i + 1}`}: ${answer}`);
      }
    }
    onSubmit(lines.join("\n"));
  };

  return (
    <div className="oc-agent-question-form">
      {questions.map((q, i) => (
        <QuestionField
          key={i}
          question={q}
          value={state[i]}
          onChange={(v) => setState((s) => ({ ...s, [i]: v }))}
        />
      ))}
      <button
        type="button"
        className="oc-agent-question-submit"
        onClick={handleSubmit}
        disabled={!allAnswered}
      >
        Submit answer{questions.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: ParsedQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  return (
    <div className="oc-agent-question-field">
      {question.header && (
        <div className="oc-agent-question-fieldhead">{question.header}</div>
      )}
      <div className="oc-agent-question-prompt">{question.question}</div>
      <QuestionInput question={question} value={value} onChange={onChange} />
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: ParsedQuestion;
  value: string | string[];
  onChange: (v: string | string[]) => void;
}) {
  if (question.inputType === "text") {
    return (
      <textarea
        className="oc-agent-question-textarea"
        rows={2}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your answer…"
      />
    );
  }

  if (question.inputType === "yesno") {
    const v = typeof value === "string" ? value : "";
    return (
      <div className="oc-agent-question-yesno">
        {["Yes", "No"].map((opt) => (
          <button
            key={opt}
            type="button"
            className={`oc-agent-question-yesno-btn ${
              v === opt ? "oc-agent-question-yesno-btn-active" : ""
            }`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.inputType === "multi_choice") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="oc-agent-question-options">
        {question.options.map((opt) => {
          const checked = arr.includes(opt.label);
          return (
            <label key={opt.label} className="oc-agent-question-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  const next = checked
                    ? arr.filter((x) => x !== opt.label)
                    : [...arr, opt.label];
                  onChange(next);
                }}
              />
              <span className="oc-agent-question-option-body">
                <span className="oc-agent-question-option-label">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="oc-agent-question-option-desc">
                    {opt.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // Default: single choice (radio)
  const v = typeof value === "string" ? value : "";
  return (
    <div className="oc-agent-question-options">
      {question.options.map((opt) => {
        const checked = v === opt.label;
        return (
          <label key={opt.label} className="oc-agent-question-option">
            <input
              type="radio"
              checked={checked}
              onChange={() => onChange(opt.label)}
            />
            <span className="oc-agent-question-option-body">
              <span className="oc-agent-question-option-label">
                {opt.label}
              </span>
              {opt.description && (
                <span className="oc-agent-question-option-desc">
                  {opt.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// parsing — tolerant to the AskUserQuestion payload variants
// ──────────────────────────────────────────────────────────

function parseQuestions(input: unknown): ParsedQuestion[] {
  if (!isObj(input)) return [];
  const arr = Array.isArray(input.questions) ? input.questions : null;
  if (!arr) return [];
  const out: ParsedQuestion[] = [];
  for (const q of arr) {
    if (!isObj(q)) continue;
    const text = typeof q.question === "string" ? q.question : null;
    if (!text) continue;
    const header = typeof q.header === "string" ? q.header : undefined;
    const inputTypeRaw = typeof q.inputType === "string" ? q.inputType : "";
    const inputType: InputType =
      inputTypeRaw === "multi_choice" ||
      inputTypeRaw === "text" ||
      inputTypeRaw === "yesno" ||
      inputTypeRaw === "choice"
        ? inputTypeRaw
        : Array.isArray(q.options)
        ? q.multiSelect
          ? "multi_choice"
          : "choice"
        : "text";
    const options: QuestionOption[] = Array.isArray(q.options)
      ? q.options.flatMap((o: unknown) => {
          if (typeof o === "string") return [{ label: o }];
          if (isObj(o) && typeof o.label === "string") {
            return [
              {
                label: o.label,
                description:
                  typeof o.description === "string" ? o.description : undefined,
                preview:
                  typeof o.preview === "string" ? o.preview : undefined,
              },
            ];
          }
          return [];
        })
      : [];
    out.push({
      question: text,
      header,
      inputType,
      options,
      multiSelect: q.multiSelect === true,
    });
  }
  return out;
}

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
