import React, { useState } from 'react';
import {
  X,
  Sliders,
  Columns,
  Eye,
  Camera,
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import { Model3DData, CapturedPhoto, ComponentDefinition } from '../types';
import { triggerHaptic } from '../utils/haptics';
import { soundEffects } from '../utils/audio';

interface PhotoCompareModalProps {
  modelData: Model3DData;
  workingComponents: ComponentDefinition[];
  onUpdateComponentColor: (componentIndex: number, newColor: string) => void;
  onApplyColorToAll: (newColor: string) => void;
  onAlignCameraAngle: (angleType: 'front' | 'top' | 'side' | 'isometric') => void;
  onClose: () => void;
}

export const PhotoCompareModal: React.FC<PhotoCompareModalProps> = ({
  modelData,
  workingComponents,
  onUpdateComponentColor,
  onApplyColorToAll,
  onAlignCameraAngle,
  onClose,
}) => {
  const photos = modelData.sourcePhotos || (modelData.thumbnailUrl ? [{
    id: 'thumb',
    dataUrl: modelData.thumbnailUrl,
    angleLabel: 'Foto Referencia',
    timestamp: Date.now(),
  }] : []);

  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number>(0);
  const [compareMode, setCompareMode] = useState<'split' | 'side' | 'overlay'>('side');
  const [splitPos, setSplitPos] = useState<number>(50); // 0 to 100%
  const [overlayOpacity, setOverlayOpacity] = useState<number>(50); // 0 to 100%
  const [selectedComponentIdx, setSelectedComponentIdx] = useState<number>(0);
  const [appliedColorToast, setAppliedColorToast] = useState<string | null>(null);

  const currentPhoto = photos[selectedPhotoIdx] || photos[0];

  // Palette of real colors extracted from model & photos
  const sampleColors = [
    modelData.materialStyle.dominantColor,
    modelData.materialStyle.accentColor,
    modelData.materialStyle.secondaryColor || '#38bdf8',
    '#0f172a',
    '#e2e8f0',
    '#ef4444',
    '#f59e0b',
    '#10b981',
  ].filter(Boolean) as string[];

  const handleApplyColor = (color: string) => {
    triggerHaptic('light');
    soundEffects.playBlip();
    if (selectedComponentIdx >= 0 && selectedComponentIdx < workingComponents.length) {
      onUpdateComponentColor(selectedComponentIdx, color);
    } else {
      onApplyColorToAll(color);
    }
    setAppliedColorToast(`Color ${color} aplicado`);
    setTimeout(() => setAppliedColorToast(null), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/90 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-zinc-950 font-bold">
              <Sliders className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Comparador Foto vs Modelo 3D
                <span className="text-[10px] font-mono font-normal text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800/60">
                  Verificación de Precisión
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Compara las fotos reales con la malla 3D, revisa hoyos y transfiere los colores de la foto.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Bar */}
        <div className="px-5 py-2 bg-zinc-950 border-b border-zinc-850 flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">Modo de vista:</span>
            {[
              { id: 'side', label: 'Lado a Lado', icon: Columns },
              { id: 'split', label: 'Separador Deslizante', icon: Sliders },
              { id: 'overlay', label: 'Superposición Translúcida', icon: Eye },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setCompareMode(m.id as any);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                    compareMode === m.id
                      ? 'bg-cyan-500 text-zinc-950 font-bold shadow'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Camera angle match buttons */}
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-zinc-500">Ángulo 3D:</span>
            <button
              onClick={() => {
                triggerHaptic('light');
                onAlignCameraAngle('top');
              }}
              className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold hover:bg-amber-500/30 cursor-pointer"
              title="Alinear cámara cenital para inspeccionar orificios interiores"
            >
              🕳️ Cenital (Hoyos)
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onAlignCameraAngle('front');
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            >
              Frente 0°
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onAlignCameraAngle('side');
              }}
              className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
            >
              Lateral 90°
            </button>
          </div>
        </div>

        {/* Main Comparison Area */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {/* Comparison Screen */}
          <div className="relative w-full aspect-video sm:aspect-[16/9] max-h-[460px] bg-black rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
            {compareMode === 'side' && (
              <div className="grid grid-cols-2 w-full h-full">
                {/* Left: Original Photo */}
                <div className="relative h-full border-r border-zinc-800 flex items-center justify-center bg-zinc-950 overflow-hidden">
                  {currentPhoto ? (
                    <img
                      src={currentPhoto.dataUrl}
                      alt="Foto Real"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-zinc-500">Sin foto de referencia</span>
                  )}
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-500/40">
                    Foto Real (#{selectedPhotoIdx + 1} • {currentPhoto?.angleLabel})
                  </div>
                </div>

                {/* Right: 3D Model Texture / Render Preview */}
                <div className="relative h-full flex items-center justify-center bg-zinc-900 overflow-hidden">
                  {modelData.textureUrl ? (
                    <img
                      src={modelData.textureUrl}
                      alt="Textura 3D Desenrrollada"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : currentPhoto ? (
                    <img
                      src={currentPhoto.dataUrl}
                      alt="Render 3D"
                      className="w-full h-full object-contain filter contrast-125"
                    />
                  ) : null}
                  <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-amber-300 border border-amber-500/40">
                    Textura Fotogramétrica 3D
                  </div>
                </div>
              </div>
            )}

            {compareMode === 'split' && (
              <div className="relative w-full h-full overflow-hidden">
                {/* Background image (3D texture / render) */}
                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                  <img
                    src={modelData.textureUrl || currentPhoto?.dataUrl}
                    alt="Modelo 3D"
                    className="w-full h-full object-contain filter brightness-110"
                  />
                  <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-amber-300 border border-amber-500/40">
                    Textura 3D
                  </div>
                </div>

                {/* Foreground clipped image (Real photo) */}
                <div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                >
                  <img
                    src={currentPhoto?.dataUrl}
                    alt="Foto Real"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-500/40">
                    Foto Real
                  </div>
                </div>

                {/* Slider divider line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_12px_#06b6d4] cursor-ew-resize flex items-center justify-center pointer-events-none"
                  style={{ left: `${splitPos}%` }}
                >
                  <div className="w-6 h-6 rounded-full bg-cyan-400 text-zinc-950 flex items-center justify-center text-[10px] font-bold shadow-lg">
                    ↔
                  </div>
                </div>

                {/* Slider input control */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPos}
                  onChange={(e) => setSplitPos(Number(e.target.value))}
                  className="absolute bottom-3 inset-x-8 z-30 opacity-70 hover:opacity-100 transition-opacity"
                />
              </div>
            )}

            {compareMode === 'overlay' && (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {/* 3D Texture Base */}
                <img
                  src={modelData.textureUrl || currentPhoto?.dataUrl}
                  alt="3D Base"
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* Real Photo Superimposed */}
                <img
                  src={currentPhoto?.dataUrl}
                  alt="Foto Superpuesta"
                  style={{ opacity: overlayOpacity / 100 }}
                  className="absolute inset-0 w-full h-full object-contain transition-opacity duration-75 mix-blend-screen"
                />

                {/* Opacity slider bar */}
                <div className="absolute bottom-3 inset-x-8 bg-zinc-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-zinc-700 flex items-center gap-3">
                  <span className="text-[10px] font-mono text-zinc-400 whitespace-nowrap">
                    Transparencia: {overlayOpacity}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <span className="text-[10px] font-mono text-cyan-400 font-bold whitespace-nowrap">
                    {overlayOpacity > 50 ? 'Foto Real' : 'Modelo 3D'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Photo Selector Reel */}
          {photos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-zinc-500 text-[11px] font-mono whitespace-nowrap">
                Elegir Foto ({photos.length}):
              </span>
              {photos.map((p, idx) => (
                <button
                  key={p.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedPhotoIdx(idx);
                  }}
                  className={`relative w-14 h-14 rounded-xl overflow-hidden border shrink-0 transition-transform cursor-pointer ${
                    selectedPhotoIdx === idx
                      ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-500/30'
                      : 'border-zinc-800 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={p.dataUrl} alt={`Foto ${idx}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[8px] font-mono text-center text-white truncate px-0.5">
                    #{idx + 1} {p.pitch ? `${p.pitch}°` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Color Picker & Transfer to 3D Model */}
          <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Transferir Colores de la Foto al Modelo 3D
                </h3>
              </div>
              {appliedColorToast && (
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3 h-3" />
                  {appliedColorToast}
                </span>
              )}
            </div>

            {/* Select which component to apply to */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-400">Aplicar a la pieza:</span>
              <select
                value={selectedComponentIdx}
                onChange={(e) => setSelectedComponentIdx(Number(e.target.value))}
                className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {workingComponents.map((c, i) => (
                  <option key={i} value={i}>
                    {c.name.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Swatches */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-400">Colores extraídos:</span>
              {sampleColors.map((color, idx) => (
                <button
                  key={`${color}-${idx}`}
                  onClick={() => handleApplyColor(color)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-cyan-400 text-xs text-zinc-200 cursor-pointer active:scale-95 transition-all"
                  title={`Aplicar ${color} al componente seleccionado`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-mono text-[10px]">{color}</span>
                </button>
              ))}

              <button
                onClick={() => handleApplyColor(modelData.materialStyle.dominantColor)}
                className="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow cursor-pointer ml-auto"
              >
                <Sparkles className="w-3 h-3" />
                <span>Aplicar a Todo el Modelo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
          >
            Listo / Volver al Visor 3D
          </button>
        </div>
      </div>
    </div>
  );
};
