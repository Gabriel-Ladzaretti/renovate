import { ChildProcess, SpawnOptions, spawn } from 'child_process';
import { logger } from '../lib/logger';

export interface RawSpawnOptions extends SpawnOptions {
  encoding: BufferEncoding;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  process: ChildProcess;
}

const rawSpawn = (cmd: string, opts: RawSpawnOptions): Promise<SpawnResult> => {
  const [command, ...args] = cmd.split(/\s+/);
  const encoding: BufferEncoding = opts.encoding;
  const cp = spawn(command, args, opts);
  return new Promise<SpawnResult>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    // handle node streams
    cp.stdout?.on('data', (data: Buffer) => {
      stdout.push(data);
    });
    cp.stderr?.on('data', (data: Buffer) => {
      stderr.push(data);
    });

    // handle child process
    cp.on('error', (error: Buffer) => {
      reject(error);
    });
    cp.on('close', (code: number) => {
      if (code !== 0) {
        reject(Buffer.concat(stderr).toString(encoding));
        return;
      }
      resolve({
        stderr: Buffer.concat(stderr).toString(encoding),
        stdout: Buffer.concat(stdout).toString(encoding),
        process: cp,
      });
    });
  });
};

void (async () => {
  const controller = new AbortController();
  const { signal } = controller;

  const opts: RawSpawnOptions = {
    detached: true,
    encoding: 'utf8',
    signal,
  };

  const {
    stdout,
    stderr,
    process: child, // this can be omitted and be handled inside rawSpawn
  } = await rawSpawn('npm init -y', opts);

  if (stdout) {
    logger.info(stdout);
  }
  if (stderr) {
    logger.info(stderr);
  }
  logger.info(`pid: ${child.pid!}`);
  logger.info('done');
})();
