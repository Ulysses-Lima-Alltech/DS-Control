import { db } from "@infra/database";
import { applications, djiApplicationLinks, djiFlightAssets, djiFlights } from "@infra/database/schema";
import { and, eq, gte, lt } from "drizzle-orm";
import type {
  ApprovedDjiFlightForApplication,
  DjiApplicationCandidateContext,
  DjiApplicationLink,
  DjiFlightCandidate,
  DjiFlight,
  DjiFlightAsset,
  DjiFlightWithAssets,
  UpsertDjiApplicationLinkInput,
  UpsertDjiFlightAssetInput,
  UpsertDjiFlightInput,
} from "./dji.types";

export class DjiRepository {
  public async getApplicationCandidateContext(applicationId: string): Promise<DjiApplicationCandidateContext | null> {
    const application = await db.query.applications.findFirst({
      where: eq(applications.id, applicationId),
      with: {
        pilot: { columns: { name: true } },
        drone: { columns: { name: true } },
        plot: { columns: { name: true, hectare: true } },
      },
    });

    if (!application) return null;

    return {
      id: application.id,
      date: application.date,
      hectares: application.hectares,
      observations: application.observations,
      pilot: application.pilot,
      drone: application.drone,
      plot: application.plot,
    };
  }

  public async applicationExists(applicationId: string): Promise<boolean> {
    const application = await db.query.applications.findFirst({
      columns: { id: true },
      where: eq(applications.id, applicationId),
    });

    return Boolean(application);
  }

  public async getFlightByRecordNumber(recordNumber: string): Promise<DjiFlightWithAssets | null> {
    const flight = await db.query.djiFlights.findFirst({
      where: eq(djiFlights.recordNumber, recordNumber),
      with: { assets: true },
    });

    if (!flight) return null;

    return {
      ...this.formatFlight(flight),
      assets: this.formatAsset(flight.assets),
    };
  }

  public async listFlightsByDate(date: Date): Promise<DjiFlightWithAssets[]> {
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const flights = await db.query.djiFlights.findMany({
      where: and(gte(djiFlights.flightDate, date), lt(djiFlights.flightDate, nextDate)),
      with: { assets: true },
      orderBy: (table, { asc }) => [asc(table.startTime), asc(table.recordNumber)],
    });

    return flights.map((flight) => ({
      ...this.formatFlight(flight),
      assets: this.formatAsset(flight.assets),
    }));
  }

  public async upsertFlight(input: UpsertDjiFlightInput): Promise<{ flight: DjiFlight; created: boolean }> {
    const existing = await db.query.djiFlights.findFirst({
      where: eq(djiFlights.recordNumber, input.recordNumber),
    });

    if (existing) {
      const [updated] = await db
        .update(djiFlights)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(djiFlights.id, existing.id))
        .returning();

      return { flight: this.formatFlight(updated), created: false };
    }

    const [created] = await db
      .insert(djiFlights)
      .values(input)
      .returning();

    return { flight: this.formatFlight(created), created: true };
  }

  public async upsertFlightAsset(input: UpsertDjiFlightAssetInput): Promise<DjiFlightAsset> {
    const existing = await db.query.djiFlightAssets.findFirst({
      where: eq(djiFlightAssets.djiFlightId, input.djiFlightId),
    });

    if (existing) {
      const [updated] = await db
        .update(djiFlightAssets)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(djiFlightAssets.id, existing.id))
        .returning();

      return this.formatAsset(updated)!;
    }

    const [created] = await db
      .insert(djiFlightAssets)
      .values(input)
      .returning();

    return this.formatAsset(created)!;
  }

  public async upsertApplicationLink(input: UpsertDjiApplicationLinkInput): Promise<DjiApplicationLink> {
    const existing = await db.query.djiApplicationLinks.findFirst({
      where: and(
        eq(djiApplicationLinks.applicationId, input.applicationId),
        eq(djiApplicationLinks.djiFlightId, input.djiFlightId),
      ),
    });

    if (existing) {
      const [updated] = await db
        .update(djiApplicationLinks)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(djiApplicationLinks.id, existing.id))
        .returning();

      return this.formatApplicationLink(updated);
    }

    const [created] = await db
      .insert(djiApplicationLinks)
      .values(input)
      .returning();

    return this.formatApplicationLink(created);
  }

  public async listApprovedFlightsByApplication(applicationId: string): Promise<ApprovedDjiFlightForApplication[]> {
    const rows = await db
      .select({
        recordNumber: djiFlights.recordNumber,
        flightDate: djiFlights.flightDate,
        startTime: djiFlights.startTime,
        aircraftName: djiFlights.aircraftName,
        pilotName: djiFlights.pilotName,
        taskAreaHa: djiFlights.taskAreaHa,
        estimatedAppliedAreaHa: djiFlights.estimatedAppliedAreaHa,
        pngS3Key: djiFlightAssets.pngS3Key,
        metadataS3Key: djiFlightAssets.metadataS3Key,
        bucket: djiFlightAssets.bucket,
        region: djiFlightAssets.region,
      })
      .from(djiApplicationLinks)
      .innerJoin(djiFlights, eq(djiApplicationLinks.djiFlightId, djiFlights.id))
      .innerJoin(djiFlightAssets, eq(djiFlightAssets.djiFlightId, djiFlights.id))
      .where(and(
        eq(djiApplicationLinks.applicationId, applicationId),
        eq(djiApplicationLinks.status, "approved"),
      ));

    return rows;
  }

  public async listFlightCandidatesByApplicationDate(
    applicationId: string,
    date: Date,
  ): Promise<DjiFlightCandidate[]> {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const nextDate = new Date(startDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const rows = await db
      .select({
        id: djiFlights.id,
        recordNumber: djiFlights.recordNumber,
        flightDate: djiFlights.flightDate,
        startTime: djiFlights.startTime,
        aircraftName: djiFlights.aircraftName,
        pilotName: djiFlights.pilotName,
        taskAreaHa: djiFlights.taskAreaHa,
        estimatedAppliedAreaHa: djiFlights.estimatedAppliedAreaHa,
        rawMetadata: djiFlights.rawMetadata,
        pngS3Key: djiFlightAssets.pngS3Key,
        metadataS3Key: djiFlightAssets.metadataS3Key,
        bucket: djiFlightAssets.bucket,
        region: djiFlightAssets.region,
        alreadyLinkedStatus: djiApplicationLinks.status,
      })
      .from(djiFlights)
      .innerJoin(djiFlightAssets, eq(djiFlightAssets.djiFlightId, djiFlights.id))
      .leftJoin(
        djiApplicationLinks,
        and(
          eq(djiApplicationLinks.djiFlightId, djiFlights.id),
          eq(djiApplicationLinks.applicationId, applicationId),
        ),
      )
      .where(and(gte(djiFlights.flightDate, startDate), lt(djiFlights.flightDate, nextDate)));

    return rows.map((row) => ({
      ...row,
      alreadyLinkedStatus: row.alreadyLinkedStatus as DjiFlightCandidate["alreadyLinkedStatus"],
    }));
  }

  private formatFlight(flight: typeof djiFlights.$inferSelect): DjiFlight {
    return {
      id: flight.id,
      recordNumber: flight.recordNumber,
      flightDate: flight.flightDate,
      startTime: flight.startTime,
      endTime: flight.endTime,
      aircraftName: flight.aircraftName,
      droneSerial: flight.droneSerial,
      pilotName: flight.pilotName,
      taskAreaHa: flight.taskAreaHa,
      estimatedAppliedAreaHa: flight.estimatedAppliedAreaHa,
      routeSpacingM: flight.routeSpacingM,
      routeDistanceKm: flight.routeDistanceKm,
      coordinateCount: flight.coordinateCount,
      bbox: flight.bbox,
      center: flight.center,
      rawMetadata: flight.rawMetadata,
      createdAt: flight.createdAt,
      updatedAt: flight.updatedAt,
    };
  }

  private formatAsset(asset?: typeof djiFlightAssets.$inferSelect | null): DjiFlightAsset | null {
    if (!asset) return null;

    return {
      id: asset.id,
      djiFlightId: asset.djiFlightId,
      bucket: asset.bucket,
      region: asset.region,
      rawKmlS3Key: asset.rawKmlS3Key,
      pngS3Key: asset.pngS3Key,
      routeGeoJsonS3Key: asset.routeGeoJsonS3Key,
      bufferGeoJsonS3Key: asset.bufferGeoJsonS3Key,
      metadataS3Key: asset.metadataS3Key,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private formatApplicationLink(link: typeof djiApplicationLinks.$inferSelect): DjiApplicationLink {
    return {
      id: link.id,
      applicationId: link.applicationId,
      djiFlightId: link.djiFlightId,
      recordNumber: link.recordNumber,
      status: link.status as DjiApplicationLink["status"],
      confidenceScore: link.confidenceScore,
      matchType: link.matchType,
      scoreReasons: link.scoreReasons,
      approvedBy: link.approvedBy,
      approvedAt: link.approvedAt,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}
