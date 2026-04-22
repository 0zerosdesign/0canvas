// ──────────────────────────────────────────────────────────
// Color Editor — Visual color editor wired to the bridge
// ──────────────────────────────────────────────────────────
//
// Wraps the existing ColorPicker and adds:
//   - Bridge integration (sends STYLE_CHANGE on color change)
//   - Local inline style application (instant feedback)
//   - Connection status indicator
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { ColorPicker } from "../themes/color-picker";
import { useStyleChange } from "../bridge/use-bridge";
import { useWorkspace } from "../store/store";
import { applyStyle } from "../inspector";
import { Button } from "../ui";

interface ColorEditorProps {
  elementId: string;
  selector: string;
  property: string;
  value: string;
  onClose: () => void;
}

export function ColorEditor({
  elementId,
  selector,
  property,
  value,
  onClose,
}: ColorEditorProps) {
  const { dispatch } = useWorkspace();
  const sendStyleChange = useStyleChange();
  const [writeStatus, setWriteStatus] = useState<"idle" | "writing" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValueRef = useRef(value);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (newValue: string) => {
      lastValueRef.current = newValue;

      // 1. Instant local feedback — apply inline style to DOM element
      dispatch({ type: "UPDATE_STYLE", elementId, property, value: newValue });
      applyStyle(elementId, property, newValue);

      // 2. Debounced bridge send (300ms) — only send to extension on pause
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setWriteStatus("writing");
        const kebabProp = property.replace(/([A-Z])/g, "-$1").toLowerCase();
        const result = await sendStyleChange(selector, kebabProp, newValue, value);

        if (result?.success) {
          setWriteStatus("success");
          setTimeout(() => setWriteStatus("idle"), 2000);
        } else if (result) {
          setWriteStatus("error");
          setErrorMsg(result.error ?? "Write failed");
        } else {
          // Bridge not connected — local-only edit
          setWriteStatus("idle");
        }
      }, 300);
    },
    [elementId, selector, property, value, dispatch, sendStyleChange]
  );

  const formatProperty = (prop: string) =>
    prop.replace(/([A-Z])/g, "-$1").toLowerCase();

  return (
    <div className="oc-color-editor" data-Zeros="color-editor">
      {/* Header */}
      <div className="oc-color-editor-header">
        <span className="oc-color-editor-label">{formatProperty(property)}</span>
        <div className="oc-color-editor-status">
          {writeStatus === "writing" && (
            <span className="oc-color-editor-badge oc-badge-writing">saving...</span>
          )}
          {writeStatus === "success" && (
            <Check size={12} className="oc-color-editor-icon oc-icon-success" />
          )}
          {writeStatus === "error" && (
            <span className="oc-color-editor-badge oc-badge-error" title={errorMsg}>
              <AlertCircle size={12} />
            </span>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onClose} title="Close">
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Color picker */}
      <ColorPicker
        value={lastValueRef.current}
        tokenName={formatProperty(property)}
        onChange={handleChange}
        onClose={onClose}
      />
    </div>
  );
}
