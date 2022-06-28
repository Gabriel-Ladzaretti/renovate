import { ChildProcess, SpawnOptionsWithoutStdio, spawn } from 'child_process';
import { logger } from '../lib/logger';

export interface RawSpawnOptions extends SpawnOptionsWithoutStdio {
  encoding?: BufferEncoding;
}

// import { exec } from 'child_process';
// import { promisify } from 'util';
// import type { ExecResult, RawExecOptions } from './types';
//
// export const rawExec: (
//   cmd: string,
//   opts: RawExecOptions
// ) => Promise<ExecResult> = promisify(exec);

export interface SpawnResult {
  stdout: string;
  stderr: string;
  process: ChildProcess;
}

const promisify = (
  child: ChildProcess,
  encoding: BufferEncoding = 'utf8'
): Promise<ChildProcess> => {
  return new Promise<ChildProcess>((resolve, reject) => {
    child.addListener('error', reject);
    child.addListener('exit', resolve);
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
  // const child = spawn('sleep', ['10'], opts);
  const child = spawn('npm', ['init', '-y'], opts);
  await promisify(child);
  logger.info('done');
})();
