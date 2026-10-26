import { BadRequestException } from '@nestjs/common';

export type ImageKind = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' };

/** Identify an image by magic bytes; the client-supplied mimetype and filename are never trusted. */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Image URLs saved on products/categories must belong to our Cloudinary account. */
export function assertTrustedImageUrl(url?: string | null) {
  if (!url) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new BadRequestException('Cloudinary image storage is not configured');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new BadRequestException('Image URL must point to the configured Cloudinary account'); }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com' || !parsed.pathname.startsWith(`/${cloudName}/image/upload/`)) {
    throw new BadRequestException('Image URL must point to the configured Cloudinary account');
  }
}
