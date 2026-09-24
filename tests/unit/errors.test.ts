import { describe, expect, it } from "vitest";
import { errorKind, errorMessage, SLOT_TAKEN_MESSAGE } from "@/lib/domain/errors";

describe("errorMessage", () => {
  it("distingue las dos violaciones de UNIQUE por el nombre de la constraint", () => {
    const slot = { code: "23505", message: 'duplicate key value violates unique constraint "match_players_slot_key"' };
    const user = { code: "23505", message: 'duplicate key value violates unique constraint "match_players_user_key"' };
    expect(errorKind(slot)).toBe("slot_taken");
    expect(errorMessage(slot)).toBe(SLOT_TAKEN_MESSAGE);
    expect(errorMessage(user)).toBe("Ya estás anotado en este partido.");
  });

  it("traduce los errores de dominio de los triggers", () => {
    expect(errorMessage({ code: "P0001", message: "match_closed" })).toMatch(/cerraron/);
    expect(errorMessage({ code: "P0001", message: "team_full" })).toMatch(/completo/);
  });

  it("rate limit de Auth y errores de red", () => {
    expect(errorMessage({ status: 429 })).toMatch(/Demasiados intentos/);
    expect(errorMessage({ name: "TypeError", message: "Failed to fetch" })).toMatch(/conexión/);
  });

  it("clave foránea rota (sesión de un usuario que ya no existe)", () => {
    expect(errorMessage({ code: "23503", message: 'violates foreign key constraint "matches_created_by_fkey"' })).toMatch(
      /sesión/,
    );
  });

  it("mensaje genérico para lo desconocido", () => {
    expect(errorMessage({ code: "XX000", message: "boom" })).toBe("Algo salió mal. Probá de nuevo.");
  });
});
