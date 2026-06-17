import { z } from "zod";

const DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const ImportDjiFlightsFromS3Schema = z.object({
  date: DateSchema,
  bucket: z.string().min(1),
  prefix: z.string().min(1).default("dji"),
  region: z.string().min(1).default("us-east-1"),
});

export type ImportDjiFlightsFromS3DTO = z.infer<typeof ImportDjiFlightsFromS3Schema>;

export const DjiFlightsQuerySchema = z.object({
  date: DateSchema.optional(),
});

export const DjiRecordNumberParamsSchema = z.object({
  recordNumber: z.string().min(1),
});

export const ApplicationDjiFlightsParamsSchema = z.object({
  applicationId: z.string().uuid(),
});

export const ApplicationDjiFlightLinkParamsSchema = z.object({
  applicationId: z.string().uuid(),
  recordNumber: z.string().min(1),
});

export const LinkDjiFlightSchema = z.object({
  status: z.enum(["suggested", "approved", "rejected"]).default("approved"),
  confidenceScore: z.number().min(0).max(100).optional(),
  matchType: z.string().optional(),
  scoreReasons: z.array(z.string()).optional(),
});

export type LinkDjiFlightDTO = z.infer<typeof LinkDjiFlightSchema>;

export const PatchDjiFlightLinkSchema = z.object({
  status: z.enum(["suggested", "approved", "rejected"]),
  confidenceScore: z.number().min(0).max(100).optional(),
  matchType: z.string().optional(),
  scoreReasons: z.array(z.string()).optional(),
});

export type PatchDjiFlightLinkDTO = z.infer<typeof PatchDjiFlightLinkSchema>;
