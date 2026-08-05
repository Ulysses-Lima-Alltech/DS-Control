import { normalizeApplicationSearch } from "@common/utils/application-search";
import { GetApplicationQueryStringSchema } from "@modules/application/dto/get-all-application.dto";
import { buildApplicationSearchCondition } from "@repositories/applications/application-search";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

describe("application search", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["   ", undefined],
    ["  Fazenda   São   José  ", "Fazenda São José"],
    ["  142  ", "142"],
  ])("normalizes %j to %j", (input, expected) => {
    expect(normalizeApplicationSearch(input)).toBe(expected);
  });

  it("builds one accent-insensitive OR condition for every simple-search field", () => {
    const query = new PgDialect().sqlToQuery(
      buildApplicationSearchCondition("São José"),
    );

    expect(query.sql.match(/unaccent\(/g)).toHaveLength(20);
    expect(query.sql).toContain('"applications"."observations"');
    expect(query.sql).toContain('"users"."name"');
    expect(query.sql).toContain('"assistants"."name"');
    expect(query.sql).toContain('"drones"."name"');
    expect(query.sql).toContain('"culture_types"."name"');
    expect(query.sql).toContain('"products"."name"');
    expect(query.sql).toContain('"plots"."name"');
    expect(query.sql).toContain('"customers"."name"');
    expect(query.sql).toContain('"farms"."name"');
    expect(query.sql).toContain('"service_orders"."number"');
    expect(query.params).toEqual(Array(10).fill("%São José%"));
  });

  it("normalizes search at the HTTP query contract boundary", () => {
    expect(
      GetApplicationQueryStringSchema.parse({ search: "  piloto   agrícola  " })
        .search,
    ).toBe("piloto agrícola");
  });

  it("removes an empty search at the HTTP query contract boundary", () => {
    expect(
      GetApplicationQueryStringSchema.parse({ search: "   " }).search,
    ).toBeUndefined();
  });
});
