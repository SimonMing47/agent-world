"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";

export function DeleteResourceButton({
  endpoint,
  id,
  label = "actions.delete",
  confirmText,
  confirmKey = "ui.common.confirm.deleteNamed",
  confirmParams,
  body,
}: {
  endpoint: string;
  id: string;
  label?: string;
  confirmText?: string;
  confirmKey?: string;
  confirmParams?: Record<string, string | number>;
  body?: Record<string, unknown>;
}) {
  const router = useRouter();
  const text = useLanguageText();
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove() {
    const localizedParams = confirmParams
      ? Object.fromEntries(
        Object.entries(confirmParams).map(([key, value]) => [
          key,
          typeof value === "string" ? text(value) : value,
        ]),
      )
      : undefined;
    const confirmation = confirmText
      ? text(confirmText)
      : text(confirmKey, undefined, localizedParams);
    if (!window.confirm(confirmation)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...(body ?? {}) }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? text("ui.generated.c72250c5922"));
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : text("ui.generated.c72250c5922"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="danger" onClick={remove} disabled={isDeleting}>
      <Trash2 className="h-4 w-4" />
      {isDeleting ? text("ui.generated.cba46be979d") : text(label)}
    </Button>
  );
}
