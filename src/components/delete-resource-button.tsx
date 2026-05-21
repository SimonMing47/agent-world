"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
  const resourceLabel =
    localizedParams && typeof localizedParams.resource === "string"
      ? localizedParams.resource
      : text("ui.common.resources.session");

  async function remove() {
    setErrorMessage("");
    setIsDeleting(true);
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...(body ?? {}) }),
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error ?? text("ui.generated.c72250c5922"));
      setOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text("ui.generated.c72250c5922"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="danger" disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
          {isDeleting ? text("ui.generated.cba46be979d") : text(label)}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(92vw,480px)]">
        <DialogHeader>
          <DialogTitle>{`${text("actions.delete")} ${resourceLabel}`}</DialogTitle>
          <DialogDescription>{confirmation}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {errorMessage ? (
            <div className="rounded-lg border border-[var(--danger)]/15 bg-[var(--danger)]/5 px-3 py-2 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={isDeleting}>
              {text("actions.cancel")}
            </Button>
            <Button type="button" variant="danger" onClick={remove} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
              {isDeleting ? text("ui.generated.cba46be979d") : text(label)}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
