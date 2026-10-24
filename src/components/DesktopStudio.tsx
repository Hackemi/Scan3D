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
  Disc,
  RotateCw,
  Timer,
  Smartphone,
  ChevronRight,
  HelpCircle,
  X,
  Keyboard,
  Layers,
  CheckCircle2,
  Copy,
  Check,
  Maximize2,
  FolderOpen,
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
  { id: 'pieza_3d', label: 'Pieza 3D / CAD', icon: '🧩', desc: 'Repuestos de ingeniería, bridas, engranajes y piezas con tolerancias para impresión 3D' },
  { id: 'hoyo', label: 'Hoyo / Cavidad', icon: '🕳️', desc: 'Orificios, moldes cóncavos con cálculo de diámetro (Ø), profundidad y volumen' },
  { id: 'aparato', label: 'Aparato / Electrónica', icon: '📱', desc: 'Dispositivos, carcasas, controles táctiles y gadgets' },
  { id: 'general', label: 'General / Vajilla', icon: '🏺', desc: 'Recipientes, calzado, figuras y objetos de revolución' },
];

const GUIDED_ANGLES = [
  { id: 'front', label: 'Frente 0°', deg: 0, hint: 'Vista frontal directa' },
  { id: 'front-right', label: 'Diagonal Der 45°', deg: 45, hint: 'Gira 45° hacia la derecha' },
  { id: 'right', label: 'Lateral Der 90°', deg: 90, hint: 'Perfil derecho' },
  { id: 'back-right', label: 'Trasero Der 135°', deg: 135, hint: 'Tres cuartos posterior' },
  { id: 'back', label: 'Posterior 180°', deg: 180, hint: 'Vista trasera completa' },
  { id: 'back-left', label: 'Trasero Izq 225°', deg: 225, hint: 'Tres cuartos posterior izq' },
  { id: 'left', label: 'Lateral Izq 270°', deg: 270, hint: 'Perfil izquierdo' },
  { id: 'front-left', label: 'Diagonal Izq 315°', deg: 315, hint: 'Cerrando ciclo frontal' },
  { id: 'top', label: 'Cenital 45°', deg: 360, hint: 'Inclinado desde arriba para cerrar tapas/cavidades' },
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
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [objectHint, setObjectHint] = useState<string>('');
  const [previewPhoto, setPreviewPhoto] = useState<CapturedPhoto | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showTutorial, setShowTutorial] = useState<boolean>(false);

  // Auto Turntable (Giro de Objeto) Mode on Desktop
  const [isAutoTurntable, setIsAutoTurntable] = useState<boolean>(false);
  const [autoCadenceSeconds, setAutoCadenceSeconds] = useState<number>(3);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const [autoCreateOnFinish, setAutoCreateOnFinish] = useState<boolean>(true);
  const [showAutoCompletionModal, setShowAutoCompletionModal] = useState<boolean>(false);
  const [autoLaunchSeconds, setAutoLaunchSeconds] = useState<number>(3);

  // Enumerate video devices on PC
  useEffect(() => {
    async function getDevices() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = devs.filter((d) => d.kind === 'videoinput');
        setDevices(videoDevs);
        if (videoDevs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevs[0].deviceId);
        }
      } catch (e) {
        console.warn('Could not enumerate cameras', e);
      }
    }
    getDevices();
  }, [cameraActive]);

  // Start webcam on PC with 4K resolution request
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints = getCameraConstraints('environment', resolution, selectedDeviceId || undefined);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Desktop 4K camera access issue, trying standard stream:', err);
      try {
        const fallback = await navigator.mediaDevices.getUserMedia({
          video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
          audio: false,
        });
        streamRef.current = fallback;
        if (videoRef.current) {
          videoRef.current.srcObject = fallback;
          videoRef.current.play();
          setCameraActive(true);
        }
      } catch (fallbackErr) {
        setCameraError(
          'Cámara web no detectada o permiso denegado. Puedes arrastrar y soltar fotos directamente desde tu PC o cargar muestras.'
        );
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

  // Capture high-resolution photo from PC webcam
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !streamRef.current || isCapturing) return;

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
        'environment',
        resolution,
        targetAngle.label
      );

      onAddPhoto(newPhoto);
      setCurrentAngleIndex((prev) => (prev + 1) % GUIDED_ANGLES.length);
    } catch (e) {
      console.error('Desktop photo capture error:', e);
    } finally {
      setIsCapturing(false);
    }
  }, [currentAngleIndex, onAddPhoto, resolution, isCapturing]);

  // Turntable Cadence Timer for Desktop
  useEffect(() => {
    if (!isAutoTurntable) {
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
        seconds = Math.ceil(autoCadenceSeconds);
        setAutoCountdown(seconds);
        soundEffects.playCountdown(false);
        triggerHaptic('countdown');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoTurntable, autoCadenceSeconds, capturePhoto]);

  // Completion detection when 8 photos reached
  useEffect(() => {
    if (isAutoTurntable && photos.length >= 8) {
      setIsAutoTurntable(false);
      setAutoCountdown(null);
      soundEffects.playSuccess();
      triggerHaptic('complete');
      setShowAutoCompletionModal(true);
      setAutoLaunchSeconds(3);
    }
  }, [photos.length, isAutoTurntable]);

  // Auto-launch countdown effect
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

  // Keyboard shortcuts on PC: Spacebar to capture, Enter to reconstruct
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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

  // Clipboard Paste support on PC (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              const dataUrl = loadEvent.target?.result as string;
              if (dataUrl) {
                const img = new Image();
                img.onload = () => {
                  const is4K = img.width >= 3200 || img.height >= 3200;
                  const angleLabel = GUIDED_ANGLES[(photos.length) % GUIDED_ANGLES.length].label;
                  onAddPhoto({
                    id: `paste-${Date.now()}`,
                    dataUrl,
                    angleLabel,
                    timestamp: Date.now(),
                    width: img.width,
                    height: img.height,
                    is4K,
                    resolutionLabel: `${img.width} × ${img.height} ${is4K ? '(4K UHD)' : '(FHD)'}`,
                  });
                  soundEffects.playBlip();
                };
                img.src = dataUrl;
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [photos.length, onAddPhoto]);

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const dataUrl = loadEvent.target?.result as string;
          if (dataUrl) {
            const img = new Image();
            img.onload = () => {
              const is4K = img.width >= 3200 || img.height >= 3200;
              const angleLabel = GUIDED_ANGLES[(photos.length + idx) % GUIDED_ANGLES.length].label;
              onAddPhoto({
                id: `drag-${Date.now()}-${idx}`,
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
      }
    });

    soundEffects.playSuccess();
  };

  const currentGuide = GUIDED_ANGLES[currentAngleIndex % GUIDED_ANGLES.length];
  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className="relative flex flex-col w-full h-full bg-zinc-950 text-zinc-100 select-none overflow-hidden"
    >
      {/* Top PC Studio Navigation Bar */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">Scan3D Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-semibold">
                EDICIÓN PC EN NAVEGADOR
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Fotogrametría 3D y Metrología Computacional de Alta Resolución</p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2.5">
          {/* 4K Ultra HD Toggle */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              setResolution((prev) => (prev === '4k' ? '1080p' : '4k'));
              soundEffects.playBlip();
            }}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              resolution === '4k'
                ? 'bg-amber-400 border-amber-300 text-black shadow-amber-400/25'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
            }`}
            title="Alternar resolución: 4K Ultra HD (3840×2160) vs 1080p FHD"
          >
            <span>{resolution === '4k' ? '4K UHD (3840×2160) ★' : '1080p FHD'}</span>
          </button>

          {/* Tutorial modal button */}
          <button
            onClick={() => setShowTutorial(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>Guía de Rotación 3D</span>
          </button>

          {/* Android APK Modal Trigger */}
          <button
            onClick={onOpenAndroidApk}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            title="Instalador WebAPK y Proyecto Android"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>App Android (.APK)</span>
          </button>

          {/* Switch to phone mobile layout */}
          <button
            onClick={onSwitchToPhoneView}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Ver en marco de Smartphone"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Vista Móvil</span>
          </button>
        </div>
      </header>

      {/* Main Dual-Column PC Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center: High-Resolution Viewfinder & Drag-Drop Area */}
        <div className="flex-1 flex flex-col relative bg-black overflow-hidden border-r border-zinc-800/80">
          {/* Drag & drop overlay indicator */}
          {isDragging && (
            <div className="absolute inset-0 z-40 bg-cyan-950/80 border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
              <FolderOpen className="w-16 h-16 text-cyan-400 animate-bounce mb-3" />
              <h3 className="text-lg font-bold text-white">Suelta aquí las fotos de tu objeto</h3>
              <p className="text-xs text-cyan-300">Se añadirán a la secuencia fotogramétrica 360°</p>
            </div>
          )}

          {/* Flash screen feedback */}
          {flashEffect && (
            <div className="absolute inset-0 bg-white z-30 opacity-90 transition-opacity duration-100 pointer-events-none" />
          )}

          {/* Video viewfinder */}
          <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Error or No Webcam fallback */}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-zinc-950/95 z-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Visor de Cámara PC</h3>
                <p className="text-xs text-zinc-400 mb-6 max-w-md leading-relaxed">
                  {cameraError}
                </p>

                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Seleccionar Fotos desde el PC
                  </button>
                  <button
                    onClick={() => onSelectSample('sample-bracket-3d')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                  >
                    Cargar Muestra: Pieza 3D CAD
                  </button>
                </div>
              </div>
            )}

            {/* Viewfinder Overlays */}
            {cameraActive && (
              <>
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

                {/* Central Photogrammetry Reticle */}
                {showCrosshair && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                    <div className={`relative w-80 h-80 border-2 border-dashed rounded-3xl flex items-center justify-center transition-colors ${
                      isAutoTurntable ? 'border-amber-400/80 bg-black/40' : 'border-cyan-400/50'
                    }`}>
                      <div className="w-6 h-0.5 bg-cyan-400/70" />
                      <div className="h-6 w-0.5 bg-cyan-400/70 absolute" />

                      {/* Turntable Auto Countdown Center */}
                      {isAutoTurntable && (
                        <div className="flex flex-col items-center justify-center bg-black/85 backdrop-blur-md rounded-2xl px-5 py-3 border border-amber-400/60 shadow-2xl animate-in zoom-in-95">
                          <Disc className="w-6 h-6 text-amber-400 animate-spin mb-1" />
                          <span className="text-4xl font-black font-mono text-amber-400">
                            {autoCountdown !== null && autoCountdown > 0 ? autoCountdown : '📸'}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-300">
                            {autoCountdown !== null && autoCountdown > 0
                              ? 'Gira el objeto en la mesa...'
                              : '¡Foto capturada!'}
                          </span>
                        </div>
                      )}

                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-full border border-cyan-500/40 text-[11px] font-mono text-cyan-300 whitespace-nowrap">
                        {isAutoTurntable ? 'Modo Auto-Giro de Objeto (Turntable)' : `Ángulo actual: ${currentGuide.label}`}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Top Toolbar overlay on camera */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
              {/* 4K Live Resolution Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-950/85 border border-zinc-700 text-xs font-mono text-zinc-300 shadow">
                <span className={`w-2 h-2 rounded-full ${resolution === '4k' ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400'}`} />
                <span className={resolution === '4k' ? 'text-amber-300 font-bold' : 'text-cyan-300 font-bold'}>
                  {resolution === '4k' ? '4K ULTRA HD (3840×2160)' : '1080p FHD'}
                </span>
              </div>

              {devices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="bg-zinc-950/80 border border-zinc-700 text-xs rounded-xl px-2.5 py-1 text-zinc-300 focus:outline-none focus:border-cyan-500"
                >
                  {devices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Cámara ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowGrid((v) => !v)}
                className={`p-2 rounded-xl border text-xs cursor-pointer shadow ${
                  showGrid ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-zinc-900/80 border-zinc-700 text-zinc-400'
                }`}
                title="Alternar cuadrícula"
              >
                <Grid className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowCrosshair((v) => !v)}
                className={`p-2 rounded-xl border text-xs cursor-pointer shadow ${
                  showCrosshair ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-zinc-900/80 border-zinc-700 text-zinc-400'
                }`}
                title="Alternar retícula central"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PC Bottom Shutter & Controls Dock */}
          <div className="h-20 bg-zinc-900/95 border-t border-zinc-800 px-6 flex items-center justify-between z-20">
            {/* Multi-file file upload button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files) return;
                  Array.from(files).forEach((file, idx) => {
                    const reader = new FileReader();
                    reader.onload = (loadEvent) => {
                      const dataUrl = loadEvent.target?.result as string;
                      if (dataUrl) {
                        const img = new Image();
                        img.onload = () => {
                          const is4K = img.width >= 3200 || img.height >= 3200;
                          const angleLabel = GUIDED_ANGLES[(photos.length + idx) % GUIDED_ANGLES.length].label;
                          onAddPhoto({
                            id: `upload-${Date.now()}-${idx}`,
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
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-2 cursor-pointer shadow"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Importar Fotos de PC</span>
              </button>
            </div>

            {/* Center Controls: Auto Turntable + Manual Shutter */}
            <div className="flex items-center gap-3">
              {/* Auto Turntable Toggle Button */}
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setIsAutoTurntable((prev) => !prev);
                  if (isAutoTurntable) setAutoCountdown(null);
                }}
                disabled={!cameraActive}
                className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer ${
                  isAutoTurntable
                    ? 'bg-amber-400 text-black shadow-amber-400/30 animate-pulse'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/40 shadow-sm'
                }`}
                title="Captura automática rítmica para cuando giras el objeto en una base giratoria"
              >
                {isAutoTurntable ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausar Auto Giro ({autoCountdown}s)</span>
                  </>
                ) : (
                  <>
                    <Disc className="w-4 h-4 text-amber-400" />
                    <span>Auto-Giro de Objeto (Turntable)</span>
                  </>
                )}
              </button>

              {/* Big Shutter Trigger with [Space] badge */}
              <button
                onClick={capturePhoto}
                disabled={!cameraActive}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
              >
                <Camera className="w-4 h-4 text-zinc-950" />
                <span>Capturar</span>
                <span className="text-[10px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-zinc-950">
                  ESPACIO
                </span>
              </button>
            </div>

            {/* Quick status & Auto 3D setting */}
            <div className="text-right flex flex-col items-end">
              <label className="flex items-center gap-1.5 text-[10px] text-zinc-300 cursor-pointer select-none mb-0.5">
                <input
                  type="checkbox"
                  checked={autoCreateOnFinish}
                  onChange={(e) => setAutoCreateOnFinish(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-cyan-400"
                />
                <span className="text-cyan-300 font-semibold">Auto-crear 3D al terminar</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-white">
                  {photos.length}/8 Fotos
                </span>
                <span className="text-[10px] text-zinc-500">Ctrl+V / Arrastrar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Scan Center, Categories, Metric Preview & History */}
        <div className="w-96 bg-zinc-900 flex flex-col overflow-y-auto p-5 space-y-5 shrink-0">
          {/* Category Profile Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                1. Perfil de Escaneo
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Calibración IA</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    triggerHaptic('light');
                    onChangeCategory(cat.id);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-md'
                      : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold mb-0.5">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight line-clamp-2">{cat.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Object Name / Hint Input */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              2. Nombre o Pista del Objeto
            </span>
            <input
              type="text"
              value={objectHint}
              onChange={(e) => setObjectHint(e.target.value)}
              placeholder="Ej: Soporte de motor, Cavidad cilíndrica, Engranaje..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* 360 Photogrammetry Angle Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                3. Cobertura Orbital ({photos.length} / 8 tomas)
              </span>
              {photos.length > 0 && (
                <button
                  onClick={onClearPhotos}
                  className="text-[11px] text-red-400 hover:text-red-300 cursor-pointer"
                >
                  Borrar todas
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {GUIDED_ANGLES.map((ang, i) => {
                const isCaptured = i < photos.length;
                return (
                  <div
                    key={ang.id}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      isCaptured
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span className="text-[10px] font-mono block font-bold">{ang.label.split(' ')[0]}</span>
                    <span className="text-[9px] block text-zinc-500">{isCaptured ? '✓ Lista' : 'Pendiente'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Captured Photos Reel */}
          {photos.length > 0 && (
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                Fotogramas Capturados ({photos.length})
              </span>
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {photos.map((p, idx) => (
                  <div
                    key={p.id}
                    className="relative group rounded-lg overflow-hidden border border-zinc-700 aspect-square bg-black cursor-pointer"
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
                      className="absolute top-1 right-1 p-0.5 rounded bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-0.5 left-1 text-[8px] font-mono bg-black/70 px-1 rounded text-white">
                      #{idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Big Action: Reconstruct 3D Model */}
          <div className="pt-2">
            <button
              onClick={() => onStartReconstruction(objectHint)}
              disabled={photos.length === 0}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xl cursor-pointer ${
                photos.length > 0
                  ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/30'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Modelo 3D con IA [Enter]</span>
            </button>
            <p className="text-[10px] text-zinc-500 text-center mt-2">
              Se creará la malla tridimensional con cálculo métrico en mm y exportación a OBJ / STL.
            </p>
          </div>

          {/* Quick Presets for PC testing */}
          <div className="pt-2 border-t border-zinc-800">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
              Modelos de Prueba Instantáneos
            </span>
            <div className="space-y-1.5">
              {SAMPLE_MODELS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectSample(item.id)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div>
                    <span className="font-semibold text-zinc-200 block">{item.name}</span>
                    <span className="text-[10px] text-zinc-500 capitalize">{item.scanCategory} • Medidas en mm</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-300">
                    Cargar 3D
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tutorial Modal */}
      <InteractiveTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStartScanning={() => setShowTutorial(false)}
      />

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md select-none">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">{previewPhoto.angleLabel}</span>
                {previewPhoto.is4K ? (
                  <span className="text-[9px] font-mono font-bold bg-amber-400 text-black px-2 py-0.5 rounded-full shadow">
                    4K ULTRA HD
                  </span>
                ) : (
                  <span className="text-[9px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full border border-zinc-700">
                    FHD 1080p
                  </span>
                )}
              </div>
              <button onClick={() => setPreviewPhoto(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 bg-black flex items-center justify-center max-h-[60vh]">
              <img src={previewPhoto.dataUrl} alt="Foto" className="max-h-[55vh] object-contain rounded-xl" />
            </div>
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
              <span>Resolución: {previewPhoto.resolutionLabel || `${previewPhoto.width || 1920} × ${previewPhoto.height || 1080}`}</span>
              <span className="text-cyan-400 font-semibold">Sensor Fotogramétrico Óptimo</span>
            </div>
            <div className="p-3 flex justify-between gap-2 bg-zinc-900">
              <button
                onClick={() => {
                  onRemovePhoto(previewPhoto.id);
                  setPreviewPhoto(null);
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
          <div className="relative w-full max-w-md bg-gradient-to-b from-zinc-900 to-zinc-950 border border-amber-500/40 rounded-3xl p-6 shadow-2xl text-center">
            {/* Top Badge */}
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-400/30 mb-4 animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>

            <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-amber-400 block mb-1">
              Escaneo Orbital 100% Completo
            </span>
            <h3 className="text-xl font-black text-white mb-2">
              ¡Giro 360° Completado!
            </h3>
            <p className="text-xs text-zinc-300 mb-5 leading-relaxed">
              Has capturado los <strong className="text-white">8 ángulos orbitales</strong> en{' '}
              <strong className="text-amber-300">{resolution === '4k' ? '4K Ultra HD' : '1080p'}</strong> con tu cámara web. La geometría está lista para ser triangulada.
            </p>

            {/* Auto-Launch Countdown Indicator */}
            {autoCreateOnFinish && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-black font-black font-mono text-base flex items-center justify-center shrink-0">
                    {autoLaunchSeconds}s
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">Generación Automática</span>
                    <span className="text-[10px] text-zinc-400">Creando modelo 3D con IA...</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAutoCompletionModal(false);
                    triggerHaptic('light');
                  }}
                  className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl bg-zinc-800"
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
                <span>Crear Modelo 3D Ahora [Enter]</span>
              </button>

              <button
                onClick={() => {
                  setShowAutoCompletionModal(false);
                  triggerHaptic('light');
                }}
                className="w-full py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-medium text-xs cursor-pointer"
              >
                Continuar Escaneando Más Tomas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
