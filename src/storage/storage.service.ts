import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient } from '@azure/storage-blob';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class StorageService {
  constructor(private readonly configService: ConfigService) {}

  private async uploadToAzure(params: {
    data: Buffer;
    contentType?: string;
    fileName: string;
  }) {
    const connectionString = this.configService.get('AZURE_CONNECTION_STRING');
    const containerName = this.configService.get('AZURE_CONTAINER');

    if (!connectionString || !containerName) return null;

    const client = BlobServiceClient.fromConnectionString(String(connectionString));
    const containerClient = client.getContainerClient(String(containerName));
    await containerClient.createIfNotExists();

    const blobClient = containerClient.getBlockBlobClient(params.fileName);
    await blobClient.uploadData(params.data, {
      blobHTTPHeaders: params.contentType ? { blobContentType: params.contentType } : undefined,
    });

    return blobClient.url;
  }

  private async saveToLocal(params: {
    data: Buffer;
    fileName: string;
    baseUrl: string;
  }) {
    await mkdir(join(process.cwd(), 'uploads'), { recursive: true });
    const abs = join(process.cwd(), 'uploads', params.fileName);
    await writeFile(abs, params.data);
    return `${params.baseUrl}/uploads/${params.fileName}`;
  }

  async saveUploadedFile(params: {
    file: Express.Multer.File;
    baseUrl: string;
    prefix?: string;
  }) {
    const original = params.file.originalname || 'file';
    const safeOriginal = original.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${params.prefix ?? 'uploads'}/${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginal}`;

    const azureUrl = await this.uploadToAzure({
      data: params.file.buffer,
      contentType: params.file.mimetype,
      fileName,
    });

    if (azureUrl) return azureUrl;

    const localName = fileName.split('/').slice(1).join('-');
    return this.saveToLocal({ data: params.file.buffer, fileName: localName, baseUrl: params.baseUrl });
  }
}
