import * as ScrollArea from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export function AppScrollArea({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollArea.Root className={cn("relative overflow-hidden", className)}>
      <ScrollArea.Viewport className="h-full w-full rounded-[inherit]">{children}</ScrollArea.Viewport>
      <ScrollArea.ScrollAreaScrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none select-none p-0.5"
      >
        <ScrollArea.ScrollAreaThumb className="flex-1 rounded-full bg-black/10" />
      </ScrollArea.ScrollAreaScrollbar>
      <ScrollArea.Corner />
    </ScrollArea.Root>
  );
}
