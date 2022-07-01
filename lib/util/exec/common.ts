import { ChildProcess, exec, spawn } from 'child_process';
import { promisify } from 'util';
import type { ExecResult, RawExecOptions, RawSpawnOptions } from './types';

function stringify(
  stream: Buffer[],
  encoding: BufferEncoding = 'utf8'
): string {
  return Buffer.concat(stream).toString(encoding);
}

function promisifySpawn(
  cmd: string,
  opts: RawSpawnOptions
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const encoding: BufferEncoding = opts.encoding;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let cp: ChildProcess;
    opts.detached = true; // force detached

    if (opts.shell) {
      const [command, ...args] = cmd.split(/\s+/);
      cp = spawn(command, args, opts);
    } else {
      cp = spawn(cmd, opts);
    }
    cp.unref();

    // handle streams
    cp.stdout?.on('data', (data: Buffer) => {
      // process.stdout.write(data.toString());
      stdout.push(data);
    });
    cp.stderr?.on('data', (data: Buffer) => {
      // process.stderr.write(data.toString());
      stderr.push(data);
    });

    // handle process events
    cp.on('error', (error) => {
      reject(error.message);
    });
    cp.on('exit', (code: number) => {
      if (cp.signalCode) {
        stderr.push(
          Buffer.from(
            `process pid=${cp.pid as number} "${cmd}" killed with signal "${
              cp.signalCode
            }"`
          )
        );
        process.kill(-(cp.pid as number)); // kill process tree
      }
      if (code !== 0) {
        reject(stringify(stderr, encoding));
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
