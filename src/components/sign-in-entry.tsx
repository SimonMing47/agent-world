"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ProviderOption = {
  id: string;
  name: string;
  adapterKey: string;
};

type TeamOption = {
  id: string;
  name: string;
};

export function SignInEntry({
  providers,
  teams,
}: {
  providers: ProviderOption[];
  teams: TeamOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = useLanguageText();
  const next = searchParams.get("next") || "/overview";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    providerConfigId: "builtin-development",
    name: "",
    email: "",
    employeeNo: "",
    title: "",
    primaryBusinessTeamId: "",
    businessTeamIds: [] as string[],
    isSystemAdmin: false,
  });

  const selectedTeams = useMemo(() => new Set(form.businessTeamIds), [form.businessTeamIds]);

  async function submit() {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfigId: form.providerConfigId === "builtin-development" ? null : form.providerConfigId,
          name: form.name,
          email: form.email,
          employeeNo: form.employeeNo,
          title: form.title,
          primaryBusinessTeamId: form.primaryBusinessTeamId || null,
          businessTeamIds: form.businessTeamIds,
          isSystemAdmin: form.isSystemAdmin,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "identityAccess.signIn.errors.failed");
      }
      router.push(next);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.signIn.errors.failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,247,250,0.98))] p-8 shadow-[var(--shadow-medium)] ring-1 ring-white/70">
        <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(29,78,216,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Enterprise Access Layer
        </div>
        <h1 className="mt-6 text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[0.95] text-[var(--ink)]">
          identityAccess.signIn.heroTitle
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-8 text-[var(--ink-muted)]">
          identityAccess.signIn.heroDescription
        </p>
        <div className="mt-8 grid gap-3">
          <div className="rounded-[22px] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
              identityAccess.signIn.adapterTitle
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--ink-muted)]">
              <span className="rounded-full bg-[rgba(29,78,216,0.08)] px-3 py-1 text-[var(--accent)]">Development Preview</span>
              <span className="rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1">Generic OIDC</span>
              <span className="rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1">Assertion Bridge</span>
            </div>
          </div>
          <div className="rounded-[22px] bg-white px-5 py-4 shadow-[var(--shadow-soft)] ring-1 ring-black/4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
              identityAccess.signIn.providerTitle
            </div>
            <div className="mt-3 text-sm leading-7 text-[var(--ink-muted)]">
              {providers.length
                ? text("identityAccess.signIn.providerConfigured", undefined, { count: providers.length })
                : "identityAccess.signIn.providerEmpty"}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] bg-white p-8 shadow-[var(--shadow-medium)] ring-1 ring-black/4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[rgba(15,23,42,0.05)] text-[var(--ink)]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-[var(--ink)]">identityAccess.signIn.formTitle</div>
            <div className="text-sm text-[var(--ink-muted)]">identityAccess.signIn.formDescription</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FieldGroup label="identityAccess.signIn.fields.provider">
            <Select
              value={form.providerConfigId}
              onChange={(event) => setForm({ ...form, providerConfigId: event.target.value })}
            >
              <option value="builtin-development">identityAccess.signIn.builtinProvider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="identityAccess.signIn.fields.name">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.signIn.fields.email">
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.signIn.fields.employeeNo">
            <Input value={form.employeeNo} onChange={(event) => setForm({ ...form, employeeNo: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.signIn.fields.title">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </FieldGroup>
          <FieldGroup label="identityAccess.signIn.fields.primaryTeam">
            <Select
              value={form.primaryBusinessTeamId}
              onChange={(event) => setForm({ ...form, primaryBusinessTeamId: event.target.value })}
            >
              <option value="">identityAccess.signIn.noPrimaryTeam</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
            identityAccess.signIn.teamMemberships
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {teams.length ? (
              teams.map((team) => {
                const checked = selectedTeams.has(team.id);
                return (
                  <label
                    key={team.id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                      checked
                        ? "bg-[rgba(29,78,216,0.08)] text-[var(--ink)] ring-1 ring-[rgba(29,78,216,0.16)]"
                        : "bg-[rgba(15,23,42,0.03)] text-[var(--ink-muted)] ring-1 ring-black/4"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          businessTeamIds: event.target.checked
                            ? [...current.businessTeamIds, team.id]
                            : current.businessTeamIds.filter((id) => id !== team.id),
                        }))
                      }
                    />
                    <span>{team.name}</span>
                  </label>
                );
              })
            ) : (
              <div className="rounded-2xl bg-[rgba(15,23,42,0.03)] px-4 py-4 text-sm text-[var(--ink-muted)] ring-1 ring-black/4">
                identityAccess.signIn.noTeams
              </div>
            )}
          </div>
        </div>

        <label className="mt-5 flex items-center gap-3 rounded-2xl bg-[rgba(15,23,42,0.03)] px-4 py-3 text-sm text-[var(--ink-muted)] ring-1 ring-black/4">
          <input
            type="checkbox"
            checked={form.isSystemAdmin}
            onChange={(event) => setForm({ ...form, isSystemAdmin: event.target.checked })}
          />
          identityAccess.signIn.systemAdminToggle
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-[var(--ink-muted)]">
            {message ? message : "identityAccess.signIn.footerHint"}
          </div>
          <Button type="button" variant="primary" size="lg" disabled={isSubmitting} onClick={submit}>
            {isSubmitting ? "identityAccess.signIn.submitting" : "identityAccess.signIn.submit"}
          </Button>
        </div>
      </div>
    </div>
  );
}
