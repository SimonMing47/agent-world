import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  side = "left",
  className,
  children,
}: {
  side?: "left" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const text = useLanguageText();

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/18 backdrop-blur-[2px]" />
      <Dialog.Content
        className={cn(
          "fixed top-0 z-50 h-full w-[min(86vw,320px)] border-[var(--sidebar-line)] bg-[var(--sidebar)] text-[var(--sidebar-ink)] outline-none",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--sidebar-line)] px-4 py-4">
          <div>
            <Dialog.Title className="text-sm font-semibold text-[var(--sidebar-ink)]">
              {text("terminology.productName", "AgentWorld")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-[var(--sidebar-muted)]">
              {text("ui.generated.c8027d9d7d0")}
            </Dialog.Description>
          </div>
          <Dialog.Close className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition-colors hover:bg-[var(--sidebar-surface)] hover:text-[var(--sidebar-ink)]">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>
        <div className="h-[calc(100%-69px)] overflow-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
