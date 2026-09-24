"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ViewIcon, ViewOffSlashIcon } from "@hugeicons/core-free-icons";
import { AUTH_INPUT, AUTH_LABEL } from "@/components/auth/AuthShell";

/** Password input with a show/hide toggle and the right autocomplete hint. */
export function PasswordField({
  id = "password",
  label = "Password",
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  labelAction,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  minLength?: number;
  /** Rendered opposite the label, e.g. a "Forgot password?" link. */
  labelAction?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={AUTH_LABEL}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={`${AUTH_INPUT} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={shown ? ViewOffSlashIcon : ViewIcon} size={18} />
        </button>
      </div>
    </div>
  );
}
