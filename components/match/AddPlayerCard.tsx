"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { TeamToggle } from "@/components/ui/TeamToggle";
import { TextField } from "@/components/ui/TextField";
import { LIMITS } from "@/lib/domain/validation";
import type { Team } from "@/lib/domain/teams";
import { cx } from "@/lib/cx";

/**
 * "Agregar jugador" del organizador: para gente que no usa la app. Se
 * inserta con user_id null; la política RLS solo lo permite si sos admin.
 */
export function AddPlayerCard({
  name,
  onName,
  nameError,
  team,
  onTeam,
  hint,
  error,
  submitLabel,
  busy,
  disabled,
  onSubmit,
  footer,
}: {
  name: string;
  onName: (v: string) => void;
  nameError?: string | null;
  team: Team;
  onTeam: (t: Team) => void;
  hint: string;
  error?: string | null;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  /** "Anotarme yo" / "Estás anotado como…" */
  footer?: ReactNode;
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }
  return (
    <Card>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3 lg:gap-3.5">
        <CardTitle>Agregar jugador</CardTitle>
        <TextField
          label="Nombre"
          autoComplete="off"
          placeholder="ej. Nico"
          maxLength={LIMITS.name}
          value={name}
          onChange={(e) => onName(e.target.value)}
          error={nameError}
          className="[&_input]:h-12 lg:[&_input]:h-11"
        />
        <TeamToggle value={team} onChange={onTeam} disabled={disabled} />
        <p
          aria-live="polite"
          className={cx("min-h-[38px] text-13 leading-[1.45]", error ? "font-semibold text-danger" : "text-ink-2")}
        >
          {error ?? hint}
        </p>
        <Button type="submit" disabled={disabled || busy} className="lg:h-12">
          {busy ? "Agregando…" : submitLabel}
        </Button>
        {footer}
      </form>
    </Card>
  );
}
