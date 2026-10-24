import React, { useState } from 'react';
import {
  RotateCcw,
  Sun,
  Layers,
  Camera,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  HelpCircle,
  Lightbulb,
  Crosshair,
  Smartphone,
  Eye,
  Disc,
} from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

interface InteractiveTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onStartScanning: () => void;
}

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: '¿Cómo rotar para mejor fotogrametría?',
    subtitle: 'El secreto está en el movimiento relativo',
    icon: RotateCcw,
    accentColor: 'from-cyan-500 to-blue-600',
    content: (
      <div className="space-y-3 text-xs text-zinc-300">
        <p>
          Para que el algoritmo reconstruya la geometría en 3D necesita ver el objeto desde múltiples ángulos con la misma iluminación:
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <span className="font-bold text-cyan-400 block mb-1">Opción A: Gira el Teléfono</span>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Ideal para hoyos o piezas grandes. Usa el <strong>Auto Giro con Giroscopio</strong>: solo camina alrededor y el móvil disparará solo con vibración háptica cada 40°.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-zinc-950/80 border border-zinc-800">
            <span className="font-bold text-emerald-400 block mb-1">Opción B: Gira el Objeto</span>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Ideal para piezas 3D y aparatos. Usa el <strong>Auto Giro Objeto</strong>: pon el móvil quieto y gira la pieza cada vez que sientas el pulso háptico del temporizador.
            </p>
          </div>
        </div>
      </div>
    ),
    tip: '¡Usa el modo "Auto Giro 360°" para no tener que tocar la pantalla durante el escaneo y generar el modelo 3D al terminar!',
  },
  {
    step: 2,
    title: 'Regla de Oro: 60-70% de Solapamiento',
    subtitle: 'Cada foto debe compartir puntos con la anterior',
    icon: Layers,
    accentColor: 'from-blue-500 to-indigo-600',
    content: (
      <div className="space-y-3 text-xs text-zinc-300">
        <p>
          La IA busca características idénticas (aristas, texturas, imperfecciones) entre fotos consecutivas para triangular la profundidad.
        </p>
        <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-300 font-mono font-bold">
            65%
          </div>
          <div>
            <span className="font-bold text-white block">Solapamiento Óptimo</span>
            <span className="text-[11px] text-zinc-400">
              Gira aproximadamente 20° a 30° en cada toma. Nuestro anillo 360° te indica el punto exacto.
            </span>
          </div>
        </div>
      </div>
    ),
    tip: 'Si saltas más de 45° entre fotos, el algoritmo no podrá unir las superficies.',
  },
  {
    step: 3,
    title: 'Las 3 Alturas de Escaneo',
    subtitle: 'Nivel medio, inclinación 45° y cenital',
    icon: Disc,
    accentColor: 'from-indigo-500 to-purple-600',
    content: (
      <div className="space-y-2 text-xs text-zinc-300">
        <p>
          Para obtener un modelo 3D cerrado y volumétrico sin agujeros en la parte superior:
        </p>
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span><strong>Nivel Medio (0°):</strong> Altura de los ojos para el perfil y paredes laterales.</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span><strong>Inclinado (45°):</strong> Desde arriba para biseles, tapas y relieves.</span>
          </div>
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span><strong>Cenital (Superior):</strong> Justo encima para cerrar la cavidad superior.</span>
          </div>
        </div>
      </div>
    ),
    tip: 'Al menos una toma mirando desde arriba es vital para que la tapa o boca no quede hueca.',
  },
  {
    step: 4,
    title: 'Escanear Hoyos, Piezas 3D y Aparatos',
    subtitle: 'Técnicas según el tipo de objeto',
    icon: Crosshair,
    accentColor: 'from-amber-500 to-orange-600',
    content: (
      <div className="space-y-2 text-xs text-zinc-300">
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <span className="font-bold text-amber-400 block mb-0.5">🕳️ Hoyos y Cavidades:</span>
          <p className="text-[11px] text-zinc-400">
            Enfoca oblicuamente hacia el interior. Activa la linterna/flash de la app para que el fondo del hoyo tenga luz y no quede en sombras.
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <span className="font-bold text-cyan-400 block mb-0.5">🧩 Piezas 3D y Repuestos:</span>
          <p className="text-[11px] text-zinc-400">
            Colócalas sobre una hoja cuadriculada o fondo mate. El contraste permite medir tolerancias milimétricas con mayor precisión.
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <span className="font-bold text-emerald-400 block mb-0.5">📱 Aparatos y Dispositivos:</span>
          <p className="text-[11px] text-zinc-400">
            Si tienen pantallas brillantes o vidrio, apaga pantallas o muévete despacio para evitar reflejos especulares engañosos.
          </p>
        </div>
      </div>
    ),
    tip: 'En el menú de la cámara selecciona el perfil adecuado (Pieza 3D, Hoyo, Aparato) para calibrar el algoritmo.',
  },
  {
    step: 5,
    title: '¿Qué cámara de tu teléfono es mejor?',
    subtitle: 'Principal (1x) vs Telefoto (2x) vs Gran Angular (0.5x)',
    icon: Camera,
    accentColor: 'from-emerald-500 to-teal-600',
    content: (
      <div className="space-y-2.5 text-xs text-zinc-300">
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
          <div className="flex items-center justify-between font-bold text-emerald-300 mb-0.5">
            <span>⭐ Cámara Principal (1x)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 font-mono">LA MEJOR</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Tiene el sensor más grande, mayor nitidez y cero distorsión de lente. Es la opción ideal para el 90% de los escaneos.
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <span className="font-bold text-cyan-300 block mb-0.5">🔍 Telefoto (2x / 3x):</span>
          <p className="text-[11px] text-zinc-400">
            Excelente para piezas mecánicas pequeñas. Al aplanar la perspectiva, las medidas son más precisas y no se curvan los bordes.
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <span className="font-bold text-zinc-300 block mb-0.5">🌐 Gran Angular (0.5x):</span>
          <p className="text-[11px] text-zinc-400">
            Úsala únicamente si el hoyo o el espacio es muy estrecho y no puedes alejarte. Ten en cuenta que deforma ligeramente los extremos.
          </p>
        </div>
      </div>
    ),
    tip: '¡Te recomendamos usar la Cámara Principal (1x) para obtener los modelos más nítidos y exactos!',
  },
  {
    step: 6,
    title: 'Captura en 4K Ultra HD (3840 × 2160)',
    subtitle: 'Máxima densidad de puntos y medidas exactas',
    icon: Sparkles,
    accentColor: 'from-amber-400 to-yellow-600',
    content: (
      <div className="space-y-2.5 text-xs text-zinc-300">
        <p>
          Hemos habilitado el sensor a resolución completa 4K UHD para capturar hasta el más mínimo detalle de tu objeto:
        </p>
        <div className="space-y-2 pt-1">
          <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40">
            <span className="font-bold text-amber-300 block mb-0.5">✨ 4 Veces Más Puntos Clave:</span>
            <p className="text-[11px] text-zinc-400">
              Al pasar de 1080p a 4K UHD, la nube de puntos aumenta de 12,000 a más de 50,000 puntos tridimensionales, logrando bordes afilados y superficies sin ruido.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <span className="font-bold text-cyan-300 block mb-0.5">📏 Metrología Submilimétrica:</span>
            <p className="text-[11px] text-zinc-400">
              La resolución 4K permite calibrar diámetros de hoyos (Ø) y profundidades con precisión de décimas de milímetro, ideal para ingeniería y repuestos 3D.
            </p>
          </div>
        </div>
      </div>
    ),
    tip: 'Deja activado el botón "4K UHD ★" para obtener los mejores resultados de escaneo.',
  },
];

export const InteractiveTutorial: React.FC<InteractiveTutorialProps> = ({
  isOpen,
  onClose,
  onStartScanning,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  if (!isOpen) return null;

  const stepData = TUTORIAL_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TUTORIAL_STEPS.length - 1;
  const Icon = stepData.icon;

  const nextStep = () => {
    triggerHaptic('light');
    if (isLast) {
      onStartScanning();
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    triggerHaptic('light');
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-1.5">
            {TUTORIAL_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentStepIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  idx === currentStepIndex
                    ? 'w-7 bg-cyan-400'
                    : idx < currentStepIndex
                    ? 'w-3 bg-zinc-600'
                    : 'w-3 bg-zinc-800'
                }`}
                title={`Paso ${idx + 1}`}
              />
            ))}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 flex flex-col justify-between">
          <div>
            {/* Step Icon Badge */}
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-11 h-11 rounded-2xl bg-gradient-to-tr ${stepData.accentColor} flex items-center justify-center text-white shadow-lg`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Paso {stepData.step} de {TUTORIAL_STEPS.length}
                </span>
                <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                  {stepData.title}
                </h3>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 mb-3 font-medium">
              {stepData.subtitle}
            </p>

            {/* Dynamic Step Content */}
            <div className="mb-4">{stepData.content}</div>

            {/* Tip banner */}
            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-start gap-2 text-[11px] text-zinc-400">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{stepData.tip}</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between gap-3 pt-5 mt-3 border-t border-zinc-800/80">
            <button
              onClick={prevStep}
              disabled={isFirst}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                isFirst
                  ? 'opacity-0 pointer-events-none'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              onClick={nextStep}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all"
            >
              <span>{isLast ? '¡Empezar a Escanear!' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
