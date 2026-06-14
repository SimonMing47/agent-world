"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Verdict = "accurate" | "inaccurate" | "unclear";

const verdictOptions: Array<{ value: Verdict; label: string; icon: typeof CheckCircle2 }> = [
  { value: "accurate", label: "findingFeedback.form.verdictAccurate", icon: CheckCircle2 },
  { value: "inaccurate", label: "findingFeedback.form.verdictInaccurate", icon: XCircle },
  { value: "unclear", label: "findingFeedback.form.verdictUnclear", icon: HelpCircle },
];

export function FindingFeedbackForm({
  token,
  defaultVerdict = "unclear",
  defaultNote = "",
}: {
  token: string;
  defaultVerdict?: Verdict;
  defaultNote?: string;
}) {
  const text = useLanguageText();
  const [verdict, setVerdict] = useState<Verdict>(defaultVerdict);
  const [note, setNote] = useState(defaultNote);
  const [writeKnowledge, setWriteKnowledge] = useState(true);
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "failed">("idle");
  const [message, setMessage] = useState("");

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    const response = await fetch(`/api/finding-feedback/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verdict,
        note,
        writeKnowledge,
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const payload = response ? ((await response.json().catch(() => null)) as { error?: string } | null) : null;
      setStatus("failed");
      setMessage(payload?.error ?? text("findingFeedback.form.submitFailed"));
      return;
    }

    setStatus("submitted");
    setMessage(text("findingFeedback.form.submitSuccess"));
  }

  return (
    <form className="space-y-5" onSubmit={submitFeedback}>
      <div className="grid gap-2 sm:grid-cols-3">
        {verdictOptions.map((option) => {
          const Icon = option.icon;
          const selected = verdict === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`flex min-h-11 items-center justify-center gap-2 border px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "border-[var(--line)] bg-white text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
              onClick={() => setVerdict(option.value)}
            >
              <Icon className="h-4 w-4" />
              {text(option.label)}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-[var(--ink)]">{text("findingFeedback.form.noteLabel")}</span>
        <Textarea
          className="mt-2 min-h-28"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="findingFeedback.form.notePlaceholder"
        />
      </label>

      <label className="flex items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--ink-muted)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={writeKnowledge}
          onChange={(event) => setWriteKnowledge(event.target.checked)}
        />
        <span>{text("findingFeedback.form.writeKnowledge")}</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={status === "submitting"}>
          {status === "submitting" ? "findingFeedback.form.submitting" : "findingFeedback.form.submit"}
        </Button>
        {message ? (
          <span
            className={`text-sm ${
              status === "failed" ? "text-[var(--danger)]" : "text-[#166534]"
            }`}
          >
            {text(message, message)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
