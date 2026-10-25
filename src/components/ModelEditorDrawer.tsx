import React, { useState } from 'react';
import {
  ComponentDefinition,
  ShapeType,
  ClipPlaneConfig,
} from '../types';
import {
  Scissors,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Undo2,
  RotateCcw,
  Palette,
  Wrench,
  Check,
  X,
  Sliders,
  Layers,
  Sparkles,
  Box,
  Disc,
  Circle,
  HelpCircle,
  Copy,
  Ruler,
  Move,
  RotateCw,
  Target,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';
import { soundEffects } from '../utils/audio';

export const CONTRAST_PALETTE = [
  '#2563eb', // Azul zafiro (Cuerpo exterior)
  '#ef4444', // Rojo perforación (Hoyos transversales)
  '#f59e0b', // Ámbar dorado (Bisel / Cavidad)
  '#10b981', // Verde esmeralda (Chaflán de boca)
  '#8b5cf6', // Púrpura intenso (Nervaduras)
  '#06b6d4', // Cian brillante (Buje / Eje)
  '#ec4899', // Rosa magenta
  '#0f172a', // Grafito profundo (Fondo de hoyo)
  '#e2e8f0', // Blanco aluminio
  '#78350f', // Cobre / Bronce
];

interface ModelEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  components: ComponentDefinition[];
  selectedIdx: number | null;
  onSelectComponent: (idx: number | null) => void;
  onUpdateComponent: (idx: number, updated: ComponentDefinition) => void;
  onDeleteComponent: (idx: number) => void;
  onToggleVisibility: (idx: number) => void;
  onAddComponent: (type: ShapeType, variantName?: string, customDef?: Partial<ComponentDefinition>) => void;
  onDuplicateComponent?: (idx: number) => void;
  onTrimNoise: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onResetOriginal: () => void;
  clipConfig: ClipPlaneConfig;
  onChangeClipConfig: (cfg: Partial<ClipPlaneConfig>) => void;
  onApplyPermanentSlice: () => void;
}

export const ModelEditorDrawer: React.FC<ModelEditorDrawerProps> = ({
  isOpen,
  onClose,
  components,
  selectedIdx,
  onSelectComponent,
  onUpdateComponent,
  onDeleteComponent,
  onToggleVisibility,
  onAddComponent,
  onDuplicateComponent,
  onTrimNoise,
  onUndo,
  canUndo,
  onResetOriginal,
  clipConfig,
  onChangeClipConfig,
  onApplyPermanentSlice,
}) => {
  // Tabs: 'holes' | 'slice' | 'transform' | 'dimensions' | 'components'
  const [activeTab, setActiveTab] = useState<'holes' | 'slice' | 'transform' | 'dimensions' | 'components'>('holes');

  if (!isOpen) return null;

  const currentComp = selectedIdx !== null && selectedIdx >= 0 && selectedIdx < components.length
    ? components[selectedIdx]
    : components[0] || null;

  const currentCompIdx = selectedIdx !== null && selectedIdx >= 0 && selectedIdx < components.length
    ? selectedIdx
    : 0;

  // Helper to convert 3D internal units to real-world millimeters (1.0 3D unit ≈ 50 mm)
  const UNIT_TO_MM = 50;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm sm:max-w-md bg-zinc-950/95 border-l border-zinc-800 backdrop-blur-xl shadow-2xl flex flex-col text-white animate-in slide-in-from-right duration-200 select-none">
      {/* 1. Header with Undo & Close */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-zinc-950 shadow-md shadow-cyan-500/20">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              Editor CAD y Formas 3D
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono">
              Hoyos, cortes, deslizador y medidas métricas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              triggerHaptic('light');
              onUndo();
            }}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
              canUndo
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700 cursor-pointer'
                : 'bg-zinc-900/50 text-zinc-600 border-zinc-800/50 cursor-not-allowed'
            }`}
            title="Deshacer cambio (Undo)"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Deshacer</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="flex items-center justify-between p-1.5 bg-zinc-900/60 border-b border-zinc-800 gap-1 text-xs overflow-x-auto shrink-0">
        {[
          { id: 'holes', label: '1. Hoyos', icon: Target },
          { id: 'slice', label: '2. Cortar', icon: Scissors },
          { id: 'transform', label: '3. Deslizar', icon: Move },
          { id: 'dimensions', label: '4. Medidas', icon: Ruler },
          { id: 'components', label: `5. Piezas (${components.length})`, icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                triggerHaptic('light');
              }}
              className={`py-1.5 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-cyan-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Component Quick Switcher Bar */}
      {components.length > 0 && activeTab !== 'slice' && (
        <div className="px-4 py-2 bg-zinc-900/40 border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] font-mono text-zinc-400 uppercase">Pieza activa:</span>
          <select
            value={currentCompIdx}
            onChange={(e) => {
              onSelectComponent(Number(e.target.value));
              triggerHaptic('light');
            }}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-0.5 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-400 truncate max-w-[200px]"
          >
            {components.map((c, i) => (
              <option key={i} value={i}>
                {i + 1}. {c.name.replace(/_/g, ' ')} ({c.shapeType})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 3. Main Drawer Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================== */}
        {/* TAB 1: AGREGAR HOYOS (SUITE COMPLETA DE PERFORACIONES)          */}
        {/* ============================================================== */}
        {activeTab === 'holes' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Agregar Hoyos y Perforaciones</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Elige el tipo de hoyo que deseas perforar en el cilindro o pieza. Se adaptará automáticamente a la geometría con dimensiones métricas reales.
              </p>
            </div>

            {/* Hoyo Preset Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Preset 1: Hoyo Central Pasante */}
              <div
                onClick={() => {
                  onAddComponent('tube', 'tubo_hoyo_central', {
                    position: [0, 1.2, 0],
                    rotation: [0, 0, 0],
                    parameters: { radius: 1.35, innerRadius: 0.85, height: 2.4, radialSegments: 48 },
                    material: { color: '#2563eb', roughness: 0.35, metalness: 0.2 },
                  });
                  triggerHaptic('success');
                  soundEffects.playBlip();
                }}
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/50 flex flex-col items-center text-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Disc className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-cyan-300">
                    Hoyo Central
                  </span>
                  <span className="text-[9px] text-zinc-400">Barreno Pasante Y</span>
                </div>
              </div>

              {/* Preset 2: Hoyo Transversal en X (Taladro lateral) */}
              <div
                onClick={() => {
                  onAddComponent('cylinder', 'hoyo_transversal_eje_X', {
                    position: [0, 1.3, 0],
                    rotation: [0, 0, Math.PI / 2],
                    parameters: { radiusTop: 0.35, radiusBottom: 0.35, height: 3.2, radialSegments: 36 },
                    material: { color: '#ef4444', roughness: 0.25, metalness: 0.6 },
                  });
                  triggerHaptic('success');
                  soundEffects.playBlip();
                }}
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-red-500/50 flex flex-col items-center text-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-red-300">
                    Hoyo en X (Lateral)
                  </span>
                  <span className="text-[9px] text-zinc-400">Atraviesa de lado a lado</span>
                </div>
              </div>

              {/* Preset 3: Hoyo Transversal en Z (Frontal) */}
              <div
                onClick={() => {
                  onAddComponent('cylinder', 'hoyo_transversal_eje_Z', {
                    position: [0, 1.3, 0],
                    rotation: [Math.PI / 2, 0, 0],
                    parameters: { radiusTop: 0.35, radiusBottom: 0.35, height: 3.2, radialSegments: 36 },
                    material: { color: '#f59e0b', roughness: 0.25, metalness: 0.6 },
                  });
                  triggerHaptic('success');
                  soundEffects.playBlip();
                }}
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/50 flex flex-col items-center text-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-amber-300">
                    Hoyo en Z (Frente)
                  </span>
                  <span className="text-[9px] text-zinc-400">De adelante hacia atrás</span>
                </div>
              </div>

              {/* Preset 4: Cavidad Ciega Interior */}
              <div
                onClick={() => {
                  onAddComponent('cylinder', 'cavidad_ciega_fondo', {
                    position: [0, 1.35, 0],
                    rotation: [0, 0, 0],
                    parameters: { radiusTop: 0.8, radiusBottom: 0.8, height: 2.1, radialSegments: 36 },
                    material: { color: '#09090b', roughness: 0.95, metalness: 0.05 },
                  });
                  triggerHaptic('success');
                  soundEffects.playBlip();
                }}
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-blue-500/50 flex flex-col items-center text-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                  <Circle className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block group-hover:text-blue-300">
                    Cavidad Ciega
                  </span>
                  <span className="text-[9px] text-zinc-400">Fondo cóncavo cerrado</span>
                </div>
              </div>
            </div>

            {/* Quick Chamfer / Bevel mouth */}
            <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Chaflán / Bisel de Boca</span>
                <span className="text-[10px] text-zinc-400">Borde redondeado de entrada al orificio</span>
              </div>
              <button
                onClick={() => {
                  onAddComponent('torus', 'chaflan_borde_hoyo', {
                    position: [0, 2.4, 0],
                    rotation: [Math.PI / 2, 0, 0],
                    parameters: { radius: 1.1, tube: 0.08, radialSegments: 16, tubularSegments: 48 },
                    material: { color: '#10b981', roughness: 0.2, metalness: 0.5 },
                  });
                  triggerHaptic('success');
                }}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-bold text-xs border border-emerald-500/40 cursor-pointer"
              >
                + Añadir Bisel
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: CORTAR (SLICING & SECTIONING)                           */}
        {/* ============================================================== */}
        {activeTab === 'slice' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Plano de Corte Interactivo</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clipConfig.enabled}
                    onChange={(e) => {
                      onChangeClipConfig({ enabled: e.target.checked });
                      triggerHaptic('medium');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              <p className="text-[11px] text-zinc-400 leading-snug">
                Corta y secciona el modelo en tiempo real para inspeccionar el interior del cilindro, ver los hoyos y quitar partes no deseadas.
              </p>

              {clipConfig.enabled && (
                <div className="space-y-3 pt-2 border-t border-zinc-800/80 animate-in fade-in">
                  {/* Axis Selector */}
                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block mb-1.5">
                      Eje de Corte:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'y', label: 'Eje Y (Altura / Horizontal)' },
                        { id: 'x', label: 'Eje X (Transversal)' },
                        { id: 'z', label: 'Eje Z (Longitudinal)' },
                      ].map((ax) => (
                        <button
                          key={ax.id}
                          onClick={() => {
                            onChangeClipConfig({ axis: ax.id as 'x' | 'y' | 'z' });
                            triggerHaptic('light');
                          }}
                          className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                            clipConfig.axis === ax.id
                              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ax.id.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Position Slider */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-400">Posición de Corte:</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {(clipConfig.position * UNIT_TO_MM).toFixed(0)} mm ({clipConfig.position.toFixed(2)})
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-2.0"
                      max="3.0"
                      step="0.02"
                      value={clipConfig.position}
                      onChange={(e) => onChangeClipConfig({ position: parseFloat(e.target.value) })}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Invert direction */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-zinc-300">Invertir lado cortado</span>
                    <button
                      onClick={() => {
                        onChangeClipConfig({ inverted: !clipConfig.inverted });
                        triggerHaptic('light');
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        clipConfig.inverted
                          ? 'bg-amber-400/20 border-amber-500 text-amber-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {clipConfig.inverted ? 'Invertido' : 'Normal'}
                    </button>
                  </div>

                  {/* Freeze / Apply button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onApplyPermanentSlice();
                        triggerHaptic('success');
                        soundEffects.playSuccess();
                      }}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Aplicar Corte Permanente a la Malla</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Trim Noise */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Limpiar Ruido y Base</h4>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Elimina automáticamente artefactos flotantes debajo de la base o planos capturados por error.
              </p>
              <button
                onClick={() => {
                  onTrimNoise();
                  triggerHaptic('medium');
                  soundEffects.playSuccess();
                }}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Recortar Ruido Inferior (Bajo Y=0)</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DESLIZAR Y MOVER (POSICIÓN, ROTACIÓN Y ESCALA)          */}
        {/* ============================================================== */}
        {activeTab === 'transform' && currentComp && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Move className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Deslizar Posición (X, Y, Z)</span>
                </div>
                <button
                  onClick={() => {
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      position: [0, 1.2, 0],
                    });
                    triggerHaptic('light');
                  }}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  Centrar
                </button>
              </div>

              {/* Slider Posición X (Izquierda / Derecha) */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-400">Deslizar X (Horizontal):</span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {(currentComp.position[0] * UNIT_TO_MM).toFixed(0)} mm ({currentComp.position[0].toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min="-2.5"
                  max="2.5"
                  step="0.05"
                  value={currentComp.position[0]}
                  onChange={(e) => {
                    const x = parseFloat(e.target.value);
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      position: [x, currentComp.position[1], currentComp.position[2]],
                    });
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Posición Y (Altura Arriba / Abajo) */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-400">Deslizar Y (Altura):</span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {(currentComp.position[1] * UNIT_TO_MM).toFixed(0)} mm ({currentComp.position[1].toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.5"
                  max="3.5"
                  step="0.05"
                  value={currentComp.position[1]}
                  onChange={(e) => {
                    const y = parseFloat(e.target.value);
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      position: [currentComp.position[0], y, currentComp.position[2]],
                    });
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Slider Posición Z (Adelante / Atrás) */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-400">Deslizar Z (Profundidad):</span>
                  <span className="text-cyan-400 font-bold font-mono">
                    {(currentComp.position[2] * UNIT_TO_MM).toFixed(0)} mm ({currentComp.position[2].toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min="-2.5"
                  max="2.5"
                  step="0.05"
                  value={currentComp.position[2]}
                  onChange={(e) => {
                    const z = parseFloat(e.target.value);
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      position: [currentComp.position[0], currentComp.position[1], z],
                    });
                  }}
                  className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Rotación X, Y, Z */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Rotación de Pieza (Grados)</span>
                </div>
              </div>

              {/* Rotación Z (Inclinación / Barreno lateral) */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-400">Giro Z (Inclinación hoyo):</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {Math.round((currentComp.rotation[2] * 180) / Math.PI)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.05"
                  value={currentComp.rotation[2]}
                  onChange={(e) => {
                    const rz = parseFloat(e.target.value);
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      rotation: [currentComp.rotation[0], currentComp.rotation[1], rz],
                    });
                  }}
                  className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Rotación X */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-400">Giro X (Cabeceo frontal):</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {Math.round((currentComp.rotation[0] * 180) / Math.PI)}°
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.05"
                  value={currentComp.rotation[0]}
                  onChange={(e) => {
                    const rx = parseFloat(e.target.value);
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      rotation: [rx, currentComp.rotation[1], currentComp.rotation[2]],
                    });
                  }}
                  className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Botones de giro rápido a 90° */}
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => {
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      rotation: [0, 0, Math.PI / 2],
                    });
                    triggerHaptic('light');
                  }}
                  className="flex-1 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                >
                  Horizontal 90° (Eje X)
                </button>
                <button
                  onClick={() => {
                    onUpdateComponent(currentCompIdx, {
                      ...currentComp,
                      rotation: [0, 0, 0],
                    });
                    triggerHaptic('light');
                  }}
                  className="flex-1 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[10px] font-mono text-zinc-300 cursor-pointer"
                >
                  Vertical 0° (Eje Y)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CAMBIAR MEDIDAS MÉTRICAS (PARAMETRIC DIMENSIONS IN MM)  */}
        {/* ============================================================== */}
        {activeTab === 'dimensions' && currentComp && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-4 h-4 text-cyan-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">Modificar Medidas Métricas (mm)</h4>
                  <span className="text-[10px] font-mono text-cyan-400">
                    Pieza: {currentComp.name.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* PARAMETERS FOR TUBE (Cilindro con hoyo) */}
              {currentComp.shapeType === 'tube' && (
                <div className="space-y-3 pt-2">
                  {/* Diámetro Exterior */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Diámetro Exterior (Ø):</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.radius || 1.35) * 2 * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="200"
                      step="2"
                      value={Math.round((currentComp.parameters?.radius || 1.35) * 2 * UNIT_TO_MM)}
                      onChange={(e) => {
                        const newDiamMm = parseFloat(e.target.value);
                        const newRadius = newDiamMm / (2 * UNIT_TO_MM);
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: {
                            ...currentComp.parameters,
                            radius: newRadius,
                            innerRadius: Math.min(newRadius * 0.9, currentComp.parameters?.innerRadius || 0.8),
                          },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Diámetro del Hoyo Interior */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-amber-300 font-bold">Diámetro del Hoyo / Barreno (Ø):</span>
                      <span className="text-amber-300 font-bold font-mono">
                        {Math.round((currentComp.parameters?.innerRadius || 0.8) * 2 * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="180"
                      step="2"
                      value={Math.round((currentComp.parameters?.innerRadius || 0.8) * 2 * UNIT_TO_MM)}
                      onChange={(e) => {
                        const newHoleMm = parseFloat(e.target.value);
                        const newInnerR = newHoleMm / (2 * UNIT_TO_MM);
                        const currentOuterR = currentComp.parameters?.radius || 1.35;
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: {
                            ...currentComp.parameters,
                            innerRadius: Math.min(currentOuterR * 0.95, newInnerR),
                          },
                        });
                      }}
                      className="w-full accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Altura Total */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Altura Total (Y):</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.height || 2.4) * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="300"
                      step="2"
                      value={Math.round((currentComp.parameters?.height || 2.4) * UNIT_TO_MM)}
                      onChange={(e) => {
                        const newHeightMm = parseFloat(e.target.value);
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: {
                            ...currentComp.parameters,
                            height: newHeightMm / UNIT_TO_MM,
                          },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Espesor de Pared Informativo */}
                  <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                    <span className="text-zinc-400 text-[11px]">Espesor de Pared:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      {(
                        ((currentComp.parameters?.radius || 1.35) -
                          (currentComp.parameters?.innerRadius || 0.8)) *
                        UNIT_TO_MM
                      ).toFixed(1)}{' '}
                      mm
                    </span>
                  </div>
                </div>
              )}

              {/* PARAMETERS FOR CYLINDER (Hoyos transversales o macizos) */}
              {currentComp.shapeType === 'cylinder' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Diámetro del Cilindro/Hoyo (Ø):</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.radiusTop || 0.35) * 2 * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="150"
                      step="1"
                      value={Math.round((currentComp.parameters?.radiusTop || 0.35) * 2 * UNIT_TO_MM)}
                      onChange={(e) => {
                        const newDiamMm = parseFloat(e.target.value);
                        const r = newDiamMm / (2 * UNIT_TO_MM);
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: {
                            ...currentComp.parameters,
                            radiusTop: r,
                            radiusBottom: r,
                          },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Longitud / Profundidad:</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.height || 2.0) * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="300"
                      step="2"
                      value={Math.round((currentComp.parameters?.height || 2.0) * UNIT_TO_MM)}
                      onChange={(e) => {
                        const hMm = parseFloat(e.target.value);
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: {
                            ...currentComp.parameters,
                            height: hMm / UNIT_TO_MM,
                          },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* PARAMETERS FOR BOX */}
              {currentComp.shapeType === 'box' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Ancho X:</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.width || 1.5) * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="250"
                      step="2"
                      value={Math.round((currentComp.parameters?.width || 1.5) * UNIT_TO_MM)}
                      onChange={(e) => {
                        const w = parseFloat(e.target.value) / UNIT_TO_MM;
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: { ...currentComp.parameters, width: w },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Alto Y:</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.height || 1.5) * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="250"
                      step="2"
                      value={Math.round((currentComp.parameters?.height || 1.5) * UNIT_TO_MM)}
                      onChange={(e) => {
                        const h = parseFloat(e.target.value) / UNIT_TO_MM;
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: { ...currentComp.parameters, height: h },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-zinc-300 font-bold">Profundidad Z:</span>
                      <span className="text-cyan-400 font-bold font-mono">
                        {Math.round((currentComp.parameters?.depth || 1.5) * UNIT_TO_MM)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="250"
                      step="2"
                      value={Math.round((currentComp.parameters?.depth || 1.5) * UNIT_TO_MM)}
                      onChange={(e) => {
                        const d = parseFloat(e.target.value) / UNIT_TO_MM;
                        onUpdateComponent(currentCompIdx, {
                          ...currentComp,
                          parameters: { ...currentComp.parameters, depth: d },
                        });
                      }}
                      className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: GESTOR DE PIEZAS (LISTA, DUPLICAR, QUITAR Y COLOR)      */}
        {/* ============================================================== */}
        {activeTab === 'components' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 text-[11px]">Componentes 3D ({components.length}):</span>
              <button
                onClick={() => {
                  onResetOriginal();
                  triggerHaptic('medium');
                }}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            </div>

            {/* Components list */}
            <div className="space-y-2">
              {components.map((comp, idx) => {
                const isSelected = selectedIdx === idx;
                const isVisible = comp.visible !== false;

                return (
                  <div
                    key={`${comp.name}-${idx}`}
                    className={`p-3 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-zinc-900 border-cyan-500 shadow-md shadow-cyan-500/10'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        onClick={() => {
                          onSelectComponent(isSelected ? null : idx);
                          triggerHaptic('light');
                        }}
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0 shadow-sm"
                          style={{ backgroundColor: comp.material.color || '#38bdf8' }}
                        />
                        <div className="min-w-0">
                          <span className={`text-xs font-bold truncate block ${isSelected ? 'text-cyan-300' : 'text-zinc-200'}`}>
                            {comp.name.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 uppercase">
                            {comp.shapeType} • Y={(comp.position[1] * UNIT_TO_MM).toFixed(0)}mm
                          </span>
                        </div>
                      </div>

                      {/* Controls: Duplicate, Visibility & Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {onDuplicateComponent && (
                          <button
                            onClick={() => onDuplicateComponent(idx)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                            title="Duplicar pieza"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onToggleVisibility(idx);
                            triggerHaptic('light');
                          }}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            isVisible
                              ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                              : 'bg-red-950/40 border-red-800/60 text-red-400'
                          }`}
                          title={isVisible ? 'Ocultar pieza' : 'Mostrar pieza'}
                        >
                          {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => {
                            onDeleteComponent(idx);
                            triggerHaptic('medium');
                            soundEffects.playBlip();
                          }}
                          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-600/30 border border-zinc-700 hover:border-red-500/50 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="Eliminar pieza permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Color Swatches if selected */}
                    {isSelected && (
                      <div className="mt-2.5 pt-2.5 border-t border-zinc-800 space-y-2">
                        <label className="text-[10px] font-mono text-zinc-400 uppercase font-semibold block">
                          Color CAD Diferenciado:
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CONTRAST_PALETTE.map((hex) => (
                            <button
                              key={hex}
                              onClick={() => {
                                onUpdateComponent(idx, {
                                  ...comp,
                                  material: { ...comp.material, color: hex },
                                });
                                triggerHaptic('light');
                              }}
                              style={{ backgroundColor: hex }}
                              className={`w-5 h-5 rounded-full border-2 transition-transform cursor-pointer ${
                                comp.material.color === hex
                                  ? 'border-white scale-110 shadow-md'
                                  : 'border-transparent hover:scale-105'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs px-4 shrink-0">
        <span className="text-[11px] text-zinc-400 font-mono">
          {components.length} piezas activas
        </span>
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md"
        >
          Aplicar y Cerrar
        </button>
      </div>
    </div>
  );
};
