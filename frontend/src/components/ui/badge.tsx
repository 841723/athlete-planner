import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
}

export function Badge({ className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("badge", className)} {...props}>
      {children}
    </span>
  );
}