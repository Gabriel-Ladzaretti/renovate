import type { RepositoryCacheType } from '../../../../config/types';
import { logger } from '../../../../logger';
import type { RepoCache } from '../types';
import { LocalRepositoryCache } from './local';

export class CacheFactory {
  private static client: RepoCache | null;

  static get(
    repository: string,
    cacheType: RepositoryCacheType = 'local'
  ): RepoCache {
    switch (cacheType) {
      case 'local':
        this.client = new LocalRepositoryCache(repository);
        break;
      default:
        this.client = new LocalRepositoryCache(repository);
        logger.warn(
          { cacheType },
          `Repository cache type not supported using type "local" instead`
        );
        break;
    }

    return this.client;
  }
}
