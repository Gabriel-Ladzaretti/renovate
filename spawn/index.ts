import { ChildProcess, SpawnOptionsWithoutStdio, spawn } from 'child_process';
import { logger } from '../lib/logger';

export interface RawSpawnOptions extends SpawnOptionsWithoutStdio {
  encoding?: BufferEncoding;
}

export interface SpawnResult {
  stdout: string;
  stderr: string;
  process: ChildProcess;
}

const rawSpwan = (
  cmd: string,
  args: ReadonlyArray<string>,
  options?: RawSpawnOptions
): Promise<SpawnResult> =>
  new Promise<SpawnResult>((resolve, reject) => {
    const encoding = options?.encoding;
    const child = spawn(cmd, args, options);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
      stdout.push(data);
    });
    child.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
      stderr.push(data);
    });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('close', (code) => {
      if (code === 1) {
        reject(Buffer.concat(stderr).toString(encoding ? encoding : undefined));
        return;
      }
      resolve({
        stderr: Buffer.concat(stderr).toString(encoding ? encoding : undefined),
        stdout: Buffer.concat(stdout).toString(encoding ? encoding : undefined),
        process: child,
      });
    });
  });

void (async () => {
  const controller = new AbortController();
  const { signal } = controller;
  const opts: RawSpawnOptions = {
    detached: true,
    timeout: 10,
    encoding: 'utf8',
    signal,
  };
  const c1 = await rawSpwan('npm', ['-v'], opts);
  logger.info(c1.process.pid.toString());
  const c3 = await rawSpwan('ls', ['/usr'], opts);
  const c4 = await rawSpwan('npm', ['init', '-y'], opts);
  const c5 = await rawSpwan('dir', [], opts);
  const c2 = await rawSpwan('ps', ['-ejH'], opts);
  logger.info('done');
})();
