import { logger } from '../../logger';
import { rawSpawn } from './common';
// import { rawExec } from './common';
import type { RawSpawnOptions } from './types';

void (async () => {
  const cmds: string[] = [];
  const opts: RawSpawnOptions = {
    encoding: 'utf8',
    shell: true,
    // timeout: 5000
  };
  logger.info('driver function - START');
  logger.info({ options: opts }, 'spawn options');
  cmds.push('npm run non-existent-script');
  cmds.push('docker');
  cmds.push('docker image rm alpine');
  cmds.push('docker images');
  cmds.push('docker pull alpine');
  cmds.push('docker images');
  cmds.push('npm run spawn-testing-script');
  cmds.push('ls /usr');

  for (const cmd of cmds) {
    logger.info(`run cmd - START - "${cmd}"`);
    try {
      // const cmd = 'npm run non-existent-script';
      // const cmd = 'docker';
      // const cmd = 'ls /usr';
      // const cmd = 'npm run spawn-testing-script';
      const { stdout, stderr } = await rawSpawn(cmd, opts);
      // const { stdout, stderr } = await rawExec(cmd, {encoding: 'utf8', timeout: 0});
      if (stdout) {
        logger.info(stdout);
      }
      if (stderr) {
        logger.warn(stderr);
      }
    } catch (err) {
      logger.error(err as string);
    }
    logger.info(`run cmd - END - "${cmd}"`);
  }
  logger.info('driver function - END');
})();
