import { GlobalConfig } from '../../../../../config/global';
import type { RepositoryCacheType } from '../../../../../config/types';
import { logger } from '../../../../../logger';
import type { CacheClient } from '../../types';
import { LocalRepoCache } from './local';
import { S3RepoCache } from './s3';

export class CacheClientFactory {
  private static client: CacheClient | null;

  static get(repository: string, cacheType: RepositoryCacheType): CacheClient {
    if (this.client) {
      return this.client;
    }

    const platform = GlobalConfig.get('platform')!;
    const type = cacheType.split('://')[0].trim().toLowerCase();

    switch (type) {
      case 'local':
        this.client = new LocalRepoCache(platform, repository);
        break;
      case 's3':
        this.client = new S3RepoCache(platform, repository, cacheType);
        break;
      // istanbul ignore next: untestable
      default:
        this.client = new LocalRepoCache(platform, repository);
        logger.warn(
          { repositoryCacheType: cacheType, parsedType: type },
          `Repository cache type not supported using type "local" instead`
        );
        break;
    }

    return this.client;
  }

  static reset(): void {
    this.client = null;
  }
}
