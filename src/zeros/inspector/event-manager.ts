// ──────────────────────────────────────────────────────────
// EventManager — Tracks all addEventListener calls to prevent
// memory leaks from accumulated listeners.
// ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = ((e: any) => void) | EventListenerObject;

type ListenerEntry = {
  element: EventTarget;
  type: string;
  handler: AnyHandler;
  capture: boolean;
};

export class EventManager {
  private listeners: ListenerEntry[] = [];

  /** Register an event listener and track it for cleanup. */
  add(
    element: EventTarget,
    type: string,
    handler: AnyHandler,
    capture: boolean = false
  ): void {
    element.addEventListener(type, handler as EventListener, capture);
    this.listeners.push({ element, type, handler, capture });
  }

  /** Unregister a specific event listener and stop tracking it. */
  remove(
    element: EventTarget,
    type: string,
    handler: AnyHandler,
    capture: boolean = false
  ): void {
    element.removeEventListener(type, handler as EventListener, capture);
    this.listeners = this.listeners.filter(
      (l) =>
        !(
          l.element === element &&
          l.type === type &&
          l.handler === handler &&
          l.capture === capture
        )
    );
  }

  /** Remove ALL registered listeners — call on teardown. */
  cleanup(): void {
    for (const { element, type, handler, capture } of this.listeners) {
      try {
        element.removeEventListener(type, handler as EventListener, capture);
      } catch {
        /* element may have been removed from DOM */
      }
    }
    this.listeners = [];
  }
}
