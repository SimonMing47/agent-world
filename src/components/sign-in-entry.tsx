"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Building2, ChevronDown } from "lucide-react";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ProviderOption = {
  id: string;
  name: string;
  adapterKey: string;
};

type TeamOption = {
  id: string;
  name: string;
};

type SignInField = "name" | "email";

function UnderlineField({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">{label}</div>
      {children}
      <div
        className={cn(
          "min-h-[18px] text-[12px] leading-5 transition-opacity",
          error ? "text-[#ff8a8a] opacity-100" : "opacity-0",
        )}
      >
        {error || "."}
      </div>
    </div>
  );
}

export function SignInEntry({
  providers,
  teams,
  developmentAccess,
}: {
  providers: ProviderOption[];
  teams: TeamOption[];
  developmentAccess: {
    enabled: boolean;
    autoEnter: boolean;
    name: string;
    email: string;
    title: string;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = useLanguageText();
  const next = searchParams.get("next") || "/overview";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignInField, string>>>({});
  const hasAutoEnteredRef = useRef(false);
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

  const updateField = useCallback(
    (field: keyof typeof form, value: string | boolean | string[]) => {
      setForm((current) => ({ ...current, [field]: value }));
      if (field === "name" || field === "email") {
        setFieldErrors((current) => ({ ...current, [field]: undefined }));
      }
      setFormMessage(null);
    },
    [],
  );

  const enterDevelopmentMode = useCallback(async () => {
    setIsDevSubmitting(true);
    setDevMessage(null);
    try {
      const response = await fetch("/api/auth/dev-mode-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "developmentAccess.errors.failed");
      }
      router.push(next);
      router.refresh();
    } catch (error) {
      setDevMessage(error instanceof Error ? error.message : "developmentAccess.errors.failed");
    } finally {
      setIsDevSubmitting(false);
    }
  }, [next, router]);

  useEffect(() => {
    if (developmentAccess.enabled && developmentAccess.autoEnter && !hasAutoEnteredRef.current) {
      hasAutoEnteredRef.current = true;
      void enterDevelopmentMode();
    }
  }, [developmentAccess.autoEnter, developmentAccess.enabled, enterDevelopmentMode]);

  async function submit() {
    const nextErrors: Partial<Record<SignInField, string>> = {};
    if (!form.name.trim()) nextErrors.name = "identityAccess.signIn.errors.nameRequired";
    if (!form.email.trim()) nextErrors.email = "identityAccess.signIn.errors.emailRequired";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormMessage(null);
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);
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
      setFormMessage(error instanceof Error ? error.message : "identityAccess.signIn.errors.failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <div className="mx-auto max-w-[1180px]">
        <div className="max-w-[760px]">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] backdrop-blur-xl">
              <AgentWorldLogo animated className="h-9 w-9 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/34">
                {text("landing.eyebrow")}
              </div>
              <div className="mt-2 text-[32px] font-semibold tracking-[-0.04em] text-white">
                {text("terminology.productName", "AgentWorld")}
              </div>
            </div>
          </div>

          <div className="mt-10">
            <div className="max-w-[10ch] text-[clamp(3rem,8vw,5.8rem)] font-semibold leading-[0.88] tracking-[-0.06em] text-white">
              {text("identityAccess.signIn.heroTitle")}
            </div>
            <p className="mt-5 max-w-[42rem] text-[15px] leading-8 text-white/52">
              {text("identityAccess.signIn.heroDescription")}
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 rounded-[36px] border border-white/10 bg-[rgba(7,10,16,0.58)] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-[28px] lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,0.82fr)] lg:p-5">
          <section className="relative overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-7 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.14),transparent_28%)]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  {text("developmentAccess.entry.label")}
                </div>
                <div className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.04em] text-white">
                  {text("developmentAccess.entry.title")}
                </div>
                <p className="mt-3 max-w-[28rem] text-sm leading-7 text-white/54">
                  {text("developmentAccess.entry.description")}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/68">
                    {providers.length
                      ? text("identityAccess.signIn.providerConfigured", undefined, { count: providers.length })
                      : text("identityAccess.signIn.providerEmpty")}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/68">
                    {text("identityAccess.signIn.heroTag")}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {developmentAccess.enabled ? (
                  <Button
                    type="button"
                    size="lg"
                    className="h-12 rounded-full border-0 bg-[linear-gradient(135deg,#8B5CF6_0%,#4F46E5_45%,#06B6D4_100%)] px-6 text-white shadow-[0_18px_48px_rgba(79,70,229,0.36)] hover:opacity-95"
                    disabled={isDevSubmitting || isSubmitting}
                    onClick={enterDevelopmentMode}
                  >
                    {isDevSubmitting ? text("developmentAccess.entry.entering") : text("developmentAccess.entry.action")}
                  </Button>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-white/8 bg-black/18 px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
                      {text("developmentAccess.entry.identityLabel")}
                    </div>
                    <div className="mt-2 text-base font-medium text-white">{developmentAccess.name}</div>
                    <div className="mt-1 text-sm text-white/46">{developmentAccess.title}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-black/18 px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
                      {text("developmentAccess.entry.contactLabel")}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white/76">{developmentAccess.email}</div>
                    <div className="mt-1 text-sm text-white/46">{text("developmentAccess.entry.hint", undefined, { name: developmentAccess.name })}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-3">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-white/50 transition hover:text-white"
                  >
                    {text("identityAccess.signIn.backToWelcome")}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {devMessage ? <div className="text-right text-sm text-[#ff9aa5]">{text(devMessage, devMessage)}</div> : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-white/8 bg-[rgba(8,10,16,0.68)] p-7 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white/82">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-white">
                  {text("identityAccess.signIn.formTitle")}
                </div>
                <div className="text-sm text-white/42">{text("identityAccess.signIn.formDescription")}</div>
              </div>
            </div>

            <div className="mt-8 space-y-1">
              <UnderlineField label={text("identityAccess.signIn.fields.provider")}>
                <Select
                  value={form.providerConfigId}
                  onChange={(event) => updateField("providerConfigId", event.target.value)}
                  className="h-12 rounded-none border-0 border-b border-white/10 bg-transparent px-0 pr-10 text-base text-white shadow-none focus:border-[rgba(110,231,255,0.65)] focus:ring-0"
                >
                  <option value="builtin-development" className="bg-[#0c111b] text-white">
                    {text("identityAccess.signIn.builtinProvider")}
                  </option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id} className="bg-[#0c111b] text-white">
                      {provider.name}
                    </option>
                  ))}
                </Select>
              </UnderlineField>

              <UnderlineField
                label={text("identityAccess.signIn.fields.name")}
                error={fieldErrors.name ? text(fieldErrors.name, fieldErrors.name) : null}
              >
                <Input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={cn(
                    "h-12 rounded-none border-0 border-b bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/18 focus:ring-0",
                    fieldErrors.name
                      ? "border-[#ff6d85] focus:border-[#ff8797]"
                      : "border-white/10 focus:border-[rgba(110,231,255,0.65)]",
                  )}
                />
              </UnderlineField>

              <UnderlineField
                label={text("identityAccess.signIn.fields.email")}
                error={fieldErrors.email ? text(fieldErrors.email, fieldErrors.email) : null}
              >
                <Input
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={cn(
                    "h-12 rounded-none border-0 border-b bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/18 focus:ring-0",
                    fieldErrors.email
                      ? "border-[#ff6d85] focus:border-[#ff8797]"
                      : "border-white/10 focus:border-[rgba(110,231,255,0.65)]",
                  )}
                />
              </UnderlineField>
            </div>

            <div className="mt-6 rounded-[22px] border border-white/8 bg-white/[0.02]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setAdvancedOpen((current) => !current)}
              >
                <div>
                  <div className="text-sm font-medium text-white/82">{text("identityAccess.signIn.advanced.title")}</div>
                  <div className="mt-1 text-sm text-white/38">{text("identityAccess.signIn.advanced.description")}</div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/46 transition-transform",
                    advancedOpen && "rotate-180",
                  )}
                />
              </button>

              {advancedOpen ? (
                <div className="space-y-5 border-t border-white/8 px-5 py-5">
                  <UnderlineField label={text("identityAccess.signIn.fields.employeeNo")}>
                    <Input
                      value={form.employeeNo}
                      onChange={(event) => updateField("employeeNo", event.target.value)}
                      className="h-11 rounded-none border-0 border-b border-white/10 bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/18 focus:border-[rgba(110,231,255,0.65)] focus:ring-0"
                    />
                  </UnderlineField>

                  <UnderlineField label={text("identityAccess.signIn.fields.title")}>
                    <Input
                      value={form.title}
                      onChange={(event) => updateField("title", event.target.value)}
                      className="h-11 rounded-none border-0 border-b border-white/10 bg-transparent px-0 text-base text-white shadow-none placeholder:text-white/18 focus:border-[rgba(110,231,255,0.65)] focus:ring-0"
                    />
                  </UnderlineField>

                  <UnderlineField label={text("identityAccess.signIn.fields.primaryTeam")}>
                    <Select
                      value={form.primaryBusinessTeamId}
                      onChange={(event) => updateField("primaryBusinessTeamId", event.target.value)}
                      className="h-11 rounded-none border-0 border-b border-white/10 bg-transparent px-0 pr-10 text-base text-white shadow-none focus:border-[rgba(110,231,255,0.65)] focus:ring-0"
                    >
                      <option value="" className="bg-[#0c111b] text-white">
                        {text("identityAccess.signIn.noPrimaryTeam")}
                      </option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id} className="bg-[#0c111b] text-white">
                          {team.name}
                        </option>
                      ))}
                    </Select>
                  </UnderlineField>

                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
                      {text("identityAccess.signIn.teamMemberships")}
                    </div>
                    {teams.length ? (
                      <div className="grid gap-2">
                        {teams.map((team) => {
                          const checked = selectedTeams.has(team.id);
                          return (
                            <label
                              key={team.id}
                              className={cn(
                                "flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition",
                                checked
                                  ? "border-[rgba(110,231,255,0.22)] bg-[rgba(110,231,255,0.08)] text-white"
                                  : "border-white/8 bg-white/[0.02] text-white/56 hover:text-white/72",
                              )}
                            >
                              <span>{team.name}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  updateField(
                                    "businessTeamIds",
                                    event.target.checked
                                      ? [...form.businessTeamIds, team.id]
                                      : form.businessTeamIds.filter((id) => id !== team.id),
                                  )
                                }
                                className="h-4 w-4 accent-cyan-400"
                              />
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/38">
                        {text("identityAccess.signIn.noTeams")}
                      </div>
                    )}
                  </div>

                  <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/64">
                    <div>
                      <div className="font-medium text-white/78">{text("identityAccess.signIn.systemAdminToggle")}</div>
                      <div className="mt-1 text-xs text-white/38">{text("identityAccess.signIn.systemAdminHint")}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.isSystemAdmin}
                      onChange={(event) => updateField("isSystemAdmin", event.target.checked)}
                      className="h-4 w-4 accent-cyan-400"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <div className="min-h-[20px] text-sm text-white/42">
                {formMessage ? text(formMessage, formMessage) : text("identityAccess.signIn.footerHint")}
              </div>
              <Button
                type="button"
                size="lg"
                className="h-12 rounded-full border-0 bg-[linear-gradient(135deg,#8B5CF6_0%,#5B5CF6_42%,#06B6D4_100%)] px-6 text-white shadow-[0_20px_48px_rgba(59,130,246,0.28)] hover:opacity-95"
                disabled={isSubmitting}
                onClick={submit}
              >
                {isSubmitting ? text("identityAccess.signIn.submitting") : text("identityAccess.signIn.submit")}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
