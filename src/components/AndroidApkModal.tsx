import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  QrCode,
  CheckCircle2,
  Terminal,
  ExternalLink,
  X,
  Copy,
  Check,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { triggerHaptic } from '../utils/haptics';
import { soundEffects } from '../utils/audio';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'direct' | 'qr' | 'developer'>('direct');
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://scan3d.app';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    currentUrl
  )}&bgcolor=18181b&color=38bdf8`;

  // Download Android TWA / Manifest configuration bundle
  const handleDownloadAndroidPackage = () => {
    triggerHaptic('medium');
    soundEffects.playSuccess();

    const manifestJson = {
      package_name: 'com.scan3d.studio',
      app_name: 'Scan3D Studio',
      short_name: 'Scan3D',
      version_name: '1.0.0',
      version_code: 1,
      start_url: currentUrl,
      theme_color: '#09090b',
      background_color: '#09090b',
      display: 'standalone',
      orientation: 'portrait',
      permissions: ['CAMERA', 'INTERNET', 'VIBRATE'],
    };

    const gradleBuildContent = `// Android Gradle build file for Scan3D
plugins {
    id 'com.android.application'
}

android {
    namespace 'com.scan3d.studio'
    compileSdk 34

    defaultConfig {
        applicationId "com.scan3d.studio"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
    }

    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.5.0'
}
`;

    const androidManifestContent = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.scan3d.studio">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Scan3D"
        android:theme="@style/Theme.AppCompat.NoActionBar">

        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${currentUrl}" />
        </activity>
    </application>
</manifest>`;

    const readmeContent = `# Scan3D Studio - Paquete APK Android

Este paquete contiene la configuración oficial de Trusted Web Activity (TWA) para compilar el archivo Scan3D.apk de Android:

## Opción 1: Compilar APK con Bubblewrap CLI (Recomendado, 1 comando)
1. Instala NodeJS y ejecuta en tu terminal:
   npx @bubblewrap/cli build --manifest="${currentUrl}manifest.webmanifest"
2. Bubblewrap generará automáticamente el archivo 'app-release-signed.apk' listo para instalar en cualquier teléfono Android.

## Opción 2: Compilar en Android Studio
1. Abre este proyecto en Android Studio.
2. Conecta tu teléfono Android con depuración USB activada.
3. Presiona 'Run' o 'Build > Build APK(s)'.

## Opción 3: WebAPK Directo (Sin compilar)
Abre ${currentUrl} en Google Chrome desde tu teléfono Android y presiona "Instalar Aplicación". Chrome creará un APK nativo en tu cajón de apps.
`;

    // Download README with instructions and configs
    const bundleText = `${readmeContent}\n\n========================================\n// AndroidManifest.xml\n========================================\n${androidManifestContent}\n\n========================================\n// build.gradle\n========================================\n${gradleBuildContent}\n\n========================================\n// twa-manifest.json\n========================================\n${JSON.stringify(manifestJson, null, 2)}`;

    const blob = new Blob([bundleText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Scan3D_Android_APK_Project.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const copyBubblewrapCommand = () => {
    const cmd = `npx @bubblewrap/cli init --manifest="${currentUrl}manifest.webmanifest" && npx @bubblewrap/cli build`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    triggerHaptic('light');
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-zinc-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                Scan3D para Android (APK)
              </h3>
              <p className="text-[10px] text-zinc-400">Instalación nativa y paquete Android Studio</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center border-b border-zinc-800 px-4 pt-2 gap-2 text-xs font-semibold bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('direct')}
            className={`pb-2 px-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'direct'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Instalador WebAPK
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2 px-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Escanear Código QR
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`pb-2 px-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'developer'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Compilar APK (CLI)
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'direct' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-300 text-xs mb-1">
                    Instalación Automática WebAPK en Android
                  </h4>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Android genera automáticamente un paquete APK firmado por Google Play Services cuando agregas la aplicación a tu teléfono desde Chrome o Samsung Internet.
                  </p>
                </div>
              </div>

              {isInstalled ? (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>¡Scan3D ya está instalada en este dispositivo!</span>
                </div>
              ) : isInstallable ? (
                <button
                  onClick={async () => {
                    triggerHaptic('medium');
                    const ok = await install();
                    if (ok) onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Instalar APK de Scan3D en Android
                </button>
              ) : (
                <div className="space-y-2 bg-zinc-950/70 p-3.5 rounded-2xl border border-zinc-800 text-[11px] text-zinc-300">
                  <span className="font-bold text-white block mb-1">Pasos para instalar en tu teléfono:</span>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-zinc-800 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0">1</span>
                    <span>Abre este enlace en Google Chrome desde tu teléfono Android.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-zinc-800 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0">2</span>
                    <span>Toca los 3 puntos (⋮) de la esquina superior derecha.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-zinc-800 text-cyan-400 font-bold flex items-center justify-center text-[10px] shrink-0">3</span>
                    <span>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</span>
                  </div>
                </div>
              )}

              <button
                onClick={handleDownloadAndroidPackage}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Descargar Código Fuente y Manifiesto Android
              </button>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-3">
              <p className="text-zinc-300 text-[11px]">
                Apunta con la cámara de tu teléfono Android a este código para abrir la app e instalar el APK de inmediato:
              </p>

              <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 shadow-xl">
                <img
                  src={qrCodeUrl}
                  alt="Código QR para Android"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              </div>

              <span className="text-[10px] font-mono text-cyan-400 truncate max-w-xs">
                {currentUrl}
              </span>
            </div>
          )}

          {activeTab === 'developer' && (
            <div className="space-y-3">
              <p className="text-zinc-300 text-[11px]">
                Puedes compilar el archivo <strong>.apk</strong> independiente firmado para instalarlo o subirlo a Google Play Store mediante la herramienta oficial de Google:
              </p>

              <div className="p-3 rounded-xl bg-black border border-zinc-800 font-mono text-[10px] text-cyan-300 space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-zinc-500">
                  <span>Comando de compilación APK:</span>
                  <button
                    onClick={copyBubblewrapCommand}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-[10px] cursor-pointer"
                  >
                    {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCmd ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                <div className="overflow-x-auto whitespace-pre-wrap break-all select-all">
                  npx @bubblewrap/cli build
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <span className="text-white font-semibold block">Características del APK:</span>
                <div>• Acceso nativo por hardware a la cámara sin barras de navegador.</div>
                <div>• Permiso de linterna / flash y vibración háptica.</div>
                <div>• Renderizado WebGL 3D acelerado por la GPU de tu teléfono.</div>
              </div>

              <button
                onClick={handleDownloadAndroidPackage}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-900/30"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar Plantilla de Proyecto Android
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
