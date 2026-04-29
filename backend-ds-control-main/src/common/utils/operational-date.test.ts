import { describe, expect, it } from "vitest";

import {
  diffOperationalDaysInclusive,
  toOperationalDateDatabaseTimestamp,
  toOperationalDateDisplayBR,
  toOperationalDateYMD,
} from "./operational-date";

describe("operational-date util", () => {
  it("normaliza timestamp 2026-04-26T00:30:00-03:00 para 2026-04-26", () => {
    expect(toOperationalDateYMD("2026-04-26T00:30:00-03:00")).toBe("2026-04-26");
    expect(toOperationalDateDisplayBR("2026-04-26T00:30:00-03:00")).toBe("26/04/2026");
  });

  it("normaliza timestamp 2026-04-26T23:30:00-03:00 para 2026-04-26", () => {
    expect(toOperationalDateYMD("2026-04-26T23:30:00-03:00")).toBe("2026-04-26");
    expect(toOperationalDateDisplayBR("2026-04-26T23:30:00-03:00")).toBe("26/04/2026");
  });

  it("mantem YYYY-MM-DD sem conversao UTC", () => {
    expect(toOperationalDateYMD("2026-04-26")).toBe("2026-04-26");
    expect(toOperationalDateDisplayBR("2026-04-26")).toBe("26/04/2026");
  });

  it("calcula diferenca inclusiva corretamente no mesmo dia operacional", () => {
    expect(diffOperationalDaysInclusive("2026-04-26", "2026-04-26")).toBe(1);
  });

  it("gera timestamp de banco consistente para o mesmo dia operacional", () => {
    const fromYmd = toOperationalDateDatabaseTimestamp("2026-04-26");
    const fromIso = toOperationalDateDatabaseTimestamp("2026-04-26T23:30:00-03:00");

    expect(toOperationalDateYMD(fromYmd)).toBe("2026-04-26");
    expect(toOperationalDateYMD(fromIso)).toBe("2026-04-26");
  });
});
