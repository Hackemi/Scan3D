import React from 'react';
import { Smartphone, Download, Share2, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { triggerHaptic } from '../utils/haptics';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    triggerHaptic('medium');
    const success = await install();
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-3xl p-6 shadow-2xl text-zinc-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mb-4 text-white shadow-lg shadow-cyan-500/25">
          <Smartphone className="w-7 h-7" />
        </div>

        <h3 className="text-lg font-bold text-white tracking-tight mb-1">
          Instalar en tu Teléfono
        </h3>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          Instala Scan3D como aplicación nativa en tu pantalla de inicio para acceder directamente a la cámara a pantalla completa sin barras de navegación.
        </p>

        {isInstalled ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-3 text-emerald-400 mb-4 text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>¡Scan3D ya está instalada como app nativa en este dispositivo!</span>
          </div>
        ) : isInstallable ? (
          <button
            onClick={handleInstallClick}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-all cursor-pointer mb-3"
          >
            <Download className="w-4 h-4" />
            Instalar App en el Teléfono
          </button>
        ) : isIOS ? (
          <div className="space-y-3 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 text-xs text-zinc-300 mb-4">
            <div className="font-semibold text-cyan-400 flex items-center gap-1.5">
              <span>Instrucciones para iPhone (Safari):</span>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-[10px] text-zinc-200">
                1
              </div>
              <p>
                Toca el botón <strong>Compartir</strong> <Share2 className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" /> en la barra inferior de Safari.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-[10px] text-zinc-200">
                2
              </div>
              <p>
                Desplázate hacia abajo y selecciona <strong>Agregar a pantalla de inicio</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-zinc-200" />.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 font-bold text-[10px] text-zinc-200">
                3
              </div>
              <p>
                Presiona <strong>Agregar</strong> en la esquina superior derecha.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 bg-zinc-950/80 p-4 rounded-2xl border border-zinc-800 text-xs text-zinc-300 mb-4">
            <div className="font-semibold text-cyan-400">En Android (Chrome / Edge):</div>
            <p>
              Toca el menú de <strong>tres puntos (⋮)</strong> del navegador y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
        >
          Continuar en navegador
        </button>
      </div>
    </div>
  );
};
