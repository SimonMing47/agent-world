"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type DevelopmentAccessSetting = {
  enabled: boolean;
  autoEnter: boolean;
  name: string;
  email: string;
  title: string;
};

export function DevelopmentAccessSettingsForm({
  setting,
}: {
  setting: DevelopmentAccessSetting;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [form, setForm] = useState(setting);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function save() {
    setMessage(null);
    try {
      const response = await fetch("/api/system-settings/development-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error ?? "developmentAccess.errors.saveFailed");
      }
      setMessage("developmentAccess.settings.saved");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "developmentAccess.errors.saveFailed");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
          />
          {text("developmentAccess.settings.fields.enabled")}
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--ink-muted)]">
          <input
            type="checkbox"
            checked={form.autoEnter}
            onChange={(event) => setForm((current) => ({ ...current, autoEnter: event.target.checked }))}
          />
          {text("developmentAccess.settings.fields.autoEnter")}
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <FieldGroup label="developmentAccess.settings.fields.name">
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </FieldGroup>
          <FieldGroup label="developmentAccess.settings.fields.email">
            <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </FieldGroup>
        </div>

        <FieldGroup label="developmentAccess.settings.fields.title">
          <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </FieldGroup>

        {message ? <div className="text-sm text-[var(--ink-muted)]">{text(message, message)}</div> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" onClick={save} disabled={isPending}>
            {isPending ? "ui.generated.ca032e8fdda" : "ui.generated.c9152e440ee"}
          </Button>
        </div>
      </div>

      <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-subtle)] px-5 py-5">
        <div className="text-sm font-semibold text-[var(--ink)]">{text("developmentAccess.settings.previewTitle")}</div>
        <div className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          {text("developmentAccess.settings.previewDescription")}
        </div>
        <div className="mt-4 space-y-2 text-sm text-[var(--ink-muted)]">
          <div><span className="font-medium text-[var(--ink)]">{text("developmentAccess.settings.preview.name")}</span> {form.name}</div>
          <div><span className="font-medium text-[var(--ink)]">{text("developmentAccess.settings.preview.email")}</span> {form.email}</div>
          <div><span className="font-medium text-[var(--ink)]">{text("developmentAccess.settings.preview.role")}</span> {form.title}</div>
        </div>
      </div>
    </div>
  );
}
