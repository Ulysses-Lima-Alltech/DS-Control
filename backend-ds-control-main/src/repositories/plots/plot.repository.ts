import { db } from "@infra/database";
import { plots } from "@infra/database/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { CreatePlot, Plot } from "./plot.types";

export class PlotRepository {
  /**
   * @description Create a new plot
   * @param {CreatePlot} data - The plot data
   * @returns {Promise<Plot>} The created plot
   */
  public async createPlot({
    name,
    farmId,
    customerId,
    geoJson,
    externalId,
    hectare,
  }: CreatePlot): Promise<Plot> {
    const [plot] = await db
      .insert(plots)
      .values({
        name,
        farmId,
        customerId,
        geoJson,
        externalId,
        hectare,
      })
      .onConflictDoUpdate({
        target: [plots.farmId, plots.externalId],
        set: {
          name,
          farmId,
          customerId,
          geoJson,
          externalId,
          hectare,
          updatedAt: new Date(),
          deletedAt: null,
        },
      })
      .returning();

    if (!plot) {
      throw new Error("Failed to create plot");
    }

    return this.formatPlot(plot)!;
  }

  /**
   * @description Get a plot by ID (excluding soft-deleted)
   * @param {string} id - The plot's ID
   * @returns {Promise<Plot | null>} The plot
   */
  public async getPlotById(id: string): Promise<Plot | null> {
    const plot = await db.query.plots.findFirst({
      where: and(eq(plots.id, id), isNull(plots.deletedAt)),
    });

    return this.formatPlot(plot);
  }

  /**
   * @description Get all plots (excluding soft-deleted)
   * @returns {Promise<Plot[]>} The plots list
   */
  public async getAllPlots(
    page: number,
    limit: number,
  ): Promise<Plot[]> {
    const plotsList = await db.query.plots.findMany({
      where: isNull(plots.deletedAt),
      offset: (page - 1) * limit,
      limit,
    });

    return plotsList.map(this.formatPlot).filter(Boolean) as Plot[];
  }

  /**
   * @description Get plots by farm ID (excluding soft-deleted)
   * @param {string} farmId - The farm's ID
   * @returns {Promise<Plot[]>} The plots list
   */
  public async getPlotsByFarmId(farmId: string): Promise<Plot[]> {
    const plotsList = await db.query.plots.findMany({
      where: and(eq(plots.farmId, farmId), isNull(plots.deletedAt)),
    });

    return plotsList.map(this.formatPlot).filter(Boolean) as Plot[];
  }

  /**
   * @description Get plots by customer ID (excluding soft-deleted)
   * @param {string} customerId - The customer's ID
   * @returns {Promise<Plot[]>} The plots list
   */
  public async getPlotsByCustomerId(customerId: string): Promise<Plot[]> {
    const plotsList = await db.query.plots.findMany({
      where: and(eq(plots.customerId, customerId), isNull(plots.deletedAt)),
    });

    return plotsList.map(this.formatPlot).filter(Boolean) as Plot[];
  }

  /**
   * @description Update a plot
   * @param {string} id - The plot's ID
   * @param {Partial<typeof plots.$inferInsert>} data - The plot data
   * @returns {Promise<Plot | null>} The updated plot
   */
  public async updatePlot(
    id: string,
    data: Partial<typeof plots.$inferInsert>,
  ): Promise<Plot | null> {
    const [plot] = await db.update(plots).set(data).where(eq(plots.id, id)).returning();

    return this.formatPlot(plot);
  }

  /**
   * @description Soft delete a plot
   * @param {string} id - The plot's ID
   * @returns {Promise<void>}
   */
  public async deletePlot(id: string): Promise<void> {
    await db.update(plots)
      .set({ deletedAt: new Date() })
      .where(and(eq(plots.id, id), isNull(plots.deletedAt)));
  }

  /**
   * @description Get plots by their IDs (excluding soft-deleted)
   * @param {string[]} ids - The plots' IDs
   * @returns {Promise<Plot[]>} The plots
   */
  public async getPlotsByIds(ids: string[]): Promise<Plot[]> {
    const list = await db.query.plots.findMany({
      where: and(inArray(plots.id, ids), isNull(plots.deletedAt)),
    });

    return list.filter(Boolean).map(this.formatPlot) as Plot[];
  }

  /**
   * @description Soft delete plots by external IDs
   * @param {string[]} externalIds - The plots' external IDs
   * @param {string} farmId - The farm ID to scope the deletion
   * @returns {Promise<void>}
   */
  public async softDeletePlotsByExternalIds(externalIds: string[], farmId: string): Promise<void> {
    await db.update(plots)
      .set({ deletedAt: new Date() })
      .where(and(
        inArray(plots.externalId, externalIds),
        eq(plots.farmId, farmId),
        isNull(plots.deletedAt)
      ));
  }

  /**
   * @description Restore a soft-deleted plot
   * @param {string} id - The plot's ID
   * @returns {Promise<void>}
   */
  public async restorePlot(id: string): Promise<void> {
    await db.update(plots)
      .set({ deletedAt: null })
      .where(eq(plots.id, id));
  }

  /**
   * @description Permanently delete a plot (hard delete)
   * @param {string} id - The plot's ID
   * @returns {Promise<void>}
   */
  public async permanentlyDeletePlot(id: string): Promise<void> {
    await db.delete(plots).where(eq(plots.id, id));
  }

  /**
   * @description Format a plot
   * @param {typeof plots.$inferSelect} plot - The plot
   * @returns {Plot} The formatted plot
   */
  private formatPlot(plot?: typeof plots.$inferSelect | null): Plot | null {
    if (!plot) return null;

    return {
      id: plot.id,
      name: plot.name,
      farmId: plot.farmId,
      customerId: plot.customerId,
      geoJson: plot.geoJson as Record<string, unknown>,
      externalId: plot.externalId,
      hectare: plot.hectare,
      createdAt: plot.createdAt,
      updatedAt: plot.updatedAt,
      deletedAt: plot.deletedAt,
    };
  }
}
