// Bounded transport for the same Docker controller. No shell, credential
// inheritance, retries, or standalone execution entrypoint.
import {spawn} from 'node:child_process';
export function boundedCommand(endpoint, args, input = '', timeout = 15000,
  {spawnProcess = spawn, schedule = setTimeout, cancel = clearTimeout} = {}) {
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30000 || Buffer.byteLength(input) > 1024 * 1024) throw Error('PROCESS_LIMIT_INVALID');
  return new Promise((resolve, reject) => {
    let child, timer, settled = false, length = 0;
    const out = [], err = [];
    const settle = (error, result) => {
      if (settled) return; settled = true; if (timer !== undefined) cancel(timer);
      if (error) {
        try {child?.kill('SIGKILL');} catch {}
        for (const stream of [child?.stdin, child?.stdout, child?.stderr]) stream?.destroy?.();
        reject(error);
      } else resolve(result);
    };
    try {
      child = spawnProcess('docker', ['--host', endpoint, ...args], {shell: false, windowsHide: true,
        env: {PATH: process.env.PATH}, stdio: ['pipe', 'pipe', 'pipe']});
      timer = schedule(() => settle(Error('DOCKER_COMMAND_TIMEOUT')), timeout);
      const collect = target => bytes => {
        if (settled) return;
        const chunk = Buffer.from(bytes); length += chunk.length;
        if (length > 65536) {settle(Error('DOCKER_OUTPUT_LIMIT')); return;}
        target.push(chunk);
      };
      child.stdout.on('data', collect(out)); child.stderr.on('data', collect(err));
      child.on('error', error => settle(error));
      child.on('close', (code, signal) => {
        if (signal || !Number.isInteger(code)) return settle(Error('DOCKER_COMMAND_INTERRUPTED'));
        settle(null, {code, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8')});
      });
      child.stdin.on('error', () => settle(Error('DOCKER_INPUT_INCOMPLETE')));
      child.stdin.end(input);
    } catch (error) {settle(error);}
  });
}
