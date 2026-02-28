import pc from 'picocolors';

export function info(msg: string): void {
  console.log(pc.blue('ℹ'), msg);
}

export function success(msg: string): void {
  console.log(pc.green('✔'), msg);
}

export function warn(msg: string): void {
  console.log(pc.yellow('⚠'), msg);
}

export function error(msg: string): void {
  console.log(pc.red('✖'), msg);
}

export function fileCreated(path: string): void {
  console.log(pc.green('  ✔'), `Created ${pc.dim(path)}`);
}

export function fileUpdated(path: string): void {
  console.log(pc.green('  ✔'), `Updated ${pc.dim(path)}`);
}

export function fileUnchanged(path: string): void {
  console.log(pc.dim('  ─'), `No changes ${pc.dim(path)}`);
}

export function header(title: string): void {
  console.log();
  console.log(pc.bold(pc.cyan(`◆ ${title}`)));
  console.log(pc.dim('│'));
}

export function step(msg: string): void {
  console.log(pc.dim('├'), msg);
}

export function footer(msg: string): void {
  console.log(pc.dim('│'));
  console.log(pc.dim('└'), pc.green(msg));
}
