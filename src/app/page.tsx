import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { redirect } from "next/navigation";
import { AgentWorldLogo } from "@/components/agentworld-logo";
import { uiText } from "@/lib/language-pack";
import { getRequestAuthContext } from "@/server/auth-core";

export const dynamic = "force-dynamic";

function normalizeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/overview";
  }
  return value;
}

export default async function EntryPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const authContext = await getRequestAuthContext();
  const params = await searchParams;
  const next = normalizeNextPath(params?.next);

  if (authContext) {
    if (authContext.mustChangePassword) {
      redirect(`/change-password?next=${encodeURIComponent(next)}`);
    }
    redirect(next);
  }

  return (
    <>
      <main className="aw-intro">
        <div className="aw-intro__noise" />
        <div className="aw-intro__frame" />
        <div className="aw-intro__content">
          <div className="aw-intro__brand">
            <AgentWorldLogo animated className="h-24 w-24 text-white sm:h-28 sm:w-28" />
            <div className="aw-intro__wordmark-wrap">
              <div className="aw-intro__eyebrow">{uiText("landing.eyebrow")}</div>
              <div className="aw-intro__wordmark">{uiText("terminology.productName", "AgentWorld")}</div>
            </div>
          </div>

          <div className="aw-intro__type-group" aria-label={uiText("landing.tagline")}>
            <p className="aw-intro__typewriter">{uiText("landing.tagline")}</p>
            <div className="aw-intro__prompt">
              <span className="aw-intro__prompt-cursor" />
            </div>
          </div>

          <Link
            href={`/signin?from=welcome&next=${encodeURIComponent(next)}`}
            className="aw-intro__enter"
            aria-label={uiText("landing.enterLabel")}
          >
            <span className="aw-intro__enter-ring">
              <ArrowDown className="h-5 w-5" />
            </span>
          </Link>
        </div>
      </main>
    </>
  );
}
