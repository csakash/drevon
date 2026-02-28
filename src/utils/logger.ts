import pc from 'picocolors';

// ── ANSI RGB color helpers (Monokai Pro warm palette) ─────────
// No green, purple, or blue — only warm gradients and brights
function rgb(r: number, g: number, b: number): (text: string) => string {
  return (text: string) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

function rgbBold(r: number, g: number, b: number): (text: string) => string {
  return (text: string) => `\x1b[1m\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

const pink = rgb(255, 97, 136);     // #FF6188 — errors, strong emphasis
const orange = rgb(252, 152, 103);  // #FC9867 — brand accent, headers
const yellow = rgb(255, 216, 102);  // #FFD866 — success, highlights
const peach = rgb(255, 183, 148);   // #FFB794 — secondary accent
const warm = rgb(252, 252, 250);    // #FCFCFA — bright white

const pinkBold = rgbBold(255, 97, 136);
const orangeBold = rgbBold(252, 152, 103);
const yellowBold = rgbBold(255, 216, 102);

// Exported for use in other files
export const colors = { pink, orange, yellow, peach, warm, rgb, orangeBold, yellowBold, pinkBold };

export function info(msg: string): void {
  console.log(orange('  ●'), msg);
}

export function success(msg: string): void {
  console.log(yellow('  ✔'), pc.bold(msg));
}

export function warn(msg: string): void {
  console.log(peach('  ▲'), msg);
}

export function error(msg: string): void {
  console.log(pink('  ✖'), pc.bold(msg));
}

export function fileCreated(path: string): void {
  console.log(`  ${yellow('+')} ${peach(path)}`);
}

export function fileUpdated(path: string): void {
  console.log(`  ${orange('~')} ${peach(path)}`);
}

export function fileUnchanged(path: string): void {
  console.log(`  ${pc.dim('·')} ${pc.dim(path)}`);
}

export function header(title: string): void {
  console.log();
  console.log(pc.dim('  ┌ ') + orangeBold(title));
  console.log(pc.dim('  │'));
}

export function step(msg: string): void {
  console.log(pc.dim('  │ ') + msg);
}

export function footer(msg: string): void {
  console.log(pc.dim('  │'));
  console.log(pc.dim('  └ ') + yellowBold(msg));
}

export function divider(): void {
  console.log(pc.dim('  ─────────────────────────────────────'));
}

export function brand(msg: string): string {
  return orangeBold(msg);
}

export function highlight(msg: string): string {
  return yellow(msg);
}
