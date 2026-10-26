import { assertTrustedImageUrl, sniffImage } from './image.util';

describe('sniffImage', () => {
  it('detects JPEG, PNG and WebP by content', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe('jpg');
    expect(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))?.ext).toBe('png');
    expect(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]))?.ext).toBe('webp');
  });
  it('rejects scripts and other content regardless of filename', () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImage(Buffer.alloc(3))).toBeNull();
  });
});
describe('assertTrustedImageUrl', () => {
  const old = process.env.CLOUDINARY_CLOUD_NAME;
  afterEach(() => {
    if (old === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = old;
  });
  it('accepts only secure URLs from the configured Cloudinary account', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'dee-light';
    expect(() => assertTrustedImageUrl('https://res.cloudinary.com/dee-light/image/upload/products/a.jpg')).not.toThrow();
    expect(() => assertTrustedImageUrl('https://res.cloudinary.com/another-cloud/image/upload/products/a.jpg')).toThrow();
    expect(() => assertTrustedImageUrl('http://res.cloudinary.com/dee-light/image/upload/products/a.jpg')).toThrow();
    expect(() => assertTrustedImageUrl(undefined)).not.toThrow();
  });
});
