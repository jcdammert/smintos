import type { ComponentProps } from "react";

interface InputProps extends Omit<ComponentProps<"input">, "className"> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, id, ...rest }: InputProps) {
  return (
    <label htmlFor={id} className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-text-primary">
          {label}
        </span>
      )}
      <input
        id={id}
        className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
        {...rest}
      />
      {hint && <span className="mt-1 block text-xs text-text-secondary">{hint}</span>}
    </label>
  );
}

interface TextareaProps extends Omit<ComponentProps<"textarea">, "className"> {
  label?: string;
}

export function Textarea({ label, id, ...rest }: TextareaProps) {
  return (
    <label htmlFor={id} className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-text-primary">
          {label}
        </span>
      )}
      <textarea
        id={id}
        className="min-h-[96px] w-full rounded-card border border-line bg-white px-4 py-3 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
        {...rest}
      />
    </label>
  );
}
