import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";

type InlineAlertVariant = "info" | "success" | "warning" | "error";

const variantStyles: Record<InlineAlertVariant, string> = {
  info: "alert-inline-info border-l-blue-500/50 text-blue-400 bg-blue-500/5",
  success: "alert-inline-success border-l-emerald-500/50 text-emerald-400 bg-emerald-500/5",
  warning: "alert-inline-warning border-l-amber-500/50 text-amber-400 bg-amber-500/5",
  error: "alert-inline-error border-l-red-500/50 text-red-400 bg-red-500/5",
};

const variantIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
};

interface InlineAlertProps {
  variant?: InlineAlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function InlineAlert({
  variant = "info",
  title,
  children,
  className,
}: InlineAlertProps) {
  const Icon = variantIcons[variant];
  return (
    <div className={cn("alert-inline", variantStyles[variant], className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <div className="flex-1">
        {title && <div className="font-medium">{title}</div>}
        <div className="text-[11px] opacity-90">{children}</div>
      </div>
    </div>
  );
}
