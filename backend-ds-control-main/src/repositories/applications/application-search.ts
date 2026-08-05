import {
  applications,
  assistants,
  cultureTypes,
  customers,
  drones,
  farms,
  plots,
  products,
  serviceOrders,
  users,
} from "@infra/database/schema";
import { or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

function accentInsensitiveContains(column: SQLWrapper, search: string): SQL {
  return sql`unaccent(COALESCE(CAST(${column} AS text), '')) ILIKE unaccent(${`%${search}%`})`;
}

export function buildApplicationSearchCondition(search: string): SQL {
  return or(
    accentInsensitiveContains(applications.observations, search),
    accentInsensitiveContains(users.name, search),
    accentInsensitiveContains(assistants.name, search),
    accentInsensitiveContains(drones.name, search),
    accentInsensitiveContains(cultureTypes.name, search),
    accentInsensitiveContains(products.name, search),
    accentInsensitiveContains(plots.name, search),
    accentInsensitiveContains(customers.name, search),
    accentInsensitiveContains(farms.name, search),
    accentInsensitiveContains(serviceOrders.number, search),
  )!;
}
