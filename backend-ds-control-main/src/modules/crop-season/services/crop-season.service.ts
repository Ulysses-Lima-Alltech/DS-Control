import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import type { PaginatedRequest } from "@common/types/paginated-request.types";
import { toOperationalDateYMD } from "@common/utils/operational-date";
import { CropSeasonVM, type CropSeasonViewModelSchema } from "@models/crop-season.vm";
import { app } from "@modules/app/app.module";
import { ProductRepository } from "@repositories/products/product.repository";
import { CropSeasonRepository } from "@repositories/crop-seasons/crop-season.repository";
import type { CreateCropSeasonDTO } from "../dto/create-crop-season.dto";
import type { UpdateCropSeasonDTO } from "../dto/update-crop-season.dto";

export class CropSeasonService {
  private readonly cropSeasonRepository = new CropSeasonRepository();
  private readonly productRepository = new ProductRepository();

  public async createCropSeason(data: CreateCropSeasonDTO): Promise<void> {
    app.log.info("[CropSeasonService] - Starting crop season creation with name %s", data.name);

    await this.validateProductIds(data.productIds);
    await this.cropSeasonRepository.createCropSeason(data);

    app.log.info("[CropSeasonService] - Crop season created successfully");
  }

  public async listCropSeasons(
    page: number,
    limit: number,
    search?: string,
    status: "active" | "inactive" = "active",
  ): Promise<PaginatedRequest<typeof CropSeasonViewModelSchema>> {
    app.log.info("[CropSeasonService] - Listing crop seasons");

    const [data, totalCount] = await Promise.all([
      this.cropSeasonRepository.listCropSeasons(page, limit, search, status),
      this.cropSeasonRepository.countCropSeasons(search, status),
    ]);

    return {
      data: data.map((item) => CropSeasonVM.toViewModel(item)),
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  public async getCropSeasonById(cropSeasonId: string) {
    const cropSeason = await this.cropSeasonRepository.getCropSeasonById(cropSeasonId);
    if (!cropSeason) {
      throw new AppError("Safra não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }

    return cropSeason;
  }

  public async getCurrentCropSeason() {
    const todayYmd = toOperationalDateYMD(new Date());
    return this.cropSeasonRepository.getCurrentCropSeason(todayYmd);
  }

  public async updateCropSeason(cropSeasonId: string, data: UpdateCropSeasonDTO) {
    await this.validateProductIds(data.productIds);

    const updatedCropSeason = await this.cropSeasonRepository.updateCropSeason(cropSeasonId, data);
    if (!updatedCropSeason) {
      throw new AppError("Safra não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }

    return updatedCropSeason;
  }

  public async deleteCropSeason(cropSeasonId: string): Promise<void> {
    const deleted = await this.cropSeasonRepository.deleteCropSeason(cropSeasonId);
    if (!deleted) {
      throw new AppError("Safra não encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async validateProductIds(productIds: string[]): Promise<void> {
    const uniqueProductIds = Array.from(new Set(productIds));
    if (uniqueProductIds.length === 0) {
      throw new AppError("Selecione ao menos um produto", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    const products = await this.productRepository.getProductsByIds(uniqueProductIds);
    if (products.length !== uniqueProductIds.length) {
      throw new AppError(
        "Um ou mais produtos são inválidos ou inativos",
        HTTP_STATUS_CODES.BAD_REQUEST,
      );
    }
  }
}

