import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../config/global';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';
import { commitAndPush } from '../../../../modules/platform/commit';
import {
  getFile,
  isBranchBehindBase,
  isBranchModified,
} from '../../../../util/git';
import { OnboardingState, defaultConfigFile, toSha256 } from '../common';
import { OnboardingCommitMessageFactory } from './commit-message';
import { getOnboardingConfigContents } from './config';

export async function rebaseOnboardingBranch(
  config: RenovateConfig,
  previousConfigHash?: string
): Promise<string | null> {
  logger.debug('Checking if onboarding branch needs rebasing');
  const configFile = defaultConfigFile(config);
  const existingContents =
    (await getFile(configFile, config.onboardingBranch)) ?? '';
  const currentConfigHash = toSha256(existingContents);
  const contents = await getOnboardingConfigContents(config, configFile);

  if (is.nullOrUndefined(previousConfigHash)) {
    logger.debug('Missing previousConfigHash bodyStruct prop in onboarding PR');
    OnboardingState.prUpdateRequested = true;
  } else if (previousConfigHash !== currentConfigHash) {
    logger.debug('Onboarding config has been modified by the user');
    OnboardingState.prUpdateRequested = true;
  }

  // TODO #7154
  if (await isBranchModified(config.onboardingBranch!)) {
    logger.debug('Onboarding branch has been edited and cannot be rebased');
    return null;
  }

  // TODO #7154
  if (
    contents === existingContents &&
    !(await isBranchBehindBase(config.onboardingBranch!))
  ) {
    logger.debug('Onboarding branch is up to date');
    return null;
  }

  logger.debug('Rebasing onboarding branch');
  OnboardingState.prUpdateRequested = true;
  // istanbul ignore next
  const commitMessageFactory = new OnboardingCommitMessageFactory(
    config,
    configFile
  );
  const commitMessage = commitMessageFactory.create();

  // istanbul ignore if
  if (GlobalConfig.get('dryRun')) {
    logger.info('DRY-RUN: Would rebase files in onboarding branch');
    return null;
  }

  // TODO #7154
  return commitAndPush({
    branchName: config.onboardingBranch!,
    files: [
      {
        type: 'addition',
        path: configFile,
        contents,
      },
    ],
    message: commitMessage.toString(),
    platformCommit: !!config.platformCommit,
  });
}
