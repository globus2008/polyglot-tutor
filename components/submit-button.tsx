"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useI18n } from "@/lib/i18n/client";
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
  const { t } = useI18n();
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
      {pending ? (pendingText ?? t.common.saving) : children}
    </button>
  );
}
