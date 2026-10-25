import { CapturedPhoto, ScanCoverageInfo } from '../types';

export interface SectorStatus {
  angle: number; // degrees 0, 45, 90, 135, 180, 225, 270, 315
  label: string;
  isCovered: boolean;
  photoCount: number;
}

export interface DetailedCoverage {
  info: ScanCoverageInfo;
  lowSectors: SectorStatus[];
  midSectors: SectorStatus[];
  zenithSectors: SectorStatus[];
  recommendedPitch: number; // what pitch to hold phone now
  recommendedRing: 'low' | 'mid' | 'zenith';
  recommendedOrientation: 'vertical' | 'horizontal';
}

const SECTOR_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const SECTOR_LABELS = ['0°', '45°', '90°', '135°', '180°', '225°', '270°', '315°'];

export function analyzeScanCoverage(
  photos: CapturedPhoto[],
  isHoyoOrCylinder: boolean = false
): DetailedCoverage {
  const lowSectors: SectorStatus[] = SECTOR_ANGLES.map((angle, i) => ({
    angle,
    label: SECTOR_LABELS[i],
    isCovered: false,
    photoCount: 0,
  }));

  const midSectors: SectorStatus[] = SECTOR_ANGLES.map((angle, i) => ({
    angle,
    label: SECTOR_LABELS[i],
    isCovered: false,
    photoCount: 0,
  }));

  const zenithSectors: SectorStatus[] = [0, 90, 180, 270].map((angle) => ({
    angle,
    label: `${angle}°`,
    isCovered: false,
    photoCount: 0,
  }));

  photos.forEach((photo, idx) => {
    // Determine ring by pitch if available, or angleLabel fallback
    let ring: 'low' | 'mid' | 'zenith' = photo.ring || 'mid';
    const pitch = typeof photo.pitch === 'number' ? photo.pitch : 45;

    if (pitch >= 68 || /cenital|top|arriba|superior/i.test(photo.angleLabel)) {
      ring = 'zenith';
    } else if (pitch < 32 || /rasante|lateral|frente|bajo/i.test(photo.angleLabel)) {
      ring = 'low';
    } else {
      ring = 'mid';
    }

    // Determine sector angle
    const yaw =
      typeof photo.yaw === 'number'
        ? photo.yaw
        : (idx * (360 / Math.max(8, photos.length))) % 360;

    if (ring === 'zenith') {
      const zIdx = Math.min(3, Math.floor(((yaw + 45) % 360) / 90));
      zenithSectors[zIdx].isCovered = true;
      zenithSectors[zIdx].photoCount++;
    } else if (ring === 'low') {
      const sIdx = Math.min(7, Math.floor(((yaw + 22.5) % 360) / 45));
      lowSectors[sIdx].isCovered = true;
      lowSectors[sIdx].photoCount++;
    } else {
      const sIdx = Math.min(7, Math.floor(((yaw + 22.5) % 360) / 45));
      midSectors[sIdx].isCovered = true;
      midSectors[sIdx].photoCount++;
    }
  });

  const lowCount = lowSectors.filter((s) => s.isCovered).length;
  const midCount = midSectors.filter((s) => s.isCovered).length;
  const zenithCount = zenithSectors.filter((s) => s.isCovered).length;
  const hasTopHoleView = zenithCount >= 1;

  // Calculate overall completeness
  // 8 mid sectors + 8 low sectors + 4 zenith sectors = 20 targets total
  const targetTotal = isHoyoOrCylinder ? 18 : 16;
  const score = midCount * 1.2 + lowCount * 0.9 + (isHoyoOrCylinder ? zenithCount * 1.8 : zenithCount);
  const coveragePercent = Math.min(100, Math.round((score / targetTotal) * 100));

  const missingHints: string[] = [];

  if (photos.length === 0) {
    missingHints.push('Comienza tomando una foto frontal a 45° con el teléfono nivelado.');
  } else {
    if (isHoyoOrCylinder && !hasTopHoleView) {
      missingHints.push('⚠️ Falta toma Cenital (arriba 75°-90°) para detectar agujeros y cavidad interior.');
    }
    if (midCount < 5) {
      missingHints.push('Gira alrededor del objeto para cubrir los ángulos faltantes a 45°.');
    }
    if (lowCount < 3) {
      missingHints.push('Toma fotos a nivel rasante (20°) para capturar paredes y orificios transversales.');
    }
    if (coveragePercent >= 75) {
      missingHints.push('✅ Cobertura alta: Reconstrucción nítida con textura y agujeros precisos.');
    }
  }

  // Next recommended angle
  let recommendedPitch = 45;
  let recommendedRing: 'low' | 'mid' | 'zenith' = 'mid';

  if (isHoyoOrCylinder && zenithCount === 0 && photos.length >= 2) {
    recommendedPitch = 80;
    recommendedRing = 'zenith';
  } else if (midCount >= 6 && lowCount < 4) {
    recommendedPitch = 20;
    recommendedRing = 'low';
  } else if (midCount < 8) {
    recommendedPitch = 45;
    recommendedRing = 'mid';
  }

  // Cylinders and tall objects are best scanned with phone in vertical portrait
  const recommendedOrientation: 'vertical' | 'horizontal' = 'vertical';

  return {
    info: {
      totalPhotos: photos.length,
      lowRingCovered: lowCount,
      midRingCovered: midCount,
      zenithCovered: zenithCount,
      hasTopHoleView,
      coveragePercent,
      missingHints,
    },
    lowSectors,
    midSectors,
    zenithSectors,
    recommendedPitch,
    recommendedRing,
    recommendedOrientation,
  };
}
