import { Client as MinioClient } from 'minio';
import { env } from '../config.js';

let _client: MinioClient | null = null;

export function minioClient(): MinioClient {
    if (!_client) {
        const [host, port] = env.MINIO_ENDPOINT.includes(':')
            ? env.MINIO_ENDPOINT.split(':')
            : [env.MINIO_ENDPOINT, '9000'];
        _client = new MinioClient({
            endPoint: host!,
            port: Number(port),
            useSSL: env.MINIO_SECURE,
            accessKey: env.MINIO_ROOT_USER,
            secretKey: env.MINIO_ROOT_PASSWORD,
        });
    }
    return _client;
}

export async function ensureBucket(): Promise<void> {
    const client = minioClient();
    const exists = await client.bucketExists(env.MINIO_BUCKET);
    if (!exists) await client.makeBucket(env.MINIO_BUCKET, 'us-east-1');
}

export async function presignedPutUrl(key: string, expiresSeconds = 60 * 60): Promise<string> {
    return minioClient().presignedPutObject(env.MINIO_BUCKET, key, expiresSeconds);
}

export async function presignedGetUrl(key: string, expiresSeconds = 60 * 60): Promise<string> {
    return minioClient().presignedGetObject(env.MINIO_BUCKET, key, expiresSeconds);
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await minioClient().putObject(env.MINIO_BUCKET, key, body, body.length, { 'Content-Type': contentType });
}

export async function deleteObject(key: string): Promise<void> {
    await minioClient().removeObject(env.MINIO_BUCKET, key);
}

export async function pingStorage(): Promise<boolean> {
    try {
        return await minioClient().bucketExists(env.MINIO_BUCKET);
    } catch {
        return false;
    }
}
