import React, { useState, type PropsWithChildren } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AlertVariant = "warning" | "info" | "success" | "danger";
export type AlertSize = "sm" | "md" | "lg";

export type AlertProps = PropsWithChildren<{
  variant?: AlertVariant;
  size?: AlertSize;
  title?: React.ReactNode;
  icon?: React.ReactNode | boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
  role?: string;
}>;

const VARIANT_CONFIGS = {
  warning: {
    container: "border-amber-200/90 bg-amber-50/80 text-amber-950",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    dismissHover: "hover:bg-amber-100/70 text-amber-700",
    defaultRole: "status",
  },
  info: {
    container: "border-blue-200/70 bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]",
    icon: Info,
    iconColor: "text-[var(--text-brand)]",
    titleColor: "text-[var(--text-brand-strong)]",
    dismissHover: "hover:bg-blue-100/60 text-blue-700",
    defaultRole: "status",
  },
  success: {
    container: "border-emerald-200/80 bg-[#EAF3DE] text-[#27500A]",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    titleColor: "text-[#27500A]",
    dismissHover: "hover:bg-emerald-100/60 text-emerald-800",
    defaultRole: "status",
  },
  danger: {
    container: "border-red-200/80 bg-[#FCEBEB] text-[#791F1F]",
    icon: AlertCircle,
    iconColor: "text-red-600",
    titleColor: "text-[#791F1F]",
    dismissHover: "hover:bg-red-100/60 text-red-800",
    defaultRole: "alert",
  },
};

const SIZE_CONFIGS = {
  sm: {
    container: "p-2.5 text-xs rounded-[var(--radius-md)] gap-2.5",
    iconSize: "h-4 w-4",
    title: "text-xs font-semibold",
    content: "text-xs leading-relaxed",
  },
  md: {
    container: "p-3.5 text-sm rounded-[var(--radius-lg)] gap-3",
    iconSize: "h-4.5 w-4.5",
    title: "text-sm font-semibold",
    content: "text-sm leading-relaxed",
  },
  lg: {
    container: "p-4 text-sm rounded-[var(--radius-lg)] gap-3.5",
    iconSize: "h-5 w-5",
    title: "text-base font-semibold",
    content: "text-sm leading-relaxed",
  },
};

export function Alert({
  variant = "info",
  size = "md",
  title,
  icon = true,
  dismissible = false,
  onDismiss,
  action,
  children,
  className,
  role,
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const vConfig = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.info;
  const sConfig = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;
  const IconComponent = vConfig.icon;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const renderIcon = () => {
    if (icon === false) return null;
    if (React.isValidElement(icon)) return icon;
    return (
      <div className={cn("shrink-0 mt-0.5", vConfig.iconColor)}>
        <IconComponent className={sConfig.iconSize} aria-hidden="true" />
      </div>
    );
  };

  return (
    <div
      role={role || vConfig.defaultRole}
      aria-live={variant === "danger" ? "assertive" : "polite"}
      className={cn(
        "flex items-start border shadow-2xs transition-all duration-[var(--duration-fast)]",
        vConfig.container,
        sConfig.container,
        className
      )}
    >
      {renderIcon()}
      <div className="min-w-0 flex-1">
        {title && (
          <div className={cn("font-semibold mb-0.5", vConfig.titleColor, sConfig.title)}>
            {title}
          </div>
        )}
        {children && <div className={sConfig.content}>{children}</div>}
      </div>
      {action && <div className="ml-2 shrink-0 self-center">{action}</div>}
      {(dismissible || onDismiss) && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar aviso"
          className={cn(
            "ml-2 shrink-0 rounded-md p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1",
            vConfig.dismissHover
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
