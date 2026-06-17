import { relations } from "drizzle-orm";
import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { applications } from "./applications.schema";

export const djiFlights = pgTable("dji_flights", {
  id: uuid("id").primaryKey().defaultRandom(),
  recordNumber: text("record_number").notNull(),
  flightDate: timestamp("flight_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  aircraftName: text("aircraft_name"),
  droneSerial: text("drone_serial"),
  pilotName: text("pilot_name"),
  taskAreaHa: numeric("task_area_ha", { precision: 12, scale: 4 }),
  estimatedAppliedAreaHa: numeric("estimated_applied_area_ha", { precision: 12, scale: 4 }),
  routeSpacingM: numeric("route_spacing_m", { precision: 10, scale: 4 }),
  routeDistanceKm: numeric("route_distance_km", { precision: 12, scale: 4 }),
  coordinateCount: integer("coordinate_count"),
  bbox: jsonb("bbox"),
  center: jsonb("center"),
  rawMetadata: jsonb("raw_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("dji_flights_record_number_unique_index").on(table.recordNumber),
  index("dji_flights_record_number_index").on(table.recordNumber),
  index("dji_flights_flight_date_index").on(table.flightDate),
  index("dji_flights_aircraft_name_index").on(table.aircraftName),
  index("dji_flights_pilot_name_index").on(table.pilotName),
]);

export const djiFlightAssets = pgTable("dji_flight_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  djiFlightId: uuid("dji_flight_id").references(() => djiFlights.id, { onDelete: "cascade" }).notNull(),
  bucket: text("bucket").notNull(),
  region: text("region").notNull(),
  rawKmlS3Key: text("raw_kml_s3_key").notNull(),
  pngS3Key: text("png_s3_key").notNull(),
  routeGeoJsonS3Key: text("route_geojson_s3_key").notNull(),
  bufferGeoJsonS3Key: text("buffer_geojson_s3_key").notNull(),
  metadataS3Key: text("metadata_s3_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("dji_flight_assets_dji_flight_id_unique_index").on(table.djiFlightId),
  index("dji_flight_assets_dji_flight_id_index").on(table.djiFlightId),
]);

export const djiApplicationLinks = pgTable("dji_application_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  djiFlightId: uuid("dji_flight_id").references(() => djiFlights.id, { onDelete: "cascade" }).notNull(),
  recordNumber: text("record_number").notNull(),
  status: text("status").notNull().default("suggested"),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  matchType: text("match_type"),
  scoreReasons: jsonb("score_reasons"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("dji_application_links_application_flight_unique_index").on(table.applicationId, table.djiFlightId),
  index("dji_application_links_application_id_index").on(table.applicationId),
  index("dji_application_links_dji_flight_id_index").on(table.djiFlightId),
  index("dji_application_links_record_number_index").on(table.recordNumber),
  index("dji_application_links_status_index").on(table.status),
]);

export const djiFlightsRelations = relations(djiFlights, ({ one, many }) => ({
  assets: one(djiFlightAssets, {
    fields: [djiFlights.id],
    references: [djiFlightAssets.djiFlightId],
  }),
  applicationLinks: many(djiApplicationLinks),
}));

export const djiFlightAssetsRelations = relations(djiFlightAssets, ({ one }) => ({
  flight: one(djiFlights, {
    fields: [djiFlightAssets.djiFlightId],
    references: [djiFlights.id],
  }),
}));

export const djiApplicationLinksRelations = relations(djiApplicationLinks, ({ one }) => ({
  application: one(applications, {
    fields: [djiApplicationLinks.applicationId],
    references: [applications.id],
  }),
  flight: one(djiFlights, {
    fields: [djiApplicationLinks.djiFlightId],
    references: [djiFlights.id],
  }),
}));
