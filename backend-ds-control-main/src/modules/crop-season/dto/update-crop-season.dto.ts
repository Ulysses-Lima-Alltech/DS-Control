import z from "zod";
import { CreateCropSeasonSchema } from "./create-crop-season.dto";

export const UpdateCropSeasonSchema = CreateCropSeasonSchema;

export type UpdateCropSeasonDTO = z.infer<typeof UpdateCropSeasonSchema>;
