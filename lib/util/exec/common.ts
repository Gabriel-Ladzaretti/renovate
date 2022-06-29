import { ChildProcess, exec } from 'child_process';
import type { ExecResult, RawExecOptions } from './types';

const execWrapper = (
  cmd: string,
  opts: RawExecOptions
): Promise<ExecResult> => {
  const cp: ChildProcess = exec(cmd, opts);
  return new Promise<ExecResult>((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    // handle node streams
    cp.stdout?.on('data', (data: string) => {
      stdout.push(data);
    });
    cp.stderr?.on('data', (data: string) => {
      stderr.push(data);
    });

    // handle child process
    cp.on('error', (error: string) => {
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
) => Promise<ExecResult> = execWrapper;
