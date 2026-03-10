"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmModalWithInputProps {
  open: boolean;
  title: string;
  description: string;
  confirmPhrase: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmModalWithInput({
  open,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = true,
}: ConfirmModalWithInputProps) {
  const [input, setInput] = useState("");

  if (!open) return null;

  const matches = input.toLowerCase() === confirmPhrase.toLowerCase();

  function handleCancel() {
    setInput("");
    onCancel();
  }

  function handleConfirm() {
    if (!matches) return;
    setInput("");
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleCancel}
      />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
        <div className="mt-4">
          <label className="text-sm text-muted-foreground">
            Type &quot;{confirmPhrase}&quot; to confirm
          </label>
          <Input
            className="mt-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) handleConfirm();
            }}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!matches}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
