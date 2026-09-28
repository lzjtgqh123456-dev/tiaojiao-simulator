import { resizeImageFile } from './imageUtils';

export type MediaType = 'video' | 'gif' | 'image' | 'audio' | 'unknown';

/**
 * Normalizes any relative or local disk path into a browser-resolvable URL.
 * Handles paths like:
 * - 'uploads/xxx.mp4' -> '/uploads/xxx.mp4'
 * - './uploads/xxx.mp4' -> '/uploads/xxx.mp4'
 * - 'data/uploads/xxx.mp4' -> '/uploads/xxx.mp4'
 * - './data/uploads/xxx.mp4' -> '/uploads/xxx.mp4'
 * - '/uploads/xxx.mp4' -> '/uploads/xxx.mp4'
 * - 'http://...' or 'https://...' or 'data:...' -> unmodified
 */
export function normalizeMediaUrl(url: string | undefined): string {
  if (!url) return '';
  // Normalize Windows backslashes to standard forward slashes
  let trimmed = url.trim().replace(/\\/g, '/');

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Handle absolute or file:// disk paths matching uploads/ or data/uploads/
  const uploadsMatch = trimmed.match(/(?:^|[/\\])(?:data[/\\])?uploads[/\\](.+)$/i);
  if (uploadsMatch && uploadsMatch[1]) {
    return '/uploads/' + uploadsMatch[1].replace(/^\/+/, '');
  }

  if (trimmed.startsWith('./data/uploads/')) {
    return '/uploads/' + trimmed.substring(15);
  }
  if (trimmed.startsWith('data/uploads/')) {
    return '/uploads/' + trimmed.substring(13);
  }
  if (trimmed.startsWith('/data/uploads/')) {
    return '/uploads/' + trimmed.substring(14);
  }
  if (trimmed.startsWith('./uploads/')) {
    return '/uploads/' + trimmed.substring(10);
  }
  if (trimmed.startsWith('uploads/')) {
    return '/uploads/' + trimmed.substring(8);
  }
  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }
  if (trimmed.startsWith('./')) {
    return '/' + trimmed.substring(2);
  }

  // If it's a bare filename with media extension (e.g. "hero.png" or "portrait.mp4"), map to /uploads/
  if (!trimmed.includes('/') && /\.(png|jpg|jpeg|gif|webp|mp4|webm|svg|avif|bmp)$/i.test(trimmed)) {
    return '/uploads/' + trimmed;
  }

  return trimmed;
}

/**
 * Sanitizes a media URL or path for storage / JSON export:
 * Ensures clean, lightweight relative/local paths (e.g. /uploads/media_xxx.mp4)
 * and strips/warns on bloated raw Base64 strings.
 */
export function sanitizeMediaUrlForExport(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) {
    // If it's a small data URL or svg, keep it, otherwise avoid bloating JSON
    if (trimmed.startsWith('data:image/svg+xml') || trimmed.length < 500) {
      return trimmed;
    }
    return undefined;
  }
  return normalizeMediaUrl(trimmed);
}

export interface LocalMediaItem {
  id: string;
  url: string;
  fileName: string;
  originalName: string;
  fileSizeMB: number;
  mediaType: MediaType;
  category?: string;
  heroId?: string;
  createdAt: number;
}

/**
 * Detects whether a URL or DataURL represents a Video, GIF animation, or static Image.
 */
export function getMediaType(url: string | undefined): MediaType {
  if (!url) return 'unknown';
  const cleanUrl = url.trim().toLowerCase();

  // Data URL mime type checks
  if (cleanUrl.startsWith('data:video/')) return 'video';
  if (cleanUrl.startsWith('data:image/gif')) return 'gif';
  if (cleanUrl.startsWith('data:image/')) return 'image';
  if (cleanUrl.startsWith('data:audio/')) return 'audio';

  // Extension/URL format checks
  if (/\.(mp4|webm|mov|m4v|ogv|m3u8|avi|mkv)(\?.*)?$/i.test(cleanUrl)) return 'video';
  if (/\.(gif)(\?.*)?$/i.test(cleanUrl)) return 'gif';
  if (/\.(mp3|wav|ogg|aac|m4a)(\?.*)?$/i.test(cleanUrl)) return 'audio';
  if (/\.(png|jpg|jpeg|webp|svg|bmp|ico|avif)(\?.*)?$/i.test(cleanUrl)) return 'image';

  return 'image';
}

/**
 * Persists any Base64 Data URL or media directly into the server's local /uploads folder on disk.
 * This guarantees the embedded video/image will never be lost even if browser storage is reset.
 */
export async function persistMediaToLocalFolder(
  dataUrl: string,
  fileName: string = 'media_upload',
  category: string = 'custom',
  heroId?: string
): Promise<{
  url: string;
  fileName: string;
  fileSizeMB: number;
  mediaType: MediaType;
}> {
  try {
    const res = await fetch('/api/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        fileName,
        category,
        heroId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.url) {
        return {
          url: data.url,
          fileName: data.fileName || fileName,
          fileSizeMB: data.fileSizeMB || 0,
          mediaType: (data.mediaType as MediaType) || getMediaType(data.url),
        };
      }
    }
  } catch (err) {
    console.warn('[MediaStorage] Failed to upload to local /uploads folder, fallback to dataUrl:', err);
  }

  return {
    url: dataUrl,
    fileName,
    fileSizeMB: 0,
    mediaType: getMediaType(dataUrl),
  };
}

/**
 * Reads any uploaded image, GIF, or video file and automatically saves it to the local /uploads folder on disk.
 */
export async function readMediaFile(file: File, category: string = 'custom', heroId?: string): Promise<{
  dataUrl: string;
  localUrl: string;
  mediaType: MediaType;
  fileName: string;
  fileSizeMB: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv|avi|mkv)$/i.test(file.name);
    const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name);

    reader.onload = async (e) => {
      let src = e.target?.result as string;
      if (!src) {
        reject(new Error('无法读取该媒体文件'));
        return;
      }

      const fileSizeMB = Number((file.size / (1024 * 1024)).toFixed(2));
      let mediaType: MediaType = 'image';
      if (isVideo) mediaType = 'video';
      else if (isGif) mediaType = 'gif';

      // If it's a large static image (not GIF/video), compress before saving to disk
      if (!isVideo && !isGif && file.size > 2 * 1024 * 1024) {
        try {
          const compressed = await resizeImageFile(file, 1400, 1800, 0.88);
          src = compressed;
        } catch (err) {
          console.warn('Compression failed, using raw dataUrl:', err);
        }
      }

      // Automatically persist to the local folder on disk (/uploads)
      let localUrl = src;
      try {
        const persisted = await persistMediaToLocalFolder(src, file.name, category, heroId);
        if (persisted.url) {
          localUrl = persisted.url;
        }
      } catch (err) {
        console.warn('Auto persist to local disk failed:', err);
      }

      resolve({
        dataUrl: src,
        localUrl,
        mediaType,
        fileName: file.name,
        fileSizeMB,
      });
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

/**
 * Fetches list of all media files saved in the local /uploads folder on disk.
 */
export async function fetchLocalMediaFiles(): Promise<LocalMediaItem[]> {
  try {
    const res = await fetch('/api/media-files');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        return data.files;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch local media files:', err);
  }
  return [];
}

/**
 * Deletes a media file from the local /uploads folder.
 */
export async function deleteLocalMediaFile(urlOrFileName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/media-files/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlOrFileName }),
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.error('Failed to delete local media file:', err);
  }
  return false;
}

