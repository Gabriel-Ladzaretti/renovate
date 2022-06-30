import { logger } from '../lib/logger';
import { rawExec } from '../lib/util/exec/common';
import type { RawSpawnOptions } from '../lib/util/exec/types';

void (async () => {
  const controller = new AbortController();
  const { signal } = controller;

  const opts: RawSpawnOptions = {
    encoding: 'utf8',
    signal,
  };

  try {
    const { stdout, stderr } = await rawExec('docker', opts);
    if (stdout) {
      logger.info(stdout);
    }
    if (stderr) {
      logger.warn(stderr);
    }
  } catch (err) {
    logger.error(err);
  }
  logger.info('done');
})();
