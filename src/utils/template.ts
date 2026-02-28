import Handlebars from 'handlebars';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getTemplatesDir(): string {
  // When bundled with tsup, all code is in dist/cli.js or dist/index.js
  // Templates are copied to dist/templates/ by tsup onSuccess
  const candidates = [
    join(__dirname, 'templates'),              // dist/templates/ (production — bundled)
    join(__dirname, '..', 'templates'),         // ../templates/ (if __dirname is dist/utils/)
    join(__dirname, '..', 'src', 'templates'),  // src/templates/ (dev — running from project root)
    join(__dirname, '..', '..', 'src', 'templates'), // two levels up
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Templates directory not found. Checked: ${candidates.join(', ')}`);
}

let templatesDir: string | null = null;
let partialsRegistered = false;

function ensureTemplatesDir(): string {
  if (!templatesDir) {
    templatesDir = getTemplatesDir();
  }
  return templatesDir;
}

// Register custom helpers
Handlebars.registerHelper('json', (context: unknown) => {
  return new Handlebars.SafeString(JSON.stringify(context));
});

Handlebars.registerHelper('ifEquals', function (
  this: unknown,
  a: unknown,
  b: unknown,
  options: Handlebars.HelperOptions,
) {
  return a === b ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('date', () => {
  return new Date().toISOString().split('T')[0];
});

export function registerPartials(): void {
  if (partialsRegistered) return;
  const dir = ensureTemplatesDir();
  const partialsDir = join(dir, 'partials');

  if (!existsSync(partialsDir)) return;

  const files = readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
  for (const file of files) {
    const name = file.replace('.hbs', '');
    const content = readFileSync(join(partialsDir, file), 'utf-8');
    Handlebars.registerPartial(name, content);
  }
  partialsRegistered = true;
}

export function loadTemplate(name: string): HandlebarsTemplateDelegate {
  registerPartials();
  const dir = ensureTemplatesDir();
  const filePath = join(dir, `${name}.hbs`);
  if (!existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }
  const source = readFileSync(filePath, 'utf-8');
  return Handlebars.compile(source);
}

export function loadMemoryTemplate(mode: string, fileName: string): string {
  const dir = ensureTemplatesDir();
  const filePath = join(dir, 'memory', mode, fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Memory template not found: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

export function loadPromptTemplate(fileName: string): string {
  const dir = ensureTemplatesDir();
  const filePath = join(dir, 'prompts', fileName);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt template not found: ${filePath}`);
  }
  return readFileSync(filePath, 'utf-8');
}

export { Handlebars };
