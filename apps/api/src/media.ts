const validTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

function dimensions(bytes: Uint8Array, type: string): [number, number] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (type === 'image/png') {
    if (bytes.length < 24 || String.fromCharCode(...bytes.slice(1, 4)) !== 'PNG') return null;
    return [view.getUint32(16), view.getUint32(20)];
  }
  if (type === 'image/webp') {
    if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return null;
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === 'VP8X') return [1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)];
    if (kind === 'VP8L' && bytes[20] === 0x2f) return [1 + (((bytes[22] & 0x3f) << 8) | bytes[21]), 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6))];
    if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return [view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff];
    return null;
  }
  if (type === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      if (marker === 0xd9 || marker === 0xda) return null;
      const length = view.getUint16(offset + 2);
      if (length < 2) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      }
      offset += 2 + length;
    }
  }
  return null;
}

export async function readImage(file: File) {
  if (!validTypes.includes(file.type as typeof validTypes[number]) || file.size === 0 || file.size > 5 * 1024 * 1024) {
    throw new Error('JPG, PNG, WebP 이미지만 5MB 이하로 올릴 수 있습니다.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const size = dimensions(bytes, file.type);
  if (!size || size[0] < 1 || size[1] < 1 || size[0] > 2400 || size[1] > 4000) {
    throw new Error('이미지 형식이 올바르지 않거나 크기 제한(2400 × 4000px)을 넘었습니다.');
  }
  return bytes;
}
