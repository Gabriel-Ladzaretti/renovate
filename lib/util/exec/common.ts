import { ChildProcess, spawn } from 'child_process';
import type { ExecResult, RawSpawnOptions } from './types';

const promisifySpawn = (
  cmd: string,
  opts: RawSpawnOptions
): Promise<ExecResult> => {
  return new Promise((resolve, reject) => {
    const encoding: BufferEncoding = opts.encoding;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const cp: ChildProcess = spawn(cmd, {
      ...opts,
      shell: true,
      detached: true,
      stdio: ['ignore', 1, 2],
    });

    // handle node streams
    cp.stdout?.on('data', (data: Buffer) => stdout.push(data));
    cp.stderr?.on('data', (data: Buffer) => stderr.push(data));

    // handle child process
    cp.on('error', (error) => {
      reject(error);
    });
    cp.on('exit', (code: number) => {
      if (code !== 0) {
        reject(Buffer.concat(stderr).toString(encoding));
        return;
      }
      resolve({
        stderr: Buffer.concat(stderr).toString(encoding),
        stdout: Buffer.concat(stdout).toString(encoding),
      });
    });
  });
};

export const rawExec: (
  cmd: string,
  opts: RawSpawnOptions
) => Promise<ExecResult> = promisifySpawn;
