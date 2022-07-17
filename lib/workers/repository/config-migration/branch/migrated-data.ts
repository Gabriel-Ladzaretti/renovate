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

function extractValue(src: string, key: string, isArray: boolean): string {
  const re = regEx(`\\"?${key}`);
  const op = isArray ? '[' : '{';
  const cl = isArray ? ']' : '}';
  const index = src.indexOf(op, src.search(re));

  if (index === -1) {
    return '';
  }

  const stack: string[] = [];
  let val = '';

  for (let i = index; i < src.length; i += 1) {
    if (src[i] === op) {
      stack.push(src[i]);
    } else if (src[i] === cl) {
      stack.pop();
      if (stack.length === 0) {
        val = src.slice(index, i + 1);
        break;
      }
    }
  }
  return val;
}

function restoreUserFormat(
  original: string,
  migrated: string,
  json5 = false
): string {
  const org = JSON.parse(original);
  const mig = JSON.parse(migrated);
  let restored = migrated;

  for (const [key, valOrg] of Object.entries(org)) {
    if (!Object.prototype.hasOwnProperty.call(mig, key)) {
      continue;
    }
    switch (typeof valOrg) {
      case 'number':
      case 'boolean':
      case 'string':
        if (mig[key as keyof typeof mig] === valOrg) {
          const entryRe = regEx(`\\"?${key}\\"?[^,]*,`);
          const replacement = original.match(entryRe)?.[0];
          if (replacement) {
            restored = restored.replace(entryRe, replacement);
          }
        }
        break;
      case 'object':
        {
          const valOrgStr = json5
            ? JSON5.stringify(valOrg)
            : JSON.stringify(valOrg);

          const valMigStr = json5
            ? JSON5.stringify(mig[key as keyof typeof mig])
            : JSON.stringify(mig[key as keyof typeof mig]);

          if (valOrgStr === valMigStr) {
            const orgVal = extractValue(original, key, valOrg instanceof Array);
            const newVal = extractValue(migrated, key, valOrg instanceof Array);
            restored = restored.replace(newVal, orgVal);
          }
        }
        break;
      default:
        break;
    }
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
        content = JSON5.stringify(migratedConfig, undefined, indentSpace);
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

      content = restoreUserFormat(raw!, content);
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
