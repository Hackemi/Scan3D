import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  Sparkles,
  Upload,
  Trash2,
  Grid,
  Zap,
  Play,
  Pause,
  Flashlight,
  Smartphone,
  HelpCircle,
  X,
  Target,
  Ruler,
  Activity,
  ArrowUpDown,
  Disc,
  Compass,
  Layers,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  Sliders,
} from 'lucide-react';
import { CapturedPhoto, ScanCategory, CaptureResolution } from '../types';
import { soundEffects } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';
import { SAMPLE_MODELS } from '../utils/sampleData';
import { InteractiveTutorial } from './InteractiveTutorial';
import { takeHighResPhoto, getCameraConstraints } from '../utils/cameraCapture';
import { analyzeScanCoverage } from '../utils/scanCoverage';

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
  { id: 'auto', label: 'Auto', icon: '✨', desc: 'Detección inteligente de forma y orificios' },
  { id: 'hoyo', label: 'Hoyos / Cavidad', icon: '🕳️', desc: 'Cilindros con hoyos y cavidades cóncavas' },
  { id: 'pieza_3d', label: 'Pieza CAD', icon: '🧩', desc: 'Piezas mecánicas e ingeniería' },
  { id: 'aparato', label: 'Aparato', icon: '📱', desc: 'Dispositivos electrónicos y chasis' },
  { id: 'general', label: 'General', icon: '🏺', desc: 'Envases, calzado y objetos comunes' },
];

const GUIDED_ANGLES = [
  { id: 'front', label: 'Frente 0°', ring: 'mid' as const, pitch: 45 },
  { id: 'front-right', label: 'Diagonal 45°', ring: 'mid' as const, pitch: 45 },
  { id: 'right', label: 'Lateral 90°', ring: 'mid' as const, pitch: 45 },
  { id: 'back-right', label: 'Posterior 135°', ring: 'mid' as const, pitch: 45 },
  { id: 'back', label: 'Trasero 180°', ring: 'mid' as const, pitch: 45 },
  { id: 'back-left', label: 'Posterior 225°', ring: 'mid' as const, pitch: 45 },
  { id: 'left', label: 'Lateral 270°', ring: 'mid' as const, pitch: 45 },
  { id: 'front-left', label: 'Diagonal 315°', ring: 'mid' as const, pitch: 45 },
  { id: 'top-hole', label: 'Cenital 80° (Hoyos)', ring: 'zenith' as const, pitch: 80 },
  { id: 'low-wall', label: 'Rasante 20° (Pared)', ring: 'low' as const, pitch: 20 },
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
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showLevel, setShowLevel] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // Resolution (Default 4K Ultra HD)
  const [resolution, setResolution] = useState<CaptureResolution>('4k');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Zoom / Lens
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Capture mode: manual vs auto vs burst
  const [isAutoGiro, setIsAutoGiro] = useState<boolean>(false);
  const [isBurstMode, setIsBurstMode] = useState<boolean>(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [objectHint, setObjectHint] = useState<string>('');
  const [showPhotosDrawer, setShowPhotosDrawer] = useState<boolean>(false);
  const [showCoverageModal, setShowCoverageModal] = useState<boolean>(false);

  // Inclinometer, Level & Distance
  const [handStability, setHandStability] = useState<'steady' | 'moving'>('steady');
  const [devicePitch, setDevicePitch] = useState<number>(45); // 0=horizontal looking ahead, 90=zenith looking straight down
  const [deviceRoll, setDeviceRoll] = useState<number>(0); // 0=level, negative=tilt left, positive=tilt right
  const [targetPitch, setTargetPitch] = useState<number>(45); // 20 (rasante), 45 (medio), 80 (cenital hoyos)
  const [distanceCm, setDistanceCm] = useState<number>(35); // Estimated distance (30-45cm ideal)

  // Modals
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showHolesGuideModal, setShowHolesGuideModal] = useState<boolean>(false);
  const [showSamplePicker, setShowSamplePicker] = useState<boolean>(false);

  const isHoyoMode = selectedCategory === 'hoyo' || /cilindro|hoyo|agujero|tubo/i.test(objectHint);

  // Coverage analysis (3 rings: Rasante, Medio, Cenital)
  const coverage = analyzeScanCoverage(photos, isHoyoMode);

  // Hand stability & pitch tracking via accelerometer & gyro
  useEffect(() => {
    let lastX = 0, lastY = 0, lastZ = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;
      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;

      const delta = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);
      lastX = x;
      lastY = y;
      lastZ = z;

      setHandStability(delta > 3.2 ? 'moving' : 'steady');

      if (event.accelerationIncludingGravity) {
        // Approximate pitch from gravity vector
        const pitchRad = Math.atan2(Math.abs(z), Math.sqrt(x * x + y * y));
        const pitchDeg = Math.round(pitchRad * (180 / Math.PI));
        // Fallback pitch if orientation API is not available
        if (pitchDeg >= 0 && pitchDeg <= 90) {
          setDevicePitch((prev) => Math.round(prev * 0.8 + pitchDeg * 0.2));
        }
      }
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (typeof event.beta === 'number' && event.beta !== null) {
        // Beta: -180 to 180 (front-back tilt). When phone is upright facing forward, beta is ~90.
        // When pointing down at table (zenith), beta is ~0 to 20 depending on screen orientation.
        const absBeta = Math.abs(event.beta);
        const mappedPitch = Math.max(5, Math.min(90, Math.round(90 - (absBeta > 90 ? 180 - absBeta : absBeta) * 0.8)));
        setDevicePitch(mappedPitch);
      }
      if (typeof event.gamma === 'number' && event.gamma !== null) {
        // Gamma: -90 to 90 (left-right tilt). 0 is level.
        setDeviceRoll(Math.round(event.gamma));
      }
    };

    if (typeof window !== 'undefined') {
      if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', handleMotion);
      }
      if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleOrientation);
      }
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('devicemotion', handleMotion);
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // Update target pitch when in hoyo mode and missing zenith shots
  useEffect(() => {
    if (isHoyoMode && !coverage.info.hasTopHoleView && photos.length >= 2) {
      setTargetPitch(80);
    }
  }, [isHoyoMode, coverage.info.hasTopHoleView, photos.length]);

  // Camera start / restart
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints = getCameraConstraints(facingMode, resolution);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const caps = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        setHasTorch(Boolean(caps.torch));
      }
    } catch (err: any) {
      console.warn('Camera starting failed, attempting basic fallback:', err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (fallbackErr) {
        setCameraError('Permiso de cámara denegado o no disponible en este dispositivo.');
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

  // Torch toggle
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({ advanced: [{ torch: nextState } as any] });
        setTorchOn(nextState);
        triggerHaptic('light');
      } catch (e) {
        console.warn('Could not toggle torch', e);
      }
    }
  };

  // Flip camera
  const toggleCameraFacing = () => {
    triggerHaptic('medium');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Take photo with full sensor orientation & distance metadata
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !streamRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      soundEffects.playShutter();
      triggerHaptic('shutter');
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 90);

      const targetAngle = GUIDED_ANGLES[currentAngleIndex % GUIDED_ANGLES.length];
      const newPhoto = await takeHighResPhoto(
        videoRef.current,
        streamRef.current,
        facingMode,
        resolution,
        targetAngle.label
      );

      // Attach precision spatial metadata for photogrammetry
      newPhoto.pitch = devicePitch;
      newPhoto.roll = deviceRoll;
      newPhoto.yaw = (photos.length * 30) % 360;
      newPhoto.distanceCm = distanceCm;
      newPhoto.ring = devicePitch >= 68 ? 'zenith' : devicePitch < 32 ? 'low' : 'mid';

      onAddPhoto(newPhoto);
      setCurrentAngleIndex((prev) => (prev + 1) % GUIDED_ANGLES.length);
    } catch (e) {
      console.error('Camera capture error:', e);
    } finally {
      setIsCapturing(false);
    }
  }, [currentAngleIndex, facingMode, onAddPhoto, resolution, isCapturing, devicePitch, deviceRoll, distanceCm, photos.length]);

  // Auto Giro Cadence Timer (every 3 seconds)
  useEffect(() => {
    if (!isAutoGiro) {
      setAutoCountdown(null);
      return;
    }

    let seconds = 3;
    setAutoCountdown(seconds);

    const interval = setInterval(() => {
      seconds -= 1;
      if (seconds > 0) {
        setAutoCountdown(seconds);
        soundEffects.playCountdown(false);
      } else if (seconds === 0) {
        setAutoCountdown(0);
        capturePhoto();
      } else {
        seconds = 3;
        setAutoCountdown(seconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoGiro, capturePhoto]);

  // Burst Mode (continuous fast capture every 1.4s as you orbit)
  useEffect(() => {
    if (!isBurstMode) return;

    const burstTimer = setInterval(() => {
      if (photos.length >= 48) {
        setIsBurstMode(false);
        return;
      }
      capturePhoto();
    }, 1400);

    return () => clearInterval(burstTimer);
  }, [isBurstMode, capturePhoto, photos.length]);

  // File upload from device
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
            const pitchEst = index === 0 ? 80 : index % 2 === 0 ? 45 : 20;
            onAddPhoto({
              id: `upload-${Date.now()}-${index}`,
              dataUrl,
              angleLabel: GUIDED_ANGLES[(photos.length + index) % GUIDED_ANGLES.length].label,
              timestamp: Date.now(),
              width: img.width,
              height: img.height,
              is4K: img.width >= 3200,
              resolutionLabel: `${img.width} × ${img.height}`,
              pitch: pitchEst,
              roll: 0,
              yaw: (index * 45) % 360,
              distanceCm: 35,
              ring: pitchEst >= 68 ? 'zenith' : pitchEst < 32 ? 'low' : 'mid',
            });
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
    triggerHaptic('success');
  };

  // Level status (Roll within +/- 3 degrees is considered perfectly level)
  const isRollLevel = Math.abs(deviceRoll) <= 3;
  const pitchDiff = Math.abs(devicePitch - targetPitch);
  const isPitchTarget = pitchDiff <= 8;

  // Max photo target scale (dynamically expands: 12 -> 24 -> 36 -> 48)
  const targetPhotoMilestone = photos.length < 12 ? 12 : photos.length < 24 ? 24 : photos.length < 36 ? 36 : 48;
  const orbitProgress = Math.min(100, (photos.length / targetPhotoMilestone) * 100);

  return (
    <div className="relative flex flex-col h-full w-full bg-black text-white select-none overflow-hidden touch-none font-sans">
      {/* 1. Sleek Top Bar */}
      <header className="relative z-30 flex items-center justify-between px-3.5 py-2 bg-gradient-to-b from-black/95 via-black/75 to-transparent shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold tracking-tight text-white block leading-tight">Scan3D Studio</span>
            <span className="text-[9px] text-cyan-400 font-mono block leading-none">Móvil • Modo Fotogrametría</span>
          </div>
        </div>

        {/* Clean Utility Actions */}
        <div className="flex items-center gap-1.5">
          {/* Domo de Cobertura Mini-Radar Badge */}
          <button
            onClick={() => setShowCoverageModal(true)}
            className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
              coverage.info.coveragePercent >= 75
                ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
            }`}
            title="Ver Domo de Cobertura 360°"
          >
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>{coverage.info.coveragePercent}% Cobertura</span>
          </button>

          {/* 4K resolution toggle */}
          <button
            onClick={() => setResolution((prev) => (prev === '4k' ? '1080p' : '4k'))}
            className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
              resolution === '4k'
                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
          >
            {resolution === '4k' ? '4K' : 'FHD'}
          </button>

          {/* Torch if available */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                torchOn ? 'bg-amber-400 border-amber-300 text-black' : 'bg-black/60 border-zinc-700 text-zinc-300'
              }`}
              title="Linterna"
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Level & Horizon toggle */}
          <button
            onClick={() => setShowLevel((v) => !v)}
            className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
              showLevel ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-black/60 border-zinc-700 text-zinc-400'
            }`}
            title="Nivel de Burbuja e Inclinómetro"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
              showGrid ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-black/60 border-zinc-700 text-zinc-400'
            }`}
            title="Cuadrícula"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* Tutorial / Help */}
          <button
            onClick={() => setShowTutorial(true)}
            className="p-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white cursor-pointer"
            title="Guía de Escaneo"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Category Selector & Orientation Advisor */}
      <nav className="relative z-30 px-3 py-1.5 bg-black/90 border-b border-zinc-900 flex items-center justify-between gap-1 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                triggerHaptic('light');
                onChangeCategory(cat.id);
              }}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500 text-zinc-950 font-bold shadow-sm'
                  : 'bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Orientation badge: VERTICAL vs HORIZONTAL */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          <div className="px-2 py-1 rounded-xl text-[10px] font-mono font-semibold bg-zinc-900 border border-zinc-750 text-zinc-300 flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-cyan-400" />
            <span>VERTICAL</span>
          </div>

          {isHoyoMode && (
            <button
              onClick={() => setShowHolesGuideModal(true)}
              className="px-2 py-1 rounded-xl text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 shrink-0 flex items-center gap-1"
            >
              <Target className="w-3 h-3 text-amber-400" />
              <span>Hoyos</span>
            </button>
          )}
        </div>
      </nav>

      {/* 3. Main Viewfinder with Level & Angle HUD */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {/* Flash feedback */}
        {flashEffect && (
          <div className="absolute inset-0 bg-white z-40 opacity-95 transition-opacity duration-100 pointer-events-none" />
        )}

        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ transform: `scale(${zoomLevel}) ${facingMode === 'user' ? 'scaleX(-1)' : ''}` }}
          className="w-full h-full object-cover"
        />

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-zinc-950/95 z-30 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Cámara Móvil</h3>
            <p className="text-xs text-zinc-400 mb-4 max-w-xs">{cameraError}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Subir fotos de tu teléfono
              </button>
              <button
                onClick={() => setShowSamplePicker(true)}
                className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium cursor-pointer"
              >
                Ver Modelos de Muestra
              </button>
            </div>
          </div>
        )}

        {/* SLEEK LIVE HUD STRIP (Distance, Level, Pitch, Photo Counter) */}
        {cameraActive && (
          <div className="absolute top-2.5 inset-x-3 z-20 pointer-events-none flex flex-col items-center gap-1.5">
            {/* Main telemetry capsule */}
            <div className="flex items-center gap-2 bg-zinc-950/85 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-700/60 text-[10px] font-mono shadow-xl text-zinc-200">
              {/* Distance meter */}
              <span className="flex items-center gap-1 font-semibold text-cyan-300" title="Distancia al objeto">
                <Ruler className="w-2.5 h-2.5 text-cyan-400" />
                {distanceCm} cm {distanceCm >= 28 && distanceCm <= 45 ? '✓' : ''}
              </span>

              <span className="text-zinc-600">•</span>

              {/* Inclinometer Pitch (Grados de inclinación) */}
              <span
                className={`flex items-center gap-1 font-bold ${
                  isPitchTarget ? 'text-emerald-400' : 'text-amber-300'
                }`}
                title="Inclinación actual vs objetivo"
              >
                <ArrowUpDown className="w-2.5 h-2.5" />
                {devicePitch}° / Obj: {targetPitch}°
              </span>

              <span className="text-zinc-600">•</span>

              {/* Lateral Level (Roll) */}
              <span
                className={`flex items-center gap-1 ${
                  isRollLevel ? 'text-emerald-400 font-bold' : 'text-amber-400'
                }`}
                title="Nivel lateral horizontal"
              >
                <span>{isRollLevel ? 'Nivelado ✓' : `${deviceRoll > 0 ? '⟲' : '⟳'} ${Math.abs(deviceRoll)}°`}</span>
              </span>

              <span className="text-zinc-600">•</span>

              {/* Stability */}
              <span className={handStability === 'moving' ? 'text-amber-300' : 'text-emerald-400'}>
                {handStability === 'moving' ? 'Estabiliza' : 'Firme'}
              </span>

              <span className="text-zinc-600">•</span>

              {/* Photo Count */}
              <span className="text-cyan-400 font-bold">
                {photos.length} fotos
              </span>
            </div>

            {/* Smart Coaching Advice for Missing Holes/Angles */}
            {coverage.info.missingHints.length > 0 && (
              <div className="px-3 py-1 rounded-full bg-zinc-950/90 border border-amber-500/40 text-[10px] text-amber-200 backdrop-blur-md shadow-lg flex items-center gap-1.5 max-w-sm text-center">
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{coverage.info.missingHints[0]}</span>
              </div>
            )}
          </div>
        )}

        {/* Grid lines */}
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

        {/* ARTIFICIAL HORIZON & BUBBLE LEVEL HUD OVERLAY */}
        {showLevel && cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-15">
            {/* Horizon Line rotating with roll */}
            <div
              className={`w-44 h-0.5 transition-transform duration-100 ${
                isRollLevel ? 'bg-emerald-400/70 shadow-sm shadow-emerald-400/50' : 'bg-amber-400/50'
              }`}
              style={{ transform: `rotate(${-deviceRoll}deg)` }}
            />

            {/* Center Digital Level Bubble */}
            <div className="absolute w-14 h-14 rounded-full border border-dashed border-zinc-500/60 flex items-center justify-center">
              {/* Inner crosshair */}
              <div className="w-1.5 h-1.5 rounded-full border border-cyan-400/80" />
              {/* Floating bubble based on roll & pitch error */}
              <div
                className={`absolute w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  isRollLevel && isPitchTarget
                    ? 'bg-emerald-400 shadow-md shadow-emerald-400/80 scale-110'
                    : 'bg-amber-400/90'
                }`}
                style={{
                  transform: `translate(${Math.max(-20, Math.min(20, deviceRoll * 1.8))}px, ${Math.max(
                    -20,
                    Math.min(20, (devicePitch - targetPitch) * 0.8)
                  )}px)`,
                }}
              />
            </div>
          </div>
        )}

        {/* Quick Pitch Selector Buttons (20° Rasante, 45° Medio, 80° Cenital para hoyos) */}
        <div className="absolute right-3 top-16 z-25 flex flex-col gap-1.5 pointer-events-auto">
          {[
            { label: '80° Cenital', pitch: 80, desc: 'Para ver hoyos' },
            { label: '45° Medio', pitch: 45, desc: 'Forma general' },
            { label: '20° Rasante', pitch: 20, desc: 'Paredes y base' },
          ].map((item) => (
            <button
              key={item.pitch}
              onClick={() => {
                setTargetPitch(item.pitch);
                triggerHaptic('light');
              }}
              className={`px-2 py-1 rounded-xl text-[9px] font-mono text-right transition-all border cursor-pointer ${
                targetPitch === item.pitch
                  ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-400 shadow-md'
                  : 'bg-black/70 backdrop-blur-md text-zinc-300 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="font-bold">{item.label}</div>
              <div className="text-[8px] opacity-75">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Framing Reticle (Clean CAD Corners + Hairline Orbit) */}
        {cameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Hairline circular orbit tracker */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="50%"
                  cy="50%"
                  r="46%"
                  fill="none"
                  stroke="#27272a"
                  strokeWidth="2"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r="46%"
                  fill="none"
                  stroke={isBurstMode ? '#10b981' : isAutoGiro ? '#f59e0b' : '#06b6d4'}
                  strokeWidth="3.5"
                  strokeDasharray={`${(orbitProgress / 100) * 2.89 * 100} 1000`}
                  className="transition-all duration-300"
                />
              </svg>

              {/* CAD corner brackets */}
              <div className="absolute inset-6 pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400/70" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70" />
              </div>

              {/* If Hoyos Mode: central cavity circle with depth guidance */}
              {isHoyoMode ? (
                <div className="w-28 h-28 rounded-full border border-dashed border-amber-400/60 flex items-center justify-center animate-pulse">
                  <div className="text-center">
                    <div className="w-2 h-2 rounded-full bg-amber-400 mx-auto mb-1" />
                    <span className="text-[8px] font-mono text-amber-300 font-bold">ZONA DE HOYOS</span>
                  </div>
                </div>
              ) : (
                <div className="w-3 h-3 flex items-center justify-center">
                  <div className="w-2 h-0.5 bg-cyan-400/60" />
                  <div className="h-2 w-0.5 bg-cyan-400/60 absolute" />
                </div>
              )}

              {/* Countdown overlay in Auto-Giro */}
              {isAutoGiro && autoCountdown !== null && (
                <div className="absolute z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-2xl px-4 py-2 border border-amber-400/50 shadow-2xl animate-in zoom-in-95">
                  <span className="text-3xl font-black font-mono text-amber-400">
                    {autoCountdown > 0 ? autoCountdown : '📸'}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-300">
                    {autoCountdown > 0 ? 'Gira el objeto...' : '¡Disparando!'}
                  </span>
                </div>
              )}

              {/* Burst mode feedback */}
              {isBurstMode && (
                <div className="absolute bottom-4 z-20 bg-emerald-950/90 border border-emerald-500/70 px-3 py-1 rounded-full text-[10px] font-mono text-emerald-300 shadow-xl flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Ráfaga activa: Camina alrededor</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. Streamlined Hint Input & Distance Slider */}
      <div className="relative z-30 px-3.5 py-1.5 bg-black/95 border-t border-zinc-900 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={objectHint}
          onChange={(e) => setObjectHint(e.target.value)}
          placeholder="Nombre o descripción (opcional)..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />

        {/* Distance fine-tuning popup/button */}
        <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded-xl border border-zinc-800 text-[11px] font-mono text-zinc-300 shrink-0">
          <Ruler className="w-3 h-3 text-cyan-400" />
          <span>{distanceCm}cm</span>
        </div>

        {photos.length > 0 && (
          <button
            onClick={() => {
              onClearPhotos();
              triggerHaptic('medium');
            }}
            className="text-[11px] text-zinc-500 hover:text-red-400 whitespace-nowrap px-1 cursor-pointer"
          >
            Borrar ({photos.length})
          </button>
        )}
      </div>

      {/* 5. Clean Bottom Action Dock with Burst and Auto Modes */}
      <div className="relative z-30 px-5 pt-2 pb-5 bg-black border-t border-zinc-900 flex items-center justify-between shrink-0">
        {/* Left: Photos Reel Thumbnail / Upload */}
        <div className="relative w-12 h-12 flex items-center justify-center">
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
              onClick={() => setShowPhotosDrawer(true)}
              className="relative w-11 h-11 rounded-xl overflow-hidden border border-cyan-400 shadow bg-zinc-900 active:scale-95 transition-transform cursor-pointer"
              title="Ver fotos capturadas"
            >
              <img
                src={photos[photos.length - 1].dataUrl}
                alt="Última foto"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono text-center text-cyan-300 font-bold">
                {photos.length}
              </span>
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-11 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer"
              title="Subir fotos"
            >
              <Upload className="w-4 h-4 text-cyan-400" />
            </button>
          )}
        </div>

        {/* Center: Tactile Shutter Button with Auto-Giro and Ráfaga Toggles */}
        <div className="flex flex-col items-center gap-1.5">
          {/* Quick mode toggles */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsAutoGiro((v) => !v);
                setIsBurstMode(false);
                triggerHaptic('light');
              }}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                isAutoGiro
                  ? 'bg-amber-400 border-amber-300 text-black'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Disc className={`w-2.5 h-2.5 ${isAutoGiro ? 'animate-spin' : ''}`} />
              <span>{isAutoGiro ? 'Giro Activo' : 'Auto Giro'}</span>
            </button>

            <button
              onClick={() => {
                setIsBurstMode((v) => !v);
                setIsAutoGiro(false);
                triggerHaptic('light');
              }}
              className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-colors cursor-pointer border ${
                isBurstMode
                  ? 'bg-emerald-400 border-emerald-300 text-black'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Ráfaga continua para máxima cantidad de fotos y textura"
            >
              <Zap className="w-2.5 h-2.5" />
              <span>{isBurstMode ? 'Ráfaga ON' : 'Ráfaga'}</span>
            </button>
          </div>

          {/* Shutter Circle */}
          <button
            onClick={capturePhoto}
            disabled={!cameraActive}
            className="relative w-16 h-16 rounded-full border-3 border-white p-1 active:scale-92 transition-transform cursor-pointer shadow-xl flex items-center justify-center"
            title="Tomar Foto"
          >
            <div className="w-full h-full rounded-full bg-cyan-400 active:bg-cyan-300 transition-colors flex items-center justify-center shadow-inner">
              <Camera className="w-5 h-5 text-zinc-950 fill-current" />
            </div>
          </button>
        </div>

        {/* Right: Direct Reconstruct 3D Button (or Flip Camera when 0 photos) */}
        <div className="relative w-28 flex items-center justify-end">
          {photos.length >= 1 ? (
            <button
              onClick={() => {
                triggerHaptic('success');
                onStartReconstruction(objectHint);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Generar 3D</span>
            </button>
          ) : (
            <button
              onClick={toggleCameraFacing}
              className="w-11 h-11 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all active:scale-95 cursor-pointer shadow"
              title="Girar cámara"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 6. Domo de Cobertura 360° Modal (Visual radar showing what is missing) */}
      {showCoverageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-5 shadow-2xl text-zinc-100 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Domo de Cobertura 360°</h3>
              </div>
              <button
                onClick={() => setShowCoverageModal(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Radar Circular Visualization */}
            <div className="flex flex-col items-center justify-center py-3">
              <div className="relative w-48 h-48 rounded-full border border-zinc-800 flex items-center justify-center bg-zinc-950/60">
                {/* Ring 1: Low 20 deg (outer) */}
                <div className="absolute inset-2 rounded-full border border-zinc-750" />
                {/* Ring 2: Mid 45 deg */}
                <div className="absolute inset-10 rounded-full border border-zinc-750" />
                {/* Ring 3: Zenith 80 deg (inner, for holes) */}
                <div className="absolute inset-18 rounded-full border-2 border-dashed border-amber-400/60 bg-amber-500/5 flex items-center justify-center">
                  <span className="text-[8px] font-mono text-amber-300 font-bold">HOYOS</span>
                </div>

                {/* Zenith sector indicators */}
                {coverage.zenithSectors.map((sec, i) => {
                  const angleRad = (sec.angle * Math.PI) / 180;
                  const x = Math.cos(angleRad) * 28;
                  const y = Math.sin(angleRad) * 28;
                  return (
                    <div
                      key={`zenith-${i}`}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className={`absolute w-3 h-3 rounded-full border ${
                        sec.isCovered
                          ? 'bg-emerald-400 border-emerald-200 shadow-sm shadow-emerald-400'
                          : 'bg-zinc-850 border-zinc-700'
                      }`}
                      title={`Cenital ${sec.label}`}
                    />
                  );
                })}

                {/* Mid sectors */}
                {coverage.midSectors.map((sec, i) => {
                  const angleRad = (sec.angle * Math.PI) / 180;
                  const x = Math.cos(angleRad) * 58;
                  const y = Math.sin(angleRad) * 58;
                  return (
                    <div
                      key={`mid-${i}`}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className={`absolute w-2.5 h-2.5 rounded-full border ${
                        sec.isCovered
                          ? 'bg-cyan-400 border-cyan-200 shadow-sm shadow-cyan-400'
                          : 'bg-zinc-850 border-zinc-700'
                      }`}
                      title={`Medio 45° ${sec.label}`}
                    />
                  );
                })}

                {/* Low sectors */}
                {coverage.lowSectors.map((sec, i) => {
                  const angleRad = (sec.angle * Math.PI) / 180;
                  const x = Math.cos(angleRad) * 86;
                  const y = Math.sin(angleRad) * 86;
                  return (
                    <div
                      key={`low-${i}`}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      className={`absolute w-2.5 h-2.5 rounded-full border ${
                        sec.isCovered
                          ? 'bg-blue-500 border-blue-300 shadow-sm shadow-blue-500'
                          : 'bg-zinc-850 border-zinc-700'
                      }`}
                      title={`Rasante 20° ${sec.label}`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Cenital (Hoyos)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> Medio 45°
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" /> Rasante 20°
                </span>
              </div>
            </div>

            {/* Missing Hints Checklist */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs">
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider block">
                ¿Qué nos hace falta escanear?
              </span>
              {coverage.info.missingHints.map((hint, i) => (
                <div key={i} className="text-zinc-300 text-[11px] leading-tight flex items-start gap-1.5">
                  <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{hint}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowCoverageModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
            >
              Continuar Escaneo
            </button>
          </div>
        </div>
      )}

      {/* 7. Photos Drawer Modal */}
      {showPhotosDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm select-none">
          <div className="w-full max-w-md bg-zinc-900 border-t border-zinc-700 rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                Fotogramas Capturados ({photos.length})
              </h3>
              <button
                onClick={() => setShowPhotosDrawer(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 overflow-y-auto p-1 flex-1">
              {photos.map((p, idx) => (
                <div
                  key={p.id}
                  className="relative group rounded-xl overflow-hidden border border-zinc-800 aspect-square bg-black"
                >
                  <img src={p.dataUrl} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => onRemovePhoto(p.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-600/90 text-white cursor-pointer"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-mono text-white">
                    #{idx + 1} {p.pitch ? `${p.pitch}°` : ''}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
              <button
                onClick={onClearPhotos}
                className="px-3 py-2 rounded-xl bg-zinc-800 text-red-400 text-xs font-medium cursor-pointer"
              >
                Borrar todas
              </button>
              <button
                onClick={() => {
                  setShowPhotosDrawer(false);
                  onStartReconstruction(objectHint);
                }}
                disabled={photos.length === 0}
                className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generar Modelo 3D ({photos.length} tomas)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Interactive Tutorial Modal */}
      <InteractiveTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStartScanning={() => setShowTutorial(false)}
      />

      {/* 9. Guía de Hoyos / Cavidades Modal */}
      {showHolesGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-5 shadow-2xl text-zinc-100">
            <button
              onClick={() => setShowHolesGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Cómo Escanear Cilindros y Hoyos
            </h3>
            <div className="space-y-3 text-xs text-zinc-300">
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="font-bold text-cyan-300 block mb-0.5">1. Orientación del teléfono</span>
                <p className="text-[11px] text-zinc-400">
                  Sostén el teléfono en posición <strong>VERTICAL</strong> para capturar toda la altura del cilindro y la boca del orificio sin cortar los bordes.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="font-bold text-amber-300 block mb-0.5">2. Tomas Cenitales (75° - 90°)</span>
                <p className="text-[11px] text-zinc-400">
                  Inclina la cámara hacia abajo apuntando directamente al interior de la cavidad para que la luz y el lente detecten el fondo y el diámetro del orificio.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="font-bold text-emerald-300 block mb-0.5">3. Distancia recomendada: 35 cm</span>
                <p className="text-[11px] text-zinc-400">
                  No te acerques a menos de 25 cm para evitar distorsión de lente y desenfoque. A 35 cm se obtiene la máxima nitidez.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHolesGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
