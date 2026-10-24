import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// High limit for base64 camera image uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// 3D Reconstruction API
app.post('/api/reconstruct-3d', async (req, res) => {
  try {
    const { images, objectHint, scanCategory = 'general' } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'No se recibieron fotos para la reconstrucción 3D' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        fallback: true,
        message: 'No se detectó GEMINI_API_KEY en el entorno. Se usará el motor fotogramétrico local.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Prepare multimodal parts from photos (limit to max 6 best photos for prompt context speed)
    const processedImages: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    for (const imgObj of (images as Array<{ dataUrl: string; angleLabel?: string }>).slice(0, 6)) {
      const dataUrl = imgObj?.dataUrl || '';
      const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        processedImages.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    }

    if (processedImages.length === 0) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const categoryDirectives = {
      pieza_3d: 'Enfócate en geometría de ingeniería mecánica precisa (biseles, chaflanes, orificios de montaje, espesor de pared y dimensiones en milímetros aptas para impresión 3D / CAD).',
      hoyo: 'ES UN HOYO / CAVIDAD / ORIFICIO / MOLDE CÓNCAVO. Modela la cavidad hueca interior, el borde de la boca exterior, calcula el diámetro del orificio (Ø en mm), la profundidad interna hasta el fondo (en mm) y el volumen de llenado en cm³.',
      aparato: 'ES UN APARATO / DISPOSITIVO ELECTRÓNICO / GADGET. Modela el chasis unibody exterior, panel de pantalla o interfaz, botoneras táctiles, ranuras o puertos laterales.',
      general: 'Modela el objeto combinando silueta primaria, secundaria y acentos PBR.'
    }[scanCategory as 'pieza_3d' | 'hoyo' | 'aparato' | 'general'] || '';

    const promptText = `
Eres un ingeniero experto en fotogrametría 3D computacional, metrología óptica y gráficos tridimensionales en Three.js.
Analiza detenidamente la(s) foto(s) capturada(s) con la cámara del teléfono.

Pistas del usuario: "${objectHint || 'Objeto capturado con cámara'}".
Categoría seleccionada: "${scanCategory}".
${categoryDirectives}

Tu objetivo es descomponer este objeto o cavidad en una representación 3D paramétrica precisa, estéticamente fiel y con MEDICIÓN MÉTRICA ESTIMADA REAL (ancho, alto, profundidad en cm y milímetros exactos).

REGLAS DE RECONSTRUCCIÓN 3D:
1. NUNCA representes el objeto con una sola primitiva básica genérica. Descompónlo en 4 a 12 partes jerárquicas:
   - Silueta primaria (cuerpo central, tronco, carcasa, base principal).
   - Silueta secundaria (asas, cuellos, bordes, tapas, suelas, patas, perillas, aberturas).
   - Detalles de acento (rebordes, biseles, botones, ranuras, reflectores, texturas).
2. Si es una CAVIDAD / HOYO ('hoyo'):
   - Modela la masa exterior y la cavidad cilíndrica/cónica interna ('shapeType': 'lathe' o 'cylinder' con hollow interior).
   - Estima el diámetro de la boca ('diameterMm') y la profundidad hasta el fondo ('internalDepthMm').
3. Si es una PIEZA 3D ('pieza_3d'):
   - Calcula volumen de material para impresión 3D ('volumeCm3') y peso aproximado en filamento PLA/PETG ('filamentWeightGrams').
4. Ajusta materiales PBR con colorimetría real extraída de las fotografías (rugosidad, metalicidad, color dominante).
5. Genera entre 60 y 140 muestras de nube de puntos superficial [x, y, z, hexColor].

Devuelve EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "name": "Nombre descriptivo en español (ej. Soporte de Montaje Mecánico 3D / Cavidad Cilíndrica)",
  "category": "${scanCategory}",
  "scanCategory": "${scanCategory}",
  "description": "Descripción física detallada y métricas estimadas",
  "dimensions": { "width": 12, "height": 8.5, "depth": 10 },
  "measurements": {
    "widthMm": 120,
    "heightMm": 85,
    "depthMm": 100,
    "diameterMm": 75,
    "internalDepthMm": 60,
    "volumeCm3": 210,
    "wallThicknessMm": 3.2,
    "filamentWeightGrams": 42
  },
  "materialStyle": {
    "dominantColor": "#2b3a4a",
    "accentColor": "#e0a843",
    "secondaryColor": "#ffffff",
    "metalness": 0.1,
    "roughness": 0.35,
    "surfaceFinish": "matte"
  },
  "components": [
    {
      "name": "cuerpo_principal",
      "shapeType": "cylinder",
      "position": [0, 0.4, 0],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1],
      "parameters": { "radiusTop": 1.2, "radiusBottom": 1.2, "height": 0.8, "radialSegments": 32 },
      "material": { "color": "#2b3a4a", "roughness": 0.35, "metalness": 0.1 }
    }
  ],
  "pointCloudSamples": [
    [0.5, 0.8, 0.4, "#2b3a4a"]
  ],
  "qualityScore": 95,
  "detectedFeatures": ["Medición calibrada por lente", "Diámetro de cavidad detectado", "Superficie optimizada para impresión"]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            ...processedImages,
            { text: promptText },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedResult;
    try {
      parsedResult = JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        throw new Error('No se pudo decodificar el formato JSON de Gemini');
      }
    }

    return res.json({
      success: true,
      model3d: parsedResult,
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Error en /api/reconstruct-3d:', error);
    // Return graceful fallback indication so frontend seamlessly switches to client-side reconstruction
    return res.status(200).json({
      fallback: true,
      message: error?.message || 'Error en análisis con Gemini. Se activará el motor de reconstrucción local.',
    });
  }
});

async function main() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scan3D Studio server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
