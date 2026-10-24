import React, { useState, useEffect } from 'react';
import { Cpu, Box, ScanLine, Layers, CheckCircle } from 'lucide-react';
import { soundEffects } from '../utils/audio';

interface ReconstructionProgressProps {
  photosCount: number;
  objectHint?: string;
  onComplete?: () => void;
}

const STAGES = [
  {
    title: 'Análisis de Perspectivas y Segmentación',
    desc: 'Identificando objeto, eliminando fondo y detectando condiciones lumínicas...',
    icon: ScanLine,
  },
  {
    title: 'Extracción de Contornos y Puntos Clave',
    desc: 'Triangulando características visuales en los diferentes ángulos capturados...',
    icon: Layers,
  },
  {
    title: 'Cálculo de Nube de Puntos Espacial',
    desc: 'Estimando mapa de profundidad volumétrico y coordenadas tridimensionales...',
    icon: Cpu,
  },
  {
    title: 'Construcción de Malla 3D y Materiales PBR',
    desc: 'Generando polígonos, normales de superficie y horneado de reflectividad...',
    icon: Box,
  },
];

export const ReconstructionProgress: React.FC<ReconstructionProgressProps> = ({
  photosCount,
  objectHint,
}) => {
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [progress, setProgress] = useState<number>(10);
  const [logs, setLogs] = useState<string[]>([
    'Iniciando pipeline de reconstrucción fotogramétrica...',
    `Cargando ${photosCount} fotograma(s) de alta resolución...`,
  ]);

  useEffect(() => {
    // Sound blip on stage change
    soundEffects.playBlip();

    const stageTimer = setInterval(() => {
      setCurrentStage((prev) => {
        const next = Math.min(prev + 1, STAGES.length - 1);
        if (next !== prev) {
          soundEffects.playBlip();
        }
        return next;
      });
    }, 1400);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.floor(Math.random() * 8) + 4;
      });
    }, 280);

    const logTimer = setInterval(() => {
      const candidateLogs = [
        `Detectados ${photosCount * 140} descriptores de borde de alta densidad`,
        'Optimizando matriz de calibración de cámara intrínseca',
        'Generando descomposición de silueta en componentes paramétricos',
        'Normalizando sistema de coordenadas: Y-Up, grounded en Z=0',
        'Calculando curvatura superficial y tangentes de textura',
        'Configurando shader PBR con ToneMapping ACESFilmic',
      ];
      setLogs((prev) => [
        ...prev.slice(-4),
        candidateLogs[Math.floor(Math.random() * candidateLogs.length)],
      ]);
    }, 1200);

    return () => {
      clearInterval(stageTimer);
      clearInterval(progressTimer);
      clearInterval(logTimer);
    };
  }, [photosCount]);

  return (
    <div className="flex flex-col items-center justify-center h-full bg-zinc-950 p-6 text-zinc-100 select-none">
      <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Center Holographic Scanner Ring */}
        <div className="relative w-28 h-28 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/40 animate-spin" style={{ animationDuration: '8s' }} />
          <div className="absolute inset-2 rounded-full border border-blue-500/30 animate-ping opacity-25" style={{ animationDuration: '3s' }} />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Box className="w-8 h-8 text-white animate-pulse" />
          </div>
        </div>

        {/* Progress percent & title */}
        <div className="text-center mb-6">
          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-800/60 uppercase tracking-wider">
            Reconstruyendo 3D ({Math.min(99, progress)}%)
          </span>
          <h2 className="text-lg font-bold text-white mt-2.5">
            {objectHint ? `Modelando: ${objectHint}` : 'Generando Malla Tridimensional'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Procesando {photosCount} perspectiva(s) capturada(s)
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-6 p-0.5">
          <div
            className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(99, progress)}%` }}
          />
        </div>

        {/* Stage List */}
        <div className="space-y-3 mb-6">
          {STAGES.map((st, idx) => {
            const Icon = st.icon;
            const isDone = idx < currentStage;
            const isCurrent = idx === currentStage;

            return (
              <div
                key={st.title}
                className={`flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-zinc-800/90 border border-cyan-500/40 shadow-sm'
                    : isDone
                    ? 'opacity-60'
                    : 'opacity-30'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isCurrent
                      ? 'bg-cyan-500/20 text-cyan-400 animate-pulse'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-zinc-200 truncate">{st.title}</h4>
                  <p className="text-[11px] text-zinc-400 leading-snug">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Console Log output */}
        <div className="bg-black/60 rounded-xl p-3 border border-zinc-800/80 font-mono text-[10px] text-zinc-400 space-y-1">
          <div className="text-zinc-500 flex items-center gap-1.5 pb-1 border-b border-zinc-800">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Terminal de Fotogrametría</span>
          </div>
          {logs.map((log, i) => (
            <div key={i} className="truncate text-cyan-300/80">
              &gt; {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
