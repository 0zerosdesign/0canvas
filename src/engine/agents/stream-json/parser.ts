// ──────────────────────────────────────────────────────────
// NDJSON stream parser
// ──────────────────────────────────────────────────────────
//
// Claude (`--output-format stream-json`), Codex (`exec --json`),
// Cursor (`--output-format stream-json`) and Droid
// (`exec --output-format stream-json`) all emit one JSON object per
// newline. This parser buffers stdout, splits on '\n', and surfaces
// each parsed object.
//
// Constraints:
//   - A single line can exceed 1MB (tool outputs contain file diffs).
//     We cap at 8MB to avoid runaway memory; beyond that we emit a
//     `parseError` and skip the line.
//   - Partial lines across chunk boundaries are buffered.
//   - We never throw — malformed JSON is reported via `onParseError`
//     so the adapter can decide whether to fail the session or
//     continue.
//
// ──────────────────────────────────────────────────────────

const MAX_LINE_BYTES = 8 * 1024 * 1024;

export interface StreamJsonHandlers {
  onEvent: (obj: unknown) => void;
  onParseError?: (line: string, error: Error) => void;
  onBufferOverflow?: (bytes: number) => void;
}

export class StreamJsonParser {
  private buffer = "";
  private readonly handlers: StreamJsonHandlers;

  constructor(handlers: StreamJsonHandlers) {
    this.handlers = handlers;
  }

  feed(chunk: string | Buffer): void {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    this.buffer += text;
    if (Buffer.byteLength(this.buffer, "utf-8") > MAX_LINE_BYTES) {
      const size = Buffer.byteLength(this.buffer, "utf-8");
      this.buffer = "";
      this.handlers.onBufferOverflow?.(size);
      return;
    }
    // Split on '\n'. Keep the trailing partial line in the buffer.
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl).replace(/\r$/, "");
      this.buffer = this.buffer.slice(nl + 1);
      if (line.trim().length) {
        this.parseLine(line);
      }
      nl = this.buffer.indexOf("\n");
    }
  }

  /** Flush any trailing buffered line. Call on stdout `end`. */
  end(): void {
    if (this.buffer.trim().length) {
      this.parseLine(this.buffer);
    }
    this.buffer = "";
  }

  private parseLine(line: string): void {
    try {
      const obj: unknown = JSON.parse(line);
      this.handlers.onEvent(obj);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.handlers.onParseError?.(line, error);
    }
  }
}
