import detectIndent from 'detect-indent';
import JSON5 from 'json5';
import prettier from 'prettier';
import { migrateConfig } from '../../../../config/migration';
import { logger } from '../../../../logger';
import { readLocalFile } from '../../../../util/fs';
import { getFileList } from '../../../../util/git';
import { regEx } from '../../../../util/regex';
import { detectRepoFileConfig } from '../../init/merge';

export interface MigratedData {
  content: string;
  filename: string;
}

interface Indent {
  amount: number;
  indent: string;
  type?: string;
}

const prettierConfigFilenames = new Set([
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.json5',
  '.prettierrc.js',
  '.prettierrc.cjs',
  'prettier.config.js',
  'prettier.config.cjs',
  '.prettierrc.toml',
]);

export async function applyPrettierFormatting(
  content: string,
  parser: string,
  indent: Indent
): Promise<string> {
  const fileList = await getFileList();
  let prettierExists = fileList.some((file) =>
    prettierConfigFilenames.has(file)
  );
  if (!prettierExists) {
    try {
      const packageJsonContent = await readLocalFile('package.json', 'utf8');
      prettierExists =
        packageJsonContent && JSON.parse(packageJsonContent).prettier;
    } catch {
      logger.warn('Invalid JSON found in package.json');
    }
  }

  if (!prettierExists) {
    return content;
  }
  const options = {
    parser,
    tabWidth: indent.amount === 0 ? 2 : indent.amount,
    useTabs: indent.type === 'tab',
  };

  return prettier.format(content, options);
}

function quote(
  strings: TemplateStringsArray,
  src: string,
  str: string
): string {
  const search = src.match(regEx(`['"]?${str}`))?.[0] ?? '';
  const q = search.match(regEx(/['"]/))?.[0] ?? '';
  return `${strings[1]}${q}${str}${q}${strings[2]}`;
}

function extractValue(
  src: string,
  key: string,
  isArray: boolean
): string | null {
  const re = regEx(`\\"?${key}`);
  const op = isArray ? '[' : '{';
  const cl = isArray ? ']' : '}';
  const index = src.indexOf(op, src.search(re));
  const stack: string[] = [];
  let val = '';

  if (index === -1) {
    return '';
  }

  for (let i = index; i < src.length; i += 1) {
    if (src[i] === op) {
      stack.push(src[i]);
    }
    if (src[i] === cl) {
      stack.pop();
      if (stack.length === 0) {
        val = src.slice(index, i + 1);
        break;
      }
    }
  }

  return stack.length ? null : val;
}

function recursionBaseCase(
  originalRaw: string,
  restored: string,
  key: string,
  value: string
): string {
  let replace: string | undefined;
  let search: string | undefined;

  if (isNaN(parseInt(key))) {
    // inside object
    search = getValueKeyFormatting(restored);
    replace = getValueKeyFormatting(originalRaw);
  } else {
    // inside array
    search = getValueFormatting(restored);
    replace = getValueFormatting(originalRaw);
  }

  if (search && replace) {
    return restored.replace(search, replace);
  }

  return restored;

  function getValueKeyFormatting(raw: string): string | undefined {
    const k = quote`${raw}${key}`;
    const v = quote`${raw}${value}`;
    const replaceKey = raw.match(regEx(`\\s*${k}\\s*:\\s*`))?.[0];
    if (!replaceKey) {
      return restored;
    }
    const replaceRe = regEx(`\\s*${replaceKey}${v}\\s*,?\\s*`);
    return raw.match(replaceRe)?.[0];
  }

  function getValueFormatting(raw: string): string | undefined {
    return raw.match(regEx(quote`${raw}\\s*${value}\\s*,?\\s*`))?.[0];
  }
}

function restoreUserFormat(
  originalRaw: string,
  migratedRaw: string,
  isJson5 = false
): string {
  const original = (isJson5 ? JSON5 : JSON).parse(originalRaw);
  const migrated = (isJson5 ? JSON5 : JSON).parse(migratedRaw);
  let restored = migratedRaw;

  for (const [key, value] of Object.entries(original)) {
    if (!Object.prototype.hasOwnProperty.call(migrated, key)) {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value !== 'object') {
      if (value === migrated[key as keyof typeof migrated]) {
        restored = recursionBaseCase(
          originalRaw,
          restored,
          key,
          value as string
        );
      }
      continue;
    }

    const search = extractValue(migratedRaw, key, value instanceof Array);
    const replacement = extractValue(originalRaw, key, value instanceof Array);

    if (!search || !replacement) {
      continue;
    }

    restored = restored.replace(
      search,
      restoreUserFormat(replacement, search, isJson5).replace(/\$/g, '$$$') // escape '$'
    );
  }

  return restored;
}

export class MigratedDataFactory {
  // singleton
  private static data: MigratedData | null;

  static async getAsync(): Promise<MigratedData | null> {
    if (this.data) {
      return this.data;
    }
    const migrated = await this.build();

    if (!migrated) {
      return null;
    }

    this.data = migrated;
    return this.data;
  }

  static reset(): void {
    this.data = null;
  }

  private static async build(): Promise<MigratedData | null> {
    let res: MigratedData | null = null;
    try {
      const rc = await detectRepoFileConfig();
      const configFileParsed = rc?.configFileParsed || {};

      // get migrated config
      const { isMigrated, migratedConfig } = migrateConfig(configFileParsed);
      if (!isMigrated) {
        return null;
      }

      delete migratedConfig.errors;
      delete migratedConfig.warnings;

      const filename = rc.configFileName ?? '';
      const raw = await readLocalFile(filename, 'utf8');

      // indent defaults to 2 spaces
      // TODO #7154
      const indent = detectIndent(raw!);
      const indentSpace = indent.indent ?? '  ';
      let content: string;

      if (filename.endsWith('.json5')) {
        const userQuotes = raw!.match(/['"]/)?.[0] ?? '"';
        content = JSON5.stringify(migratedConfig, {
          space: indentSpace,
          quote: userQuotes,
        });
      } else {
        content = JSON.stringify(migratedConfig, undefined, indentSpace);
      }

      // format if prettier is found in the user's repo
      content = await applyPrettierFormatting(
        content,
        filename.endsWith('.json5') ? 'json5' : 'json',
        indent
      );
      if (!content.endsWith('\n')) {
        content += '\n';
      }

      content = restoreUserFormat(raw!, content, filename.endsWith('.json5'));
      res = { content, filename };
    } catch (err) {
      logger.debug(
        { err },
        'MigratedDataFactory.getAsync() Error initializing renovate MigratedData'
      );
    }
    return res;
  }
}
