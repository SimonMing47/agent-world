"use client";

import { useLanguageText } from "@/components/language-pack-provider";

export function T({
  k,
  fallback,
  params,
}: {
  k: string;
  fallback?: string;
  params?: Record<string, string | number>;
}) {
  const text = useLanguageText();
  return <>{text(k, fallback, params)}</>;
}
