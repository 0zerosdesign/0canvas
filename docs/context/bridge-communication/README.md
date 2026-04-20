# WebSocket Bridge Communication

> **🚧 Partially stale (2026-04-20).** The engine ↔ webview WebSocket
> described here is still current (Col 3 uses it). Two changes since
> this was written:
> 1. The engine is now launched by `src-tauri/src/sidecar.rs`, not by
>    `src/vite-plugin.ts`. Port discovery goes through the Tauri
>    command `get_engine_port`.
> 2. Col 2 chat does NOT go through this WebSocket; it uses
>    `ai_cli.rs` (subprocess) or `anthropic.ts` / `openai.ts` (direct
>    HTTPS). The WebSocket is engine-specific.
>
> See [../README.md](../README.md).

---

> `src/0canvas/bridge/messages.ts` -- message types
> `src/0canvas/bridge/ws-client.ts` -- browser WebSocket client
> `src/0canvas/bridge/use-bridge.tsx` -- React hooks
> `src/vite-plugin.ts` -- WebSocket server in Vite plugin

The WebSocket bridge is the real-time communication layer between the browser overlay, the Vite dev server, and the VS Code extension. It enables live CSS editing, source map resolution, project file sync, Tailwind class editing, and AI agent dispatch.

---

## Architecture

```
Browser (0canvas overlay)           VS Code Extension
     |                                    |
     |  WebSocket (ws://localhost:PORT/__0canvas)
     |                                    |
     +-------> Vite Plugin (relay) <------+
               (WebSocketServer)
```

**Three participants:**
- **Browser** (`source: "browser"`) -- the 0canvas design overlay running in the user's app
- **Vite Plugin** (`source: "vite"`) -- the WebSocket relay server running inside Vite's dev server
- **VS Code Extension** (`source: "extension"`) -- the editor-side client that reads/writes source files

The Vite plugin acts as a **relay**: it does not process messages itself (except CONNECTED/peer management). It forwards browser messages to the extension and extension messages to the browser.

---

## All Message Types

Every message extends `BaseMessage`:
```typescript
interface BaseMessage {
  id: string;           // UUID or timestamp-based unique ID
  source: MessageSource; // "browser" | "extension" | "vite"
  timestamp: number;    // Date.now()
}
```

### Browser -> Extension

| Type | Interface | Purpose | Key Fields |
|------|-----------|---------|------------|
| `STYLE_CHANGE` | `StyleChangeMessage` | Request a CSS property change in source files | `selector`, `property`, `value`, `previousValue?` |
| `REQUEST_SOURCE_MAP` | `RequestSourceMapMessage` | Ask where a selector+property lives on disk | `selector`, `property` |
| `ELEMENT_SELECTED` | `ElementSelectedMessage` | Notify that the user selected an element | `selector`, `tagName`, `className`, `computedStyles` |
| `PROJECT_STATE_SYNC` | `ProjectStateSyncMessage` | Save the current .0c project state to disk | `projectFile` (JSON string), `filePath?` |
| `TAILWIND_CLASS_CHANGE` | `TailwindClassChangeMessage` | Add or remove a Tailwind class in JSX source | `selector`, `action` ("add"/"remove"), `className` |
| `AI_CHAT_REQUEST` | `AIChatRequestMessage` | Send a design request to the IDE's AI agent | `query`, `selector?`, `styles?`, `route?` |

### Extension -> Browser

| Type | Interface | Purpose | Key Fields |
|------|-----------|---------|------------|
| `STYLE_CHANGE_ACK` | `StyleChangeAckMessage` | Acknowledge a style change (success/failure) | `requestId`, `success`, `file?`, `line?`, `error?` |
| `SOURCE_MAP_RESULT` | `SourceMapResultMessage` | Return the source file location for a selector | `requestId`, `selector`, `file`, `line`, `column?` |
| `PROJECT_STATE_LOADED` | `ProjectStateLoadedMessage` | Send a .0c file's contents to the browser | `projectFile` (JSON string), `filePath` |
| `AI_CHAT_RESPONSE` | `AIChatResponseMessage` | Return the AI agent's response | `requestId`, `success`, `message`, `filesChanged?` |

### Connection Management

| Type | Interface | Purpose | Key Fields |
|------|-----------|---------|------------|
| `CONNECTED` | `ConnectedMessage` | Client announces itself on connect | `role`, `capabilities` (e.g., "style-edit", "css-write") |
| `PEER_CONNECTED` | `PeerConnectedMessage` | Vite notifies about a new peer | `role` |
| `PEER_DISCONNECTED` | `PeerDisconnectedMessage` | Vite notifies about a peer leaving | `role` |
| `HEARTBEAT` | `HeartbeatMessage` | Keep-alive (no extra fields) | -- |
| `ERROR` | `ErrorMessage` | Error notification | `code`, `message`, `requestId?` |

### Helper Functions

- `createMessageId()` -- generates a UUID via `crypto.randomUUID()` (browser) or `Date.now()-random` (fallback)
- `createMessage<T>(msg)` -- stamps a message with `id` and `timestamp`

---

## The Vite Plugin

> `src/vite-plugin.ts`

### Setup

```typescript
import { zeroCanvas } from "@zerosdesign/0canvas/vite";
export default defineConfig({
  plugins: [react(), zeroCanvas()],
});
```

### WebSocket Server

- Creates a `WebSocketServer` with `noServer: true` (piggybacks on Vite's HTTP server)
- Intercepts HTTP `upgrade` requests at path `/__0canvas` (configurable via `wsPath` option)
- Handles both immediate and deferred `httpServer` availability (polls every 50ms up to 10s)

### Relay Logic

The `relay()` function:
1. Parses the incoming JSON message
2. Determines the sender's role from the `ClientInfo` map (or from `msg.source`)
3. Forwards: browser -> extension, extension -> browser
4. Does NOT relay between same-role clients
5. Does NOT relay `CONNECTED` messages (those are handled separately for peer management)

### Peer Management

When a client sends `CONNECTED`:
1. Store its role and capabilities in the `clients` Map
2. Send `PEER_CONNECTED` to all OTHER connected clients
3. Send `PEER_CONNECTED` for each already-connected peer back to THIS client

When a client disconnects:
1. Remove from the `clients` Map
2. Send `PEER_DISCONNECTED` to all remaining clients

### Port File (`.0canvas/.port`)

On server start:
1. Creates `.0canvas/` directory in the project root if it does not exist
2. Writes the Vite dev server's port number to `.0canvas/.port`
3. The VS Code extension watches this file to auto-discover the WebSocket URL

On `buildEnd`:
- Deletes the `.port` file (cleanup)

---

## Browser Client

> `src/0canvas/bridge/ws-client.ts`

### `CanvasBridgeClient` Class

The browser-side WebSocket client. Uses the browser's native `WebSocket` API (no npm dependencies).

### Connection

- Derives the WebSocket URL from the page's own origin: `ws[s]://{host}/__0canvas`
- On open, sends a `CONNECTED` message with `source: "browser"` and capabilities `["style-edit", "element-select"]`

### Auto-Reconnect

- On close, schedules a reconnect after **2 seconds**
- Only one reconnect timer at a time (prevents storms)
- Stops reconnecting when `dispose()` is called (sets `_disposed = true`)

### Status Tracking

Three states: `"disconnected"`, `"connecting"`, `"connected"`
- Status changes notify all registered listeners via `onStatusChange(cb)`
- `status` getter for current state

### Extension Connection Tracking

- Tracks `_extensionConnected` boolean based on `PEER_CONNECTED`/`PEER_DISCONNECTED` messages with `role === "extension"`
- Exposed via `extensionConnected` getter

### Message Handling

**Fire-and-forget:** `send(msg)` -- JSON-serializes and sends. Auto-stamps with `id`, `source: "browser"`, `timestamp`.

**Request-response:** `request<T>(msg, timeoutMs?)` -- sends a message, stores a pending promise keyed by message `id`, and resolves when a response with matching `requestId` arrives. Default timeout: 5 seconds. Rejects on timeout.

**Type-based subscriptions:** `on(type, handler)` -- registers a handler for a specific message type. Returns an unsubscribe function. Multiple handlers per type are supported.

### Pending Request Correlation

When a message arrives with a `requestId` field:
1. Check if `pendingRequests` has an entry for that `requestId`
2. If yes: clear the timeout, delete the entry, resolve the promise with the message
3. Then notify type-based listeners as normal

### Disposal

`dispose()`:
- Sets `_disposed = true`
- Clears reconnect timer
- Rejects all pending requests with "Bridge disposed"
- Clears all handler maps and status listeners
- Closes the WebSocket

---

## React Hooks

> `src/0canvas/bridge/use-bridge.tsx`

### `BridgeProvider`

A React context provider that mounts at the engine root.

- Creates a single `CanvasBridgeClient` instance on mount
- Calls `client.connect()` immediately
- Disposes the client on unmount
- Uses a `forceUpdate` trick to re-render children after the client is created (since `useRef` does not trigger re-renders)

### `useBridge(): CanvasBridgeClient | null`

Returns the bridge client from context. May be `null` during the initial render (before the `useEffect` fires and `forceUpdate` runs).

### `useBridgeStatus(): ConnectionStatus`

Reactive hook that tracks the bridge's connection status.
- Initializes from `bridge.status`
- Subscribes to `bridge.onStatusChange()` in a `useEffect`
- Returns `"disconnected"` | `"connecting"` | `"connected"`

### `useExtensionConnected(): boolean`

Reactive hook that tracks whether the VS Code extension is connected.
- Subscribes to `PEER_CONNECTED` and `PEER_DISCONNECTED` events
- Checks `bridge.extensionConnected` for initial state
- Returns `true` when extension is connected

### `useStyleChange(): (selector, property, value, previousValue?) => Promise<StyleChangeAckMessage | null>`

Returns a callback function that:
1. Checks bridge is connected
2. Sends a `STYLE_CHANGE` message via `bridge.request()` (awaits correlated ACK)
3. Returns the `StyleChangeAckMessage` on success, or `null` on error/disconnection

This is used by the style panel to send CSS changes to the extension for file write.

---

## Message Flow Examples

### Style Change (Browser -> Extension -> Browser)

```
1. User drags a slider in the style panel
2. Browser calls useStyleChange() -> bridge.request({ type: "STYLE_CHANGE", ... })
3. Vite plugin relays to extension
4. Extension's style handler:
   a. CSSSourceResolver.resolve(selector, property) -> finds file + line
   b. CSSFileWriter.write(file, line, property, value) -> updates CSS file
   c. Sends STYLE_CHANGE_ACK { success, file, line }
5. Vite plugin relays ACK to browser
6. bridge.request() resolves with the ACK
7. Vite HMR detects the CSS file change -> browser hot-reloads
```

### Project State Sync (Browser -> Extension)

```
1. Browser dispatches PROJECT_STATE_SYNC with serialized .0c JSON
2. Extension receives, writes to disk (workspace root + filePath)
3. No ACK -- fire-and-forget
```

### Project State Load (Extension -> Browser on connect)

```
1. Browser connects and sends CONNECTED { role: "browser" }
2. Vite sends PEER_CONNECTED { role: "browser" } to extension
3. Extension finds all *.0c files in workspace
4. For each valid .0c file, sends PROJECT_STATE_LOADED with contents
5. Browser loads the project state
```

### AI Chat via IDE Agent (Browser -> Extension -> IDE -> Extension -> Browser)

```
1. Browser sends AI_CHAT_REQUEST { query, selector, styles, route }
2. Extension builds rich markdown context (ai-context.ts)
3. Extension writes context to .0canvas/ai-request.md
4. Extension opens IDE chat (Cursor/Copilot/Claude Code) with direct prompt
5. Agent processes the request and modifies source files
6. Extension sends AI_CHAT_RESPONSE { success, message }
7. Browser shows response in AI chat panel with diff view
```

---

## Connection Lifecycle

```
1. Vite dev server starts -> Vite plugin creates WebSocketServer at /__0canvas
2. Vite plugin writes port to .0canvas/.port
3. VS Code extension detects .port file (filesystem watcher or polling)
4. Extension connects: ws://localhost:{port}/__0canvas
5. Extension sends CONNECTED { role: "extension", capabilities: ["css-write", "source-resolve"] }
6. Vite sends PEER_CONNECTED { role: "extension" } (no recipients yet)
7. User opens browser -> page loads -> 0canvas overlay initializes
8. Browser connects: ws[s]://{host}/__0canvas
9. Browser sends CONNECTED { role: "browser", capabilities: ["style-edit", "element-select"] }
10. Vite sends PEER_CONNECTED { role: "browser" } to extension
11. Vite sends PEER_CONNECTED { role: "extension" } to browser
12. Extension receives PEER_CONNECTED(browser) -> sends all .0c files
13. Both sides are now live -- messages relay freely
```

### Reconnection

- **Browser:** auto-reconnects every 2 seconds on disconnect
- **Extension:** auto-reconnects every 2 seconds + polls `.port` file every 10 seconds as fallback
- **Port file deletion** triggers extension disconnect

---

## File Dependencies

| File | Role |
|------|------|
| `src/0canvas/bridge/messages.ts` | Shared message type definitions + helpers (browser side) |
| `src/0canvas/bridge/ws-client.ts` | Browser WebSocket client class |
| `src/0canvas/bridge/use-bridge.tsx` | React context provider and hooks |
| `src/vite-plugin.ts` | Vite plugin with WebSocket relay server |
| `extensions/vscode/src/messages.ts` | Mirror of message types (extension side, kept in sync) |
| `extensions/vscode/src/websocket-client.ts` | Extension WebSocket client class |
