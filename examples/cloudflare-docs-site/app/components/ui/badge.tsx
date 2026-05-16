import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "~/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-white",
  outline: "text-foreground",
};

interface BadgeProps extends React.ComponentProps<"span"> {
  variant?: BadgeVariant;
  asChild?: boolean;
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 transition-colors",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export type { BadgeVariant };
export { Badge };
