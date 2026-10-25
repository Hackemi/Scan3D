export type CaptureResolution = '4k' | '1080p' | '720p';

export interface CapturedPhoto {
  id: string;
  dataUrl: string;
  angleLabel: string;
  timestamp: number;
  width?: number;
  height?: number;
  is4K?: boolean;
  resolutionLabel?: string;
  pitch?: number; // degrees from horizontal: 0=flat, 45=oblique, 80-90=zenith (top)
  roll?: number; // left/right tilt: 0=level
  yaw?: number; // orbit degree: 0-360
  distanceCm?: number; // estimated distance in cm
  ring?: 'low' | 'mid' | 'zenith';
}

export interface ScanCoverageInfo {
  totalPhotos: number;
  lowRingCovered: number; // 0 to 8 sectors
  midRingCovered: number; // 0 to 8 sectors
  zenithCovered: number; // 0 to 4 sectors
  hasTopHoleView: boolean;
  coveragePercent: number;
  missingHints: string[];
}


export type ShapeType =
  | 'cylinder'
  | 'box'
  | 'sphere'
  | 'cone'
  | 'torus'
  | 'lathe'
  | 'capsule'
  | 'tube';

export type ScanCategory = 'auto' | 'pieza_3d' | 'hoyo' | 'aparato' | 'general';

export type LensType = 'ultrawide' | 'main' | 'telephoto';

export interface ComponentMaterial {
  color: string;
  roughness: number;
  metalness: number;
  transparent?: boolean;
  opacity?: number;
  wireframe?: boolean;
  clearcoat?: number;
}

export interface ComponentDefinition {
  name: string;
  shapeType: ShapeType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  parameters?: {
    radiusTop?: number;
    radiusBottom?: number;
    height?: number;
    radialSegments?: number;
    radius?: number;
    tube?: number;
    tubularSegments?: number;
    width?: number;
    depth?: number;
    capSegments?: number;
    arc?: number;
    innerRadius?: number;
    holeDepth?: number;
  };
  lathePoints?: Array<[number, number]>;
  material: ComponentMaterial;
  visible?: boolean;
}

export interface ModelMeasurements {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  diameterMm?: number;
  internalDepthMm?: number;
  volumeCm3: number;
  wallThicknessMm?: number;
  filamentWeightGrams?: number;
  toleranceMm?: number;
  holeDiameterMm?: number;
  holeCount?: number;
}

export interface Model3DData {
  id: string;
  name: string;
  category: string;
  scanCategory: ScanCategory;
  description: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  measurements?: ModelMeasurements;
  materialStyle: {
    dominantColor: string;
    accentColor: string;
    secondaryColor?: string;
    metalness: number;
    roughness: number;
    surfaceFinish: 'smooth' | 'matte' | 'glossy' | 'textured' | 'metallic' | 'ceramic';
  };
  components: ComponentDefinition[];
  pointCloudSamples?: Array<[number, number, number, string]>;
  qualityScore: number;
  detectedFeatures: string[];
  createdAt: string;
  source: 'gemini-3.8-flash' | 'local-photogrammetry' | 'sample-preset';
  thumbnailUrl?: string;
  photosCount: number;
  textureUrl?: string;
  sourcePhotos?: CapturedPhoto[];
}

export type RenderMode =
  | 'textured'
  | 'photo_texture'
  | 'contrast_colors'
  | 'wireframe'
  | 'pointcloud'
  | 'normals'
  | 'elevation'
  | 'cavity'
  | 'clay';

export interface ClipPlaneConfig {
  enabled: boolean;
  axis: 'x' | 'y' | 'z';
  position: number;
  inverted: boolean;
}

export interface BoundingCropConfig {
  enabled: boolean;
  minY: number;
  maxY: number;
}

export type EnvironmentPreset = 'studio' | 'cyber' | 'warm' | 'dark';

export interface AngleGuide {
  id: string;
  label: string;
  degree: number;
  hint: string;
  iconName: string;
}
