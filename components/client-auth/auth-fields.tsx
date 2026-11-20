"use client";

import { PiCheckBold, PiCircleDuotone, PiEyeDuotone, PiEyeSlashDuotone, PiSpinnerGapBold, PiWarningCircleDuotone } from "react-icons/pi";
import type { ComponentType, CSSProperties } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "h-12 rounded-xl border-2 border-[var(--auth-line)] bg-white text-[15px] text-[var(--auth-ink)] shadow-none placeholder:text-[#8793aa] focus-visible:border-[var(--auth-blue)] focus-visible:ring-4 focus-visible:ring-[var(--auth-blue)]/15";

type Icon = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** A labelled text field with its icon. */
export function AuthField({
  id,
  label,
  value,
  onChange,
  icon: IconComponent,
  type = "text",
  autoComplete,
  placeholder,
  required = false,
  optional = false,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: Icon;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  /** A short help line under the field. */
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-[var(--auth-ink)]">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-[var(--auth-muted)]">(facultatif)</span> : null}
      </Label>
      <div className="relative">
        <IconComponent aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[var(--auth-blue)]" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(INPUT_CLASS, "pl-11")}
        />
      </div>
      {hint ? <p id={`${id}-hint`} className="text-xs leading-5 text-[var(--auth-muted)]">{hint}</p> : null}
    </div>
  );
}

/** A password field with a show/hide button. */
export function AuthPasswordField({
  id,
  label,
  value,
  onChange,
  icon: IconComponent,
  autoComplete,
  placeholder,
  visible,
  onToggle,
  aside,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: Icon;
  autoComplete: string;
  placeholder?: string;
  visible: boolean;
  onToggle: () => void;
  /** Shown on the label line, at the right (for example "Mot de passe oublié ?"). */
  aside?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor={id} className="text-sm font-semibold text-[var(--auth-ink)]">
          {label}
        </Label>
        {aside}
      </div>
      <div className="relative">
        <IconComponent aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[var(--auth-blue)]" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          className={cn(INPUT_CLASS, "pr-12 pl-11")}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-[var(--auth-muted)] transition-colors hover:bg-[var(--auth-wash)] hover:text-[var(--auth-ink)] focus-visible:outline-2 focus-visible:outline-[var(--auth-blue)]">
          {visible ? <PiEyeSlashDuotone className="size-[18px]" aria-hidden="true" /> : <PiEyeDuotone className="size-[18px]" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** A two-way choice shown as pills (for example M / Mme). */
export function AuthChoice<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <span id={`${label}-choice`} className="block text-sm font-semibold text-[var(--auth-ink)]">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${label}-choice`} className="flex h-12 gap-1 rounded-xl border-2 border-[var(--auth-line)] bg-white p-1">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-w-14 flex-1 cursor-pointer rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--auth-blue)]",
                selected ? "bg-[var(--auth-ink)] text-white" : "text-[var(--auth-muted)] hover:bg-[var(--auth-wash)]",
              )}>
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A heading that separates the groups of a long form. */
export function AuthGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 w-full border-b-2 border-dashed border-[var(--auth-line)] pb-2 text-sm font-bold text-[var(--auth-ink)]">{title}</legend>
      {children}
    </fieldset>
  );
}

/** A line of stitches that fills as the form is completed. */
export function StitchProgress({ done, total, label }: { done: number; total: number; label: string }) {
  const share = total === 0 ? 0 : Math.min(1, done / total);
  return (
    <div className="space-y-1.5" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div className="relative">
        <div className="auth-stitch-track" />
        <div className="auth-stitch-fill absolute inset-0" style={{ "--done": share } as CSSProperties} />
      </div>
      <p className="text-xs text-[var(--auth-muted)]">
        {done === total ? "Tout est prêt." : `${done} sur ${total} ${total > 1 ? "informations obligatoires renseignées" : "information obligatoire renseignée"}`}
      </p>
    </div>
  );
}

/** One rule the password has to meet, ticked when it does. */
export function AuthRule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 text-sm", ok ? "text-[#17703a]" : "text-[var(--auth-muted)]")}>
      {ok ? <PiCheckBold className="size-4" aria-hidden="true" /> : <PiCircleDuotone className="size-4" aria-hidden="true" />}
      <span>{children}</span>
      <span className="sr-only">{ok ? " : respecté" : " : pas encore respecté"}</span>
    </li>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border-2 border-[var(--auth-red)]/40 bg-[var(--auth-red)]/8 px-4 py-3 text-sm font-medium text-[#a3141d]">
      <PiWarningCircleDuotone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSubmit({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--auth-red)] px-6 text-base font-bold text-white shadow-[0_10px_24px_-10px_rgba(211,32,43,0.8)] transition-all hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-red)]">
      {pending ? (
        <>
          <PiSpinnerGapBold className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
