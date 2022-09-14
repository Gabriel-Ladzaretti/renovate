import type { UpdateType } from '../../config/types';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../cache/package';
import * as hostRules from '../host-rules';
import { Http } from '../http';

const hostType = 'merge-confidence';
const http = new Http(hostType);

const MERGE_CONFIDENCE = ['low', 'neutral', 'high', 'very high'] as const;
type MergeConfidenceTuple = typeof MERGE_CONFIDENCE;
export type MergeConfidence = MergeConfidenceTuple[number];

export const confidenceLevels: Record<MergeConfidence, number> = {
  low: -1,
  neutral: 0,
  high: 1,
  'very high': 2,
};

export function isMergeConfidence(value: string): value is MergeConfidence {
  return MERGE_CONFIDENCE.includes(value as MergeConfidence);
}

export function isActiveConfidenceLevel(confidence: string): boolean {
  return confidence !== 'low' && isMergeConfidence(confidence);
}

export function satisfiesConfidenceLevel(
  confidence: MergeConfidence,
  minimumConfidence: MergeConfidence
): boolean {
  return confidenceLevels[confidence] >= confidenceLevels[minimumConfidence];
}

const updateTypeConfidenceMapping: Record<UpdateType, MergeConfidence | null> =
  {
    pin: 'high',
    digest: 'neutral',
    pinDigest: 'high',
    bump: 'neutral',
    lockFileMaintenance: 'neutral',
    lockfileUpdate: 'neutral',
    rollback: 'neutral',
    replacement: 'neutral',
    major: null,
    minor: null,
    patch: null,
  };

export async function getMergeConfidenceLevel(
  datasource: string,
  depName: string,
  currentVersion: string,
  newVersion: string,
  updateType: UpdateType
): Promise<MergeConfidence | undefined> {
  const { token } = hostRules.find({
    url: 'https://badges.renovateapi.com',
    hostType,
  });
  if (!token) {
    return undefined;
  }
  if (!(currentVersion && newVersion && updateType)) {
    return 'neutral';
  }
  const mappedConfidence = updateTypeConfidenceMapping[updateType];
  if (mappedConfidence) {
    return mappedConfidence;
  }
  const url = `https://badges.renovateapi.com/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`;
  const cachedResult = await packageCache.get(hostType, token + url);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let confidence: MergeConfidence = 'neutral';
  try {
    const res = (await http.getJson<{ confidence: MergeConfidence }>(url)).body;
    if (isMergeConfidence(res.confidence)) {
      confidence = res.confidence;
    }
  } catch (err) {
    if (err.statusCode === 403) {
      logger.error(
        { err },
        'Merge Confidence API token rejected - aborting run'
      );
      throw new ExternalHostError(err, hostType);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.error({ err }, 'Merge Confidence API failure: 5xx - aborting run');
      throw new ExternalHostError(err, hostType);
    }
    logger.debug({ err }, 'Error fetching merge confidence');
  }
  await packageCache.set(hostType, token + url, confidence, 60);
  return confidence;
}
