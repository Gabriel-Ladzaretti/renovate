import is from '@sindresorhus/is';
import type { UpdateType } from '../../config/types';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../cache/package';
import * as hostRules from '../host-rules';
import { Http } from '../http';

const hostType = 'merge-confidence';
const http = new Http(hostType);
let token: string | undefined;
let apiBaseUrl: string | undefined;

const supportedDatasources = ['npm', 'maven', 'pypi'];

const MERGE_CONFIDENCE = ['low', 'neutral', 'high', 'very high'] as const;
export type MergeConfidence = (typeof MERGE_CONFIDENCE)[number];

export const confidenceLevels: Record<MergeConfidence, number> = {
  low: -1,
  neutral: 0,
  high: 1,
  'very high': 2,
};

export function initMergeConfidence(): void {
  token = getApiToken(hostType);
  apiBaseUrl = getApiBaseUrl();
}

export function resetMergeConfidence(): void {
  token = undefined;
  apiBaseUrl = undefined;
}

export function isMergeConfidence(value: string): value is MergeConfidence {
  return MERGE_CONFIDENCE.includes(value as MergeConfidence);
}

export function isActiveConfidenceLevel(confidence: string): boolean {
  return isMergeConfidence(confidence) && confidence !== 'low';
}

export function satisfiesConfidenceLevel(
  confidence: MergeConfidence,
  minimumConfidence: MergeConfidence
): boolean {
  return confidenceLevels[confidence] >= confidenceLevels[minimumConfidence];
}

const updateTypeConfidenceMapping: Record<
  UpdateType,
  MergeConfidence | undefined
> = {
  pin: 'high',
  digest: 'neutral',
  pinDigest: 'high',
  bump: 'neutral',
  lockFileMaintenance: 'neutral',
  lockfileUpdate: 'neutral',
  rollback: 'neutral',
  replacement: 'neutral',
  major: undefined,
  minor: undefined,
  patch: undefined,
};

export async function getMergeConfidenceLevel(
  datasource: string,
  depName: string,
  currentVersion: string,
  newVersion: string,
  updateType: UpdateType
): Promise<MergeConfidence | undefined> {
  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    return undefined;
  }

  if (!supportedDatasources.includes(datasource)) {
    return undefined;
  }

  if (!(currentVersion && newVersion && updateType)) {
    return 'neutral';
  }

  const mappedConfidence = updateTypeConfidenceMapping[updateType];
  if (mappedConfidence) {
    return mappedConfidence;
  }

  return await queryApi(datasource, depName, currentVersion, newVersion);
}

/**
 * Checks the health of the Merge Confidence API by attempting to authenticate with it.
 *
 * @returns A Promise that resolves when the API health check is complete.
 *
 * @throws {ExternalHostError} If the authentication request to the API returns a 403 Forbidden status code or a 5xx
 * server-side error status code.
 *
 * @remarks
 * This function first checks that the API base URL and an authentication bearer token are defined before attempting to
 * authenticate with the API. If either the base URL or token is no defined, it will immediately return
 * without making a request.
 */
export async function checkMergeConfidenceApiHealth(): Promise<void> {
  initMergeConfidence();

  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    logger.trace('merge confidence api usage is disabled');
    return;
  }

  const url = `${apiBaseUrl}api/mc/json/datasource/depName/currentVersion/newVersion`;
  try {
    await http.getJson(url);
  } catch (err) {
    apiErrorHandler(err);
  }

  logger.debug('merge confidence api - successfully authenticated');
  return;
}

function getApiBaseUrl(): string | undefined {
  const baseFromEnv = process.env.RENOVATE_X_MERGE_CONFIDENCE_API_BASE_URL;

  if (is.nullOrUndefined(baseFromEnv)) {
    return;
  }

  let baseUrl: string | undefined;
  try {
    baseUrl = new URL(baseFromEnv).toString();
    logger.trace(
      { baseUrl },
      'found merge confidence api base url in environment variables'
    );
  } catch (err) {
    logger.warn({ err }, 'invalid merge confidence base url');
  }

  return baseUrl;
}

function getApiToken(hostType: string): string | undefined {
  return hostRules.find({
    hostType,
  })?.token;
}

/**
 * Queries the Merge Confidence API with the given package release information.
 *
 * @param datasource
 * @param depName
 * @param currentVersion
 * @param newVersion
 *
 * @returns The merge confidence level for the given package release.
 * @throws {ExternalHostError} If the authentication request to the API returns a 403 Forbidden status code or a 5xx server-side error status code.
 *
 * @remarks
 *
 * Results are caches for 60 minutes to reduce the number of API calls.
 */
async function queryApi(
  datasource: string,
  depName: string,
  currentVersion: string,
  newVersion: string
): Promise<MergeConfidence> {
  // istanbul ignore if: defensive, already been validated before calling this function
  if (is.nullOrUndefined(apiBaseUrl) || is.nullOrUndefined(token)) {
    return 'neutral';
  }

  const url = `${apiBaseUrl}api/mc/json/${datasource}/${depName}/${currentVersion}/${newVersion}`;
  const cacheKey = `${token}:${url}`;
  const cachedResult = await packageCache.get(hostType, cacheKey);

  // istanbul ignore if
  if (cachedResult) {
    logger.debug(
      { datasource, depName, currentVersion, newVersion, cachedResult },
      'using merge confidence cached result'
    );
    return cachedResult;
  }

  let confidence: MergeConfidence = 'neutral';
  try {
    const res = (await http.getJson<{ confidence: MergeConfidence }>(url)).body;
    if (isMergeConfidence(res.confidence)) {
      confidence = res.confidence;
    }
  } catch (err) {
    apiErrorHandler(err);
  }

  await packageCache.set(hostType, cacheKey, confidence, 60);
  return confidence;
}

/**
 * Handles errors returned by the Merge Confidence API.
 *
 * @param err - The error object returned by the API.
 * @throws {ExternalHostError} If the error is related to an issue with the external API host.
 *
 * @remarks
 * This function throws an ExternalHostError if authentication fails or an internal server error occurs.
 * Otherwise, it logs the error at the debug level.
 */
function apiErrorHandler(err: any): void {
  if (err.statusCode === 403) {
    logger.error({ err }, 'merge confidence api token rejected - aborting run');
    throw new ExternalHostError(err, hostType);
  }

  if (err.statusCode >= 500 && err.statusCode < 600) {
    logger.error({ err }, 'merge confidence api failure: 5xx - aborting run');
    throw new ExternalHostError(err, hostType);
  }

  logger.debug({ err }, 'error fetching merge confidence data');
}
