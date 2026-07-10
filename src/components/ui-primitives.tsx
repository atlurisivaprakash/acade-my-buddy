import type { ReactNode } from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-hairline bg-surface p-6 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60";
  const variants = {
    primary: "bg-brand text-brand-foreground hover:opacity-90 shadow-sm",
    secondary: "border border-hairline bg-surface hover:bg-surface-alt",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-surface-alt",
    danger: "bg-danger text-white hover:opacity-90",
  };
  return <button {...props} className={`${base} ${variants[variant]} ${className}`} />;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-hairline bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Select({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-hairline bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${className}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-hairline bg-surface px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${
        props.className ?? ""
      }`}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "safe" | "warn" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-alt text-muted-foreground",
    brand: "bg-brand-soft text-brand",
    safe: "bg-accent-emerald-soft text-[color:var(--accent-emerald)]",
    warn: "bg-warn-soft text-[color:var(--warn)]",
    danger: "bg-danger-soft text-[color:var(--danger)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-hairline bg-surface-alt/40 px-6 py-16 text-center">
      <div className="max-w-sm space-y-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}