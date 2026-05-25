"use client";

import { ChevronDown } from "lucide-react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export type SettingsNavItem = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
};

export function SettingsConfigLayout({
  items,
  children,
}: {
  items: SettingsNavItem[];
  children: React.ReactNode;
}) {
  const text = useLanguageText();

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <nav className="rounded-lg border border-[var(--line)] bg-[rgba(255,255,255,0.72)] p-2 shadow-[0_12px_38px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
            配置导航
          </div>
          <div className="space-y-1">
            {items.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-md px-3 py-2 text-sm transition hover:bg-[var(--surface-muted)] focus:bg-[var(--surface-muted)] focus:outline-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--ink)]">{text(item.label)}</span>
                  {item.meta ? <span className="shrink-0 text-[11px] text-[var(--ink-subtle)]">{text(item.meta)}</span> : null}
                </div>
                {item.description ? (
                  <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--ink-muted)]">
                    {text(item.description)}
                  </div>
                ) : null}
              </a>
            ))}
          </div>
        </nav>
      </aside>

      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

export function SettingsCollapsiblePanel({
  id,
  eyebrow,
  title,
  description,
  meta,
  children,
  bodyClassName,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  meta?: string;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const text = useLanguageText();

  return (
    <details
      id={id}
      className="group scroll-mt-24 overflow-hidden rounded-lg border border-white/58 bg-[var(--surface)] shadow-none backdrop-blur-xl"
    >
      <summary className="list-none cursor-pointer select-none px-6 py-5 outline-none transition hover:bg-[rgba(15,23,42,0.018)] focus:bg-[rgba(15,23,42,0.024)] [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            {eyebrow ? (
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-subtle)]">
                {text(eyebrow)}
              </div>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-[18px] font-semibold tracking-[-0.03em] text-[var(--ink)]">{text(title)}</h3>
              {meta ? (
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">
                  {text(meta)}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="mt-1 max-w-3xl text-[12px] leading-6 text-[var(--ink-subtle)]">
                {typeof description === "string" ? text(description) : localizeNode(description, text)}
              </p>
            ) : null}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[rgba(255,255,255,0.7)] text-[var(--ink-muted)] transition group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </summary>
      <div className={cn("border-t border-[var(--line)] px-6 py-5", bodyClassName)}>{children}</div>
    </details>
  );
}
