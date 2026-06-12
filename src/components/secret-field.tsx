"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function maskSecretValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}••••••••${trimmed.slice(-4)}`;
}

export function isEnvSecretReference(value: string) {
  return value.trim().toLowerCase().startsWith("env:");
}

export function editableSecretValue(value: string) {
  return isEnvSecretReference(value) ? "" : value;
}

export function SecretInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [draftValue, setDraftValue] = useState("");
  const [hasEdited, setHasEdited] = useState(false);
  const text = useLanguageText();
  const hasSavedValue = value.trim().length > 0 && !hasEdited;

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        className="font-mono"
        type={visible ? "text" : "password"}
        value={hasEdited ? draftValue : ""}
        onChange={(event) => {
          setHasEdited(true);
          setDraftValue(event.target.value);
          onChange(event.target.value);
        }}
        placeholder={hasSavedValue ? text("ui.common.secret.configuredPlaceholder") : placeholder}
        autoComplete="new-password"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-11 shrink-0 px-3"
        disabled={!hasEdited || !draftValue}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {visible ? text("ui.common.secret.hide") : text("ui.common.secret.show")}
      </Button>
    </div>
  );
}

export function SecretValue({
  value,
  emptyLabel = "ui.generated.c63595e95b7",
}: {
  value: string;
  emptyLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const text = useLanguageText();
  const trimmed = value.trim();

  if (!trimmed) return <span>{text(emptyLabel)}</span>;
  if (isEnvSecretReference(trimmed)) {
    return <span className="text-[var(--ink-muted)]">{text("ui.common.secret.legacyEnvReference")}</span>;
  }

  return (
    <span className="inline-flex max-w-full items-center gap-2 align-middle">
      <span className="min-w-0 break-all font-mono text-xs">
        {visible ? trimmed : maskSecretValue(trimmed)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {visible ? text("ui.common.secret.hide") : text("ui.common.secret.show")}
      </Button>
    </span>
  );
}
