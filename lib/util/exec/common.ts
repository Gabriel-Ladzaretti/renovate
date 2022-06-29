import { ChildProcess, exec } from 'child_process';
import type { ExecResult, RawExecOptions } from './types';

const execPromisify = (
  cmd: string,
  opts: RawExecOptions
): Promise<ExecResult> => {
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const cp: ChildProcess = exec(cmd, opts);
    cp.stdout?.on('data', (data: string) => stdout.push(data));
    cp.stderr?.on('data', (data: string) => stderr.push(data));
    cp.on('error', (error) => {
      reject(error);
    });
    cp.on('close', (code: number) => {
      if (code !== 0) {
        reject(stderr.join());
        return;
      }
      resolve({
        stderr: stderr.join(),
        stdout: stdout.join(),
      });
    });
  });
};

export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = execPromisify;
