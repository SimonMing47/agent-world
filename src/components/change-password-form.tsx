"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const passwordInputClass = "aw-auth-input pl-9";

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/overview";
  }
  const pathname = value.split("?")[0];
  if (pathname === "/signin" || pathname === "/change-password") {
    return "/overview";
  }
  return value;
}

export function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = useLanguageText();
  const next = normalizeNextPath(searchParams.get("next"));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordFields: Array<{
    id: string;
    label: string;
    value: string;
    setter: (nextValue: string) => void;
    autoComplete: string;
  }> = [
    {
      id: "current",
      label: "identityAccess.password.fields.current",
      value: currentPassword,
      setter: setCurrentPassword,
      autoComplete: "current-password",
    },
    {
      id: "new",
      label: "identityAccess.password.fields.new",
      value: newPassword,
      setter: setNewPassword,
      autoComplete: "new-password",
    },
    {
      id: "confirm",
      label: "identityAccess.password.fields.confirm",
      value: confirmPassword,
      setter: setConfirmPassword,
      autoComplete: "new-password",
    },
  ];

  async function submit() {
    setMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("identityAccess.password.errors.required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("identityAccess.password.errors.mismatch");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "identityAccess.password.errors.failed");
      }
      router.push(next);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "identityAccess.password.errors.failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="aw-auth-card">
      <div className="flex flex-col items-center text-center">
        <div className="aw-auth-logo">
          <AgentWorldLogo className="h-8 w-8" />
        </div>
        <h1 className="aw-auth-title mt-5">
          {text("identityAccess.password.title")}
        </h1>
        <p className="aw-auth-description">
          {text("identityAccess.password.description")}
        </p>
      </div>

      <div className="mt-7 space-y-4">
        {passwordFields.map((field) => (
          <label key={field.id} className="block">
            <span className="mb-2 block text-sm font-medium text-white/72">{text(field.label)}</span>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
              <Input
                type="password"
                autoComplete={field.autoComplete}
                value={field.value}
                onChange={(event) => field.setter(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
                className={passwordInputClass}
              />
            </div>
          </label>
        ))}

        <Button
          type="button"
          className="aw-auth-primary-button h-11 w-full"
          onClick={submit}
          disabled={isSubmitting}
        >
          {isSubmitting ? text("identityAccess.password.saving") : text("identityAccess.password.submit")}
        </Button>
      </div>

      {message ? (
        <div className="mt-4 rounded-[12px] border border-rose-300/22 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {text(message, message)}
        </div>
      ) : null}
    </section>
  );
}
