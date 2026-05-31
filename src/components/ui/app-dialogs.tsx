"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AppDialogTone = "default" | "danger" | "warning" | "success";

type AppDialogRequest = {
  kind: "alert" | "confirm" | "prompt";
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  tone?: AppDialogTone;
};

type AppDialogState = AppDialogRequest & {
  id: string;
  value: string;
  resolve: (value: boolean | string | null) => void;
};

function toneIcon(tone: AppDialogTone, kind: AppDialogRequest["kind"]) {
  if (tone === "danger" || tone === "warning") return <AlertTriangle className="h-4 w-4" />;
  if (tone === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (kind === "prompt") return <PencilLine className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function toneClass(tone: AppDialogTone) {
  if (tone === "danger") return "bg-[#fff1f3] text-[var(--danger)] ring-[#ffd7df]";
  if (tone === "warning") return "bg-[#fff7ed] text-[var(--warning)] ring-[#fed7aa]";
  if (tone === "success") return "bg-[#edf8f0] text-[#166534] ring-[#bbf7d0]";
  return "bg-[var(--accent-soft)] text-[var(--accent-strong)] ring-[rgba(9,199,232,0.16)]";
}

export function useAppDialogs() {
  const [dialog, setDialog] = useState<AppDialogState | null>(null);

  const openDialog = useCallback((request: AppDialogRequest) => {
    return new Promise<boolean | string | null>((resolve) => {
      setDialog({
        ...request,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        value: request.defaultValue ?? "",
        resolve,
      });
    });
  }, []);

  const resolveDialog = useCallback((value: boolean | string | null) => {
    setDialog((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  const setDialogValue = useCallback((value: string) => {
    setDialog((current) => (current ? { ...current, value } : current));
  }, []);

  const showAlert = useCallback(
    async (request: Omit<AppDialogRequest, "kind"> | ReactNode) => {
      await openDialog({
        kind: "alert",
        title: typeof request === "object" && request !== null && "title" in request ? request.title : request,
        description: typeof request === "object" && request !== null && "title" in request ? request.description : undefined,
        confirmText: typeof request === "object" && request !== null && "title" in request ? request.confirmText : undefined,
        tone: typeof request === "object" && request !== null && "title" in request ? request.tone : "default",
      });
    },
    [openDialog],
  );

  const showConfirm = useCallback(
    async (request: Omit<AppDialogRequest, "kind">) => {
      const result = await openDialog({ kind: "confirm", ...request });
      return result === true;
    },
    [openDialog],
  );

  const showPrompt = useCallback(
    async (request: Omit<AppDialogRequest, "kind">) => {
      const result = await openDialog({ kind: "prompt", ...request });
      return typeof result === "string" ? result : null;
    },
    [openDialog],
  );

  const dialogHost = useMemo(
    () => (
      <AppDialogHost
        dialog={dialog}
        onCancel={() => resolveDialog(dialog?.kind === "alert" ? true : null)}
        onConfirm={() => resolveDialog(dialog?.kind === "prompt" ? dialog.value : true)}
        onValueChange={setDialogValue}
      />
    ),
    [dialog, resolveDialog, setDialogValue],
  );

  return {
    alert: showAlert,
    confirm: showConfirm,
    prompt: showPrompt,
    dialogHost,
  };
}

function AppDialogHost({
  dialog,
  onCancel,
  onConfirm,
  onValueChange,
}: {
  dialog: AppDialogState | null;
  onCancel: () => void;
  onConfirm: () => void;
  onValueChange: (value: string) => void;
}) {
  if (!dialog) return null;

  const tone = dialog.tone ?? (dialog.kind === "confirm" ? "warning" : "default");
  const isPrompt = dialog.kind === "prompt";
  const isAlert = dialog.kind === "alert";
  const confirmText = dialog.confirmText ?? (isAlert ? "actions.ok" : isPrompt ? "actions.save" : "actions.confirm");
  const cancelText = dialog.cancelText ?? "actions.cancel";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="w-[min(92vw,520px)] rounded-[22px]">
        <DialogHeader className="px-5 py-4">
          <div className="flex items-start gap-3 pr-8">
            <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ring-1", toneClass(tone))}>
              {toneIcon(tone, dialog.kind)}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base">{dialog.title}</DialogTitle>
              {dialog.description ? <DialogDescription>{dialog.description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="px-5 py-4">
          {isPrompt ? (
            dialog.multiline ? (
              <Textarea
                autoFocus
                className="min-h-28"
                value={dialog.value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={dialog.placeholder}
              />
            ) : (
              <Input
                autoFocus
                value={dialog.value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder={dialog.placeholder}
              />
            )
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            {!isAlert ? (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {cancelText}
              </Button>
            ) : null}
            <Button type="button" variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
