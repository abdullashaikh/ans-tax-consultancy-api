import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/apiError';

export class S3StorageService {
  private static s3Client: S3Client | null = null;

  private static getClient(): S3Client {
    if (!this.s3Client) {
      const accessKeyId =
        env.STORAGE_ACCESS_KEY || env.AWS_ACCESS_KEY_ID || process.env['AWS_ACCESS_KEY_ID'];
      const secretAccessKey =
        env.STORAGE_SECRET_KEY || env.AWS_SECRET_ACCESS_KEY || process.env['AWS_SECRET_ACCESS_KEY'];
      const region = env.STORAGE_REGION || process.env['AWS_REGION'] || 'ap-south-1';

      if (!accessKeyId || !secretAccessKey) {
        logger.warn('[S3StorageService] AWS credentials not configured. S3 operations may fail.');
      }

      this.s3Client = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? {
                accessKeyId: accessKeyId.trim(),
                secretAccessKey: secretAccessKey.trim(),
              }
            : undefined,
      });
    }

    return this.s3Client;
  }

  static getBucketName(): string {
    return env.STORAGE_BUCKET;
  }

  /**
   * Tests AWS S3 connectivity and bucket access.
   */
  static async testConnection(): Promise<{ connected: boolean; bucket: string; region: string }> {
    const client = this.getClient();
    const bucket = this.getBucketName();
    const region = env.STORAGE_REGION;

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      logger.info('✅ AWS S3 Bucket connection verified successfully:', { bucket, region });
      return { connected: true, bucket, region };
    } catch (error: any) {
      logger.error('❌ AWS S3 connection test failed:', {
        bucket,
        region,
        error: error.message,
        name: error.name,
      });
      throw error;
    }
  }

  /**
   * Generates a pre-signed S3 URL for secure direct browser PUT upload.
   */
  static async generatePresignedUploadUrl(params: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ uploadUrl: string; objectKey: string; expiresIn: number }> {
    const client = this.getClient();
    const bucket = this.getBucketName();
    const expiresIn = params.expiresInSeconds || env.SIGNED_URL_EXPIRY_SECONDS || 900;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        ContentType: params.contentType,
        ServerSideEncryption: 'AES256',
      });

      const uploadUrl = await getSignedUrl(client, command, { expiresIn });

      return {
        uploadUrl,
        objectKey: params.key,
        expiresIn,
      };
    } catch (error: any) {
      logger.error('[S3StorageService] Failed to generate pre-signed upload URL', {
        key: params.key,
        error: error.message,
      });
      throw ApiError.internal('Failed to initialize secure document upload URL.');
    }
  }

  /**
   * Generates a pre-signed S3 URL for secure time-limited document download/viewing.
   */
  static async generatePresignedDownloadUrl(params: {
    key: string;
    originalFileName?: string;
    expiresInSeconds?: number;
    disposition?: 'attachment' | 'inline';
  }): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const client = this.getClient();
    const bucket = this.getBucketName();
    const expiresIn = params.expiresInSeconds || env.SIGNED_URL_EXPIRY_SECONDS || 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    try {
      const isInline = params.disposition === 'inline';
      const cleanFileName = params.originalFileName ? params.originalFileName.replace(/"/g, '') : 'document';
      const encodedFileName = encodeURIComponent(cleanFileName);

      const contentDisposition = isInline
        ? `inline; filename="${cleanFileName}"; filename*=UTF-8''${encodedFileName}`
        : `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodedFileName}`;

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: params.key,
        ResponseContentDisposition: contentDisposition,
      });

      const downloadUrl = await getSignedUrl(client, command, { expiresIn });

      return { downloadUrl, expiresAt };
    } catch (error: any) {
      logger.error('[S3StorageService] Failed to generate pre-signed download URL', {
        key: params.key,
        error: error.message,
      });
      throw ApiError.internal('Failed to generate secure document download URL.');
    }
  }

  /**
   * Directly uploads a file buffer to S3.
   */
  static async uploadBuffer(params: {
    key: string;
    buffer: Buffer;
    contentType: string;
  }): Promise<{ objectKey: string; bucket: string; eTag?: string }> {
    const client = this.getClient();
    const bucket = this.getBucketName();

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
        ServerSideEncryption: 'AES256',
      });

      const result = await client.send(command);

      return {
        objectKey: params.key,
        bucket,
        eTag: result.ETag,
      };
    } catch (error: any) {
      logger.error('[S3StorageService] Failed to upload buffer to S3', {
        key: params.key,
        error: error.message,
      });
      throw ApiError.internal('Failed to upload file to cloud storage.');
    }
  }

  /**
   * Deletes an object from S3.
   */
  static async deleteObject(key: string): Promise<void> {
    const client = this.getClient();
    const bucket = this.getBucketName();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
    } catch (error: any) {
      logger.warn('[S3StorageService] Failed to delete object from S3', {
        key,
        error: error.message,
      });
    }
  }
}
