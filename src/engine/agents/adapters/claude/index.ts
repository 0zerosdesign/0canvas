// Public surface of the Claude adapter.
//
// The gateway imports `createClaudeAdapter`; other code that needs
// to inspect hook shapes or reuse the translator (Phase 1.5+ JSONL
// tailer, contract-conformance tests) imports from here.

export { ClaudeAdapter, createClaudeAdapter } from "./adapter";
export { ClaudeStreamTranslator } from "./translator";
export type { ClaudeTranslatorOptions } from "./translator";
export { installClaudeHooks } from "./hooks";
export type { ClaudeHookInstallInput } from "./hooks";
export { findTranscript, replayTranscript } from "./history";
