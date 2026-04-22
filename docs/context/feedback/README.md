# Feedback System

## Overview

The feedback system lets designers annotate elements in the live preview with comments, categorized by intent and severity. Feedback items are collected in a panel, can be copied to the clipboard as structured markdown for AI agents, and can optionally be auto-dispatched to a connected agent via the WebSocket bridge.

Key files:
- `src/zeros/store/store.tsx` -- FeedbackItem type, store actions, reducer
- `src/zeros/engine/zeros-engine.tsx` -- feedback panel UI, auto-send logic, feedback marker rendering
- `src/zeros/inspector/feedback-pill.ts` -- the floating annotation card that appears on click
- `src/zeros/canvas/source-node.tsx` -- registers feedback callbacks and renders markers

## FeedbackItem Structure

```typescript
type FeedbackIntent = "fix" | "change" | "question" | "approve";
type FeedbackSeverity = "blocking" | "important" | "suggestion";

type FeedbackItem = {
  id: string;                    // unique ID, e.g. "fb-1712000000-a1b2"
  variantId: string;             // ID of the active variant (or "" for source)
  elementId: string;             // internal element ID from the inspector
  elementSelector: string;       // CSS selector, e.g. "#hero" or "div.card"
  elementTag: string;            // tag name, e.g. "div", "button"
  elementClasses: string[];      // array of class names
  comment: string;               // the user's feedback text
  intent: FeedbackIntent;        // fix / change / question / approve
  severity: FeedbackSeverity;    // blocking / important / suggestion
  status: "pending" | "sent" | "resolved";
  timestamp: number;             // Date.now() when created
  computedStyles?: Record<string, string>;   // optional computed styles snapshot
  boundingBox?: { x: number; y: number; width: number; height: number };  // click position for marker placement
};
```

### Intent Values

| Intent     | Meaning                                    |
|------------|-------------------------------------------|
| `fix`      | Something is broken and needs fixing       |
| `change`   | Request a design or behavior change        |
| `question` | Asking for clarification                   |
| `approve`  | Marking an element as approved/correct     |

### Severity Values

| Severity    | Meaning                                   |
|-------------|-------------------------------------------|
| `blocking`  | Must be resolved before shipping           |
| `important` | Should be addressed but not a blocker      |
| `suggestion`| Nice-to-have improvement                   |

## Adding Feedback

### Step 1: Enter Feedback Mode

In the workspace toolbar, click the "Feedback" button (MessageCircle icon). This sets `designMode` to `"feedback"` in the store, which:
- Shows the feedback panel on the right side
- Switches the inspector to feedback mode via `setInspectMode("feedback")`

### Step 2: Click an Element

When the user clicks an element in the source iframe, the inspector system:
1. Highlights the element with a selection overlay
2. Calls `showInspectorPill(el, clickX, clickY)` to show the feedback pill

### Step 3: The Feedback Pill

The pill (`src/zeros/inspector/feedback-pill.ts`) is a floating card injected directly into the target document (the iframe). It contains three rows:

**Row 1 -- Header:**
- Component name badge (detected via `identifyElement()`) with a code icon
- Copy button -- copies the element's agent output (selector, HTML, styles) to clipboard
- Fork button -- triggers `onForkElementRequest` to fork the element into a variant

**Row 2 -- Textarea:**
- Placeholder: "Describe the change or Cmd+L to add to chat"
- Auto-resizes up to 120px height
- Enter (without Shift) submits the feedback
- Escape dismisses the pill

**Row 3 -- Action buttons:**
- Delete button (only shown when editing existing feedback on this element)
- Cancel button
- Add button -- submits the textarea content

### Step 4: Feedback is Created

When the user submits, the `onChangeRequest` callback fires in `source-node.tsx`:
1. Checks if feedback already exists for this element (by elementId + pending status)
2. If existing: updates the comment via `UPDATE_FEEDBACK`
3. If new: creates a `FeedbackItem` with:
   - Auto-generated ID (`fb-{timestamp}-{random}`)
   - Selector derived from element ID or tagName + first class
   - Default intent: `"change"`, default severity: `"suggestion"`
   - Click position stored as `boundingBox` for marker placement

### Edit Mode

When clicking a feedback marker or an element that already has feedback, the pill pre-fills the textarea with the existing comment. The delete button appears, allowing the user to remove that feedback item.

## Feedback Panel

When `designMode === "feedback"`, the right panel in the engine workspace shows the feedback list:

- **Header:** "Feedback" title with a count of pending items
- **Empty state:** "No feedback yet. Click elements in the preview to add annotations."
- **Item list:** each feedback item displays:
  - Color-coded intent badge (`data-intent` attribute for CSS styling)
  - Color-coded severity badge (`data-severity` attribute for CSS styling)
  - Element selector
  - Comment text

## Feedback Markers

Feedback markers are numbered circular pins rendered directly into the inspected document (the iframe). They are managed in `feedback-pill.ts`:

- **Appearance:** 22px circles with the primary blue color, white border, white number text
- **Positioning:** absolute, placed at the click position (`boundingBox.x`, `boundingBox.y`) adjusted for scroll offset
- **Hover:** transforms to scale(1.15), shows a pencil icon, tooltip shows the comment text
- **Click:** opens the feedback pill at the element's position with the existing comment pre-filled
- **Lifecycle:** markers are added/removed reactively as `feedbackItems` changes in the store. Stale markers (for removed items) are cleaned up automatically.

The rendering pipeline in `source-node.tsx`:
```
state.feedbackItems changes
  -> filter items with boundingBox and pending status
  -> map to { id, number, elementId, comment, boundingBox }
  -> renderFeedbackMarkers(markers)
```

## Sending Feedback

### Copy to Clipboard

The source node's chrome bar shows a Send button when pending feedback exists. Clicking it:

1. Filters feedback items with `status === "pending"`
2. Builds structured markdown:
   ```markdown
   # Zeros Feedback (N items)

   ## Feedback Items

   ### 1. .hero-section [CHANGE - SUGGESTION]
   - **Selector:** `.hero-section`
   - **Tag:** section | **Classes:** hero-section, full-width
   - **Feedback:** Make the heading larger and add more padding
   ```
3. Copies to clipboard via `navigator.clipboard.writeText()`
4. Marks all sent items as `status: "sent"` via `MARK_FEEDBACK_SENT`

### Send to Agent via Extension

The VS Code extension sidebar can trigger "Send Feedback to Agent" which:
1. Writes feedback to `.zeros/feedback.md` in the project root
2. Triggers the agent chat in the connected IDE

### Auto-Send Pipeline

In `zeros-engine.tsx`, when `aiSettings.autoSendFeedback` is enabled and a bridge connection exists:

1. The engine watches `feedbackItems` for newly added items (length increase)
2. For each new pending item, it sends an `AI_CHAT_REQUEST` message via the bridge:
   ```
   [Auto-feedback] {intent}: "{comment}" on {selector} ({severity})
   ```
3. A notification toast appears: "Feedback sent to agent: ..."
4. The notification auto-dismisses after 3 seconds

This toggle is configured in Settings > AI Settings > Feedback Pipeline > "Auto-send feedback to agent".

## Store Actions

| Action               | Effect                                                |
|----------------------|-------------------------------------------------------|
| `ADD_FEEDBACK`       | Appends a new FeedbackItem to the array               |
| `UPDATE_FEEDBACK`    | Patches an existing item by ID                        |
| `REMOVE_FEEDBACK`    | Removes an item by ID                                 |
| `CLEAR_FEEDBACK`     | Empties the entire feedback array                     |
| `MARK_FEEDBACK_SENT` | Sets status to "sent" for a list of IDs               |

## Format for Agents

When feedback is copied or sent, it follows a structured markdown format designed for AI agents:

```
### N. {selector} [{INTENT} - {SEVERITY}]
- **Selector:** `{selector}`
- **Tag:** {tag} | **Classes:** {classes}
- **Feedback:** {comment}
```

This gives the agent enough context to locate the element in code and understand the requested change.

## User Workflow

1. Click "Feedback" in the toolbar to enter feedback mode
2. Click any element in the live preview
3. The feedback pill appears -- type your comment
4. Press Enter or click "Add" to submit
5. A numbered marker appears on the element
6. Repeat for multiple elements
7. Review all items in the Feedback panel on the right
8. Click the Send button in the source node chrome to copy all feedback to clipboard
9. Paste into your AI agent (Claude Code, Cursor, etc.) to have the issues fixed
10. Or enable auto-send in Settings to have feedback dispatched automatically

## Pending Features

- **Visual markers on canvas overlay:** rendering markers at the canvas level (outside the iframe) for better visibility at all zoom levels
- **Batch operations:** select multiple feedback items to send, resolve, or delete at once
- **Feedback resolution tracking:** marking items as resolved when the agent has addressed them, with before/after comparison
- **Intent and severity editing:** currently defaults to change/suggestion; UI for selecting intent and severity in the pill is planned
- **Feedback threads:** reply chains on individual feedback items for back-and-forth discussion
