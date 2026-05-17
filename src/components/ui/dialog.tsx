"use client";

import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type MouseEvent,
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("Dialog components must be used inside Dialog.");
  }
  return context;
}

export function Dialog({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }, [controlledOpen, onOpenChange]);
  const value = useMemo(
    () => ({ open, setOpen, titleId, descriptionId }),
    [descriptionId, open, setOpen, titleId],
  );

  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: ReactNode;
}) {
  const context = useDialogContext();
  const openDialog: MouseEventHandler = (event) => {
    if (!event.defaultPrevented) {
      context.setOpen(true);
    }
  };

  if (asChild) {
    const child = Children.toArray(children).find((item) => isValidElement(item));
    if (isValidElement<{ onClick?: MouseEventHandler; [key: string]: unknown }>(child)) {
      const childOnClick = child.props.onClick;
      return cloneElement(child, {
        onClick: (event: MouseEvent<Element>) => {
          childOnClick?.(event);
          openDialog(event);
        },
        "aria-haspopup": "dialog",
        "aria-expanded": context.open,
        "data-state": context.open ? "open" : "closed",
      });
    }
  }

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={context.open}
      data-state={context.open ? "open" : "closed"}
      onClick={openDialog}
    >
      {children}
    </button>
  );
}

export function DialogClose({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  const context = useDialogContext();
  return (
    <button type="button" className={className} onClick={() => context.setOpen(false)}>
      {children}
    </button>
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const context = useDialogContext();
  const text = useLanguageText();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!context.open || typeof document === "undefined") return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "textarea:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        context.setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute("disabled") && element.getClientRects().length > 0,
      );
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [context]);

  if (!context.open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        aria-label={text("关闭弹窗")}
        className="fixed inset-0 z-40 cursor-default bg-slate-950/24 backdrop-blur-[2px]"
        onClick={() => context.setOpen(false)}
        tabIndex={-1}
        type="button"
      />
      <div
        ref={dialogRef}
        aria-describedby={context.descriptionId}
        aria-labelledby={context.titleId}
        aria-modal="true"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_60px_rgba(15,23,42,0.18)] outline-none",
          className,
        )}
        role="dialog"
        tabIndex={-1}
      >
        {children}
        <button
          aria-label={text("关闭")}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
          onClick={() => context.setOpen(false)}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>,
    document.body,
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("border-b border-[var(--line)] px-6 py-5", className)}>{children}</div>;
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const context = useDialogContext();
  const text = useLanguageText();
  return (
    <div className={cn("text-lg font-semibold text-[var(--ink)]", className)} id={context.titleId}>
      {localizeNode(children, text)}
    </div>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const context = useDialogContext();
  const text = useLanguageText();
  return (
    <div className={cn("mt-1 text-sm leading-6 text-[var(--ink-muted)]", className)} id={context.descriptionId}>
      {localizeNode(children, text)}
    </div>
  );
}

export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("overflow-y-auto px-6 py-5", className)}>{children}</div>;
}
