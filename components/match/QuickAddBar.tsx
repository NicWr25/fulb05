"use client";

import { useId, type FormEvent, type ReactNode } from "react";
import { TeamSwatch } from "@/components/ui/TeamSwatch";
import { TEAM_LABEL, type Team } from "@/lib/domain/teams";
import { LIMITS } from "@/lib/domain/validation";
import { cx } from "@/lib/cx";

export function QuickAddBar({ name, onName, nameError, alias, onAlias, aliasError, showAlias,
  team, onTeam, teamDisabled, hint, error, placeholder, submitLabel, busy,
  disabled, onSubmit, footer,
}: {
  name: string;
  onName: (value: string) => void;
  nameError?: string | null;
  alias?: string;
  onAlias?: (value: string) => void;
  aliasError?: string | null;
  showAlias?: boolean;
  team: Team;
  onTeam: (team: Team) => void;
  teamDisabled?: (team: Team) => boolean;
  hint: string;
  error?: string | null;
  placeholder: string;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  footer?: ReactNode;
}) {
  const id = useId();
  const message = nameError ?? aliasError ?? error ?? hint;

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={submit} noValidate className="flex flex-col gap-2.5">
        <div className="flex gap-2">
          <label htmlFor={id} className="sr-only">{placeholder}</label>
          <input
            id={id}
            autoComplete={placeholder === "Tu nombre" ? "given-name" : "off"}
            placeholder={placeholder}
            maxLength={LIMITS.name}
            value={name}
            onChange={(event) => onName(event.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={`${id}-message`}
            className={cx(
              "h-12 min-w-0 flex-1 rounded-field bg-field px-3.5 text-16 text-ink placeholder:text-ink-4",
              nameError ? "border-2 border-danger" : "border border-line-strong",
            )}
          />
          <button type="submit" disabled={disabled || busy}
            className="min-h-12 shrink-0 rounded-btn bg-ink px-4 text-14 font-semibold text-white disabled:opacity-50">
            {busy ? "Guardando…" : submitLabel}
          </button>
        </div>
        {showAlias && onAlias && <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-alias`} className="text-13 font-semibold">Alias en la cancha (opcional)</label>
          <input id={`${id}-alias`} value={alias ?? ""} maxLength={LIMITS.alias}
            onChange={(event) => onAlias(event.target.value)} aria-invalid={Boolean(aliasError)}
            aria-describedby={`${id}-message`} placeholder="Ej.: Juani 2"
            className={cx("h-11 rounded-field bg-field px-3.5 text-16 text-ink",
              aliasError ? "border-2 border-danger" : "border border-line-strong")}
          />
        </div>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div role="group" aria-label="Equipo" className="flex shrink-0 gap-1">
            {(["A", "B"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={team === value}
                onClick={() => onTeam(value)} disabled={busy || teamDisabled?.(value)}
                className={cx(
                  "flex min-h-11 items-center gap-1.5 rounded-btn border px-2.5 text-13 font-semibold",
                  team === value ? "border-ink bg-surface text-ink" : "border-line-strong bg-cream text-ink-2",
                )}>
                <TeamSwatch team={value} />{TEAM_LABEL[value]}
              </button>
            ))}
          </div>
          <p id={`${id}-message`} aria-live="polite"
            className={cx("min-h-[38px] flex-1 text-13 leading-[1.45]", nameError || error ? "font-semibold text-danger" : "text-ink-2")}>
            {message}
          </p>
        </div>
      </form>
      {footer}
    </div>
  );
}
