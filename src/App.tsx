import React, { useState, useEffect } from 'react';
import { CapturedPhoto, Model3DData, ScanCategory } from './types';
import { CameraStudio } from './components/CameraStudio';
import { DesktopStudio } from './components/DesktopStudio';
import { ReconstructionProgress } from './components/ReconstructionProgress';
import { Viewport3D } from './components/Viewport3D';
import { ModelInspector } from './components/ModelInspector';
import { PWAInstallModal } from './components/PWAInstallModal';
import { AndroidApkModal } from './components/AndroidApkModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { generate3DModelFromPhotos } from './utils/localPhotogrammetry';
import { SAMPLE_MODELS } from './utils/sampleData';
import { soundEffects } from './utils/audio';
import { triggerHaptic } from './utils/haptics';
import {
  History,
  Box,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2,
  X,
  Wifi,
  Battery,
  PackageCheck,
  Share2,
} from 'lucide-react';

type AppScreen = 'camera' | 'reconstructing' | 'viewer';
type DeviceViewMode = 'desktop' | 'phone';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('camera');
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ScanCategory>('pieza_3d');
  const [currentModel, setCurrentModel] = useState<Model3DData | null>(null);
  const [objectHint, setObjectHint] = useState<string>('');
  const [showInspector, setShowInspector] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showAndroidModal, setShowAndroidModal] = useState<boolean>(false);
  const [savedHistory, setSavedHistory] = useState<Model3DData[]>([]);

  // Desktop vs Phone Mode: Defaults to 'desktop' on PC browser, 'phone' on mobile
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<DeviceViewMode>('desktop');
  const [currentTime, setCurrentTime] = useState<string>('09:41');

  const { isInstallable, isInstalled } = usePWAInstall();

  // Detect real mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNarrow = window.innerWidth <= 768;
      const ua = navigator.userAgent.toLowerCase();
      const isMobileUA = /iphone|ipad|ipod|android|mobile/.test(ua);
      const isRealMobile = isMobileUA || (isTouch && isNarrow);
      setIsMobileDevice(isRealMobile);
      if (isRealMobile) {
        setViewMode('phone');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    const updateTime = () => {
      const d = new Date();
      const h = d.getHours().toString().padStart(2, '0');
      const m = d.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${h}:${m}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);

    return () => {
      window.removeEventListener('resize', checkMobile);
      clearInterval(timer);
    };
  }, []);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('scan3d_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedHistory(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load history from localStorage', e);
    }
    setSavedHistory(SAMPLE_MODELS);
  }, []);

  const saveToHistory = (newModel: Model3DData) => {
    setSavedHistory((prev) => {
      const filtered = prev.filter((m) => m.id !== newModel.id);
      const updated = [newModel, ...filtered].slice(0, 10);
      try {
        const lightweight = updated.map((m) => ({
          ...m,
          thumbnailUrl: m.thumbnailUrl ? m.thumbnailUrl.substring(0, 150) : undefined,
        }));
        localStorage.setItem('scan3d_history', JSON.stringify(lightweight));
      } catch (e) {
        console.warn('Could not persist to localStorage', e);
      }
      return updated;
    });
  };

  const handleAddPhoto = (photo: CapturedPhoto) => {
    setPhotos((prev) => [...prev, photo]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleClearPhotos = () => {
    setPhotos([]);
  };

  const handleSelectSample = (sampleId: string) => {
    const found = SAMPLE_MODELS.find((s) => s.id === sampleId) || SAMPLE_MODELS[0];
    setCurrentModel(found);
    setScreen('viewer');
    soundEffects.playSuccess();
    triggerHaptic('success');
  };

  const handleStartReconstruction = async (hint: string) => {
    if (photos.length === 0) return;

    setObjectHint(hint);
    setScreen('reconstructing');
    triggerHaptic('medium');

    try {
      let reconstructedModel: Model3DData | null = null;

      try {
        const res = await fetch('/api/reconstruct-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            images: photos.map((p) => ({ dataUrl: p.dataUrl, angleLabel: p.angleLabel })),
            objectHint: hint,
            scanCategory: selectedCategory,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.model3d) {
            const raw = data.model3d;
            reconstructedModel = {
              id: `scan-${Date.now()}`,
              name: raw.name || hint || 'Objeto Escaneado en PC',
              category: raw.category || selectedCategory,
              scanCategory: raw.scanCategory || selectedCategory,
              description: raw.description || 'Modelo 3D generado con fotogrametría e IA multimodal en PC/Móvil.',
              dimensions: raw.dimensions || { width: 14, height: 14, depth: 14 },
              measurements: raw.measurements,
              materialStyle: raw.materialStyle || {
                dominantColor: '#38bdf8',
                accentColor: '#f59e0b',
                metalness: 0.2,
                roughness: 0.4,
                surfaceFinish: 'smooth',
              },
              components: raw.components || [],
              pointCloudSamples: raw.pointCloudSamples || [],
              qualityScore: raw.qualityScore || 95,
              detectedFeatures: raw.detectedFeatures || ['Malla optimizada con calibración métrica'],
              createdAt: new Date().toISOString(),
              source: 'gemini-3.8-flash',
              thumbnailUrl: photos[0]?.dataUrl,
              photosCount: photos.length,
            };
          }
        }
      } catch (apiErr) {
        console.warn('API call failed, using local engine:', apiErr);
      }

      if (!reconstructedModel || reconstructedModel.components.length === 0) {
        reconstructedModel = await generate3DModelFromPhotos(photos, hint, selectedCategory);
      }

      await new Promise((resolve) => setTimeout(resolve, 1400));

      setCurrentModel(reconstructedModel);
      saveToHistory(reconstructedModel);
      setScreen('viewer');
      soundEffects.playSuccess();
      triggerHaptic('success');
    } catch (err) {
      console.error('Reconstruction error:', err);
      const fallback = await generate3DModelFromPhotos(photos, hint, selectedCategory);
      setCurrentModel(fallback);
      setScreen('viewer');
      soundEffects.playSuccess();
    }
  };

  // Phone App Screen view
  const phoneAppContent = (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-black text-white">
      {/* Mobile Top Status Bar */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1 bg-black text-[11px] font-semibold text-zinc-300 z-40 select-none">
        <span className="font-mono tracking-tight">{currentTime}</span>

        <div className="w-24 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center gap-1.5 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-[9px] font-mono text-cyan-300 font-bold">Scan3D</span>
        </div>

        <div className="flex items-center gap-1.5 text-zinc-400">
          <Wifi className="w-3.5 h-3.5" />
          <Battery className="w-4 h-4 text-zinc-300" />
        </div>
      </div>

      {/* Screen router */}
      <div className="relative flex-1 w-full overflow-hidden">
        {screen === 'camera' && (
          <CameraStudio
            photos={photos}
            selectedCategory={selectedCategory}
            onChangeCategory={setSelectedCategory}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            onClearPhotos={handleClearPhotos}
            onStartReconstruction={handleStartReconstruction}
            onSelectSample={handleSelectSample}
            onOpenInstall={() => setShowInstallModal(true)}
            isInstallable={isInstallable}
          />
        )}

        {screen === 'reconstructing' && (
          <ReconstructionProgress
            photosCount={photos.length}
            objectHint={objectHint}
          />
        )}

        {screen === 'viewer' && currentModel && (
          <Viewport3D
            modelData={currentModel}
            onRetake={() => {
              triggerHaptic('light');
              setScreen('camera');
            }}
            onOpenInspector={() => setShowInspector(true)}
          />
        )}
      </div>

      <div className="h-4 bg-black flex items-center justify-center pb-1">
        <div className="w-28 h-1 rounded-full bg-zinc-600/60" />
      </div>
    </div>
  );

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-zinc-950 flex flex-col font-sans">
      {/* If screen is 'camera' and PC viewMode is selected on non-mobile devices */}
      {!isMobileDevice && viewMode === 'desktop' && screen === 'camera' ? (
        <DesktopStudio
          photos={photos}
          selectedCategory={selectedCategory}
          onChangeCategory={setSelectedCategory}
          onAddPhoto={handleAddPhoto}
          onRemovePhoto={handleRemovePhoto}
          onClearPhotos={handleClearPhotos}
          onStartReconstruction={handleStartReconstruction}
          onSelectSample={handleSelectSample}
          onOpenAndroidApk={() => setShowAndroidModal(true)}
          onSwitchToPhoneView={() => setViewMode('phone')}
        />
      ) : !isMobileDevice && viewMode === 'desktop' && screen === 'reconstructing' ? (
        <div className="flex-1 w-full h-full flex flex-col">
          <ReconstructionProgress photosCount={photos.length} objectHint={objectHint} />
        </div>
      ) : !isMobileDevice && viewMode === 'desktop' && screen === 'viewer' && currentModel ? (
        <div className="relative flex-1 w-full h-full flex flex-col">
          {/* Header to switch modes in 3D viewer on PC */}
          <div className="absolute top-3 right-48 z-20 flex items-center gap-2">
            <button
              onClick={() => setShowAndroidModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>APK Android</span>
            </button>
            <button
              onClick={() => setViewMode('phone')}
              className="px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-medium backdrop-blur-md shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vista Móvil</span>
            </button>
          </div>
          <Viewport3D
            modelData={currentModel}
            onRetake={() => {
              triggerHaptic('light');
              setScreen('camera');
            }}
            onOpenInspector={() => setShowInspector(true)}
          />
        </div>
      ) : (
        // Phone Mode (Either Real Mobile Device or Smartphone Frame on Desktop)
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Desktop switcher bar when in phone mockup */}
          {!isMobileDevice && (
            <div className="absolute top-3 inset-x-4 z-50 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-300 shadow-xl pointer-events-auto">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-white">Modo Teléfono Móvil</span>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => setShowAndroidModal(true)}
                  className="px-3 py-1.5 rounded-full bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>APK Android</span>
                </button>

                <button
                  onClick={() => setViewMode('desktop')}
                  className="px-3 py-1.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Versión PC Navegador</span>
                </button>
              </div>
            </div>
          )}

          {isMobileDevice ? (
            <div className="w-full h-full">{phoneAppContent}</div>
          ) : (
            <div className="relative my-auto w-[390px] h-[810px] max-h-[92vh] rounded-[52px] bg-zinc-900 p-3.5 shadow-[0_0_60px_rgba(0,0,0,0.9),0_0_20px_rgba(6,182,212,0.15)] border-4 border-zinc-800 ring-1 ring-zinc-700/60 flex flex-col">
              <div className="absolute -left-5 top-28 w-1 h-12 bg-zinc-700 rounded-l-md" />
              <div className="absolute -left-5 top-44 w-1 h-12 bg-zinc-700 rounded-l-md" />
              <div className="absolute -right-5 top-32 w-1 h-16 bg-zinc-700 rounded-r-md" />

              <div className="w-full h-full rounded-[42px] overflow-hidden bg-black flex flex-col relative shadow-inner">
                {phoneAppContent}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global History Floating Button */}
      {screen !== 'reconstructing' && (
        <button
          onClick={() => {
            triggerHaptic('light');
            setShowHistoryModal(true);
          }}
          className="fixed bottom-4 left-4 z-40 p-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white backdrop-blur-md shadow-xl transition-all cursor-pointer flex items-center gap-1.5"
          title="Historial de Escaneos"
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold pr-1 hidden sm:inline">Historial</span>
        </button>
      )}

      {/* Technical Inspector Sheet */}
      {showInspector && currentModel && (
        <ModelInspector
          modelData={currentModel}
          onClose={() => setShowInspector(false)}
        />
      )}

      {/* PWA Phone Install Modal */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Android APK Hub Modal */}
      <AndroidApkModal
        isOpen={showAndroidModal}
        onClose={() => setShowAndroidModal(false)}
      />

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none">
          <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Historial de Modelos 3D</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-2">
              {savedHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 transition-all cursor-pointer group"
                  onClick={() => {
                    setCurrentModel(item);
                    setScreen('viewer');
                    setShowHistoryModal(false);
                    soundEffects.playSuccess();
                    triggerHaptic('success');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-inner"
                      style={{ backgroundColor: item.materialStyle?.dominantColor || '#0284c7' }}
                    >
                      <Box className="w-5 h-5 opacity-90" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-200 group-hover:text-cyan-300">
                        {item.name}
                      </h4>
                      <p className="text-[10px] text-zinc-400">
                        {item.measurements?.widthMm || item.dimensions.width * 10}×{item.measurements?.heightMm || item.dimensions.height * 10}×{item.measurements?.depthMm || item.dimensions.depth * 10} mm
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-800 text-cyan-400 border border-zinc-700">
                    Abrir
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
