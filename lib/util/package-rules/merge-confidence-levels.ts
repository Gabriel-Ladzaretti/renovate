import is from '@sindresorhus/is';
import type { PackageRule, PackageRuleInputConfig } from '../../config/types';
import { Matcher } from './base';

export class MergeConfidenceMatcher extends Matcher {
  override matches(
    { mergeConfidenceLevel }: PackageRuleInputConfig,
    { matchMergeConfidenceLevels }: PackageRule
  ): boolean | null {
    if (is.undefined(matchMergeConfidenceLevels)) {
      return null;
    }
    return (
      is.truthy(mergeConfidenceLevel) &&
      matchMergeConfidenceLevels.includes(mergeConfidenceLevel)
    );
  }
}
