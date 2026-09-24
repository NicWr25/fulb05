"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { TeamToggle } from "@/components/ui/TeamToggle";
import { TextField } from "@/components/ui/TextField";
import { LIMITS } from "@/lib/domain/validation";
import type { Team } from "@/lib/domain/teams";
import { cx } from "@/lib/cx";

/**
 * "Anotate": nombre + equipo. El lugar se elige tocando la cancha; si no se
 * elige, la base asigna el primer lugar libre del equipo (o el banco).
 */
export function JoinCard({
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
}) {
  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Card>
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-3 lg:gap-3.5"
      >
        <CardTitle>Anotate</CardTitle>
        <TextField
          label="Tu nombre"
          autoComplete="given-name"
          placeholder="Tu nombre"
          maxLength={LIMITS.name}
          value={name}
          onChange={(e) => onName(e.target.value)}
          error={nameError}
          className="[&_input]:h-12 lg:[&_input]:h-11"
        />
        <TeamToggle value={team} onChange={onTeam} disabled={disabled} />
        {/* Ayuda / error: min-height fijo (como el diseño) para que el botón no salte. */}
        <p
          aria-live="polite"
          className={cx(
            "min-h-[38px] text-13 leading-[1.45]",
            error ? "font-semibold text-danger" : "text-ink-2",
          )}
        >
          {error ?? hint}
        </p>
        <Button type="submit" disabled={disabled || busy} className="lg:h-12">
          {busy ? "Anotando…" : submitLabel}
        </Button>
        <p className="text-12 leading-[1.45] text-ink-4">
          ¿Ya te anotaste desde otro navegador? Desde acá no te vemos: pedile al
          organizador que te saque.
        </p>
      </form>
    </Card>
  );
}
