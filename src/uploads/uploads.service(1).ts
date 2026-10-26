import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { randomUUID } from 'crypto';
import { sniffImage } from './image.util';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function cloudinaryErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const details = error as { message?: unknown; http_code?: unknown };
    const message = typeof details.message === 'string' ? details.message : 'Unknown Cloudinary error';
    return typeof details.http_code === 'number' ? `HTTP ${details.http_code}: ${message}` : message;
  }
  return 'Unknown Cloudinary error';
}

@Injectable()
export class UploadsService {
  private configuredCloudinary() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new ServiceUnavailableException('Cloudinary image storage is not configured');
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
    return cloudinary;
  }

  private async put(folder: string, file: Express.Multer.File, authenticated = false) {
    if (!file?.buffer) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('Image must be 5 MB or smaller');
    const kind = sniffImage(file.buffer);
    if (!kind) throw new BadRequestException('Only JPEG, PNG or WebP images are allowed');

    const client = this.configuredCloudinary();
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = client.uploader.upload_stream({
          public_id: `${folder}/${randomUUID()}`,
          resource_type: 'image',
          type: authenticated ? 'authenticated' : 'upload',
          overwrite: false,
          use_filename: false,
          unique_filename: false,
          format: kind.ext,
        }, (error, uploaded) => {
          if (error) reject(error);
          else if (!uploaded) reject(new Error('Cloudinary completed the upload without returning an asset'));
          else resolve(uploaded);
        });
        stream.end(file.buffer);
      });
    } catch (error) {
      throw new ServiceUnavailableException(`Cloudinary upload failed: ${cloudinaryErrorMessage(error)}`);
    }

    return { key: `${result.public_id}.${result.format}`, url: result.secure_url };
  }

  async putPublic(folder: 'products' | 'categories' | 'branding', file: Express.Multer.File) {
    return this.put(folder, file);
  }

  /** Payment proofs use authenticated delivery and are only exposed through short-lived signed URLs. */
  async putPrivate(file: Express.Multer.File) {
    const { key } = await this.put('proofs', file, true);
    return key;
  }

  async signedUrl(key: string, seconds = 600) {
    const match = /^proofs\/([a-zA-Z0-9_-]+)\.([a-zA-Z0-9]+)$/.exec(key);
    if (!match) throw new BadRequestException('Invalid key');
    const client = this.configuredCloudinary();
    return client.utils.private_download_url(`proofs/${match[1]}`, match[2], {
      resource_type: 'image',
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + seconds,
    });
  }
}
