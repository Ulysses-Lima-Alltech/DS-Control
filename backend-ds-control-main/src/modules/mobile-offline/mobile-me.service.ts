import AppError from '@common/handlers/app-error';
import { HTTP_STATUS_CODES } from '@common/types/http-status.types';
import { ApplicationRepository } from '@repositories/applications/application.repository';
import { UserType } from '@repositories/users/user.types';

export type PilotSummary = {
  pilotId: string;
  historicalAppliedAreaHa: number;
  applicationsCount: number;
  lastApplicationAt: string | null;
  metricVersion: 1;
};

export class MobileMeService {
  constructor(private readonly applicationRepository = new ApplicationRepository()) {}

  public async getPilotSummary(userId: string, userType: string): Promise<PilotSummary> {
    if (userType !== UserType.PILOT) {
      throw new AppError('Resumo disponivel apenas para pilotos', HTTP_STATUS_CODES.FORBIDDEN);
    }

    const summary = await this.applicationRepository.getPilotApplicationSummary(userId);

    return {
      pilotId: userId,
      historicalAppliedAreaHa: Number(summary.historicalAppliedAreaHa.toFixed(2)),
      applicationsCount: summary.applicationsCount,
      lastApplicationAt: summary.lastApplicationAt?.toISOString() ?? null,
      metricVersion: 1,
    };
  }
}
