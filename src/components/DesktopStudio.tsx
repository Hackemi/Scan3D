import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Sparkles,
  Upload,
  Trash2,
  Crosshair,
  Grid,
  Play,
  Pause,
  Disc,
  Smartphone,
  HelpCircle,
  X,
  Keyboard,
  Layers,
  FolderOpen,
  ArrowRight,
  Target,
} from 'lucide-react';
import { CapturedPhoto, ScanCategory, CaptureResolution } from '../types';
import { soundEffects } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';
import { SAMPLE_MODELS } from '../utils/sampleData';
import { InteractiveTutorial } from './InteractiveTutorial';
import { takeHighResPhoto, getCameraConstraints } from '../utils/cameraCapture';

interface DesktopStudioProps {
  photos: CapturedPhoto[];
  selectedCategory: ScanCategory;
  onChangeCategory: (cat: ScanCategory) => void;
  onAddPhoto: (photo: CapturedPhoto) => void;
  onRemovePhoto: (id: string) => void;
  onClearPhotos: () => void;
  onStartReconstruction: (objectHint: string) => void;
  onSelectSample: (sampleId: string) => void;
  onOpenAndroidApk: () => void;
  onSwitchToPhoneView: () => void;
}

const CATEGORIES: Array<{ id: ScanCategory; label: string; icon: string; desc: string }> = [
  { id: 'auto', label: 'Auto-Detección', icon: '✨', desc: 'Detecta automáticamente cilindros, cavidades u objetos de las fotos' },
  { id: 'hoyo', label: 'Hoyos / Cavidad', icon: '🕳️', desc: 'Cilindros perforados, orificios pasantes y cavidades cóncavas' },
  { id: 'pieza_3d', label: 'Pieza CAD', icon: '🧩', desc: 'Repuestos de ingeniería, bridas y piezas para impresión 3D' },
  { id: 'aparato', label: 'Aparato', icon: '📱', desc: 'Dispositivos electrónicos, chasis y gadgets' },
  { id: 'general', label: 'General', icon: '🏺', desc: 'Vajilla, envases, calzado y objetos de revolución' },
];

const GUIDED_ANGLES = [
  { id: 'front', label: 'Frente 0°' },
  { id: 'front-right', label: 'Diagonal 45°' },
  { id: 'right', label: 'Lateral 90°' },
  { id: 'back-right', label: 'Posterior 135°' },
  { id: 'back', label: 'Trasero 180°' },
  { id: 'back-left', label: 'Posterior 225°' },
  { id: 'left', label: 'Lateral 270°' },
  { id: 'front-left', label: 'Diagonal 315°' },
  { id: 'top', label: 'Cenital 45°' },
];

export const DesktopStudio: React.FC<DesktopStudioProps> = ({
  photos,
  selectedCategory,
  onChangeCategory,
  onAddPhoto,
  onRemovePhoto,
  onClearPhotos,
  onStartReconstruction,
  onSelectSample,
  onOpenAndroidApk,
  onSwitchToPhoneView,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [resolution, setResolution] = useState<CaptureResolution>('4k');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);

  // Turntable / Automatic cadence
  const [isAutoTurntable, setIsAutoTurntable] = useState<boolean>(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [autoCadenceSeconds] = useState<number>(3);
  const [autoCreateOnFinish, setAutoCreateOnFinish] = useState<boolean>(true);

  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [objectHint, setObjectHint] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [showSampleModal, setShowSampleModal] = useState<boolean>(false);

  // Enumerate video devices
  useEffect(() => {
    async function getDevices() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevices.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (err) {
        console.warn('Could not list media devices:', err);
      }
    }
    getDevices();
  }, [selectedDeviceId]);

  // Start Camera
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints = getCameraConstraints('user', resolution, selectedDeviceId);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
      }
    } catch (err: any) {
      console.warn('HD camera initialization error, falling back:', err);
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = fallback;
        if (videoRef.current) {
          videoRef.current.srcObject = fallback;
          videoRef.current.play();
          setCameraActive(true);
          setCameraError(null);
        }
      } catch (fallbackErr) {
        setCameraError('Cámara web no disponible. Puedes subir fotos directamente desde tu PC o cargar un modelo de muestra.');
        setCameraActive(false);
      }
    }
  }, [selectedDeviceId, resolution]);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // Capture photo
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !streamRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      soundEffects.playShutter();
      triggerHaptic('shutter');
      setFlashEffect(true);
      setTimeout(() => setFlashEffect(false), 100);

      const targetAngle = GUIDED_ANGLES[currentAngleIndex % GUIDED_ANGLES.length];
      const newPhoto = await takeHighResPhoto(
        videoRef.current,
        streamRef.current,
        'environment',
        resolution,
        targetAngle.label
      );

      newPhoto.pitch = currentAngleIndex === 8 ? 80 : 45;
      newPhoto.roll = 0;
      newPhoto.yaw = (photos.length * 45) % 360;
      newPhoto.distanceCm = 35;
      newPhoto.ring = newPhoto.pitch >= 68 ? 'zenith' : 'mid';

      onAddPhoto(newPhoto);
      setCurrentAngleIndex((prev) => (prev + 1) % GUIDED_ANGLES.length);
    } catch (e) {
      console.error('Desktop photo capture error:', e);
    } finally {
      setIsCapturing(false);
    }
  }, [currentAngleIndex, onAddPhoto, resolution, isCapturing]);

  // Turntable timer
  useEffect(() => {
    if (!isAutoTurntable) {
      setAutoCountdown(null);
      return;
    }

    let seconds = Math.ceil(autoCadenceSeconds);
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
        seconds = Math.ceil(autoCadenceSeconds);
        setAutoCountdown(seconds);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoTurntable, autoCadenceSeconds, capturePhoto]);

  // Keyboard shortcut: Space to capture, Enter to reconstruct
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        capturePhoto();
      } else if (e.code === 'Enter' && photos.length > 0) {
        e.preventDefault();
        onStartReconstruction(objectHint);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [capturePhoto, photos.length, objectHint, onStartReconstruction]);

  // Drag and drop photos support
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            onAddPhoto({
              id: `drag-${Date.now()}-${index}`,
              dataUrl,
              angleLabel: GUIDED_ANGLES[(photos.length + index) % GUIDED_ANGLES.length].label,
              timestamp: Date.now(),
              width: img.width,
              height: img.height,
              is4K: img.width >= 3200,
              resolutionLabel: `${img.width} × ${img.height}`,
            });
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });
    soundEffects.playBlip();
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
            onAddPhoto({
              id: `upload-${Date.now()}-${index}`,
              dataUrl,
              angleLabel: GUIDED_ANGLES[(photos.length + index) % GUIDED_ANGLES.length].label,
              timestamp: Date.now(),
              width: img.width,
              height: img.height,
              is4K: img.width >= 3200,
              resolutionLabel: `${img.width} × ${img.height}`,
            });
          };
          img.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeCategoryObj = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const orbitProgress = Math.min(100, (photos.length / 8) * 100);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 text-white select-none overflow-hidden">
      {/* Top Application Bar */}
      <header className="h-13 bg-zinc-900 border-b border-zinc-800 px-5 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">Scan3D Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold">
                Fotogrametría 3D
              </span>
            </div>
          </div>
        </div>

        {/* Clean Utility Group */}
        <div className="flex items-center gap-2">
          {/* Resolution button */}
          <button
            onClick={() => setResolution((prev) => (prev === '4k' ? '1080p' : '4k'))}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              resolution === '4k'
                ? 'bg-amber-400/10 border-amber-400/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${resolution === '4k' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
            <span>{resolution === '4k' ? '4K UHD' : '1080p FHD'}</span>
          </button>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              showGrid
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title="Cuadrícula"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Crosshair toggle */}
          <button
            onClick={() => setShowCrosshair((v) => !v)}
            className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
              showCrosshair
                ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
            }`}
            title="Retícula"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Tutorial */}
          <button
            onClick={() => setShowTutorial(true)}
            className="p-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Guía y Consejos"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Switch to phone simulation */}
          <button
            onClick={onSwitchToPhoneView}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Cambiar a Vista Móvil"
          >
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Vista Móvil</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Left Viewfinder, Right Workbench */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Clean Viewfinder Section */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className="relative flex-1 bg-black flex flex-col justify-between overflow-hidden"
        >
          {/* Drag Overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-cyan-950/90 border-4 border-dashed border-cyan-400 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
              <FolderOpen className="w-16 h-16 text-cyan-400 animate-bounce mb-3" />
              <h3 className="text-lg font-bold text-white">Suelta las fotos aquí</h3>
              <p className="text-xs text-cyan-300">Se agregarán a la secuencia de fotogrametría</p>
            </div>
          )}

          {/* Flash Effect */}
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-40 opacity-90 transition-opacity duration-100 pointer-events-none" />
          )}

          {/* Video Feed */}
          <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Camera Error State */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-zinc-950/95 z-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3 text-cyan-400">
                  <Camera className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">Cámara de PC</h3>
                <p className="text-xs text-zinc-400 mb-5 max-w-sm">{cameraError}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Upload className="w-4 h-4" />
                    Subir Fotos desde PC
                  </button>
                  <button
                    onClick={() => setShowSampleModal(true)}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                  >
                    Ver Muestras
                  </button>
                </div>
              </div>
            )}

            {/* Grid Overlay */}
            {showGrid && cameraActive && (
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

            {/* Sleek Central CAD Crosshair */}
            {showCrosshair && cameraActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
                  {/* Outer Hairline Orbit Circle */}
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
                      stroke="#06b6d4"
                      strokeWidth="3.5"
                      strokeDasharray={`${(orbitProgress / 100) * 2.89 * 100} 1000`}
                      className="transition-all duration-300"
                    />
                  </svg>

                  {/* Corner CAD markers */}
                  <div className="absolute inset-8 pointer-events-none">
                    <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-cyan-400/70" />
                    <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-cyan-400/70" />
                    <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-cyan-400/70" />
                    <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-cyan-400/70" />
                  </div>

                  {/* Subtle Center Reticle */}
                  <div className="w-4 h-0.5 bg-cyan-400/60" />
                  <div className="h-4 w-0.5 bg-cyan-400/60 absolute" />

                  {/* Turntable Countdown Display */}
                  {isAutoTurntable && autoCountdown !== null && (
                    <div className="absolute z-20 flex flex-col items-center justify-center bg-zinc-950/85 backdrop-blur-md rounded-2xl px-5 py-3 border border-amber-400/50 shadow-2xl animate-in zoom-in-95">
                      <span className="text-3xl font-black font-mono text-amber-400">
                        {autoCountdown > 0 ? autoCountdown : '📸'}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-300">
                        {autoCountdown > 0 ? 'Gira el objeto...' : '¡Disparando!'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* UNIFIED LIVE HUD STRIP (Clean & Quiet) */}
            {cameraActive && (
              <div className="absolute top-3 inset-x-4 z-20 pointer-events-none flex justify-center">
                <div className="flex items-center gap-2.5 bg-zinc-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-700/60 text-[11px] font-mono shadow-lg text-zinc-300">
                  <span className="flex items-center gap-1 font-semibold text-cyan-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${resolution === '4k' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                    {resolution === '4k' ? '4K UHD' : '1080p FHD'}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-300">Distancia: 35-45 cm</span>
                  <span className="text-zinc-600">•</span>
                  <span className={isAutoTurntable ? 'text-amber-300 font-bold' : 'text-zinc-300'}>
                    {isAutoTurntable ? 'Auto-Turntable' : 'Manual'}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-cyan-400 font-bold">{photos.length}/8 tomas</span>
                </div>
              </div>
            )}
          </div>

          {/* Sleek Bottom Camera Dock */}
          <div className="h-18 bg-zinc-900 border-t border-zinc-800 px-6 flex items-center justify-between z-20 shrink-0">
            {/* File Upload from PC */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Subir fotos desde disco"
              >
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>Importar Fotos</span>
              </button>
            </div>

            {/* Center: Turntable toggle & Main Shutter */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setIsAutoTurntable((prev) => !prev);
                  if (isAutoTurntable) setAutoCountdown(null);
                }}
                disabled={!cameraActive}
                className={`px-3.5 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isAutoTurntable
                    ? 'bg-amber-400 text-black font-bold'
                    : 'bg-zinc-800 hover:bg-zinc-750 text-amber-300 border border-amber-500/30'
                }`}
                title="Captura automática rítmica para base giratoria"
              >
                <Disc className={`w-3.5 h-3.5 ${isAutoTurntable ? 'animate-spin' : ''}`} />
                <span>{isAutoTurntable ? 'Pausar Auto' : 'Modo Giratorio'}</span>
              </button>

              {/* Primary Shutter Trigger */}
              <button
                onClick={capturePhoto}
                disabled={!cameraActive}
                className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                <Camera className="w-4 h-4 fill-current" />
                <span>Capturar</span>
                <span className="text-[10px] font-mono bg-black/20 px-1 rounded text-zinc-950">
                  Espacio
                </span>
              </button>
            </div>

            {/* Quick Helper indicator */}
            <div className="text-right text-[11px] font-mono text-zinc-400">
              <span>{photos.length} fotogramas</span>
            </div>
          </div>
        </div>

        {/* Right: Clean Photogrammetry Workbench */}
        <div className="w-96 bg-zinc-900 border-l border-zinc-800 flex flex-col justify-between p-5 overflow-y-auto shrink-0">
          <div className="space-y-5">
            {/* 1. Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Categoría de Objeto
                </span>
                <span className="text-[10px] text-cyan-400 font-mono font-medium">
                  {activeCategoryObj.label}
                </span>
              </div>

              {/* Clean horizontal pill segmented control */}
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      triggerHaptic('light');
                      onChangeCategory(cat.id);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500 text-zinc-950 font-bold shadow-sm'
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Object Hint / Name */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Nombre o Pistas (Opcional)
              </span>
              <input
                type="text"
                value={objectHint}
                onChange={(e) => setObjectHint(e.target.value)}
                placeholder="Ej: Cilindro con hoyos, Carcasa, Botella..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* 3. Captured Photos Reel */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Fotos Capturadas ({photos.length})
                </span>
                {photos.length > 0 && (
                  <button
                    onClick={onClearPhotos}
                    className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {photos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {photos.map((p, idx) => (
                    <div
                      key={p.id}
                      className="relative group rounded-lg overflow-hidden border border-zinc-800 aspect-square bg-black cursor-pointer hover:border-cyan-500 transition-colors"
                      onClick={() => setPreviewPhoto(p)}
                    >
                      <img src={p.dataUrl} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                      {p.is4K && (
                        <span className="absolute top-1 left-1 bg-amber-400 text-black text-[7px] font-black px-1 rounded shadow">
                          4K
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePhoto(p.id);
                        }}
                        className="absolute top-1 right-1 p-0.5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <span className="absolute bottom-0.5 left-1 text-[8px] font-mono bg-black/70 px-1 rounded text-zinc-300">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-950/60 border border-dashed border-zinc-800 text-center">
                  <Camera className="w-6 h-6 text-zinc-600 mx-auto mb-1.5" />
                  <p className="text-xs text-zinc-400 font-medium">No hay fotos capturadas</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Presiona el botón Capturar o Espacio para tomar fotogramas del objeto.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions: Big Reconstruct Button */}
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <button
              onClick={() => onStartReconstruction(objectHint)}
              disabled={photos.length === 0}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                photos.length > 0
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/25 active:scale-98'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-750 cursor-not-allowed opacity-50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>
                {photos.length > 0
                  ? `Generar Modelo 3D (${photos.length} fotos)`
                  : 'Toma fotos para generar 3D'}
              </span>
            </button>

            {/* Subtle Samples Trigger */}
            <div className="text-center pt-1">
              <button
                onClick={() => setShowSampleModal(true)}
                className="text-[11px] text-zinc-400 hover:text-cyan-300 transition-colors cursor-pointer underline underline-offset-2"
              >
                ¿Quieres probar con un modelo de muestra?
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Step-by-Step Tutorial Modal */}
      <InteractiveTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStartScanning={() => setShowTutorial(false)}
      />

      {/* Sample Models Modal */}
      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-cyan-400" />
                Modelos 3D de Muestra
              </h3>
              <button
                onClick={() => setShowSampleModal(false)}
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
                    setShowSampleModal(false);
                  }}
                  className="p-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">{item.name}</h4>
                    <p className="text-[10px] text-zinc-400">
                      {item.measurements?.widthMm}×{item.measurements?.heightMm}×{item.measurements?.depthMm} mm
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded-lg bg-zinc-800 text-cyan-300 border border-zinc-700">
                    Cargar
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-3 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300">{previewPhoto.angleLabel}</span>
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
                className="max-h-[46vh] object-contain rounded-xl"
              />
            </div>
            <div className="p-3 flex justify-between gap-2 bg-zinc-900">
              <button
                onClick={() => {
                  onRemovePhoto(previewPhoto.id);
                  setPreviewPhoto(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-medium cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
