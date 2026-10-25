import type { ReactNode } from "react";

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

const variants = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "border border-line bg-surface hover:bg-muted",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary") {
  return `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]}`;
}

export const inputClass =
  "w-full rounded-xl border border-line bg-background px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function FormMessage({ status, message }: { status: string; message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className={`text-sm ${status === "error" ? "text-danger" : "text-success"}`}>
      {message}
    </p>
  );
}
