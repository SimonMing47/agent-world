"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BadgeCheck, LogOut, Mail, Shield, Users } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalImage } from "@/components/ui/external-image";

type TeamSummary = {
  id: string;
  name: string;
};

export function CurrentUserMenu({
  user,
}: {
  user: {
    name: string;
    email: string;
    title: string;
    avatarUrl: string;
    initials: string;
    isSystemAdmin: boolean;
    primaryBusinessTeamName: string | null;
    accessibleBusinessTeams: TeamSummary[];
  };
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/signin");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={user.name}
          title={user.name}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/78 p-1 shadow-[var(--shadow-soft)] ring-1 ring-black/4 transition hover:bg-white"
        >
          {user.avatarUrl ? (
            <ExternalImage src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(29,78,216,0.1)] text-[10px] font-semibold text-[var(--accent)]">
              {user.initials}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,620px)]">
        <DialogHeader>
          <DialogTitle>{text("identityAccess.profile.title")}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {user.avatarUrl ? (
              <ExternalImage src={user.avatarUrl} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-[rgba(29,78,216,0.1)] text-2xl font-semibold text-[var(--accent)]">
                {user.initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xl font-semibold text-[var(--ink)]">{user.name}</div>
              <div className="mt-1 text-sm text-[var(--ink-muted)]">{user.title || text("identityAccess.profile.noTitle")}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.isSystemAdmin ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(29,78,216,0.08)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    <Shield className="h-3.5 w-3.5" />
                    {text("identityAccess.profile.systemAdmin")}
                  </span>
                ) : null}
                {user.primaryBusinessTeamName ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[rgba(15,23,42,0.05)] px-3 py-1 text-xs font-semibold text-[var(--ink-subtle)]">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {user.primaryBusinessTeamName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] bg-[rgba(245,245,247,0.92)] px-5 py-5 ring-1 ring-black/4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
                <Mail className="h-3.5 w-3.5" />
                {text("identityAccess.profile.contact")}
              </div>
              <div className="mt-3 text-sm text-[var(--ink)]">{user.email}</div>
            </div>
            <div className="rounded-[20px] bg-[rgba(245,245,247,0.92)] px-5 py-5 ring-1 ring-black/4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">
                <Users className="h-3.5 w-3.5" />
                {text("identityAccess.profile.accessibleTeams")}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.accessibleBusinessTeams.length ? (
                  user.accessibleBusinessTeams.map((team) => (
                    <span
                      key={team.id}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ink)] ring-1 ring-black/4"
                    >
                      {team.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[var(--ink-muted)]">{text("identityAccess.profile.noAccessibleTeams")}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={logout} disabled={isLoggingOut}>
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? text("identityAccess.profile.loggingOut") : text("identityAccess.profile.logout")}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
