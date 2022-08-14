import { Readable } from 'stream';
import { PutObjectCommand, PutObjectCommandInput } from '@aws-sdk/client-s3';
import { logger } from '../../../../../../logger';
import { getS3Client, parseS3Url } from '../../../../../s3';
import { streamToString } from '../../../../../streams';
import type { CacheClient, RepoCacheRecord } from '../../../types';

export class S3RepoCache implements CacheClient {
  private readonly s3Client;
  private readonly bucket;

  constructor(
    private platform: string,
    private repository: string,
    url: string
  ) {
    this.bucket = parseS3Url(url)?.Bucket;
    this.s3Client = getS3Client();
  }

  async read(): Promise<string | undefined> {
    const cacheFileName = this.getCacheFileName();
    const s3Params = {
      Bucket: this.bucket,
      Key: cacheFileName,
    };
    try {
      const { Body: res } = await this.s3Client.getObject(s3Params);
      logger.debug(
        { repository: this.repository },
        'S3RepoCache: read success'
      );
      if (res instanceof Readable) {
        return JSON.parse(await streamToString(res));
      }
    } catch (err) {
      logger.warn({ repository: this.repository }, 'S3RepoCache: read failure');
    }
    return undefined;
  }

  async write(data: RepoCacheRecord): Promise<void> {
    const cacheFileName = this.getCacheFileName();
    const s3Params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: cacheFileName,
      Body: JSON.stringify(data),
      ContentType: 'text/plain',
    };
    try {
      const res = await this.s3Client.send(new PutObjectCommand(s3Params));
      logger.debug(
        { repository: this.repository, res },
        'S3RepoCache: write success'
      );
    } catch (err) {
      logger.debug(
        { repository: this.repository, err },
        'S3RepoCache: write failure'
      );
    }
  }

  private getCacheFileName(): string {
    return `${this.platform}/${this.repository}/cache.json`;
  }
}
