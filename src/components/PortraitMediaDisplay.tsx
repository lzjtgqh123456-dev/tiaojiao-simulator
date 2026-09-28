import React, { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react';
import { getMediaType, MediaType, normalizeMediaUrl } from '../utils/mediaUtils';
import { Film, Image as ImageIcon, Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export interface PortraitMediaDisplayProps {
  src: string;
  alt?: string;
  fitMode?: 'contain' | 'cover' | 'fill' | 'scale-down';
  zoom?: number; // 50 to 300
  isMuted?: boolean;
  volume?: number; // 0.0 to 1.0
  isPlaying?: boolean;
  playbackRate?: number; // 0.5, 1.0, 1.5, 2.0
  isLoop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  showMediaBadge?: boolean;
  onMediaTypeDetected?: (type: MediaType) => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

const BasePortraitMediaDisplay: React.FC<PortraitMediaDisplayProps> = ({
  src,
  alt = '立绘展示',
  fitMode = 'contain',
  zoom = 100,
  isMuted = true,
  volume = 0.8,
  isPlaying = true,
  playbackRate = 1.0,
  isLoop = true,
  className = '',
  style = {},
  onClick,
  showMediaBadge = true,
  onMediaTypeDetected,
  onLoadingChange,
}) => {
  const normalizedSrc = useMemo(() => normalizeMediaUrl(src), [src]);

  // Robust candidate list for automatic error recovery
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (!normalizedSrc) return list;
    list.push(normalizedSrc);

    // Fallback 1: URL encoded/decoded variations
    try {
      const decoded = decodeURIComponent(normalizedSrc);
      if (decoded !== normalizedSrc && !list.includes(decoded)) {
        list.push(decoded);
      }
      const encoded = encodeURI(decoded);
      if (encoded !== normalizedSrc && !list.includes(encoded)) {
        list.push(encoded);
      }
    } catch (e) {}

    // Fallback 2: Alternate uploads path
    if (normalizedSrc.startsWith('/uploads/')) {
      const altPath = '/data/uploads/' + normalizedSrc.slice(9);
      if (!list.includes(altPath)) list.push(altPath);
    } else if (normalizedSrc.startsWith('/data/uploads/')) {
      const altPath = '/uploads/' + normalizedSrc.slice(14);
      if (!list.includes(altPath)) list.push(altPath);
    }

    // Fallback 3: http to https
    if (normalizedSrc.startsWith('http://')) {
      list.push(normalizedSrc.replace('http://', 'https://'));
    }

    return list;
  }, [normalizedSrc]);

  const [candidateIndex, setCandidateIndex] = useState<number>(0);
  const activeSrc = candidates[candidateIndex] || normalizedSrc;
  const mediaType = getMediaType(activeSrc);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);

  // Sync media type to parent if requested
  useEffect(() => {
    if (onMediaTypeDetected) {
      onMediaTypeDetected(mediaType);
    }
  }, [activeSrc, mediaType, onMediaTypeDetected]);

  // Sync loading state
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Reset states on src change
  useEffect(() => {
    setCandidateIndex(0);
    setIsLoaded(false);
    setIsLoading(true);
    setHasError(false);
  }, [normalizedSrc, retryKey]);

  // Video playback properties sync
  useEffect(() => {
    if (mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;

    v.playbackRate = playbackRate;
    v.volume = Math.max(0, Math.min(1, volume));
    v.muted = isMuted;

    if (isPlaying) {
      const p = v.play();
      if (p !== undefined) {
        p.catch(() => {});
      }
    } else {
      v.pause();
    }
  }, [mediaType, isPlaying, isMuted, volume, playbackRate, activeSrc, isLoaded]);

  const handleMediaLoaded = useCallback(() => {
    setIsLoaded(true);
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleMediaError = useCallback(() => {
    // If we have remaining fallback candidates, automatically try next candidate
    setCandidateIndex((prev) => {
      if (prev < candidates.length - 1) {
        setIsLoading(true);
        return prev + 1;
      }
      setIsLoading(false);
      setHasError(true);
      return prev;
    });
  }, [candidates.length]);

  // Zoom and layout style
  const isZoomDefault = !zoom || zoom === 100;
  const scaleTransform = isZoomDefault ? undefined : `scale(${zoom / 100})`;

  const commonStyle: React.CSSProperties = {
    objectFit: fitMode,
    transform: scaleTransform,
    width: fitMode === 'cover' || fitMode === 'fill' ? '100%' : 'auto',
    height: fitMode === 'cover' || fitMode === 'fill' ? '100%' : 'auto',
    maxWidth: '100%',
    maxHeight: '100%',
    willChange: isZoomDefault ? 'auto' : 'transform',
    ...style,
  };

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-transparent ${className}`}
      onClick={onClick}
    >
      {/* Loading Indicator */}
      {isLoading && !isLoaded && !hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm pointer-events-none transition-opacity duration-200">
          <div className="relative flex items-center justify-center mb-2">
            <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin flex items-center justify-center bg-cyan-950/40">
              {mediaType === 'video' ? (
                <Film className="w-4 h-4 text-cyan-400" />
              ) : (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold tracking-wider text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>{mediaType === 'video' ? '加载视频流中...' : '加载立绘中...'}</span>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-sm p-4 text-center">
          <AlertCircle className="w-7 h-7 text-rose-400 mb-2" />
          <span className="text-xs font-mono font-bold text-rose-300">立绘媒体无法加载</span>
          <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">请检查立绘 URL 是否有效或跨域是否受限。</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRetryKey((k) => k + 1);
            }}
            className="mt-3 px-3 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 rounded-lg text-rose-200 text-xs font-mono flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>重试加载</span>
          </button>
        </div>
      )}

      {/* Media Rendering */}
      {mediaType === 'video' ? (
        <video
          key={`${activeSrc}_${retryKey}_${candidateIndex}`}
          ref={videoRef}
          src={activeSrc}
          autoPlay={isPlaying}
          loop={isLoop}
          playsInline
          muted={isMuted}
          preload="auto"
          crossOrigin="anonymous"
          onLoadedData={handleMediaLoaded}
          onCanPlay={handleMediaLoaded}
          onError={handleMediaError}
          className={`pointer-events-none select-none transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={commonStyle}
        />
      ) : (
        <img
          key={`${activeSrc}_${retryKey}_${candidateIndex}`}
          src={activeSrc}
          alt={alt}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={handleMediaLoaded}
          onError={handleMediaError}
          className={`pointer-events-none select-none transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={commonStyle}
        />
      )}

      {/* Format Indicator Badge */}
      {showMediaBadge && (
        <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center space-x-2 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-mono font-bold text-white shadow-xl">
          {mediaType === 'video' && (
            <>
              <Film className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-cyan-300">原生超清视频流</span>
            </>
          )}
          {mediaType === 'gif' && (
            <>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300">GIF 动态立绘</span>
            </>
          )}
          {mediaType === 'image' && (
            <>
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-purple-300">2D 角色立绘</span>
            </>
          )}

          {/* Status micro badge */}
          <div className="border-l border-zinc-700 pl-2 ml-1 flex items-center">
            {isLoading && !isLoaded ? (
              <span className="flex items-center space-x-1 text-amber-300">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                <span className="text-[9px]">加载中</span>
              </span>
            ) : isLoaded ? (
              <span className="flex items-center space-x-1 text-emerald-400">
                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-[9px]">就绪</span>
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export const PortraitMediaDisplay = memo(BasePortraitMediaDisplay);
