"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";

interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  singleLine?: boolean;
  className?: string;
}

export function TemplateEditor({
  value,
  onChange,
  placeholder = "Type your template...",
  singleLine = false,
  className = "",
}: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable block-level features for single-line mode
        heading: singleLine ? false : undefined,
        bulletList: singleLine ? false : undefined,
        orderedList: singleLine ? false : undefined,
        blockquote: singleLine ? false : undefined,
        codeBlock: singleLine ? false : undefined,
        horizontalRule: singleLine ? false : undefined,
        hardBreak: singleLine ? false : { keepMarks: true },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getText());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none ${singleLine ? "min-h-[36px] py-2" : "min-h-[80px] py-3"} px-3 ${className}`,
      },
      handleKeyDown: singleLine
        ? (view, event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              return true;
            }
            return false;
          }
        : undefined,
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <div className={`border rounded-md bg-background ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}

interface VariablePickerProps {
  variables: TemplateVariable[];
  onInsert: (variableName: string) => void;
}

export function VariablePicker({ variables, onInsert }: VariablePickerProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground mb-2">Available Variables</p>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <button
            key={v.name}
            onClick={() => onInsert(v.name)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
            title={`${v.description} (e.g. ${v.example})`}
          >
            {`{{${v.name}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TemplatePreviewProps {
  title: string;
  body: string;
}

export function TemplatePreview({ title, body }: TemplatePreviewProps) {
  return (
    <div className="rounded-md border bg-muted/30 p-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Preview</p>
      <div className="space-y-1">
        <p className="font-medium text-sm">{title || "(empty title)"}</p>
        <p className="text-sm text-muted-foreground">{body || "(empty body)"}</p>
      </div>
    </div>
  );
}
