"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { localizeNode, useLanguageText } from "@/components/language-pack-provider";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-medium transition-[background,color,border-color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/24 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "border border-[rgba(15,23,42,0.14)] bg-[linear-gradient(180deg,#232936_0%,#141922_100%)] text-white shadow-[0_14px_34px_rgba(15,17,21,0.16),0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:border-[rgba(9,199,232,0.28)] hover:bg-[linear-gradient(180deg,#2a3140_0%,#181d27_100%)]",
        secondary:
          "border border-[var(--line)] bg-[rgba(255,255,255,0.68)] text-[var(--ink)] shadow-none hover:bg-[rgba(255,255,255,0.92)]",
        ghost: "text-[var(--ink-muted)] hover:bg-[rgba(15,23,42,0.03)] hover:text-[var(--ink)]",
        danger: "bg-[var(--danger)] text-white hover:opacity-95",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, "aria-label": ariaLabel, title, ...props }, ref) => {
    const text = useLanguageText();
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        aria-label={typeof ariaLabel === "string" ? text(ariaLabel) : ariaLabel}
        className={cn(buttonVariants({ variant, size }), className)}
        title={typeof title === "string" ? text(title) : title}
        {...props}
      >
        {localizeNode(children, text)}
      </Comp>
    );
  },
);

Button.displayName = "Button";
