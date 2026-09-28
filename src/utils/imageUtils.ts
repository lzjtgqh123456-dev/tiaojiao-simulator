/**
 * Utility to compress and resize image files to lightweight Data URLs suitable for storage and fast rendering.
 */
export function resizeImageFile(
  file: File,
  maxWidth = 1000,
  maxHeight = 1400,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Bypass canvas compression for videos, animated GIFs, and SVGs to preserve animation and video streams
    if (
      file.type.startsWith('video/') ||
      file.type === 'image/gif' ||
      file.type === 'image/svg+xml' ||
      /\.(gif|mp4|webm|mov|m4v|ogv|avi|mkv|svg)$/i.test(file.name)
    ) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        if (src) resolve(src);
        else reject(new Error('Failed to read media file'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (!src) {
        reject(new Error('Failed to read image file'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src); // fallback to original if canvas 2D not available
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}
