import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import AppError from "@common/handlers/app-error";
import { HTTP_STATUS_CODES } from "@common/types/http-status.types";
import { app } from "@modules/app/app.module";
import { DjiRepository } from "@repositories/dji/dji.repository";
import type {
  ApprovedDjiFlightForApplication,
  DjiApplicationCandidateContext,
  DjiApplicationLinkStatus,
  DjiFlightCandidate,
} from "@repositories/dji/dji.types";
import type { ImportDjiFlightsFromS3DTO, LinkDjiFlightDTO, PatchDjiFlightLinkDTO } from "../dto/dji.dto";

type S3FlightIndex = {
  date?: string;
  totalFlights?: number;
  flights?: Array<{
    recordNumber?: string;
    metadataS3Key?: string;
    rawKmlS3Key?: string;
    pngS3Key?: string;
    routeGeoJsonS3Key?: string;
    bufferGeoJsonS3Key?: string;
  }>;
};

type DjiMetadata = {
  recordNumber?: string;
  flightDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  aircraftName?: string | null;
  taskAreaHa?: number | string | null;
  estimatedAppliedAreaHa?: number | string | null;
  routeSpacingM?: number | string | null;
  routeDistanceKm?: number | string | null;
  coordinateCount?: number | string | null;
  bbox?: unknown;
  center?: unknown;
  pilotName?: string | null;
  droneSerial?: string | null;
  rawMetadata?: unknown;
  s3?: {
    rawKmlKey?: string;
    pngKey?: string;
    routeGeoJsonKey?: string;
    bufferGeoJsonKey?: string;
    metadataKey?: string;
  };
};

type ImportError = {
  recordNumber: string | null;
  metadataS3Key: string | null;
  message: string;
};

type DjiCandidateRecommendedStatus = "strong_candidate" | "candidate" | "weak_candidate";

type ScoredDjiFlightCandidate = {
  recordNumber: string;
  flightDate: Date;
  startTime: string | null;
  aircraftName: string | null;
  pilotName: string | null;
  taskAreaHa: string | null;
  estimatedAppliedAreaHa: string | null;
  pngS3Key: string;
  pngSignedUrl: string | null;
  score: number;
  recommendedStatus: DjiCandidateRecommendedStatus;
  scoreReasons: string[];
  alreadyLinkedStatus?: DjiApplicationLinkStatus;
};

export class DjiService {
  private static readonly PNG_SIGNED_URL_EXPIRES_IN_SECONDS = 15 * 60;
  private readonly djiRepository = new DjiRepository();

  public async importFlightsFromS3(input: ImportDjiFlightsFromS3DTO) {
    app.log.info("[DjiService] - Importing DJI flights from S3 for %s", input.date);

    const s3 = new S3Client({ region: input.region });
    const datePart = this.dateToS3Part(input.date);
    const indexKey = this.s3Key(input.prefix, "renders", datePart, "flight-index.json");
    const flightIndex = await this.getJsonFromS3<S3FlightIndex>(s3, input.bucket, indexKey);
    const errors: ImportError[] = [];
    let created = 0;
    let updated = 0;

    for (const flight of flightIndex.flights || []) {
      const recordNumber = flight.recordNumber || null;
      const metadataS3Key = flight.metadataS3Key || null;

      try {
        if (!recordNumber) throw new Error("recordNumber ausente no flight-index.json");
        if (!metadataS3Key) throw new Error(`metadataS3Key ausente para ${recordNumber}`);

        const metadata = await this.getJsonFromS3<DjiMetadata>(s3, input.bucket, metadataS3Key);
        const normalized = this.normalizeMetadata(metadata, flight, input);
        const result = await this.djiRepository.upsertFlight(normalized.flight);
        await this.djiRepository.upsertFlightAsset({
          ...normalized.assets,
          djiFlightId: result.flight.id,
        });

        if (result.created) created += 1;
        else updated += 1;
      } catch (error) {
        errors.push({
          recordNumber,
          metadataS3Key,
          message: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    return {
      date: input.date,
      totalFlights: flightIndex.totalFlights ?? (flightIndex.flights || []).length,
      created,
      updated,
      errors,
    };
  }

  public async listFlights(date?: string) {
    if (!date) {
      throw new AppError("Informe date no formato YYYY-MM-DD", HTTP_STATUS_CODES.BAD_REQUEST);
    }

    return this.djiRepository.listFlightsByDate(this.parseDate(date));
  }

  public async getFlightByRecordNumber(recordNumber: string) {
    const flight = await this.djiRepository.getFlightByRecordNumber(recordNumber);

    if (!flight) {
      throw new AppError("Voo DJI nao encontrado", HTTP_STATUS_CODES.NOT_FOUND);
    }

    return flight;
  }

  public async listApprovedFlightsByApplication(applicationId: string) {
    await this.ensureApplicationExists(applicationId);
    const flights = await this.djiRepository.listApprovedFlightsByApplication(applicationId);

    return Promise.all(
      flights.map(async (flight) => ({
        ...flight,
        pngSignedUrl: await this.getPngSignedUrl(flight),
      })),
    );
  }

  public async listFlightCandidatesByApplication(applicationId: string): Promise<ScoredDjiFlightCandidate[]> {
    const application = await this.getApplicationCandidateContext(applicationId);
    const candidates = await this.djiRepository.listFlightCandidatesByApplicationDate(applicationId, application.date);
    const scoredCandidates = candidates
      .map((candidate) => {
        const scoreResult = this.scoreFlightCandidate(application, candidate);

        return {
          candidate,
          recordNumber: candidate.recordNumber,
          flightDate: candidate.flightDate,
          startTime: candidate.startTime,
          aircraftName: candidate.aircraftName,
          pilotName: candidate.pilotName,
          taskAreaHa: candidate.taskAreaHa,
          estimatedAppliedAreaHa: candidate.estimatedAppliedAreaHa,
          pngS3Key: candidate.pngS3Key,
          score: scoreResult.score,
          recommendedStatus: this.getRecommendedStatus(scoreResult.score),
          scoreReasons: scoreResult.reasons,
          ...(candidate.alreadyLinkedStatus ? { alreadyLinkedStatus: candidate.alreadyLinkedStatus } : {}),
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.recordNumber.localeCompare(b.recordNumber);
      })
      .slice(0, 50);

    return Promise.all(
      scoredCandidates.map(async ({ candidate, ...scoredCandidate }) => ({
        ...scoredCandidate,
        pngSignedUrl: await this.getPngSignedUrl(candidate),
      })),
    );
  }

  public async linkFlightToApplication(
    applicationId: string,
    recordNumber: string,
    input: LinkDjiFlightDTO | PatchDjiFlightLinkDTO,
    userId?: string,
  ) {
    await this.ensureApplicationExists(applicationId);
    const flight = await this.getFlightByRecordNumber(recordNumber);
    const status = input.status as DjiApplicationLinkStatus;
    const approvedAt = status === "approved" ? new Date() : null;

    return this.djiRepository.upsertApplicationLink({
      applicationId,
      djiFlightId: flight.id,
      recordNumber: flight.recordNumber,
      status,
      confidenceScore: input.confidenceScore === undefined ? null : String(input.confidenceScore),
      matchType: input.matchType ?? null,
      scoreReasons: input.scoreReasons ?? null,
      approvedBy: status === "approved" ? (userId ?? null) : null,
      approvedAt,
    });
  }

  private async ensureApplicationExists(applicationId: string): Promise<void> {
    const exists = await this.djiRepository.applicationExists(applicationId);

    if (!exists) {
      throw new AppError("Aplicacao nao encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }
  }

  private async getApplicationCandidateContext(applicationId: string): Promise<DjiApplicationCandidateContext> {
    const application = await this.djiRepository.getApplicationCandidateContext(applicationId);

    if (!application) {
      throw new AppError("Aplicacao nao encontrada", HTTP_STATUS_CODES.NOT_FOUND);
    }

    return application;
  }

  private scoreFlightCandidate(
    application: DjiApplicationCandidateContext,
    flight: DjiFlightCandidate,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (this.isSameDate(application.date, flight.flightDate)) {
      score += 30;
      reasons.push("flightDate igual a data da aplicacao (+30)");
    }

    if (this.isTextCompatible(flight.aircraftName, application.drone?.name)) {
      score += 20;
      reasons.push("drone compativel com a aplicacao (+20)");
    }

    if (this.hasRelevantNameIntersection(flight.pilotName, application.pilot?.name)) {
      score += 20;
      reasons.push("piloto compativel com a aplicacao (+20)");
    }

    if (this.hasApplicationTextMatch(application, flight)) {
      score += 15;
      reasons.push("texto da aplicacao encontrado nos metadados DJI (+15)");
    }

    const estimatedAppliedAreaHa = this.number(flight.estimatedAppliedAreaHa);
    const applicationAreaHa = this.number(application.hectares);
    if (estimatedAppliedAreaHa > 0 && applicationAreaHa > 0 && estimatedAppliedAreaHa <= applicationAreaHa) {
      score += 10;
      reasons.push("area estimada DJI positiva e menor ou igual a area aplicada DS (+10)");
    }

    if (flight.startTime) {
      score += 5;
      reasons.push("voo possui horario de inicio (+5)");
    }

    return { score, reasons };
  }

  private getRecommendedStatus(score: number): DjiCandidateRecommendedStatus {
    if (score >= 80) return "strong_candidate";
    if (score >= 50) return "candidate";
    return "weak_candidate";
  }

  private normalizeText(value: unknown): string {
    if (value === null || value === undefined) return "";

    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  private tokenize(value: unknown): string[] {
    return this.normalizeText(value)
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
  }

  private isTextCompatible(a: unknown, b: unknown): boolean {
    const normalizedA = this.normalizeText(a);
    const normalizedB = this.normalizeText(b);

    if (!normalizedA || !normalizedB) return false;
    return normalizedA === normalizedB || normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
  }

  private hasRelevantNameIntersection(a: unknown, b: unknown): boolean {
    const aTokens = new Set(this.tokenize(a).filter((token) => token.length >= 3));
    const bTokens = this.tokenize(b).filter((token) => token.length >= 3);

    if (aTokens.size === 0 || bTokens.length === 0) return false;
    return bTokens.some((token) => aTokens.has(token));
  }

  private hasApplicationTextMatch(
    application: DjiApplicationCandidateContext,
    flight: DjiFlightCandidate,
  ): boolean {
    const needles = [
      ...this.tokenize(application.observations).filter((token) => token.length >= 4),
      ...this.tokenize(application.plot?.name).filter((token) => token.length >= 3),
    ];

    if (!needles.length) return false;

    const haystack = this.normalizeText([
      flight.recordNumber,
      flight.metadataS3Key,
      flight.pngS3Key,
      JSON.stringify(flight.rawMetadata ?? {}),
    ].join(" "));

    return needles.some((token) => haystack.includes(token));
  }

  private isSameDate(a: Date, b: Date): boolean {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  private number(value: number | string | null | undefined): number {
    if (value === null || value === undefined || value === "") return 0;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  private normalizeMetadata(
    metadata: DjiMetadata,
    indexFlight: NonNullable<S3FlightIndex["flights"]>[number],
    input: ImportDjiFlightsFromS3DTO,
  ) {
    const recordNumber = metadata.recordNumber || indexFlight.recordNumber;
    if (!recordNumber) throw new Error("recordNumber ausente no metadata.json");

    const flightDate = metadata.flightDate || input.date;
    const metadataKey = metadata.s3?.metadataKey || indexFlight.metadataS3Key;
    if (!metadataKey) throw new Error(`metadataKey ausente para ${recordNumber}`);

    return {
      flight: {
        recordNumber,
        flightDate: this.parseDate(flightDate),
        startTime: metadata.startTime ?? null,
        endTime: metadata.endTime ?? null,
        aircraftName: metadata.aircraftName ?? null,
        droneSerial: metadata.droneSerial ?? null,
        pilotName: metadata.pilotName ?? null,
        taskAreaHa: this.decimal(metadata.taskAreaHa),
        estimatedAppliedAreaHa: this.decimal(metadata.estimatedAppliedAreaHa),
        routeSpacingM: this.decimal(metadata.routeSpacingM),
        routeDistanceKm: this.decimal(metadata.routeDistanceKm),
        coordinateCount: this.integer(metadata.coordinateCount),
        bbox: metadata.bbox ?? null,
        center: metadata.center ?? null,
        rawMetadata: metadata.rawMetadata ?? {},
      },
      assets: {
        bucket: input.bucket,
        region: input.region,
        rawKmlS3Key: metadata.s3?.rawKmlKey || indexFlight.rawKmlS3Key || this.s3Key(input.prefix, "raw-kml", this.dateToS3Part(input.date), `${recordNumber}.kml`),
        pngS3Key: metadata.s3?.pngKey || indexFlight.pngS3Key || this.s3Key(input.prefix, "renders", this.dateToS3Part(input.date), "png", `${recordNumber}.mapbox.png`),
        routeGeoJsonS3Key: metadata.s3?.routeGeoJsonKey || indexFlight.routeGeoJsonS3Key || this.s3Key(input.prefix, "renders", this.dateToS3Part(input.date), "geojson", `${recordNumber}.route.geojson`),
        bufferGeoJsonS3Key: metadata.s3?.bufferGeoJsonKey || indexFlight.bufferGeoJsonS3Key || this.s3Key(input.prefix, "renders", this.dateToS3Part(input.date), "geojson", `${recordNumber}.buffer.geojson`),
        metadataS3Key: metadataKey,
      },
    };
  }

  private async getJsonFromS3<T>(s3: S3Client, bucket: string, key: string): Promise<T> {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error(`Objeto S3 sem body: s3://${bucket}/${key}`);

    const body = await response.Body.transformToString("utf8");
    return JSON.parse(body) as T;
  }

  private async getPngSignedUrl(flight: ApprovedDjiFlightForApplication): Promise<string | null> {
    if (!flight.pngS3Key) return null;

    const s3 = new S3Client({ region: flight.region });
    const command = new GetObjectCommand({
      Bucket: flight.bucket,
      Key: flight.pngS3Key,
    });

    return getSignedUrl(s3, command, {
      expiresIn: DjiService.PNG_SIGNED_URL_EXPIRES_IN_SECONDS,
    });
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`Data invalida: ${value}. Use YYYY-MM-DD.`);
    }

    return new Date(`${value}T00:00:00.000Z`);
  }

  private dateToS3Part(value: string): string {
    return value.replace(/-/g, "_");
  }

  private s3Key(...parts: string[]): string {
    return parts
      .map((part) => part.replace(/^\/+|\/+$/g, ""))
      .filter(Boolean)
      .join("/");
  }

  private decimal(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : null;
  }

  private integer(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Number.isInteger(number) ? number : Math.trunc(number);
  }
}
