// Minimal ANSI escape stripper for terminal output.
//
// Drops CSI sequences (color / cursor movement / erase), OSC (title,
// hyperlink), DCS/SOS/PM/APC (rare), bell, and leftover carriage
// returns. Good enough for agent TUIs — not a full emulator.
//
// Lifted from the pattern used in @node-pty-adjacent tooling; keeps
// the escape set small so future terminals with new sequences fall
// through as raw bytes rather than crash us.

const ANSI_CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const ANSI_OSC = /\x1b\][\s\S]*?(?:\x07|\x1b\\)/g;
const ANSI_OTHER = /\x1b[PX^_][\s\S]*?\x1b\\/g;
const ANSI_SHORT = /\x1b[@-Z\\-_]/g;
const BELL = /\x07/g;

export function stripAnsi(input: string): string {
  return input
    .replace(ANSI_CSI, "")
    .replace(ANSI_OSC, "")
    .replace(ANSI_OTHER, "")
    .replace(ANSI_SHORT, "")
    .replace(BELL, "")
    // Normalize CRLF → LF; drop orphan CRs (cursor returns in TUI
    // line redraws).
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "");
}
