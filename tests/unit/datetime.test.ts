import { describe, expect, it } from "vitest";
import { formatMatchDate, formatWeekdayTime, toLocalInputs, weekday } from "@/lib/domain/datetime";

// 2026-09-26 00:00 UTC = viernes 25/9 21:00 en Montevideo (UTC-3).
const ISO = "2026-09-26T00:00:00Z";

describe("fechas en la zona del partido", () => {
  it("formatea en la zona del partido, no en la del dispositivo", () => {
    expect(formatMatchDate(ISO, "America/Montevideo")).toBe("Viernes 25/9 · 21:00");
    expect(formatMatchDate(ISO, "Europe/Madrid")).toBe("Sábado 26/9 · 02:00");
  });

  it("título corto para Open Graph", () => {
    expect(formatWeekdayTime(ISO, "America/Montevideo")).toBe("Viernes 21:00");
  });

  it("día de la semana en minúscula (para 'Partido del viernes')", () => {
    expect(weekday(ISO, "America/Montevideo")).toBe("viernes");
  });

  it("toLocalInputs devuelve los valores para <input type=date/time>", () => {
    expect(toLocalInputs(ISO, "America/Montevideo")).toEqual({ date: "2026-09-25", time: "21:00" });
  });
});
