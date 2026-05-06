import { MapboxNavigationStep } from '@/types/mapNavigation.type';
import {
  formatNavigationDistance,
  getManeuverRoadName,
  getManeuverTitle,
} from '@/utils/navigationInstructionUtils';

export const buildNavigationVoiceStepKey = (
  step: MapboxNavigationStep | null | undefined,
  activeStepIndex: number
) => {
  if (!step) return `empty-${activeStepIndex}`;

  return [
    activeStepIndex,
    step.instruction,
    step.maneuverType,
    step.maneuverModifier,
    step.maneuverLocation.longitude,
    step.maneuverLocation.latitude,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join('-');
};

const normalizeDistanceForSpeech = (distanceMeters?: number) => {
  const formattedDistance = formatNavigationDistance(distanceMeters);

  return formattedDistance
    .replace(/\bkm\b/g, 'quilômetros')
    .replace(/\bm\b/g, 'metros')
    .replace('.', '')
    .replace(',', ' vírgula ');
};

const normalizeManeuverTitleForSpeech = (step: MapboxNavigationStep) => {
  if (step.maneuverType === 'arrive') return 'Você chegou ao início da operação.';
  if (step.maneuverType === 'roundabout' || step.maneuverType === 'rotary')
    return 'entre na rotatória';
  if (step.maneuverType === 'turn' && step.maneuverModifier?.includes('right'))
    return 'vire à direita';
  if (step.maneuverType === 'turn' && step.maneuverModifier?.includes('left'))
    return 'vire à esquerda';
  if (step.maneuverType === 'turn' && step.maneuverModifier?.includes('straight'))
    return 'siga em frente';
  if (step.maneuverType === 'continue') return 'siga em frente';
  if (step.maneuverType === 'depart') return 'inicie a rota';
  if (step.maneuverType === 'merge') return 'entre na via';
  if (step.maneuverType === 'fork') return 'mantenha-se';
  if (step.maneuverType === 'end of road') return 'siga até o fim da via';

  return getManeuverTitle(step).toLocaleLowerCase('pt-BR');
};

export const buildSpokenNavigationInstruction = (
  step: MapboxNavigationStep | null | undefined,
  distanceToManeuverMeters?: number
) => {
  if (!step) return '';

  const maneuverTitle = normalizeManeuverTitleForSpeech(step);
  if (step.maneuverType === 'arrive') return maneuverTitle;

  const roadName = getManeuverRoadName(step);
  const distanceLabel = normalizeDistanceForSpeech(distanceToManeuverMeters ?? step.distanceMeters);
  const roadSuffix = roadName ? ` na ${roadName}` : '';

  if (distanceLabel && distanceLabel !== '--') {
    return `Em ${distanceLabel}, ${maneuverTitle}${roadSuffix}.`;
  }

  return `Prepare-se para ${maneuverTitle}${roadSuffix}.`;
};
