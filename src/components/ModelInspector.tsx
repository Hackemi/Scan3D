import React, { useState } from 'react';
import {
  X,
  Layers,
  Box,
  Palette,
  CheckCircle2,
  Download,
  FileCode,
  Sparkles,
  Printer,
  Copy,
  Check,
  Ruler,
  Compass,
} from 'lucide-react';
import { Model3DData } from '../types';
import { exportToOBJ, exportToSTL, exportToPLY, exportToJSON } from '../utils/exporters';
import { soundEffects } from '../utils/audio';

interface ModelInspectorProps {
  modelData: Model3DData;
  onClose: () => void;
}

export const ModelInspector: React.FC<ModelInspectorProps> = ({ modelData, onClose }) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHex(text);
    setTimeout(() => setCopiedHex(null), 1800);
  };

  const m = modelData.measurements || {
    widthMm: Math.round(modelData.dimensions.width * 10),
    heightMm: Math.round(modelData.dimensions.height * 10),
    depthMm: Math.round(modelData.dimensions.depth * 10),
    volumeCm3: Math.round(
      modelData.dimensions.width * modelData.dimensions.height * modelData.dimensions.depth
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm select-none animate-in fade-in">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">{modelData.name}</h2>
              <p className="text-[11px] text-zinc-400 capitalize">
                {modelData.scanCategory.toUpperCase()} • Calidad: {modelData.qualityScore}%
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-zinc-200">
          {/* Summary description */}
          <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
            {modelData.description}
          </div>

          {/* Metric Measurements Highlight (What the user specifically requested) */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" />
              ¿Cuánto Mide el Artículo Escaneado?
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Ancho Total (X)</span>
                <span className="text-sm font-bold text-white font-mono">{m.widthMm} mm</span>
                <span className="text-[10px] text-zinc-400">({(m.widthMm / 10).toFixed(1)} cm)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Alto Total (Y)</span>
                <span className="text-sm font-bold text-white font-mono">{m.heightMm} mm</span>
                <span className="text-[10px] text-zinc-400">({(m.heightMm / 10).toFixed(1)} cm)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Profundidad (Z)</span>
                <span className="text-sm font-bold text-white font-mono">{m.depthMm} mm</span>
                <span className="text-[10px] text-zinc-400">({(m.depthMm / 10).toFixed(1)} cm)</span>
              </div>

              {/* Hole specific metrics */}
              {m.diameterMm && (
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex flex-col">
                  <span className="text-[10px] text-cyan-300 uppercase font-mono font-bold">Diámetro Apertura (Ø)</span>
                  <span className="text-sm font-bold text-cyan-200 font-mono">Ø {m.diameterMm} mm</span>
                  <span className="text-[10px] text-cyan-400/80">({(m.diameterMm / 10).toFixed(1)} cm)</span>
                </div>
              )}

              {m.internalDepthMm && (
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 flex flex-col">
                  <span className="text-[10px] text-cyan-300 uppercase font-mono font-bold">Profundidad Cavidad</span>
                  <span className="text-sm font-bold text-cyan-200 font-mono">{m.internalDepthMm} mm</span>
                  <span className="text-[10px] text-cyan-400/80">al fondo interior</span>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
                <span className="text-[10px] text-zinc-500 uppercase font-mono">Volumen Neto</span>
                <span className="text-sm font-bold text-amber-300 font-mono">{m.volumeCm3} cm³</span>
                <span className="text-[10px] text-zinc-400">({m.volumeCm3} ml)</span>
              </div>

              {/* 3D Piece / Print metrics */}
              {m.filamentWeightGrams && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex flex-col">
                  <span className="text-[10px] text-emerald-300 uppercase font-mono font-bold">Impresión 3D (PLA)</span>
                  <span className="text-sm font-bold text-emerald-200 font-mono">~{m.filamentWeightGrams} g</span>
                  <span className="text-[10px] text-emerald-400/80">con 40% relleno</span>
                </div>
              )}

              {m.toleranceMm && (
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col">
                  <span className="text-[10px] text-zinc-500 uppercase font-mono">Tolerancia Óptica</span>
                  <span className="text-sm font-bold text-white font-mono">±{m.toleranceMm} mm</span>
                  <span className="text-[10px] text-zinc-400">calibrado</span>
                </div>
              )}
            </div>
          </div>

          {/* Material Finish & Color Palette */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-cyan-400" />
              Colorimetría y Acabado PBR
            </h3>
            <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-400">Colores Detectados:</span>
                {[
                  { label: 'Dominante', color: modelData.materialStyle.dominantColor },
                  { label: 'Acento', color: modelData.materialStyle.accentColor },
                  { label: 'Secundario', color: modelData.materialStyle.secondaryColor || '#94a3b8' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => copyToClipboard(item.color)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-cyan-400 text-xs text-zinc-200 cursor-pointer"
                    title="Copiar código HEX"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-mono text-[10px]">{item.color}</span>
                    {copiedHex === item.color ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5 text-zinc-500" />
                    )}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-800 text-[11px]">
                <div>
                  <span className="text-zinc-500">Rugosidad:</span>
                  <div className="font-mono text-zinc-300 font-bold">
                    {(modelData.materialStyle.roughness * 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Metalicidad:</span>
                  <div className="font-mono text-zinc-300 font-bold">
                    {(modelData.materialStyle.metalness * 100).toFixed(0)}%
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">Acabado:</span>
                  <div className="font-bold text-cyan-300 capitalize">
                    {modelData.materialStyle.surfaceFinish}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Component Hierarchy */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Descomposición Estructural ({modelData.components.length} Partes)
            </h3>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {modelData.components.map((comp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-zinc-500">#{idx + 1}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: comp.material.color }}
                    />
                    <span className="font-medium text-zinc-200 text-[11px]">{comp.name}</span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-cyan-300 font-mono text-[10px]">
                    {comp.shapeType}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          {modelData.detectedFeatures && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Características y Calibración
              </h3>
              <div className="space-y-1 text-xs text-zinc-300">
                {modelData.detectedFeatures.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                exportToOBJ(new (window as any).THREE.Group(), modelData.name);
                soundEffects.playSuccess();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold"
            >
              .OBJ
            </button>
            <button
              onClick={() => {
                exportToJSON(modelData);
                soundEffects.playSuccess();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs"
            >
              .JSON
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
