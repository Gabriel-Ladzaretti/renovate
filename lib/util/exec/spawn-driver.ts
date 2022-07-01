import { logger } from '../../logger';
import { rawSpawn } from './common';
import type { RawSpawnOptions } from './types';

void (async () => {
  const opts: RawSpawnOptions = {
    encoding: 'utf8',
    shell: true,
    timeout: 10000,
  };
  logger.info('driver function - START');
  logger.info({ options: opts }, 'spawn options');
  try {
    const cmd = 'npm run non-existent-script';
    // const cmd = 'docker';
    // const cmd = 'ls /usr';
    // const cmd = 'npm run spawn-testing-script'
    logger.info(`driver function - RUN - "${cmd}"`);
    const { stdout, stderr } = await rawSpawn(cmd, opts);
    if (stdout) {
      logger.info(stdout);
    }
    if (stderr) {
      logger.warn(stderr);
    }
  } catch (err) {
    logger.error(err as string);
  }
  logger.info('driver function - END');
})();
