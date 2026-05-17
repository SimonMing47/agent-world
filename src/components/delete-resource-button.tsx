"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteResourceButton({
  endpoint,
  id,
  label = "删除",
  confirmText,
  body,
}: {
  endpoint: string;
  id: string;
  label?: string;
  confirmText: string;
  body?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function remove() {
    if (!window.confirm(confirmText)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...(body ?? {}) }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? "删除失败");
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "删除失败");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="danger" onClick={remove} disabled={isDeleting}>
      <Trash2 className="h-4 w-4" />
      {isDeleting ? "删除中" : label}
    </Button>
  );
}
