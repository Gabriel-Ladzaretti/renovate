import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import type { ExecResult, RawExecOptions, RawSpawnOptions } from './types';

// https://man7.org/linux/man-pages/man7/signal.7.html#NAME
// Non TERM/CORE signals
const NONTERM = [
  'SIGCHLD',
  'SIGCLD',
  'SIGCONT',
  'SIGSTOP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGURG',
  'SIGWINCH',
];

function stringify(
  stream: Buffer[],
  encoding: BufferEncoding = 'utf8'
): string {
  return Buffer.concat(stream).toString(encoding);
}

function initStreamListeners(cp: ChildProcess): [Buffer[], Buffer[]] {
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  cp.stdout?.on('data', (data: Buffer) => {
    // process.stdout.write(data.toString());
    stdout.push(data);
  });
  cp.stderr?.on('data', (data: Buffer) => {
    // process.stderr.write(data.toString());
    stderr.push(data);
  });
  return [stdout, stderr];
}

function promisifySpawn(
  cmd: string,
  opts: RawSpawnOptions
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const encoding: BufferEncoding = opts.encoding;
    const [command, ...args] = cmd.split(/\s+/);
    const cp = spawn(command, args, { ...opts, detached: true }); // force detached
    const [stdout, stderr] = initStreamListeners(cp); // handle streams
    cp.unref();

    // handle process events
    cp.on('error', (error) => {
      reject(error.message);
    });

    cp.on('exit', (code: number, signal: string) => {
      if (signal && !NONTERM.includes(signal)) {
        const pid = cp.pid as number;
        const cmd = cp.spawnargs.join(' ');
        const msg = `PID= ${pid}\nCOMMAND= "${cmd}"\nSignaled with "${signal}"`;
        stderr.push(Buffer.from(msg));
        reject(stringify(stderr, encoding));
        process.kill(-pid); // kill process tree
        return;
      }
      if (code !== 0) {
        reject(stringify(stderr, encoding));
        return;
      }
      resolve({
        stderr: stringify(stderr, encoding),
        stdout: stringify(stdout, encoding),
      });
    });
  });
}

export const rawExec: (
  cmd: string,
  opts: RawExecOptions
) => Promise<ExecResult> = promisify(exec);

export const rawSpawn: (
  cmd: string,
  opts: RawSpawnOptions
) => Promise<ExecResult> = promisifySpawn;
