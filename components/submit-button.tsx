"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  disabled,
  confirmText,
  ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant; confirmText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${buttonClass(variant)} ${className}`}
      onClick={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
      {...props}
    >
      {pending ? (pendingText ?? "Ukládám…") : children}
    </button>
  );
}
