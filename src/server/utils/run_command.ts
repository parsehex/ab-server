import { spawn, SpawnOptions } from 'child_process';

interface Logger {
  info: (msg: string, ...args: any[]) => void;
  error: (msg: string, ...args: any[]) => void;
  warn?: (msg: string, ...args: any[]) => void;
  debug?: (msg: string, ...args: any[]) => void;
}

export async function runCommandDetached(
  command: string,
  args: string[],
  log: Logger,
  options: SpawnOptions = {}
): Promise<void> {
  log.info(`Running: ${command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'ignore',
      shell: false,
      detached: true,
      ...options,
    });

    proc.on('error', (err) => {
      log.error(`Error starting ${command}:`, err);
      reject(err);
    });

    proc.unref();
    resolve();
  });
}
