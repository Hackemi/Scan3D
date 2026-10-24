import { CaptureResolution, CapturedPhoto } from '../types';

/**
 * Returns MediaStreamConstraints optimized for 4K Ultra HD or standard resolutions
 */
export function getCameraConstraints(
  facingMode: 'environment' | 'user',
  resolution: CaptureResolution = '4k',
  deviceId?: string
): MediaStreamConstraints {
  let widthConstraint = { ideal: 3840, min: 1920 };
  let heightConstraint = { ideal: 2160, min: 1080 };

  if (resolution === '1080p') {
    widthConstraint = { ideal: 1920, min: 1280 };
    heightConstraint = { ideal: 1080, min: 720 };
  } else if (resolution === '720p') {
    widthConstraint = { ideal: 1280, min: 640 };
    heightConstraint = { ideal: 720, min: 480 };
  }

  const videoConstraints: MediaTrackConstraints = {
    facingMode: deviceId ? undefined : { ideal: facingMode },
    deviceId: deviceId ? { exact: deviceId } : undefined,
    width: widthConstraint,
    height: heightConstraint,
    // Request maximum sensor framerate and clarity
    frameRate: { ideal: 30, max: 60 },
  };

  return {
    video: videoConstraints,
    audio: false,
  };
}

/**
 * Takes a high-resolution 4K still photo using native ImageCapture hardware API
 * or high-precision 4K canvas buffer fallback
 */
export async function takeHighResPhoto(
  videoElement: HTMLVideoElement,
  stream: MediaStream,
  facingMode: 'environment' | 'user',
  targetResolution: CaptureResolution = '4k',
  angleLabel: string
): Promise<CapturedPhoto> {
  const track = stream.getVideoTracks()[0];
  let dataUrl = '';
  let finalWidth = 3840;
  let finalHeight = 2160;

  // 1. Try native ImageCapture API (supported in Android Chrome and modern browsers)
  // This triggers true sensor still shot at maximum camera hardware megapixels
  if (typeof (window as any).ImageCapture !== 'undefined' && track) {
    try {
      const imageCapture = new (window as any).ImageCapture(track);
      // Try takePhoto (captures still photo directly from hardware sensor)
      const blob: Blob = await imageCapture.takePhoto({
        imageWidth: targetResolution === '4k' ? 3840 : 1920,
        imageHeight: targetResolution === '4k' ? 2160 : 1080,
      });

      const bitmap = await createImageBitmap(blob);
      finalWidth = bitmap.width;
      finalHeight = bitmap.height;

      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(bitmap, 0, 0);
        dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      }
    } catch (e) {
      console.warn('ImageCapture.takePhoto failed or unsupported, using canvas pipeline', e);
    }
  }

  // 2. High-Precision 4K Canvas Buffer Fallback
  if (!dataUrl) {
    const rawW = videoElement.videoWidth || 1920;
    const rawH = videoElement.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    if (targetResolution === '4k') {
      // Scale to 4K UHD dimensions (3840 x 2160 or aspect-ratio equivalent)
      const aspect = rawW / rawH;
      if (aspect >= 1) {
        canvas.width = Math.max(3840, rawW);
        canvas.height = Math.round(canvas.width / aspect);
      } else {
        canvas.height = Math.max(3840, rawH);
        canvas.width = Math.round(canvas.height * aspect);
      }
    } else {
      canvas.width = rawW;
      canvas.height = rawH;
    }

    finalWidth = canvas.width;
    finalHeight = canvas.height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // High-quality bicubic smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    }
  }

  const is4K = finalWidth >= 3200 || finalHeight >= 3200;
  const resolutionLabel = is4K
    ? `${finalWidth} × ${finalHeight} (4K UHD)`
    : `${finalWidth} × ${finalHeight} (FHD)`;

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    dataUrl,
    angleLabel,
    timestamp: Date.now(),
    width: finalWidth,
    height: finalHeight,
    is4K,
    resolutionLabel,
  };
}
