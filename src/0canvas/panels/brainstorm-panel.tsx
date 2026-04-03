import React, { useState } from "react";
import {
  Lightbulb,
  Plus,
  X,
  Link2,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Star,
} from "lucide-react";
import { useWorkspace, BrainstormNote } from "../store/store";
import { ScrollArea } from "../ui/scroll-area";

const NOTE_COLORS = [
  "#0070f3",
  "#7928ca",
  "#ff0080",
  "#f5a623",
  "#50e3c2",
  "#ff4444",
];

export function BrainstormPanel() {
  const { state, dispatch } = useWorkspace();
  const [newNote, setNewNote] = useState("");
  const [selectedColor, setSelectedColor] = useState(NOTE_COLORS[0]);

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: BrainstormNote = {
      id: `note-${Date.now()}`,
      content: newNote,
      timestamp: Date.now(),
      linkedVersions: [],
      color: selectedColor,
    };
    dispatch({ type: "ADD_BRAINSTORM_NOTE", note });
    setNewNote("");
  };

  const quickPrompts = [
    "Try a gradient background on the hero",
    "Make the CTA more prominent",
    "Add more whitespace between sections",
    "Test a dark variant of this layout",
    "Reduce font sizes for mobile",
    "Try rounded corners on cards",
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--grey-900)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-[var(--yellow-500)]" />
        <span className="text-[13px] text-foreground">Brainstorm</span>
        <Sparkles className="w-3 h-3 text-[var(--blue-700)]" />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Quick prompts */}
          <div className="mb-4">
            <span className="text-[11px] text-muted-foreground mb-2 block">
              Quick Ideas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  className="text-[10px] text-muted-foreground bg-[var(--grey-800)] border border-[var(--grey-800)] px-2 py-1 rounded-full hover:text-foreground hover:border-[var(--grey-700)] transition-colors"
                  onClick={() => setNewNote(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Add note */}
          <div className="mb-4">
            <textarea
              placeholder="Describe a design idea or variation..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className="w-full bg-[var(--grey-800)] border border-[var(--grey-800)] rounded-lg px-3 py-2.5 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--grey-700)] resize-none h-20 transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.metaKey) addNote();
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-4 h-4 rounded-full transition-transform ${
                      selectedColor === color ? "scale-125 ring-1 ring-white/30" : ""
                    }`}
                    style={{ background: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background rounded text-[11px] hover:opacity-90 transition-opacity disabled:opacity-30"
                disabled={!newNote.trim()}
                onClick={addNote}
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            {state.brainstormNotes.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-[var(--grey-800)] mx-auto mb-3" />
                <p className="text-[12px] text-muted-foreground">
                  No ideas yet. Start brainstorming!
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Ideas will be linked to versions and sent to agents
                </p>
              </div>
            )}

            {state.brainstormNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 border rounded-lg bg-[var(--grey-900)] hover:border-[var(--grey-700)] transition-colors group"
                style={{ borderColor: `${note.color}30` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1">
                    <div
                      className="w-2 h-2 rounded-full mt-1 shrink-0"
                      style={{ background: note.color }}
                    />
                    <p className="text-[12px] text-foreground">{note.content}</p>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-[var(--grey-800)] rounded transition-all"
                    onClick={() =>
                      dispatch({ type: "DELETE_BRAINSTORM_NOTE", id: note.id })
                    }
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-2 ml-4">
                  <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--blue-600)] transition-colors">
                    <ArrowRight className="w-3 h-3" />
                    Send to IDE
                  </button>
                  <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--blue-700)] transition-colors">
                    <Link2 className="w-3 h-3" />
                    Link Version
                  </button>
                  <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--yellow-500)] transition-colors">
                    <Star className="w-3 h-3" />
                    Favorite
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}