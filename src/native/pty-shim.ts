// ──────────────────────────────────────────────────────────
// Renderer-side PTY shim — native-shell-compatible interface
// backed by Electron IPC (electron/ipc/commands/pty.ts).
// ──────────────────────────────────────────────────────────
//
// Exposes a `spawn()` function with the same shape the old PTY shim's
// default export uses, so terminal-panel.tsx can pick one at
// runtime without restructuring the lifecycle hooks:
//
//   const pty = spawn("/bin/zsh", ["-l"], { cols, rows, cwd });
//   const sub = pty.onData((d) => term.write(d));
//   pty.write("ls\n");
//   pty.resize(cols, rows);
//   pty.kill();
//   sub.dispose();
//
// Every call is async under the hood (IPC round-trip), but the
// returned object resolves lazily — writes/resizes queue until
// the underlying session id arrives, matching the synchronous
// feel of the previous PTY API.
// ──────────────────────────────────────────────────────────

import { nativeInvoke, nativeListen } from "./runtime";

export interface IPtyShim {
  onData: (cb: (data: string) => void) => { dispose: () => void };
  onExit: (
    cb: (r: { exitCode: number; signal: string | null }) => void,
  ) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

interface SpawnOptions {
  name?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export function spawn(
  shell: string,
  args: string[],
  opts: SpawnOptions = {},
): IPtyShim {
  // Session id resolves once pty_spawn completes. Until then, any
  // write/resize/kill gets queued and flushed in order.
  let resolveSid!: (id: string) => void;
  let rejectSid!: (err: unknown) => void;
  const sidPromise = new Promise<string>((resolve, reject) => {
    resolveSid = resolve;
    rejectSid = reject;
  });

  const dataSubs = new Set<(data: string) => void>();
  const exitSubs = new Set<
    (r: { exitCode: number; signal: string | null }) => void
  >();

  // Subscribe to main-process event streams BEFORE spawning — if
  // the first byte arrives between pty_spawn completion and this
  // registration, we'd lose it (low probability, but deterministic
  // to avoid entirely).
  let myId: string | null = null;
  let dataUnlisten: (() => void) | null = null;
  let exitUnlisten: (() => void) | null = null;

  void (async () => {
    dataUnlisten = await nativeListen<{ sessionId: string; data: string }>(
      "pty-data",
      (p) => {
        if (myId !== null && p.sessionId === myId) {
          for (const cb of dataSubs) cb(p.data);
        }
      },
    );
    exitUnlisten = await nativeListen<{
      sessionId: string;
      exitCode: number;
      signal: string | null;
    }>("pty-exit", (p) => {
      if (myId !== null && p.sessionId === myId) {
        for (const cb of exitSubs) cb({ exitCode: p.exitCode, signal: p.signal });
      }
    });
  })();

  // Fire the spawn request.
  void (async () => {
    try {
      const result = await nativeInvoke<{ sessionId: string; pid: number }>(
        "pty_spawn",
        {
          shell,
          args,
          cols: opts.cols,
          rows: opts.rows,
          cwd: opts.cwd,
          env: opts.env,
        },
      );
      myId = result.sessionId;
      resolveSid(result.sessionId);
    } catch (err) {
      rejectSid(err);
    }
  })();

  return {
    onData(cb) {
      dataSubs.add(cb);
      return {
        dispose() {
          dataSubs.delete(cb);
        },
      };
    },
    onExit(cb) {
      exitSubs.add(cb);
      return {
        dispose() {
          exitSubs.delete(cb);
        },
      };
    },
    write(data) {
      void sidPromise
        .then((sid) => nativeInvoke("pty_write", { sessionId: sid, data }))
        .catch(() => {
          /* session already exited; writes are no-ops */
        });
    },
    resize(cols, rows) {
      void sidPromise
        .then((sid) => nativeInvoke("pty_resize", { sessionId: sid, cols, rows }))
        .catch(() => {
          /* idempotent — resize after exit is ignored main-side too */
        });
    },
    kill() {
      void sidPromise
        .then((sid) => nativeInvoke("pty_kill", { sessionId: sid }))
        .catch(() => {
          /* already dead */
        })
        .finally(() => {
          dataUnlisten?.();
          exitUnlisten?.();
          dataSubs.clear();
          exitSubs.clear();
        });
    },
  };
}
