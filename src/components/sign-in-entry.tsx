"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, LockKeyhole, Mail, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SignInSettings = {
  passwordLoginEnabled: boolean;
  registrationEnabled: boolean;
  ssoLoginEnabled: boolean;
  ssoPluginId: string;
  ssoButtonLabel: string;
  ssoButtonLogoUrl: string;
  ssoButtonHref: string;
};

type SsoPlugin = {
  id: string;
  name: string;
  mountPoint: string;
} | null;

type AuthSessionPayload = {
  authenticated?: boolean;
  context?: {
    mustChangePassword?: boolean;
  } | null;
};

const inputClass = "aw-auth-input pl-9";
const WORMHOLE_LINE_COUNT = 112;
const ENTER_NAVIGATION_DELAY_MS = 1180;
const REDUCED_MOTION_NAVIGATION_DELAY_MS = 80;

function getEnterNavigationDelay() {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return REDUCED_MOTION_NAVIGATION_DELAY_MS;
  }
  return ENTER_NAVIGATION_DELAY_MS;
}

function waitForEnterNavigation() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, getEnterNavigationDelay());
  });
}

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/overview";
  }
  return value;
}

function WormholeTransition() {
  return (
    <div className="aw-auth-wormhole" aria-hidden="true">
      <div className="aw-auth-wormhole__field" />
      <div className="aw-auth-wormhole__lines">
        {Array.from({ length: WORMHOLE_LINE_COUNT }, (_, index) => (
          <span key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

export function SignInEntry({
  settings,
  ssoPlugin,
}: {
  settings: SignInSettings;
  ssoPlugin: SsoPlugin;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = useLanguageText();
  const next = normalizeNextPath(searchParams.get("next"));
  const signInError = searchParams.get("error");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [hasCheckedExistingSession, setHasCheckedExistingSession] = useState(false);
  const canRegister = settings.passwordLoginEnabled && settings.registrationEnabled;
  const ssoHref = settings.ssoButtonHref.trim() || ssoPlugin?.mountPoint || "";
  const ssoLabel =
    ssoPlugin && settings.ssoButtonLabel === "identityAccess.signIn.sso.defaultLabel"
      ? ssoPlugin.name
      : text(settings.ssoButtonLabel, settings.ssoButtonLabel);

  function buildSsoHref() {
    if (!ssoHref) return "";
    try {
      const url = new URL(ssoHref, window.location.origin);
      url.searchParams.set("next", next);
      return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.toString();
    } catch {
      return ssoHref;
    }
  }

  useEffect(() => {
    router.prefetch(next);
    router.prefetch(`/change-password?next=${encodeURIComponent(next)}`);
  }, [next, router]);

  useEffect(() => {
    if (signInError) setMessage(signInError);
  }, [signInError]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/auth/session", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: AuthSessionPayload | null) => {
        if (controller.signal.aborted) {
          return;
        }
        if (payload?.authenticated) {
          const destination = payload.context?.mustChangePassword
            ? `/change-password?next=${encodeURIComponent(next)}`
            : next;
          window.location.replace(destination);
          return;
        }
        setHasCheckedExistingSession(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHasCheckedExistingSession(true);
        }
      });

    return () => controller.abort();
  }, [next]);

  async function redirectAfterAuth(requirePasswordChange: boolean | undefined) {
    const destination = requirePasswordChange ? `/change-password?next=${encodeURIComponent(next)}` : next;
    setIsEntering(true);
    await waitForEnterNavigation();
    window.location.assign(destination);
  }

  async function submitLogin() {
    setMessage(null);
    if (!username.trim() || !password) {
      setMessage("identityAccess.signIn.errors.credentialsRequired");
      return;
    }

    setIsSubmitting(true);
    let didEnter = false;
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        requirePasswordChange?: boolean;
      };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "identityAccess.signIn.errors.failed");
      }
      didEnter = true;
      await redirectAfterAuth(result.requirePasswordChange);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.signIn.errors.failed");
    } finally {
      if (!didEnter) setIsSubmitting(false);
    }
  }

  async function submitRegister() {
    setMessage(null);
    if (!username.trim() || !password || !registerName.trim() || !registerEmail.trim()) {
      setMessage("identityAccess.register.errors.required");
      return;
    }
    if (password !== registerConfirmPassword) {
      setMessage("identityAccess.password.errors.mismatch");
      return;
    }

    setIsSubmitting(true);
    let didEnter = false;
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name: registerName,
          email: registerEmail,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        requirePasswordChange?: boolean;
      };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "identityAccess.register.errors.failed");
      }
      didEnter = true;
      await redirectAfterAuth(result.requirePasswordChange);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.register.errors.failed");
    } finally {
      if (!didEnter) setIsSubmitting(false);
    }
  }

  return (
    <>
      {isEntering ? <WormholeTransition /> : null}
      <section className={`aw-auth-card ${isEntering || !hasCheckedExistingSession ? "is-entering" : ""}`}>
        {!hasCheckedExistingSession ? null : (
          <>
        <div className="flex flex-col items-center text-center">
          <div className="aw-auth-logo">
            <AgentWorldLogo className="h-16 w-16 sm:h-20 sm:w-20" />
          </div>
          <h1 className="aw-auth-title">
            {text(mode === "register" ? "identityAccess.register.title" : "identityAccess.signIn.title")}
          </h1>
        </div>

        {settings.passwordLoginEnabled ? (
          <>
            {canRegister ? (
              <div className="aw-auth-mode-switch">
                {(["login", "register"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setMode(item);
                      setMessage(null);
                    }}
                    className={`aw-auth-mode-button ${mode === item ? "is-active" : ""}`}
                  >
                    {text(item === "login" ? "identityAccess.signIn.mode.login" : "identityAccess.signIn.mode.register")}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="aw-auth-form-fields mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/72">
                  {text("identityAccess.signIn.fields.username")}
                </span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <Input
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void (mode === "register" ? submitRegister() : submitLogin());
                    }}
                    className={inputClass}
                  />
                </div>
              </label>

              {mode === "register" ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/72">
                      {text("identityAccess.register.fields.name")}
                    </span>
                    <div className="relative">
                      <BadgeCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                      <Input
                        autoComplete="name"
                        value={registerName}
                        onChange={(event) => setRegisterName(event.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-white/72">
                      {text("identityAccess.register.fields.email")}
                    </span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                      <Input
                        type="email"
                        autoComplete="email"
                        value={registerEmail}
                        onChange={(event) => setRegisterEmail(event.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </label>
                </>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-white/72">
                  {text("identityAccess.signIn.fields.password")}
                </span>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                  <Input
                    type="password"
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void (mode === "register" ? submitRegister() : submitLogin());
                    }}
                    className={inputClass}
                  />
                </div>
              </label>

              {mode === "register" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/72">
                    {text("identityAccess.register.fields.confirmPassword")}
                  </span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={registerConfirmPassword}
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submitRegister();
                      }}
                      className={inputClass}
                    />
                  </div>
                </label>
              ) : null}

              <Button
                type="button"
                className={`aw-auth-primary-button h-11 w-full ${isSubmitting || isEntering ? "is-charging" : ""}`}
                onClick={mode === "register" ? submitRegister : submitLogin}
                disabled={isSubmitting || isEntering}
              >
                {mode === "register" ? <UserPlus className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                {isSubmitting
                  ? text(mode === "register" ? "identityAccess.register.submitting" : "identityAccess.signIn.submitting")
                  : text(mode === "register" ? "identityAccess.register.submit" : "identityAccess.signIn.submit")}
              </Button>
            </div>
          </>
        ) : null}

        {settings.ssoLoginEnabled ? (
          <div className={settings.passwordLoginEnabled ? "mt-5 border-t border-white/16 pt-5" : "mt-7"}>
            <Button
              type="button"
              variant="secondary"
              className="aw-auth-sso-button h-11 w-full"
              disabled={!ssoHref}
              onClick={() => {
                const nextSsoHref = buildSsoHref();
                if (nextSsoHref) window.location.href = nextSsoHref;
              }}
            >
              {settings.ssoButtonLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.ssoButtonLogoUrl} alt="" className="h-5 w-5 rounded-[4px] object-contain" />
              ) : (
                <ShieldCheck className="h-4 w-4 text-cyan-100" />
              )}
              {ssoLabel}
            </Button>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-[12px] border border-rose-300/22 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {text(message, message)}
          </div>
        ) : null}

        {!settings.passwordLoginEnabled && (!settings.ssoLoginEnabled || !ssoHref) ? (
          <div className="mt-4 rounded-[12px] border border-amber-200/24 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            {text("identityAccess.signIn.noEnabledMethod")}
          </div>
        ) : null}
          </>
        )}
      </section>
    </>
  );
}
