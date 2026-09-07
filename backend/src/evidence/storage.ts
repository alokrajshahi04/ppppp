import { Client as MinioClient } from 'minio';
import { env } from '../config.js';

let _client: MinioClient | null = null;
let _presignClient: MinioClient | null = null;

function splitEndpoint(endpoint: string): { host: string; port: number } {
    const [host, port] = endpoint.includes(':') ? endpoint.split(':') : [endpoint, '9000'];
    return { host: host!, port: Number(port) };
}

/** Client for server-side object operations (internal docker hostname). */
export function minioClient(): MinioClient {
    if (!_client) {
        const { host, port } = splitEndpoint(env.MINIO_ENDPOINT);
        _client = new MinioClient({
            endPoint: host,
            port,
            useSSL: env.MINIO_SECURE,
            accessKey: env.MINIO_ROOT_USER,
            secretKey: env.MINIO_ROOT_PASSWORD,
        });
    }
    return _client;
}

/**
 * Client used ONLY to sign presigned URLs. Presigned URLs embed the host the
 * client will connect to, so this must be the BROWSER-reachable endpoint
 * (e.g. localhost:9000 from the host), not the docker-internal one.
 */
function presignClient(): MinioClient {
    if (!_presignClient) {
        const publicEndpoint = env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT;
        const { host, port } = splitEndpoint(publicEndpoint);
        _presignClient = new MinioClient({
            endPoint: host,
            port,
            useSSL: env.MINIO_SECURE,
            region: 'us-east-1', // set explicitly → SDK signs locally, no network probe
            accessKey: env.MINIO_ROOT_USER,
            secretKey: env.MINIO_ROOT_PASSWORD,
        });
    }
    return _presignClient;
}

export async function ensureBucket(): Promise<void> {
    const client = minioClient();
    const exists = await client.bucketExists(env.MINIO_BUCKET);
    if (!exists) await client.makeBucket(env.MINIO_BUCKET, 'us-east-1');
}

export async function presignedPutUrl(key: string, expiresSeconds = 60 * 60): Promise<string> {
    return presignClient().presignedPutObject(env.MINIO_BUCKET, key, expiresSeconds);
}

export async function presignedGetUrl(key: string, expiresSeconds = 60 * 60): Promise<string> {
    return presignClient().presignedGetObject(env.MINIO_BUCKET, key, expiresSeconds);
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
