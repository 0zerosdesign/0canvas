// ──────────────────────────────────────────────────────────
// useChatCwd — active chat's folder, for scoping IDE panels
// ──────────────────────────────────────────────────────────
//
// Git / Env / Todo / Terminal all want to operate on the current
// chat's folder, not the global engine root. This hook is the
// single source of truth:
//
//   - Returns the folder from the active ChatThread
//   - Returns `undefined` when no chat is active (panels fall
//     back to engine root, which is still a useful default)
// ──────────────────────────────────────────────────────────

import { useWorkspace } from "../zeros/store/store";

export function useChatCwd(): string | undefined {
  const { state } = useWorkspace();
  const chat = state.chats.find((c) => c.id === state.activeChatId);
  return chat?.folder || undefined;
}
