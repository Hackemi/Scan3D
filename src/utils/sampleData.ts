import { Model3DData } from '../types';

export const SAMPLE_MODELS: Model3DData[] = [
  {
    id: 'sample-cylinder-holes',
    name: 'Cilindro Perforado con Hoyos (Buje CAD)',
    category: 'hoyo',
    scanCategory: 'hoyo',
    description: 'Cilindro hueco de ingeniería con barreno pasante central, 4 orificios de lubricación transversales y chaflanes en los extremos.',
    dimensions: { width: 8.0, height: 12.0, depth: 8.0 },
    measurements: {
      widthMm: 80,
      heightMm: 120,
      depthMm: 80,
      diameterMm: 80,
      internalDepthMm: 120,
      volumeCm3: 215,
      wallThicknessMm: 6.5,
      toleranceMm: 0.1,
      holeDiameterMm: 22,
      holeCount: 5,
    },
    materialStyle: {
      dominantColor: '#2563eb', // Azul anodizado
      accentColor: '#f59e0b', // Ámbar de advertencia
      secondaryColor: '#ef4444', // Rojo de orificio
      metalness: 0.35,
      roughness: 0.28,
      surfaceFinish: 'metallic',
    },
    components: [
      {
        name: 'cuerpo_cilindro_tubo',
        shapeType: 'tube',
        position: [0, 1.2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 1.4, innerRadius: 0.85, height: 2.4, radialSegments: 36 },
        material: { color: '#2563eb', roughness: 0.3, metalness: 0.4 }
      },
      {
        name: 'cavidad_interior_profunda',
        shapeType: 'cylinder',
        position: [0, 1.2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.82, radiusBottom: 0.82, height: 2.38, radialSegments: 32 },
        material: { color: '#090d16', roughness: 0.8, metalness: 0.1 }
      },
      {
        name: 'hoyo_transversal_x',
        shapeType: 'cylinder',
        position: [0, 1.2, 0],
        rotation: [0, 0, Math.PI / 2],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.35, radiusBottom: 0.35, height: 3.0, radialSegments: 24 },
        material: { color: '#ef4444', roughness: 0.25, metalness: 0.6 }
      },
      {
        name: 'hoyo_transversal_z',
        shapeType: 'cylinder',
        position: [0, 1.7, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.28, radiusBottom: 0.28, height: 3.0, radialSegments: 24 },
        material: { color: '#f59e0b', roughness: 0.25, metalness: 0.6 }
      },
      {
        name: 'chaflan_boca_superior',
        shapeType: 'torus',
        position: [0, 2.4, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 1.15, tube: 0.08, radialSegments: 16, tubularSegments: 36 },
        material: { color: '#10b981', roughness: 0.2, metalness: 0.5 }
      },
      {
        name: 'chaflan_boca_inferior',
        shapeType: 'torus',
        position: [0, 0.02, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 1.15, tube: 0.08, radialSegments: 16, tubularSegments: 36 },
        material: { color: '#06b6d4', roughness: 0.2, metalness: 0.5 }
      }
    ],
    qualityScore: 99,
    detectedFeatures: [
      'Cilindro hueco con espesor de pared de 6.5 mm',
      'Orificio pasante central Ø 44 mm con fondo calibrado',
      '2 orificios transversales pasantes a 90° (Ø 22 mm y Ø 18 mm)',
      'Chaflanes de entrada superior e inferior a 45°',
      'Colores diferenciados por elemento funcional'
    ],
    createdAt: new Date().toISOString(),
    source: 'sample-preset',
    photosCount: 10,
  },
  {
    id: 'sample-bracket-3d',
    name: 'Soporte Mecánico 3D (Pieza CAD)',
    category: 'pieza_3d',
    scanCategory: 'pieza_3d',
    description: 'Pieza técnica de precisión con brida de montaje, chavetero central y orificios avellanados para impresión 3D / mecanizado.',
    dimensions: { width: 9.5, height: 4.8, depth: 9.5 },
    measurements: {
      widthMm: 95,
      heightMm: 48,
      depthMm: 95,
      diameterMm: 32,
      wallThicknessMm: 3.2,
      volumeCm3: 86,
      filamentWeightGrams: 34,
      toleranceMm: 0.15,
    },
    materialStyle: {
      dominantColor: '#38bdf8',
      accentColor: '#f59e0b',
      secondaryColor: '#0f172a',
      metalness: 0.25,
      roughness: 0.45,
      surfaceFinish: 'textured',
    },
    components: [
      {
        name: 'placa_base_brida',
        shapeType: 'cylinder',
        position: [0, 0.2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 1.6, radiusBottom: 1.6, height: 0.4, radialSegments: 36 },
        material: { color: '#38bdf8', roughness: 0.4, metalness: 0.2 }
      },
      {
        name: 'buje_eje_central',
        shapeType: 'cylinder',
        position: [0, 1.2, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.85, radiusBottom: 0.9, height: 1.8, radialSegments: 36 },
        material: { color: '#0284c7', roughness: 0.35, metalness: 0.4 }
      },
      {
        name: 'nervio_refuerzo_1',
        shapeType: 'box',
        position: [0.95, 0.6, 0],
        rotation: [0, 0, -0.4],
        scale: [1, 1, 1],
        parameters: { width: 0.9, height: 0.8, depth: 0.2 },
        material: { color: '#38bdf8', roughness: 0.4, metalness: 0.2 }
      },
      {
        name: 'nervio_refuerzo_2',
        shapeType: 'box',
        position: [-0.95, 0.6, 0],
        rotation: [0, 0, 0.4],
        scale: [1, 1, 1],
        parameters: { width: 0.9, height: 0.8, depth: 0.2 },
        material: { color: '#38bdf8', roughness: 0.4, metalness: 0.2 }
      },
      {
        name: 'chaflan_orificio_central',
        shapeType: 'torus',
        position: [0, 2.1, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 0.5, tube: 0.08, radialSegments: 16, tubularSegments: 32 },
        material: { color: '#f59e0b', roughness: 0.2, metalness: 0.6 }
      }
    ],
    pointCloudSamples: [
      [0.0, 0.2, 1.6, '#38bdf8'],
      [1.1, 0.2, 1.1, '#38bdf8'],
      [-1.1, 0.2, 1.1, '#38bdf8'],
      [0.0, 2.1, 0.5, '#f59e0b'],
      [0.85, 1.2, 0.0, '#0284c7'],
      [-0.85, 1.2, 0.0, '#0284c7'],
      [0.0, 1.2, 0.85, '#0284c7'],
      [0.0, 1.2, -0.85, '#0284c7'],
    ],
    qualityScore: 98,
    detectedFeatures: [
      'Tolerancia de mecanizado ±0.15 mm',
      'Orificio cilíndrico calibrado Ø 32 mm',
      'Nervaduras estructurales de refuerzo a 45°',
      'Apto para exportación a STL de impresión 3D'
    ],
    createdAt: new Date().toISOString(),
    source: 'sample-preset',
    photosCount: 8,
  },
  {
    id: 'sample-bore-cavity',
    name: 'Cavidad / Hoyo Cilíndrico con Relieve',
    category: 'hoyo',
    scanCategory: 'hoyo',
    description: 'Escaneo de cavidad cóncava / orificio con medición de diámetro de apertura, profundidad interna y volumen de llenado.',
    dimensions: { width: 11.0, height: 7.5, depth: 11.0 },
    measurements: {
      widthMm: 110,
      heightMm: 75,
      depthMm: 110,
      diameterMm: 74,
      internalDepthMm: 58,
      volumeCm3: 245,
      wallThicknessMm: 4.5,
    },
    materialStyle: {
      dominantColor: '#475569',
      accentColor: '#10b981',
      secondaryColor: '#f59e0b',
      metalness: 0.15,
      roughness: 0.65,
      surfaceFinish: 'matte',
    },
    components: [
      {
        name: 'bloque_exterior_soporte',
        shapeType: 'cylinder',
        position: [0, 0.9, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 1.8, radiusBottom: 1.85, height: 1.8, radialSegments: 36 },
        material: { color: '#334155', roughness: 0.7, metalness: 0.1 }
      },
      {
        name: 'anillo_boca_apertura',
        shapeType: 'torus',
        position: [0, 1.8, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 1.25, tube: 0.08, radialSegments: 16, tubularSegments: 36 },
        material: { color: '#10b981', roughness: 0.3, metalness: 0.5 }
      },
      {
        name: 'fondo_cavidad_interior',
        shapeType: 'cylinder',
        position: [0, 0.35, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 1.15, radiusBottom: 1.1, height: 0.2, radialSegments: 32 },
        material: { color: '#f59e0b', roughness: 0.4, metalness: 0.2 }
      },
      {
        name: 'medidor_profundidad_indicador',
        shapeType: 'cylinder',
        position: [0, 1.05, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.05, radiusBottom: 0.05, height: 1.4, radialSegments: 16 },
        material: { color: '#10b981', roughness: 0.2, metalness: 0.8 }
      }
    ],
    pointCloudSamples: [
      [0.0, 1.8, 1.25, '#10b981'],
      [1.25, 1.8, 0.0, '#10b981'],
      [-1.25, 1.8, 0.0, '#10b981'],
      [0.0, 1.8, -1.25, '#10b981'],
      [0.0, 0.35, 0.0, '#f59e0b'],
      [0.8, 0.35, 0.0, '#f59e0b'],
      [-0.8, 0.35, 0.0, '#f59e0b'],
      [1.8, 0.9, 0.0, '#334155'],
    ],
    qualityScore: 97,
    detectedFeatures: [
      'Diámetro de boca medido: Ø 74 mm',
      'Profundidad interior al fondo: 58 mm',
      'Volumen de capacidad cúbica: 245 cm³ (245 ml)',
      'Medición geométrica compensada por perspectiva'
    ],
    createdAt: new Date().toISOString(),
    source: 'sample-preset',
    photosCount: 9,
  },
  {
    id: 'sample-camera-retro',
    name: 'Cámara Fotográfica 35mm (Aparato)',
    category: 'aparato',
    scanCategory: 'aparato',
    description: 'Cuerpo de cámara analógica con chasis de aleación magnesio, barril óptico de latón y diales mecánicos superiores.',
    dimensions: { width: 14.0, height: 9.0, depth: 9.0 },
    measurements: {
      widthMm: 140,
      heightMm: 90,
      depthMm: 90,
      volumeCm3: 312,
      wallThicknessMm: 2.2,
    },
    materialStyle: {
      dominantColor: '#27272a',
      accentColor: '#e4e4e7',
      secondaryColor: '#f59e0b',
      metalness: 0.85,
      roughness: 0.22,
      surfaceFinish: 'metallic',
    },
    components: [
      {
        name: 'cuerpo_chasis_central',
        shapeType: 'box',
        position: [0, 0.9, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { width: 2.6, height: 1.6, depth: 1.1 },
        material: { color: '#18181b', roughness: 0.65, metalness: 0.2 }
      },
      {
        name: 'placa_superior_aluminio',
        shapeType: 'box',
        position: [0, 1.76, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { width: 2.62, height: 0.22, depth: 1.12 },
        material: { color: '#e4e4e7', roughness: 0.18, metalness: 0.92 }
      },
      {
        name: 'barril_lente_principal',
        shapeType: 'cylinder',
        position: [0.15, 0.9, 0.85],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.68, radiusBottom: 0.72, height: 0.7, radialSegments: 36 },
        material: { color: '#27272a', roughness: 0.25, metalness: 0.8 }
      },
      {
        name: 'anillo_enfoque_dorado',
        shapeType: 'cylinder',
        position: [0.15, 0.9, 1.15],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.7, radiusBottom: 0.7, height: 0.12, radialSegments: 36 },
        material: { color: '#f59e0b', roughness: 0.15, metalness: 0.9 }
      },
      {
        name: 'dial_obturador_superior',
        shapeType: 'cylinder',
        position: [-0.8, 1.95, 0.1],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radiusTop: 0.22, radiusBottom: 0.22, height: 0.2, radialSegments: 24 },
        material: { color: '#e4e4e7', roughness: 0.2, metalness: 0.85 }
      }
    ],
    qualityScore: 98,
    detectedFeatures: [
      'Chasis metálico de magnesio 140×90 mm',
      'Elemento óptico frontal concéntrico',
      'Diales mecánicos de obturación'
    ],
    createdAt: new Date().toISOString(),
    source: 'sample-preset',
    photosCount: 12,
  },
  {
    id: 'sample-mug-nordic',
    name: 'Taza Cerámica Nórdica',
    category: 'general',
    scanCategory: 'general',
    description: 'Taza de gres porcelánico artesanal con acabado mate cobalto y asa ergonómica semicircular contorneada.',
    dimensions: { width: 13.0, height: 11.0, depth: 10.0 },
    measurements: {
      widthMm: 130,
      heightMm: 110,
      depthMm: 100,
      diameterMm: 85,
      internalDepthMm: 95,
      volumeCm3: 350,
      wallThicknessMm: 4.0,
    },
    materialStyle: {
      dominantColor: '#1e3a5f',
      accentColor: '#d97706',
      secondaryColor: '#f1f5f9',
      metalness: 0.1,
      roughness: 0.3,
      surfaceFinish: 'ceramic',
    },
    components: [
      {
        name: 'cuerpo_revolucion_taza',
        shapeType: 'lathe',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        lathePoints: [
          [0.85, 0.0],
          [0.95, 0.15],
          [1.15, 0.5],
          [1.25, 1.2],
          [1.28, 1.9],
          [1.22, 2.4],
          [1.18, 2.7],
          [1.18, 2.7],
          [1.06, 2.65],
          [1.06, 2.0],
          [1.02, 1.2],
          [0.92, 0.5],
          [0.75, 0.2]
        ],
        material: { color: '#1e3a5f', roughness: 0.32, metalness: 0.08 }
      },
      {
        name: 'borde_superior_esmaltado',
        shapeType: 'torus',
        position: [0, 2.7, 0],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 1.12, tube: 0.06, radialSegments: 16, tubularSegments: 36 },
        material: { color: '#d97706', roughness: 0.18, metalness: 0.25 }
      },
      {
        name: 'asa_ergonomica_curva',
        shapeType: 'torus',
        position: [1.32, 1.45, 0],
        rotation: [0, 0, Math.PI / 5],
        scale: [0.75, 1.15, 0.75],
        parameters: { radius: 0.65, tube: 0.14, radialSegments: 16, tubularSegments: 36, arc: Math.PI * 1.35 },
        material: { color: '#1e3a5f', roughness: 0.32, metalness: 0.08 }
      }
    ],
    qualityScore: 96,
    detectedFeatures: [
      'Diámetro de boca: Ø 85 mm',
      'Capacidad volumétrica: 350 ml',
      'Asa ergonómica de empalme tangencial'
    ],
    createdAt: new Date().toISOString(),
    source: 'sample-preset',
    photosCount: 6,
  }
];
