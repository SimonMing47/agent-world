import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/32 backdrop-blur-[1px]" />
      <Dialog.Content
        className={cn(
          "fixed top-0 z-50 h-full w-[min(86vw,320px)] border-[var(--line)] bg-[var(--sidebar)] text-[var(--sidebar-ink)] shadow-2xl outline-none",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="text-sm font-semibold">AgentWorld</div>
          <Dialog.Close className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--sidebar-muted)] transition hover:bg-white/6 hover:text-[var(--sidebar-ink)]">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>
        <div className="h-[calc(100%-61px)] overflow-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
