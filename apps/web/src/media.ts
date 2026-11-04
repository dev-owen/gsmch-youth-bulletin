// Keep these upload limits in sync with apps/api/src/media.ts.
export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_IMAGE_DIMENSION = 1920;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const validTypes = ['image/jpeg', 'image/png', 'image/webp'];

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지를 압축하지 못했습니다. 다른 이미지를 선택해 주세요.')), type, 0.82);
  });
}

export async function optimizeImage(file: File): Promise<File> {
  if (!validTypes.includes(file.type) || file.size === 0 || file.size > MAX_SOURCE_BYTES) {
    throw new Error('JPG, PNG, WebP 이미지를 20MB 이하로 선택해 주세요.');
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('이미지를 읽지 못했습니다. 다른 이미지를 선택해 주세요.'));
      image.src = url;
    });
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height || width * height > 50_000_000) {
      throw new Error('5천만 화소 이하의 이미지를 선택해 주세요.');
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이미지 압축을 지원하는 브라우저에서 다시 시도해 주세요.');

    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    let type = 'image/webp';
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const draw = () => {
        // JPEG has no alpha channel; keep transparent areas white on fallback.
        if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      draw();
      let blob = await encode(canvas, type);
      // Unsupported encoders silently return PNG, so check the actual MIME type.
      if (type === 'image/webp' && blob.type !== type) {
        type = 'image/jpeg';
        draw();
        blob = await encode(canvas, type);
      }
      if (blob.type !== type) throw new Error('이미지 압축을 지원하는 브라우저에서 다시 시도해 주세요.');
      if (blob.size > 0 && blob.size <= MAX_IMAGE_BYTES) {
        const name = file.name.replace(/\.[^.]+$/, '') || 'cover';
        return new File([blob], `${name}.${type === 'image/webp' ? 'webp' : 'jpg'}`, { type });
      }
      scale *= 0.8;
    }
    throw new Error('이미지를 512KB 이하로 압축하지 못했습니다. 더 작은 이미지를 선택해 주세요.');
  } finally {
    URL.revokeObjectURL(url);
    image.onload = image.onerror = null;
    image.src = '';
    canvas.width = canvas.height = 0;
  }
}
