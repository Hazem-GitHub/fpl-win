import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const PX = { xs: 12, sm: 14, md: 16, lg: 18 } as const;

export function Icon({
  icon: Cmp,
  size = "sm",
  className,
}: {
  icon: LucideIcon;
  size?: keyof typeof PX;
  className?: string;
}) {
  return (
    <Cmp
      size={PX[size]}
      strokeWidth={1.85}
      className={`shrink-0 ${className ?? ""}`}
      aria-hidden
    />
  );
}

export function IconLabel({
  icon,
  children,
  size = "sm",
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  size?: keyof typeof PX;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Icon icon={icon} size={size} />
      {children}
    </span>
  );
}
