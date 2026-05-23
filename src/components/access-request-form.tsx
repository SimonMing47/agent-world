"use client";

import { useState } from "react";
import { Mail, ShieldAlert } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AccessRequestForm({
  defaultName = "",
  defaultEmail = "",
  adminContactEmail,
  defaultBusinessTeamHint = "",
}: {
  defaultName?: string;
  defaultEmail?: string;
  adminContactEmail: string;
  defaultBusinessTeamHint?: string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const text = useLanguageText();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: defaultName,
    email: defaultEmail,
    requestedBusinessTeamHint: defaultBusinessTeamHint,
    requestNote: "",
  });

  async function submit() {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || "identityAccess.request.errors.failed");
      setMessage("identityAccess.request.success");
      setForm({ ...form, requestNote: "" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.request.errors.failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,250,0.98))] p-8 shadow-[var(--shadow-medium)] ring-1 ring-white/70">
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
          <ShieldAlert className="h-3.5 w-3.5" />
          Team Whitelist Required
        </div>
        <h1 className="mt-6 text-[clamp(2rem,4.2vw,3.2rem)] font-semibold leading-[0.96] text-[var(--ink)]">
          identityAccess.request.heroTitle
        </h1>
        <p className="mt-4 text-sm leading-8 text-[var(--ink-muted)]">
          identityAccess.request.heroDescription
        </p>
        <div className="mt-8 rounded-[22px] bg-white px-5 py-5 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
          <div className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
            <Mail className="h-4 w-4 text-[var(--accent)]" />
            identityAccess.request.contactTitle
          </div>
          <div className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
            {adminContactEmail ? text("identityAccess.request.contactEmail", undefined, { email: adminContactEmail }) : "identityAccess.request.contactEmpty"}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-[var(--shadow-medium)] ring-1 ring-black/4">
        <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.request.formTitle</div>
        <div className="mt-1 text-sm text-[var(--ink-muted)]">identityAccess.request.formDescription</div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FieldGroup label="identityAccess.request.fields.name">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.request.fields.email">
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.request.fields.teamHint" className="md:col-span-2">
            <Input
              value={form.requestedBusinessTeamHint}
              onChange={(event) => setForm({ ...form, requestedBusinessTeamHint: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="identityAccess.request.fields.note" className="md:col-span-2">
            <Textarea
              className="min-h-32"
              value={form.requestNote}
              onChange={(event) => setForm({ ...form, requestNote: event.target.value })}
            />
          </FieldGroup>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="text-sm text-[var(--ink-muted)]">{message ?? "identityAccess.request.footerHint"}</div>
          <Button type="button" variant="primary" size="lg" disabled={isSubmitting} onClick={submit}>
            {isSubmitting ? "identityAccess.request.submitting" : "identityAccess.request.submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
