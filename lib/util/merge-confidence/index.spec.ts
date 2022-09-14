import * as httpMock from '../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../constants/error-messages';
import { logger } from '../../logger';
import * as memCache from '../cache/memory';
import * as hostRules from '../host-rules';
import {
  getMergeConfidenceLevel,
  isActiveConfidenceLevel,
  satisfiesConfidenceLevel,
} from '.';

describe('util/merge-confidence/index', () => {
  describe('isActiveConfidenceLevel()', () => {
    it('returns false if null', () => {
      expect(isActiveConfidenceLevel(null as never)).toBeFalse();
    });

    it('returns false if low', () => {
      expect(isActiveConfidenceLevel('low')).toBeFalse();
    });

    it('returns false if nonsense', () => {
      expect(isActiveConfidenceLevel('nonsense')).toBeFalse();
    });

    it('returns true if valid value (high)', () => {
      expect(isActiveConfidenceLevel('high')).toBeTrue();
    });
  });

  describe('satisfiesConfidenceLevel()', () => {
    it('returns false if less', () => {
      expect(satisfiesConfidenceLevel('low', 'high')).toBeFalse();
    });

    it('returns true if equal', () => {
      expect(satisfiesConfidenceLevel('high', 'high')).toBeTrue();
    });

    it('returns true if more', () => {
      expect(satisfiesConfidenceLevel('very high', 'high')).toBeTrue();
    });
  });

  describe('getMergeConfidenceLevel()', () => {
    beforeEach(() => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      memCache.reset();
    });

    afterEach(() => {
      hostRules.clear();
    });

    it('returns neutral if undefined updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.0',
          '25.0.0',
          undefined as never
        )
      ).toBe('neutral');
    });

    it('returns neutral if irrelevant updateType', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.1.0',
          '25.0.0',
          'bump'
        )
      ).toBe('neutral');
    });

    it('returns high if pinning', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.1',
          '25.0.1',
          'pin'
        )
      ).toBe('high');
    });

    it('returns neutral if no token', async () => {
      hostRules.clear();
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '24.2.0',
          '25.0.0',
          'major'
        )
      ).toBeUndefined();
    });

    it('returns valid confidence level', async () => {
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '24.3.0';
      const newVersion = '25.0.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { confidence: 'high' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'major'
        )
      ).toBe('high');
    });

    it('returns neutral if invalid confidence level', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.1.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(200, { nope: 'nope' });
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
    });

    it('returns neutral if non 403/5xx exception from API', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.4.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(404);
      expect(
        await getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).toBe('neutral');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.anything(),
        'Error fetching merge confidence'
      );
    });

    it('throws on 403-Forbidden from API', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.4.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(403);

      await expect(
        getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'Merge Confidence API token rejected - aborting run'
      );
    });

    it('throws on 5xx host errors from API', async () => {
      hostRules.add({ hostType: 'merge-confidence', token: '123test' });
      const datasource = 'npm';
      const depName = 'renovate';
      const currentVersion = '25.0.0';
      const newVersion = '25.4.0';
      httpMock
        .scope('https://badges.renovateapi.com')
        .get(
          `/packages/${datasource}/${depName}/${newVersion}/confidence.api/${currentVersion}`
        )
        .reply(503);

      await expect(
        getMergeConfidenceLevel(
          datasource,
          depName,
          currentVersion,
          newVersion,
          'minor'
        )
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
      expect(logger.error).toHaveBeenCalledWith(
        expect.anything(),
        'Merge Confidence API failure: 5xx - aborting run'
      );
    });

    it('returns high if pinning digest', async () => {
      expect(
        await getMergeConfidenceLevel(
          'npm',
          'renovate',
          '25.0.1',
          '25.0.1',
          'pinDigest'
        )
      ).toBe('high');
    });
  });
});
