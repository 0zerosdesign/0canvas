"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useCallback, useEffect } from "react";

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function TipTapEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level features — inline only
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content,
    editorProps: {
      attributes: {
        class: "oai-tiptap-content",
        "data-placeholder": placeholder || "Write description...",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  // Sync external content changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const toggle = useCallback(
    (mark: string) => {
      if (!editor) return;
      switch (mark) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "underline":
          editor.chain().focus().toggleUnderline().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div className="oai-tiptap">
      <div className="oai-tiptap-toolbar">
        <button
          type="button"
          className={`oai-tiptap-toolbar__btn ${editor.isActive("bold") ? "oai-tiptap-toolbar__btn--active" : ""}`}
          onClick={() => toggle("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`oai-tiptap-toolbar__btn ${editor.isActive("italic") ? "oai-tiptap-toolbar__btn--active" : ""}`}
          onClick={() => toggle("italic")}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`oai-tiptap-toolbar__btn ${editor.isActive("underline") ? "oai-tiptap-toolbar__btn--active" : ""}`}
          onClick={() => toggle("underline")}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          className={`oai-tiptap-toolbar__btn ${editor.isActive("strike") ? "oai-tiptap-toolbar__btn--active" : ""}`}
          onClick={() => toggle("strike")}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
