import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  Upload,
  Trash2,
  Crosshair,
  Grid,
  Zap,
  Info,
  Play,
  Pause,
  Flashlight,
  Smartphone,
  ChevronRight,
  HelpCircle,
  X,
  Compass,
  Check,
  Disc,
  RotateCw,
  CheckCircle2,
  Timer,
  Vibrate,
  Sliders,
} from 'lucide-react';
import { CapturedPhoto, ScanCategory, LensType, CaptureResolution } from '../types';
import { soundEffects } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';
import { SAMPLE_MODELS } from '../utils/sampleData';
import { InteractiveTutorial } from './InteractiveTutorial';
import { takeHighResPhoto, getCameraConstraints } from '../utils/cameraCapture';

interface CameraStudioProps {
  photos: CapturedPhoto[];
  selectedCategory: ScanCategory;
  onChangeCategory: (cat: ScanCategory) => void;
  onAddPhoto: (photo: CapturedPhoto) => void;
  onRemovePhoto: (id: string) => void;
  onClearPhotos: () => void;
  onStartReconstruction: (objectHint: string) => void;
  onSelectSample: (sampleId: string) => void;
  onOpenInstall: () => void;
  isInstallable: boolean;
}

const CATEGORIES: Array<{ id: ScanCategory; label: string; icon: string; desc: string }> = [
  { id: 'pieza_3d', label: 'Pieza 3D', icon: '🧩', desc: 'Repuestos mecánicos, soportes, engranajes y piezas para impresión 3D' },
  { id: 'hoyo', label: 'Hoyo / Cavidad', icon: '🕳️', desc: 'Orificios, moldes y cavidades cóncavas con cálculo de diámetro y profundidad' },
  { id: 'aparato', label: 'Aparato', icon: '📱', desc: 'Dispositivos electrónicos, chasis, carcasas y gadgets' },
  { id: 'general', label: 'General', icon: '🏺', desc: 'Vajilla, recipientes, calzado y objetos cotidianos' },
];

const GUIDED_ANGLES = [
  { id: 'front', label: 'Frente', deg: 0, hint: 'Enfoca la parte frontal' },
  { id: 'front-right', label: 'Diagonal Der', deg: 45, hint: 'Gira 45° a la derecha' },
  { id: 'right', label: 'Lateral Der', deg: 90, hint: 'Costado derecho' },
  { id: 'back-right', label: 'Trasero Der', deg: 135, hint: 'Tres cuartos posterior' },
  { id: 'back', label: 'Posterior', deg: 180, hint: 'Espalda del objeto' },
  { id: 'back-left', label: 'Trasero Izq', deg: 225, hint: 'Tres cuartos posterior izq' },
  { id: 'left', label: 'Lateral Izq', deg: 270, hint: 'Costado izquierdo' },
  { id: 'front-left', label: 'Diagonal Izq', deg: 315, hint: 'Gira hacia el frente' },
  { id: 'top', label: 'Superior 45°', deg: 360, hint: 'Inclina cámara desde arriba para cerrar' },
];

export const CameraStudio: React.FC<CameraStudioProps> = ({
  photos,
  selectedCategory,
  onChangeCategory,
  onAddPhoto,
  onRemovePhoto,
  onClearPhotos,
  onStartReconstruction,
  onSelectSample,
  onOpenInstall,
  isInstallable,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // 4K Ultra HD Resolution Setting (Defaults to '4k' for maximum photogrammetry detail)
  const [resolution, setResolution] = useState<CaptureResolution>('4k');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Lens selection: 0.5x Ultrawide, 1x Main, 2x Telephoto
  const [selectedLens, setSelectedLens] = useState<LensType>('main');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showLensAdvice, setShowLensAdvice] = useState<boolean>(false);

  const [captureMode, setCaptureMode] = useState<'auto' | '360' | 'burst' | 'free'>('auto');
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [objectHint, setObjectHint] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const [isBursting, setIsBursting] = useState<boolean>(false);
  const [burstCount, setBurstCount] = useState<number>(0);

  // Automatic Rotation Mode (Girar Teléfono vs Girar Objeto)
  const [autoTarget, setAutoTarget] = useState<'phone' | 'object'>('phone');
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [autoCadenceSeconds, setAutoCadenceSeconds] = useState<number>(2.5);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [autoCreateOnFinish, setAutoCreateOnFinish] = useState<boolean>(true);
  const [currentHeading, setCurrentHeading] = useState<number>(0);
  const [gyroDelta, setGyroDelta] = useState<number>(0);
  const [gyroPermissionStatus, setGyroPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unsupported'>('prompt');
  const [showAutoCompletionModal, setShowAutoCompletionModal] = useState<boolean>(false);
  const [autoLaunchSeconds, setAutoLaunchSeconds] = useState<number>(3);

  const lastShotAngleRef = useRef<number | null>(null);
  const lastShotTimeRef = useRef<number>(0);
  const tickTriggeredRef = useRef<boolean>(false);

  // Interactive Tutorial state
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showSamplePicker, setShowSamplePicker] = useState<boolean>(false);

  // Initialize camera stream with 4K Ultra HD or target resolution constraints
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = getCameraConstraints(facingMode, resolution);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities: any = track.getCapabilities?.() || {};
        setHasTorch(Boolean(capabilities.torch));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      // Fallback attempt with standard resolution if 4K constraints fail on certain webcams
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
          setCameraActive(true);
        }
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr.name === 'NotAllowedError'
            ? 'Permiso de cámara denegado. Permite el acceso o sube fotos desde la galería.'
            : 'No se pudo acceder a la cámara. Puedes subir fotos directamente o probar con los ejemplos.'
        );
        setCameraActive(false);
      }
    }
  }, [facingMode, resolution]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Handle lens selection
  const handleSelectLens = (lens: LensType) => {
    triggerHaptic('light');
    setSelectedLens(lens);
    if (lens === 'ultrawide') {
      setZoomLevel(0.85); // Digital field-of-view representation
    } else if (lens === 'main') {
      setZoomLevel(1.0);
    } else if (lens === 'telephoto') {
      setZoomLevel(1.8);
    }
  };

  // Toggle Resolution (4K UHD <-> 1080p FHD)
  const toggleResolution = () => {
    triggerHaptic('medium');
    const nextRes: CaptureResolution = resolution === '4k' ? '1080p' : '4k';
    setResolution(nextRes);
    soundEffects.playBlip();
  };

  // Toggle Flashlight / Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
        triggerHaptic('light');
      } catch (e) {
        console.warn('Torch constraint error', e);
      }
    }
  };

  const toggleCameraFacing = () => {
    triggerHaptic('medium');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // High-Resolution 4K Capture Execution
  const capturePhoto = async (overrideLabel?: string) => {
    if (!videoRef.current || !streamRef.current || isCapturing) return null;

    try {
      setIsCapturing(true);
      soundEffects.playShutter();
      triggerHaptic('shutter');
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 120);

      const targetAngle = GUIDED_ANGLES[currentAngleIndex % GUIDED_ANGLES.length];
      const newPhoto = await takeHighResPhoto(
        videoRef.current,
        streamRef.current,
        facingMode,
        resolution,
        overrideLabel || targetAngle.label
      );

      onAddPhoto(newPhoto);
      setCurrentAngleIndex((prev) => (prev + 1) % GUIDED_ANGLES.length);
      return newPhoto;
    } catch (e) {
      console.error('High res photo capture error:', e);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  // Request Gyroscope permission (iOS Safari 13+ requires user gesture)
  const requestGyroPermission = async (): Promise<boolean> => {
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setGyroPermissionStatus('granted');
          triggerHaptic('success');
          return true;
        } else {
          setGyroPermissionStatus('denied');
          return false;
        }
      } catch (err) {
        console.warn('Gyro permission rejected:', err);
        setGyroPermissionStatus('denied');
        return false;
      }
    } else if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      setGyroPermissionStatus('granted');
      return true;
    } else {
      setGyroPermissionStatus('unsupported');
      return false;
    }
  };

  // Toggle Auto Mode Active State
  const toggleAutoRunning = async () => {
    triggerHaptic('medium');
    if (!isAutoRunning) {
      if (autoTarget === 'phone' && gyroPermissionStatus !== 'granted') {
        const granted = await requestGyroPermission();
        if (!granted && gyroPermissionStatus === 'denied') {
          // If gyro denied, switch seamlessly to turntable mode
          setAutoTarget('object');
        }
      }
      lastShotAngleRef.current = null;
      lastShotTimeRef.current = Date.now();
      tickTriggeredRef.current = false;
      setGyroDelta(0);
      setIsAutoRunning(true);
    } else {
      setIsAutoRunning(false);
      setAutoCountdown(null);
    }
  };

  // Gyroscope tracking for Phone Rotation around the object
  useEffect(() => {
    if (captureMode !== 'auto' || autoTarget !== 'phone' || !isAutoRunning) {
      return;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (isCapturing) return;

      let heading: number | null = null;
      if (typeof (e as any).webkitCompassHeading === 'number') {
        heading = (e as any).webkitCompassHeading;
      } else if (typeof e.alpha === 'number') {
        heading = (360 - e.alpha) % 360;
      }

      if (heading === null || isNaN(heading)) return;

      const rounded = Math.round(heading);
      setCurrentHeading(rounded);

      if (lastShotAngleRef.current === null) {
        lastShotAngleRef.current = rounded;
        lastShotTimeRef.current = Date.now();
        return;
      }

      // Calculate minimal angular delta
      let diff = Math.abs(rounded - lastShotAngleRef.current);
      if (diff > 180) diff = 360 - diff;

      setGyroDelta(Math.min(42, Math.round(diff)));

      // Halfway haptic tick feedback (~20 degrees)
      if (diff >= 20 && diff < 30 && !tickTriggeredRef.current) {
        triggerHaptic('tick');
        soundEffects.playBlip();
        tickTriggeredRef.current = true;
      }

      // Reached ~38°-40° threshold and minimum 1.4s between shots
      const now = Date.now();
      if (diff >= 38 && now - lastShotTimeRef.current > 1400) {
        lastShotAngleRef.current = rounded;
        lastShotTimeRef.current = now;
        tickTriggeredRef.current = false;
        setGyroDelta(0);
        capturePhoto();
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [captureMode, autoTarget, isAutoRunning, isCapturing]);

  // Object Rotation (Turntable) Cadence Timer
  useEffect(() => {
    if (captureMode !== 'auto' || autoTarget !== 'object' || !isAutoRunning) {
      setAutoCountdown(null);
      return;
    }

    let seconds = Math.ceil(autoCadenceSeconds);
    setAutoCountdown(seconds);
    soundEffects.playCountdown(false);
    triggerHaptic('countdown');

    const interval = setInterval(() => {
      seconds -= 1;
      if (seconds > 0) {
        setAutoCountdown(seconds);
        soundEffects.playCountdown(false);
        triggerHaptic('countdown');
      } else if (seconds === 0) {
        setAutoCountdown(0);
        capturePhoto();
      } else {
        // Reset cadence for next angle
        seconds = Math.ceil(autoCadenceSeconds);
        setAutoCountdown(seconds);
        soundEffects.playCountdown(false);
        triggerHaptic('countdown');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [captureMode, autoTarget, isAutoRunning, autoCadenceSeconds]);

  // Auto-completion detection: when 8 photos reached in Auto mode
  useEffect(() => {
    if (captureMode === 'auto' && isAutoRunning && photos.length >= 8) {
      setIsAutoRunning(false);
      setAutoCountdown(null);
      soundEffects.playSuccess();
      triggerHaptic('complete');
      setShowAutoCompletionModal(true);
      setAutoLaunchSeconds(3);
    }
  }, [photos.length, captureMode, isAutoRunning]);

  // Auto-launch countdown effect when complete modal is open
  useEffect(() => {
    if (!showAutoCompletionModal || !autoCreateOnFinish) return;

    if (autoLaunchSeconds <= 0) {
      setShowAutoCompletionModal(false);
      onStartReconstruction(objectHint);
      return;
    }

    const timer = setTimeout(() => {
      setAutoLaunchSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showAutoCompletionModal, autoLaunchSeconds, autoCreateOnFinish, objectHint, onStartReconstruction]);

  const triggerBurst = async () => {
    if (isBursting) return;
    setIsBursting(true);
    setBurstCount(3);

    await capturePhoto();
    let remaining = 2;

    const timer = setInterval(async () => {
      if (remaining > 0) {
        await capturePhoto();
        remaining--;
        setBurstCount(remaining);
      } else {
        clearInterval(timer);
        setIsBursting(false);
      }
    }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            const is4K = img.width >= 3200 || img.height >= 3200;
            const angleLabel = GUIDED_ANGLES[(photos.length + index) % GUIDED_ANGLES.length].label;
            onAddPhoto({
              id: `upload-${Date.now()}-${index}`,
              dataUrl,
              angleLabel,
              timestamp: Date.now(),
              width: img.width,
              height: img.height,
              is4K,
              resolutionLabel: `${img.width} × ${img.height} ${is4K ? '(4K UHD)' : '(FHD)'}`,
            });
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    triggerHaptic('success');
  };

  const currentGuide = GUIDED_ANGLES[currentAngleIndex % GUIDED_ANGLES.length];
  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  return (
    <div className="relative flex flex-col h-full w-full bg-black text-white select-none overflow-hidden touch-none">
      {/* Top Header Bar */}
      <div className="relative z-30 flex items-center justify-between px-3 pt-2.5 pb-2 bg-gradient-to-b from-black/95 via-black/60 to-transparent">
        {/* App Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              Scan3D Studio
            </h1>
            <span className="text-[10px] text-cyan-400 font-mono">
              {activeCategoryObj.icon} {activeCategoryObj.label}
            </span>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-1.5">
          {/* 4K Ultra HD Toggle */}
          <button
            onClick={toggleResolution}
            className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer shadow ${
              resolution === '4k'
                ? 'bg-amber-400 border-amber-300 text-black shadow-amber-400/25'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
            title="Alternar resolución: 4K Ultra HD (3840×2160) vs 1080p FHD"
          >
            <span>{resolution === '4k' ? '4K UHD ★' : '1080p'}</span>
          </button>

          {/* Tutorial Button */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowTutorial(true);
            }}
            className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 shadow"
            title="Tutorial de Rotación y Consejos"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Tutorial</span>
          </button>

          {/* Torch toggle */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full border transition-all cursor-pointer ${
                torchOn
                  ? 'bg-amber-400 border-amber-300 text-black'
                  : 'bg-black/60 border-zinc-700 text-zinc-300'
              }`}
              title="Linterna (vital para hoyos/cavidades)"
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Grid toggle */}
          <button
            onClick={() => {
              setShowGrid((v) => !v);
              triggerHaptic('light');
            }}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              showGrid
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-black/60 border-zinc-700 text-zinc-400'
            }`}
            title="Cuadrícula"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Sample Presets */}
          <button
            onClick={() => {
              setShowSamplePicker(true);
              triggerHaptic('light');
            }}
            className="p-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200"
            title="Modelos de Muestra"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Category Tabs: Pieza 3D | Hoyo/Cavidad | Aparato | General */}
      <div className="relative z-30 px-3 py-1 bg-black/90 border-b border-zinc-900 flex items-center justify-between gap-1 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              triggerHaptic('light');
              onChangeCategory(cat.id);
            }}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
              selectedCategory === cat.id
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-sm'
                : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Main Viewfinder */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {flashEffect && (
          <div className="absolute inset-0 bg-white z-40 opacity-95 transition-opacity duration-100 pointer-events-none" />
        )}

        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ transform: `scale(${zoomLevel}) ${facingMode === 'user' ? 'scaleX(-1)' : ''}` }}
          className="w-full h-full object-cover transition-transform duration-200"
        />

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-zinc-950/95 z-30 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400">
              <Camera className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5">Permiso de Cámara</h3>
            <p className="text-xs text-zinc-400 mb-5 max-w-xs">{cameraError}</p>

            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg"
              >
                <Upload className="w-4 h-4" />
                Subir fotos de tu teléfono
              </button>
              <button
                onClick={() => onSelectSample('sample-bracket-3d')}
                className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium"
              >
                Cargar muestra Pieza 3D (Soporte CAD)
              </button>
            </div>
          </div>
        )}

        {cameraActive && (
          <>
            {/* 4K Resolution Pill on Viewfinder */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-700/80 text-[10px] font-mono shadow">
              <span className={`w-2 h-2 rounded-full ${resolution === '4k' ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
              <span className={`font-bold ${resolution === '4k' ? 'text-amber-300' : 'text-cyan-300'}`}>
                {resolution === '4k' ? '4K ULTRA HD' : '1080p FHD'}
              </span>
              <span className="text-[9px] text-zinc-400">
                {resolution === '4k' ? '3840×2160' : '1920×1080'}
              </span>
            </div>

            {showGrid && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-20">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div />
              </div>
            )}

            {/* Scanning Reticle & Angle Guide */}
            {showCrosshair && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-72 h-72 sm:w-84 sm:h-84 flex items-center justify-center">
                  {/* Circular 360 Photogrammetry Orbit Progress */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="46%"
                      fill="none"
                      stroke="#27272a"
                      strokeWidth="3"
                      strokeDasharray="4 6"
                    />
                    <circle
                      cx="50%"
                      cy="50%"
                      r="46%"
                      fill="none"
                      stroke={captureMode === 'auto' ? '#f59e0b' : '#06b6d4'}
                      strokeWidth="5"
                      strokeDasharray={`${Math.min(100, (photos.length / 8) * 100) * 2.89} 1000`}
                      className="transition-all duration-300"
                    />

                    {/* Auto Mode: Next Angle Progress Ring (0 to ~40 deg) */}
                    {captureMode === 'auto' && autoTarget === 'phone' && isAutoRunning && (
                      <circle
                        cx="50%"
                        cy="50%"
                        r="38%"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeDasharray={`${Math.min(100, (gyroDelta / 40) * 100) * 2.38} 1000`}
                        className="transition-all duration-150"
                      />
                    )}
                  </svg>

                  {/* 8 Angle Nodes around the orbit circle */}
                  {GUIDED_ANGLES.slice(0, 8).map((ang, i) => {
                    const angleRad = (i * 45 - 90) * (Math.PI / 180);
                    const radiusPercent = 46;
                    const x = 50 + radiusPercent * Math.cos(angleRad);
                    const y = 50 + radiusPercent * Math.sin(angleRad);
                    const isTaken = i < photos.length;
                    const isCurrent = i === currentAngleIndex % 8;

                    return (
                      <div
                        key={ang.id}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                          isTaken
                            ? 'bg-emerald-400 text-zinc-950 scale-110 shadow-lg shadow-emerald-400/50 font-black text-[8px]'
                            : isCurrent
                            ? 'bg-amber-400 text-black scale-125 animate-ping'
                            : 'bg-zinc-800 border border-zinc-600'
                        }`}
                      >
                        {isTaken && '✓'}
                      </div>
                    );
                  })}

                  {/* Specific category reticle accents */}
                  <div
                    className={`w-52 h-52 relative flex items-center justify-center border-2 border-dashed ${
                      selectedCategory === 'hoyo'
                        ? 'rounded-full border-amber-400/60'
                        : selectedCategory === 'pieza_3d'
                        ? 'rounded-2xl border-cyan-400/60'
                        : 'rounded-3xl border-zinc-400/50'
                    }`}
                  >
                    <div className="w-4 h-0.5 bg-cyan-400" />
                    <div className="h-4 w-0.5 bg-cyan-400 absolute" />

                    {/* Turntable Auto Countdown Center Display */}
                    {captureMode === 'auto' && autoTarget === 'object' && isAutoRunning && autoCountdown !== null && (
                      <div className="flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-2xl px-4 py-2 border border-amber-400/50 shadow-2xl animate-in zoom-in-95">
                        <span className="text-3xl font-black font-mono text-amber-400">
                          {autoCountdown > 0 ? autoCountdown : '📸'}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-300">
                          {autoCountdown > 0 ? 'Gira el objeto...' : '¡Disparando!'}
                        </span>
                      </div>
                    )}

                    {/* Gyro Auto Angle Delta Center Display */}
                    {captureMode === 'auto' && autoTarget === 'phone' && isAutoRunning && (
                      <div className="flex flex-col items-center justify-center bg-black/70 backdrop-blur-md rounded-2xl px-3 py-1.5 border border-emerald-500/50 shadow-2xl">
                        <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold text-xs">
                          <RotateCw className={`w-3.5 h-3.5 ${gyroDelta > 0 ? 'animate-spin' : ''}`} />
                          <span>+{gyroDelta}° / 40°</span>
                        </div>
                        <span className="text-[8px] font-mono text-zinc-300">
                          {gyroDelta >= 36 ? '¡Listo! Capturando...' : `Gira ${Math.max(0, 40 - gyroDelta)}° más`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Central angle advice pill */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/85 backdrop-blur-md px-3 py-1 rounded-full border border-cyan-500/40 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 shadow-lg">
                    {captureMode === 'auto' ? (
                      <>
                        <span className={`w-2 h-2 rounded-full ${isAutoRunning ? 'bg-amber-400 animate-ping' : 'bg-zinc-500'}`} />
                        <span className="text-amber-300 font-bold">
                          {isAutoRunning
                            ? autoTarget === 'phone'
                              ? 'Auto-Giro Teléfono Activo'
                              : 'Auto-Giro Objeto Activo'
                            : 'Auto-Giro en Pausa'}
                        </span>
                        <span className="text-zinc-400">({photos.length}/8)</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>{currentGuide.label} ({photos.length}/8 fotos)</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Lens Selector: 0.5x Gran Angular | 1x Principal ⭐ | 2x Telefoto */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2 py-1 rounded-full border border-zinc-700/80 shadow-xl">
              <button
                onClick={() => handleSelectLens('ultrawide')}
                className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold transition-all ${
                  selectedLens === 'ultrawide'
                    ? 'bg-amber-400 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Gran Angular 0.5x - Bueno para hoyos en espacios estrechos"
              >
                0.5x
              </button>

              <button
                onClick={() => handleSelectLens('main')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all flex items-center gap-1 ${
                  selectedLens === 'main'
                    ? 'bg-cyan-400 text-zinc-950 shadow'
                    : 'text-zinc-300 hover:text-white'
                }`}
                title="Cámara Principal 1x - LA MEJOR Y RECOMENDADA"
              >
                <span>1x</span>
                <span className="text-[9px] text-amber-500 font-extrabold">★</span>
              </button>

              <button
                onClick={() => handleSelectLens('telephoto')}
                className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold transition-all ${
                  selectedLens === 'telephoto'
                    ? 'bg-amber-400 text-black shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Telefoto 2x - Mejor para piezas 3D y medidas sin distorsión"
              >
                2x
              </button>

              {/* Lens Advice Info trigger */}
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowLensAdvice(true);
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-cyan-300"
                title="¿Cuál cámara es mejor?"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating Ready Action Pill above Shutter */}
      {photos.length > 0 && (
        <div className="relative z-30 px-4 -mb-2 flex justify-center">
          <button
            onClick={() => onStartReconstruction(objectHint)}
            className="w-full max-w-xs py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/30 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Crear Modelo 3D con {photos.length} Fotos</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </div>
      )}

      {/* Auto-Giro Sub-Bar: Switch between Girar Teléfono and Girar Objeto */}
      {captureMode === 'auto' && (
        <div className="relative z-30 px-3 py-2 bg-zinc-950/95 border-t border-zinc-900 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-1.5">
            {/* Target Mode Selector: Girar Teléfono vs Girar Objeto */}
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
              <button
                onClick={() => {
                  setAutoTarget('phone');
                  setIsAutoRunning(false);
                  triggerHaptic('light');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                  autoTarget === 'phone'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>Girar Teléfono</span>
              </button>

              <button
                onClick={() => {
                  setAutoTarget('object');
                  setIsAutoRunning(false);
                  triggerHaptic('light');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                  autoTarget === 'object'
                    ? 'bg-amber-400 text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Disc className="w-3 h-3" />
                <span>Girar Objeto</span>
              </button>
            </div>

            {/* Auto-Create 3D Model Toggle */}
            <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoCreateOnFinish}
                onChange={(e) => {
                  setAutoCreateOnFinish(e.target.checked);
                  triggerHaptic('light');
                }}
                className="w-3.5 h-3.5 rounded accent-cyan-400"
              />
              <span className="whitespace-nowrap font-medium text-cyan-300">Auto-crear 3D</span>
            </label>
          </div>

          {/* Subtitle instructions based on selected auto target */}
          <div className="flex items-center justify-between text-[9px] text-zinc-400 px-1 font-mono">
            <span>
              {autoTarget === 'phone'
                ? '📱 Giroscopio: Dispara solo cada ~40° al rotar el teléfono'
                : '🍽️ Mesa Giratoria: Dispara con cuenta regresiva y vibración'}
            </span>
            {autoTarget === 'object' && (
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">Cadencia:</span>
                {[2, 2.5, 3.5].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => {
                      setAutoCadenceSeconds(sec);
                      triggerHaptic('light');
                    }}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      autoCadenceSeconds === sec
                        ? 'bg-amber-400 text-black'
                        : 'bg-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Mode Slider */}
      <div className="relative z-30 flex items-center justify-center gap-5 py-2 bg-black/95 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        <button
          onClick={() => {
            setCaptureMode('auto');
            triggerHaptic('light');
          }}
          className={`flex items-center gap-1 transition-colors ${
            captureMode === 'auto'
              ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
              : 'hover:text-zinc-300'
          }`}
        >
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>Auto Giro 360°</span>
        </button>
        <button
          onClick={() => {
            setCaptureMode('360');
            setIsAutoRunning(false);
            triggerHaptic('light');
          }}
          className={`transition-colors ${
            captureMode === '360' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : 'hover:text-zinc-300'
          }`}
        >
          Manual 360°
        </button>
        <button
          onClick={() => {
            setCaptureMode('burst');
            setIsAutoRunning(false);
            triggerHaptic('light');
          }}
          className={`transition-colors ${
            captureMode === 'burst' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : 'hover:text-zinc-300'
          }`}
        >
          Ráfaga
        </button>
        <button
          onClick={() => {
            setCaptureMode('free');
            setIsAutoRunning(false);
            triggerHaptic('light');
          }}
          className={`transition-colors ${
            captureMode === 'free' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : 'hover:text-zinc-300'
          }`}
        >
          Libre
        </button>
      </div>

      {/* Object Hint & Photos Summary Bar */}
      <div className="relative z-30 px-3 py-1.5 bg-black/95 border-t border-zinc-900 flex items-center gap-2">
        <span className="text-[10px] text-zinc-400 whitespace-nowrap">Nombre:</span>
        <input
          type="text"
          value={objectHint}
          onChange={(e) => setObjectHint(e.target.value)}
          placeholder={
            selectedCategory === 'pieza_3d'
              ? 'Ej: Soporte de montaje, Engranaje...'
              : selectedCategory === 'hoyo'
              ? 'Ej: Cavidad en cilindro, Orificio Ø 60mm...'
              : selectedCategory === 'aparato'
              ? 'Ej: Cámara, Consola, Teléfono...'
              : 'Ej: Taza, Florero, Calzado...'
          }
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
        {photos.length > 0 && (
          <button
            onClick={() => {
              onClearPhotos();
              triggerHaptic('medium');
            }}
            className="text-[10px] text-red-400 hover:text-red-300 whitespace-nowrap pl-1"
          >
            Borrar ({photos.length})
          </button>
        )}
      </div>

      {/* Mobile Shutter Control Deck */}
      <div className="relative z-30 px-5 pt-2 pb-5 bg-black border-t border-zinc-900 flex items-center justify-between">
        {/* Left: Gallery Thumbnail */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          {photos.length > 0 ? (
            <button
              onClick={() => setPreviewPhoto(photos[photos.length - 1])}
              className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-md bg-zinc-900 active:scale-95 transition-transform"
            >
              <img
                src={photos[photos.length - 1].dataUrl}
                alt="Última foto"
                className="w-full h-full object-cover"
              />
              {photos[photos.length - 1].is4K && (
                <span className="absolute top-0.5 right-0.5 bg-amber-400 text-black text-[7px] font-black px-1 rounded shadow">
                  4K
                </span>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-mono text-center text-white font-bold">
                {photos.length}
              </span>
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-12 h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95"
              title="Subir Fotos de Galería"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
            </button>
          )}
        </div>

        {/* Center: Tactile Trigger (Auto Play/Pause or Shutter) */}
        <div className="flex items-center gap-3">
          {captureMode === 'auto' ? (
            <div className="flex items-center gap-2">
              {/* Primary Big Auto Giro Toggle Button */}
              <button
                onClick={toggleAutoRunning}
                disabled={!cameraActive}
                className={`py-3 px-5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer ${
                  isAutoRunning
                    ? 'bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/30 animate-pulse'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 shadow-emerald-500/30'
                }`}
              >
                {isAutoRunning ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar Auto Giro</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar Auto Giro</span>
                  </>
                )}
              </button>

              {/* Extra instant tactile shutter for manual shots anytime */}
              <button
                onClick={() => capturePhoto()}
                disabled={!cameraActive}
                className="w-12 h-12 rounded-full border-2 border-zinc-500 bg-zinc-900 active:scale-90 flex items-center justify-center text-zinc-200"
                title="Disparo Manual Adicional"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={captureMode === 'burst' ? triggerBurst : () => capturePhoto()}
              disabled={!cameraActive || isBursting}
              className="relative w-18 h-18 rounded-full border-4 border-white p-1 active:scale-90 transition-transform cursor-pointer shadow-2xl flex items-center justify-center"
              title="Tomar Foto"
            >
              <div className="w-full h-full rounded-full bg-cyan-400 active:bg-cyan-300 transition-colors flex items-center justify-center shadow-inner">
                <Camera className="w-6 h-6 text-zinc-950" />
              </div>

              {isBursting && (
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold flex items-center justify-center animate-bounce">
                  {burstCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right: Camera Flip */}
        <div>
          <button
            onClick={toggleCameraFacing}
            className="w-12 h-12 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 hover:text-white transition-all active:scale-95 shadow-md"
            title="Girar Cámara"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Step-by-Step Tutorial Modal */}
      <InteractiveTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStartScanning={() => setShowTutorial(false)}
      />

      {/* Which camera lens is better info sheet */}
      {showLensAdvice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-5 shadow-2xl text-zinc-100">
            <button
              onClick={() => setShowLensAdvice(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              ¿Qué lente es mejor para escanear?
            </h3>

            <div className="space-y-2.5 text-xs text-zinc-300 mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                <span className="font-bold text-emerald-300 block mb-0.5">⭐ 1x Principal (Recomendada):</span>
                <p className="text-[11px] text-zinc-400">
                  Es la mejor en el 90% de los casos. Ofrece la mayor resolución, mejor rango dinámico y nula distorsión de perspectiva.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="font-bold text-cyan-300 block mb-0.5">🔍 2x Telefoto:</span>
                <p className="text-[11px] text-zinc-400">
                  Ideal para piezas 3D pequeñas y mecánicas. Al aplanar la escena, las medidas milimétricas son más exactas y sin abombamiento.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="font-bold text-zinc-300 block mb-0.5">🌐 0.5x Gran Angular:</span>
                <p className="text-[11px] text-zinc-400">
                  Úsala solo para hoyos profundos o en espacios confinados donde no te puedes alejar. Produce ligera distorsión en los bordes.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowLensAdvice(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Sample Picker Bottom Sheet */}
      {showSamplePicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm select-none">
          <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                Modelos de Muestra por Categoría
              </h3>
              <button
                onClick={() => setShowSamplePicker(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {SAMPLE_MODELS.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectSample(item.id);
                    setShowSamplePicker(false);
                  }}
                  className="p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">{item.name}</h4>
                    <p className="text-[10px] text-zinc-400">
                      {item.measurements?.widthMm}×{item.measurements?.heightMm}×{item.measurements?.depthMm} mm • {item.scanCategory.toUpperCase()}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-zinc-800 text-cyan-300 border border-zinc-700">
                    Cargar 3D
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">{previewPhoto.angleLabel}</span>
                {previewPhoto.is4K ? (
                  <span className="text-[9px] font-mono font-bold bg-amber-400 text-black px-1.5 py-0.5 rounded-full shadow">
                    4K UHD
                  </span>
                ) : (
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-700">
                    FHD
                  </span>
                )}
              </div>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[50vh]">
              <img
                src={previewPhoto.dataUrl}
                alt="Foto"
                className="max-h-[48vh] object-contain rounded-xl"
              />
            </div>
            <div className="px-3 py-1.5 bg-zinc-950/80 border-t border-zinc-800/80 text-[10px] text-zinc-400 font-mono flex items-center justify-between">
              <span>{previewPhoto.resolutionLabel || `${previewPhoto.width || 1920} × ${previewPhoto.height || 1080}`}</span>
              <span className="text-cyan-400 font-semibold">Detalle Fotogramétrico</span>
            </div>
            <div className="p-3 flex justify-between gap-2 bg-zinc-900">
              <button
                onClick={() => {
                  onRemovePhoto(previewPhoto.id);
                  setPreviewPhoto(null);
                  triggerHaptic('medium');
                }}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-medium flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Completion 360 & Instant Model Generation Modal */}
      {showAutoCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-zinc-900 to-zinc-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center">
            {/* Top Badge */}
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-400/30 mb-4 animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-400 block mb-1">
              Escaneo Orbital 100% Completo
            </span>
            <h3 className="text-lg font-black text-white mb-2">
              ¡Giro 360° Completado!
            </h3>
            <p className="text-xs text-zinc-300 mb-5 leading-relaxed">
              Capturaste los <strong className="text-white">8 ángulos</strong> necesarios en{' '}
              <strong className="text-amber-300">{resolution === '4k' ? '4K Ultra HD' : '1080p'}</strong> con solapamiento óptimo para la reconstrucción tridimensional.
            </p>

            {/* Auto-Launch Countdown Indicator */}
            {autoCreateOnFinish && (
              <div className="mb-5 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-left">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-black font-black font-mono text-base flex items-center justify-center shrink-0">
                    {autoLaunchSeconds}s
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">Generación Automática</span>
                    <span className="text-[10px] text-zinc-400">Iniciando modelo 3D...</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAutoCompletionModal(false);
                    triggerHaptic('light');
                  }}
                  className="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded-lg bg-zinc-800"
                >
                  Pausar
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setShowAutoCompletionModal(false);
                  triggerHaptic('success');
                  onStartReconstruction(objectHint);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-zinc-950 font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-400/25 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>Crear Modelo 3D Ahora</span>
              </button>

              <button
                onClick={() => {
                  setShowAutoCompletionModal(false);
                  triggerHaptic('light');
                }}
                className="w-full py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium text-xs cursor-pointer"
              >
                Continuar Escaneando Más Ángulos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
