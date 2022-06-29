import { logger } from '../lib/logger';
import { rawExec } from '../lib/util/exec/common';
import type { RawExecOptions } from '../lib/util/exec/types';

void (async () => {
  const controller = new AbortController();
  const { signal } = controller;

  const opts: RawExecOptions = {
    encoding: 'utf8',
    signal,
  };

  const { stdout, stderr } = await rawExec('npm -v', opts);

  if (stdout) {
    logger.info(stdout);
  }
  if (stderr) {
    logger.info(stderr);
  }
  logger.info('done');
})();
