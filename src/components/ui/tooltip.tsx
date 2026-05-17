import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={120}>{children}</TooltipPrimitive.Provider>;
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={8}
        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)]"
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
