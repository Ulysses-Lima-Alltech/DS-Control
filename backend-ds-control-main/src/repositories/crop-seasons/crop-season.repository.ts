import { db } from "@infra/database";
import { cropSeasonProducts, cropSeasons } from "@infra/database/schema";
import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lte } from "drizzle-orm";
import type {
  CreateCropSeason,
  CropSeasonStatus,
  CropSeasonWithProducts,
  UpdateCropSeason,
} from "./crop-season.types";

export class CropSeasonRepository {
  public async createCropSeason(data: CreateCropSeason): Promise<CropSeasonWithProducts> {
    const uniqueProductIds = Array.from(new Set(data.productIds));

    const created = await db.transaction(async (tx) => {
      const [createdCropSeason] = await tx
        .insert(cropSeasons)
        .values({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
        })
        .returning({ id: cropSeasons.id });

      if (!createdCropSeason) {
        throw new Error("Failed to create crop season");
      }

      await tx.insert(cropSeasonProducts).values(
        uniqueProductIds.map((productId) => ({
          cropSeasonId: createdCropSeason.id,
          productId,
        })),
      );

      return createdCropSeason;
    });

    const cropSeason = await this.getCropSeasonById(created.id);
    if (!cropSeason) {
      throw new Error("Failed to retrieve created crop season");
    }

    return cropSeason;
  }

  public async listCropSeasons(
    page: number,
    limit: number,
    search?: string,
    status: CropSeasonStatus = "active",
  ): Promise<CropSeasonWithProducts[]> {
    const whereClause = this.buildListWhereClause(search, status);

    const list = await db.query.cropSeasons.findMany({
      where: whereClause,
      offset: (page - 1) * limit,
      limit,
      orderBy: (table, { desc }) => [desc(table.startDate), desc(table.createdAt)],
      with: {
        cropSeasonProducts: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return list.map((item) => this.formatCropSeasonWithProducts(item));
  }

  public async countCropSeasons(search?: string, status: CropSeasonStatus = "active"): Promise<number> {
    const whereClause = this.buildListWhereClause(search, status);
    const [result] = await db
      .select({ count: count() })
      .from(cropSeasons)
      .where(whereClause);

    return Number(result?.count ?? 0);
  }

  public async getCropSeasonById(id: string): Promise<CropSeasonWithProducts | null> {
    const cropSeason = await db.query.cropSeasons.findFirst({
      where: and(eq(cropSeasons.id, id), isNull(cropSeasons.deletedAt)),
      with: {
        cropSeasonProducts: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!cropSeason) {
      return null;
    }

    return this.formatCropSeasonWithProducts(cropSeason);
  }

  public async getCurrentCropSeason(todayYmd: string): Promise<CropSeasonWithProducts | null> {
    const list = await db.query.cropSeasons.findMany({
      where: and(
        isNull(cropSeasons.deletedAt),
        lte(cropSeasons.startDate, todayYmd),
        gte(cropSeasons.endDate, todayYmd),
      ),
      orderBy: (table, { desc }) => [desc(table.startDate), desc(table.createdAt)],
      limit: 1,
      with: {
        cropSeasonProducts: {
          with: {
            product: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!list[0]) {
      return null;
    }

    return this.formatCropSeasonWithProducts(list[0]);
  }

  public async updateCropSeason(id: string, data: UpdateCropSeason): Promise<CropSeasonWithProducts | null> {
    const uniqueProductIds = Array.from(new Set(data.productIds));

    const updated = await db.transaction(async (tx) => {
      const [updatedCropSeason] = await tx
        .update(cropSeasons)
        .set({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          updatedAt: new Date(),
        })
        .where(and(eq(cropSeasons.id, id), isNull(cropSeasons.deletedAt)))
        .returning({ id: cropSeasons.id });

      if (!updatedCropSeason) {
        return null;
      }

      await tx
        .delete(cropSeasonProducts)
        .where(eq(cropSeasonProducts.cropSeasonId, id));

      await tx.insert(cropSeasonProducts).values(
        uniqueProductIds.map((productId) => ({
          cropSeasonId: id,
          productId,
        })),
      );

      return updatedCropSeason;
    });

    if (!updated) {
      return null;
    }

    return this.getCropSeasonById(id);
  }

  public async deleteCropSeason(id: string): Promise<boolean> {
    const [deleted] = await db
      .update(cropSeasons)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(cropSeasons.id, id), isNull(cropSeasons.deletedAt)))
      .returning({ id: cropSeasons.id });

    return Boolean(deleted?.id);
  }

  private buildListWhereClause(search?: string, status: CropSeasonStatus = "active") {
    const whereConditions = [];

    if (search) {
      whereConditions.push(ilike(cropSeasons.name, `%${search}%`));
    }

    if (status === "inactive") {
      whereConditions.push(isNotNull(cropSeasons.deletedAt));
    } else {
      whereConditions.push(isNull(cropSeasons.deletedAt));
    }

    return and(...whereConditions);
  }

  private formatCropSeasonWithProducts(cropSeason: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    cropSeasonProducts?: Array<{
      product: {
        id: string;
        name: string;
      } | null;
    }> | null;
  }): CropSeasonWithProducts {
    const productMap = new Map<string, { id: string; name: string }>();

    for (const item of cropSeason.cropSeasonProducts ?? []) {
      if (item.product) {
        productMap.set(item.product.id, {
          id: item.product.id,
          name: item.product.name,
        });
      }
    }

    return {
      id: cropSeason.id,
      name: cropSeason.name,
      startDate: cropSeason.startDate,
      endDate: cropSeason.endDate,
      createdAt: cropSeason.createdAt,
      updatedAt: cropSeason.updatedAt,
      deletedAt: cropSeason.deletedAt,
      products: Array.from(productMap.values()),
    };
  }
}

