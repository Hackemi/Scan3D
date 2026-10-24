import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Model3DData,
  RenderMode,
  EnvironmentPreset,
} from '../types';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  FileCode,
  Box,
  RotateCcw,
  Sliders,
  Check,
  X,
  Loader2,
  Sparkles,
  Printer,
  Layers,
  CheckCircle2,
  ArrowDownToLine,
} from 'lucide-react';
import { exportToOBJ, exportToSTL, exportToPLY, exportToJSON } from '../utils/exporters';
import { soundEffects } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';

interface Viewport3DProps {
  modelData: Model3DData;
  onRetake: () => void;
  onOpenInspector: () => void;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  modelData,
  onRetake,
  onOpenInspector,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const pointCloudMeshRef = useRef<THREE.Points | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);

  const [controlsCollapsed, setControlsCollapsed] = useState<boolean>(false);
  const [renderMode, setRenderMode] = useState<RenderMode>('textured');
  const [envPreset, setEnvPreset] = useState<EnvironmentPreset>('studio');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [explodedFactor, setExplodedFactor] = useState<number>(0);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [sharedToast, setSharedToast] = useState<boolean>(false);

  // Export Menu and Loading State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportingFormat, setExportingFormat] = useState<'obj' | 'stl' | 'ply' | 'json' | null>(null);
  const [exportProgress, setExportProgress] = useState<number>(0);
  const [exportStepMessage, setExportStepMessage] = useState<string>('');
  const [exportComplete, setExportComplete] = useState<boolean>(false);
  const [exportedFileName, setExportedFileName] = useState<string>('');

  const originalPositionsRef = useRef<Map<THREE.Object3D, THREE.Vector3>>(new Map());

  // Software WebGL detection
  const isSoftwareGl = useRef<boolean>(
    (() => {
      if (typeof document === 'undefined') return false;
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })()
  ).current;

  // Initialize Scene, Renderer, Lights, and Camera
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x09090b);
    scene.fog = new THREE.FogExp2(0x09090b, 0.05);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.2, 2.8, 4.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 15;
    controls.target.set(0, 1.1, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;

    // 3-Point Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.2);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x18181b, 1.2);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    rimLight.position.set(-4, 3, -4);
    scene.add(rimLight);

    // Ground Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x121217,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = !isSoftwareGl;
    scene.add(floor);

    // Soft Radial Shadow
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 4.5),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // Grid Floor
    const grid = new THREE.GridHelper(16, 32, 0x38bdf8, 0x27272a);
    grid.position.y = 0.005;
    scene.add(grid);

    // Animation Render Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controls.autoRotate) {
        controls.update();
      } else if (controls.enableDamping) {
        controls.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build Procedural 3D Mesh Group from Model Data
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      modelGroupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
    }

    if (pointCloudMeshRef.current) {
      scene.remove(pointCloudMeshRef.current);
      pointCloudMeshRef.current.geometry.dispose();
      (pointCloudMeshRef.current.material as THREE.Material).dispose();
      pointCloudMeshRef.current = null;
    }

    if (boxHelperRef.current) {
      scene.remove(boxHelperRef.current);
      boxHelperRef.current.dispose();
      boxHelperRef.current = null;
    }

    originalPositionsRef.current.clear();

    const mainGroup = new THREE.Group();
    mainGroup.name = 'ModelRoot';

    modelData.components.forEach((comp) => {
      let geo: THREE.BufferGeometry | null = null;
      const p = comp.parameters || {};

      switch (comp.shapeType) {
        case 'lathe': {
          if (comp.lathePoints && comp.lathePoints.length > 2) {
            const v2Points = comp.lathePoints.map(([r, y]) => new THREE.Vector2(r, y));
            geo = new THREE.LatheGeometry(v2Points, 48);
          } else {
            geo = new THREE.CylinderGeometry(1.0, 0.8, 2.5, 36);
          }
          break;
        }
        case 'cylinder': {
          geo = new THREE.CylinderGeometry(
            p.radiusTop ?? 1,
            p.radiusBottom ?? 1,
            p.height ?? 1.5,
            p.radialSegments ?? 32
          );
          break;
        }
        case 'box': {
          geo = new THREE.BoxGeometry(
            p.width ?? 1.5,
            p.height ?? 1.5,
            p.depth ?? 1.5
          );
          break;
        }
        case 'sphere': {
          geo = new THREE.SphereGeometry(
            p.radius ?? 1,
            p.radialSegments ?? 32,
            p.radialSegments ?? 32
          );
          break;
        }
        case 'torus': {
          geo = new THREE.TorusGeometry(
            p.radius ?? 0.8,
            p.tube ?? 0.15,
            p.radialSegments ?? 16,
            p.tubularSegments ?? 36,
            p.arc ?? Math.PI * 2
          );
          break;
        }
        case 'cone': {
          geo = new THREE.ConeGeometry(
            p.radiusTop ?? 0,
            p.height ?? 1.5,
            p.radialSegments ?? 32
          );
          break;
        }
        default: {
          geo = new THREE.BoxGeometry(1, 1, 1);
        }
      }

      if (!geo) return;

      const mat = createMaterialForMode(comp.material, renderMode);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = comp.name;
      mesh.position.set(...comp.position);
      mesh.rotation.set(...comp.rotation);
      mesh.scale.set(...comp.scale);
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;

      originalPositionsRef.current.set(mesh, mesh.position.clone());
      mainGroup.add(mesh);
    });

    const bbox = new THREE.Box3().setFromObject(mainGroup);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const minY = bbox.min.y;
    if (minY < 0 || minY > 0.1) {
      mainGroup.position.y -= minY;
    }

    scene.add(mainGroup);
    modelGroupRef.current = mainGroup;

    // Point Cloud
    const pointsList = modelData.pointCloudSamples || [];
    if (pointsList.length > 0) {
      const pGeo = new THREE.BufferGeometry();
      const posArray = new Float32Array(pointsList.length * 3);
      const colorArray = new Float32Array(pointsList.length * 3);

      pointsList.forEach(([px, py, pz, pColor], i) => {
        posArray[i * 3] = px;
        posArray[i * 3 + 1] = py - minY;
        posArray[i * 3 + 2] = pz;

        const c = new THREE.Color(pColor || '#38bdf8');
        colorArray[i * 3] = c.r;
        colorArray[i * 3 + 1] = c.g;
        colorArray[i * 3 + 2] = c.b;
      });

      pGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      pGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

      const pMat = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: renderMode === 'pointcloud' ? 0.95 : 0.0,
      });

      const pMesh = new THREE.Points(pGeo, pMat);
      scene.add(pMesh);
      pointCloudMeshRef.current = pMesh;
    }

    const helper = new THREE.BoxHelper(mainGroup, 0x06b6d4);
    helper.visible = showDimensions;
    scene.add(helper);
    boxHelperRef.current = helper;

    if (controlsRef.current) {
      controlsRef.current.target.set(0, size.y / 2, 0);
    }
  }, [modelData, isSoftwareGl]);

  // Update materials on renderMode change
  useEffect(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.children.forEach((child, idx) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const comp = modelData.components[idx];
        if (comp) {
          mesh.material = createMaterialForMode(comp.material, renderMode);
          mesh.visible = renderMode !== 'pointcloud';
        }
      }
    });

    if (pointCloudMeshRef.current) {
      const pMat = pointCloudMeshRef.current.material as THREE.PointsMaterial;
      pMat.opacity = renderMode === 'pointcloud' ? 0.95 : 0.0;
      pMat.size = renderMode === 'pointcloud' ? 0.09 : 0.01;
    }
  }, [renderMode, modelData]);

  // Exploded View
  useEffect(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.children.forEach((child) => {
      const orig = originalPositionsRef.current.get(child);
      if (orig) {
        const dir = orig.clone().normalize();
        child.position.x = orig.x + dir.x * explodedFactor * 1.8;
        child.position.y = orig.y + (dir.y >= 0 ? 1 : -0.5) * explodedFactor * 1.2;
        child.position.z = orig.z + dir.z * explodedFactor * 1.8;
      }
    });

    if (boxHelperRef.current) {
      boxHelperRef.current.update();
    }
  }, [explodedFactor]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
    }
  }, [autoRotate]);

  useEffect(() => {
    if (boxHelperRef.current) {
      boxHelperRef.current.visible = showDimensions;
    }
  }, [showDimensions]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    switch (envPreset) {
      case 'studio':
        scene.background = new THREE.Color(0x09090b);
        scene.fog = new THREE.FogExp2(0x09090b, 0.05);
        break;
      case 'cyber':
        scene.background = new THREE.Color(0x030712);
        scene.fog = new THREE.FogExp2(0x030712, 0.06);
        break;
      case 'warm':
        scene.background = new THREE.Color(0x1c1917);
        scene.fog = new THREE.FogExp2(0x1c1917, 0.05);
        break;
      case 'dark':
        scene.background = new THREE.Color(0x000000);
        scene.fog = new THREE.FogExp2(0x000000, 0.07);
        break;
    }
  }, [envPreset]);

  // Native Phone Share API
  const handleNativeShare = async () => {
    triggerHaptic('medium');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Modelo 3D: ${modelData.name}`,
          text: `Mira el modelo 3D que escaneé con la cámara de mi teléfono en Scan3D.`,
          url: window.location.href,
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      // Fallback: copy link
      navigator.clipboard.writeText(window.location.href);
      setSharedToast(true);
      setTimeout(() => setSharedToast(false), 2000);
    }
  };

  const handleTakeSnapshot = () => {
    triggerHaptic('shutter');
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `${modelData.name.toLowerCase().replace(/\s+/g, '_')}_3d.png`;
    link.href = dataUrl;
    link.click();
    soundEffects.playSuccess();
  };

  const handleStartExport = async (format: 'obj' | 'stl' | 'ply' | 'json') => {
    triggerHaptic('medium');
    setExportingFormat(format);
    setExportComplete(false);
    setExportProgress(12);
    setExportStepMessage('Analizando geometría y búfer de vértices...');
    soundEffects.playBlip();

    const safeName = modelData.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const ext = format.toUpperCase();
    const fileName = format === 'ply' ? `${safeName}_pointcloud.ply` : `${safeName}.${format}`;
    setExportedFileName(fileName);

    // Step 1: Geometry & vertex buffers
    await new Promise((r) => setTimeout(r, 450));
    setExportProgress(45);
    setExportStepMessage(
      format === 'ply'
        ? 'Muestreando nube de puntos 4K y coordenadas RGB...'
        : format === 'stl'
        ? 'Facetando polígonos y calculando normales de cara...'
        : 'Estructurando grupos de componentes, UVs y normales...'
    );

    // Step 2: Mesh formatting
    await new Promise((r) => setTimeout(r, 500));
    setExportProgress(82);
    setExportStepMessage(`Generando archivo binario .${ext} compatible...`);

    // Step 3: Trigger download
    await new Promise((r) => setTimeout(r, 400));
    setExportProgress(100);
    setExportStepMessage(`¡Archivo .${ext} compilado con éxito!`);

    try {
      if (format === 'obj' && modelGroupRef.current) {
        exportToOBJ(modelGroupRef.current, modelData.name);
      } else if (format === 'stl' && modelGroupRef.current) {
        exportToSTL(modelGroupRef.current, modelData.name);
      } else if (format === 'ply') {
        exportToPLY(
          modelData.pointCloudSamples || [],
          modelData.name,
          modelGroupRef.current || undefined
        );
      } else if (format === 'json') {
        exportToJSON(modelData);
      }
    } catch (err) {
      console.error('Export error:', err);
    }

    setExportComplete(true);
    soundEffects.playSuccess();
    triggerHaptic('success');
  };

  function createMaterialForMode(compMat: any, mode: RenderMode): THREE.Material {
    switch (mode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
      case 'normals':
        return new THREE.MeshNormalMaterial({ wireframe: false });
      case 'clay':
        return new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.85, metalness: 0.05 });
      case 'textured':
      default:
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(compMat.color || '#38bdf8'),
          roughness: compMat.roughness ?? 0.35,
          metalness: compMat.metalness ?? 0.1,
          transparent: Boolean(compMat.transparent),
          opacity: compMat.opacity ?? 1.0,
        });
    }
  }

  return (
    <div className="relative w-full h-full bg-zinc-950 overflow-hidden select-none touch-none">
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Mobile App Header */}
      <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-auto">
        <button
          onClick={() => {
            triggerHaptic('medium');
            onRetake();
          }}
          className="px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-white text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-1.5 active:scale-95"
        >
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span>Cámara</span>
        </button>

        <div className="bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700/80 shadow-lg flex items-center gap-2 max-w-[50%]">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-white truncate">{modelData.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Menú Exportar Modelo */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              setShowExportModal(true);
            }}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
            title="Abrir Menú de Exportación (.OBJ, .STL, .PLY)"
          >
            <Download className="w-3.5 h-3.5 text-zinc-950" />
            <span className="hidden xs:inline">Exportar</span>
            <span className="hidden md:inline">Modelo</span>
          </button>

          <button
            onClick={handleNativeShare}
            className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-white backdrop-blur-md shadow-lg active:scale-95"
            title="Compartir"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
          </button>

          <button
            onClick={onOpenInspector}
            className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:text-white backdrop-blur-md shadow-lg active:scale-95"
            title="Ficha Técnica"
          >
            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Copied toast */}
      {sharedToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <Check className="w-3.5 h-3.5" />
          <span>Enlace copiado</span>
        </div>
      )}

      {/* Floating Measurement Overlay Badge */}
      {showDimensions && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-zinc-950/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-cyan-500/50 shadow-2xl flex items-center gap-3 text-xs pointer-events-auto">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-mono uppercase text-cyan-400 font-bold">Cotas Métricas (X × Y × Z)</span>
            <span className="font-mono font-bold text-white text-xs">
              {modelData.measurements?.widthMm || Math.round(modelData.dimensions.width * 10)} ×{' '}
              {modelData.measurements?.heightMm || Math.round(modelData.dimensions.height * 10)} ×{' '}
              {modelData.measurements?.depthMm || Math.round(modelData.dimensions.depth * 10)} mm
            </span>
          </div>

          {modelData.measurements?.diameterMm && (
            <div className="border-l border-zinc-800 pl-2.5 flex flex-col items-center">
              <span className="text-[9px] font-mono text-emerald-400 font-bold">Diámetro</span>
              <span className="font-mono font-bold text-emerald-300 text-xs">
                Ø {modelData.measurements.diameterMm} mm
              </span>
            </div>
          )}

          {modelData.measurements?.internalDepthMm && (
            <div className="border-l border-zinc-800 pl-2.5 flex flex-col items-center">
              <span className="text-[9px] font-mono text-amber-400 font-bold">Profundidad</span>
              <span className="font-mono font-bold text-amber-300 text-xs">
                {modelData.measurements.internalDepthMm} mm
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mobile Bottom Dock (Collapsible) */}
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 transition-all duration-300 pointer-events-auto ${
          controlsCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
        }`}
        style={{ width: 'min(540px, 94vw)' }}
      >
        {/* Toggle pill */}
        <div className="flex justify-center -mb-px">
          <button
            onClick={() => {
              triggerHaptic('light');
              setControlsCollapsed((prev) => !prev);
            }}
            className="bg-zinc-900/95 text-zinc-300 hover:text-white px-3.5 py-1 rounded-t-xl border-t border-x border-zinc-700 text-[10px] font-semibold backdrop-blur-md shadow flex items-center gap-1"
          >
            {controlsCollapsed ? (
              <>
                <ChevronUp className="w-3 h-3 text-cyan-400" />
                <span>Controles</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
                <span>Ocultar</span>
              </>
            )}
          </button>
        </div>

        {/* Dock Card */}
        <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-3 shadow-2xl space-y-2.5">
          {/* Mode pills */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {[
              { id: 'textured', label: 'PBR' },
              { id: 'wireframe', label: 'Malla' },
              { id: 'pointcloud', label: 'Puntos' },
              { id: 'normals', label: 'Normales' },
              { id: 'clay', label: 'Arcilla' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  triggerHaptic('light');
                  setRenderMode(mode.id as RenderMode);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  renderMode === mode.id
                    ? 'bg-cyan-500 text-zinc-950 shadow-sm'
                    : 'bg-zinc-950/70 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode.label}
              </button>
            ))}

            <button
              onClick={() => {
                triggerHaptic('light');
                setShowDimensions((v) => !v);
              }}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                showDimensions
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
              title="Mostrar Medidas y Cotas Métricas"
            >
              <Box className="w-3.5 h-3.5" />
              <span className="text-[10px] font-semibold">Medidas</span>
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                setAutoRotate((v) => !v);
              }}
              className={`p-1.5 rounded-lg border text-xs ${
                autoRotate
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
              title="Giro 360°"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Slider & Quick actions */}
          <div className="flex items-center gap-3 text-xs pt-1 border-t border-zinc-800">
            <div className="flex items-center gap-2 flex-1">
              <Sliders className="w-3 h-3 text-cyan-400 shrink-0" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={explodedFactor}
                onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-zinc-400 w-7">
                {Math.round(explodedFactor * 100)}%
              </span>
            </div>

            {/* Quick Export & Snapshot buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowExportModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 active:scale-95 transition-all shadow cursor-pointer"
                title="Abrir Menú de Exportación"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exportar</span>
              </button>

              <button
                onClick={handleTakeSnapshot}
                className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white active:scale-95 transition-all cursor-pointer"
                title="Captura PNG"
              >
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal / Menú de Exportar Modelo */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/25">
                  <Download className="w-4 h-4 text-zinc-950" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    Exportar Modelo 3D
                  </h3>
                  <p className="text-[10px] text-zinc-400 truncate max-w-[220px]">
                    {modelData.name} ({modelData.components.length} componentes)
                  </p>
                </div>
              </div>
              {!exportingFormat && (
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content: Either Loading State Animation or Format List */}
            {exportingFormat ? (
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                {/* 3D Geometric Loading Animation Icon */}
                <div className="relative w-20 h-20 flex items-center justify-center my-1">
                  <div className={`absolute inset-0 rounded-2xl ${exportComplete ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-cyan-500/10 border border-cyan-500/30'} animate-pulse`} />
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      exportComplete
                        ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 scale-105 shadow-lg shadow-emerald-500/25'
                        : 'bg-zinc-900 border-2 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                    }`}
                  >
                    {exportComplete ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-in zoom-in-50 duration-300" />
                    ) : (
                      <div className="relative flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 absolute" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress text & title */}
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {exportComplete ? '¡Archivo Generado con Éxito!' : `Generando archivo .${exportingFormat.toUpperCase()}...`}
                  </h4>
                  <p className="text-xs text-zinc-400 font-mono min-h-[20px] transition-all">
                    {exportStepMessage}
                  </p>
                </div>

                {/* Animated Progress Bar */}
                <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      exportComplete
                        ? 'bg-emerald-400'
                        : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500'
                    }`}
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>

                {/* Format specs indicator */}
                <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1 pt-1">
                  <span>Progreso: {exportProgress}%</span>
                  <span className="text-cyan-400 font-bold">{exportedFileName}</span>
                </div>

                {/* Actions when complete */}
                {exportComplete && (
                  <div className="pt-2 flex gap-2 w-full animate-in fade-in duration-200">
                    <button
                      onClick={() => {
                        setExportingFormat(null);
                        setExportComplete(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Exportar en otro formato
                    </button>
                    <button
                      onClick={() => {
                        setShowExportModal(false);
                        setExportingFormat(null);
                        setExportComplete(false);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-600/30"
                    >
                      Listo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-2.5 max-h-[75vh] overflow-y-auto">
                <p className="text-xs text-zinc-400 px-1 mb-1">
                  Selecciona el formato deseado para descargar tu modelo escaneado:
                </p>

                {/* Format 1: .OBJ */}
                <div
                  onClick={() => handleStartExport('obj')}
                  className="p-3.5 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-cyan-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-cyan-300">
                          Wavefront 3D (.OBJ)
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                          Malla Poligonal
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                        Incluye vértices, normales suavizadas y coordenadas UV. Compatible con Blender, Maya, Unity y Unreal Engine.
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-xl bg-zinc-800 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-zinc-950 transition-colors shrink-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </button>
                </div>

                {/* Format 2: .STL */}
                <div
                  onClick={() => handleStartExport('stl')}
                  className="p-3.5 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                          Estereolitografía (.STL)
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Impresión 3D
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                        Malla facetada estanca (manifold). Lista para laminar en Cura, PrusaSlicer, Bambu Studio u OrcaSlicer.
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-xl bg-zinc-800 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors shrink-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </button>
                </div>

                {/* Format 3: .PLY */}
                <div
                  onClick={() => handleStartExport('ply')}
                  className="p-3.5 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-amber-300">
                          Nube de Puntos (.PLY)
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                          RGB Fotogrametría 4K
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                        Nube densa de puntos con coordenadas de color RGB real capturadas en fotogrametría. Compatible con CloudCompare y MeshLab.
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-xl bg-zinc-800 text-amber-400 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors shrink-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </button>
                </div>

                {/* Format 4: .JSON (Bonus) */}
                <div
                  onClick={() => handleStartExport('json')}
                  className="p-3.5 rounded-2xl bg-zinc-950/70 hover:bg-zinc-800/80 border border-zinc-800 hover:border-indigo-500/50 flex items-center justify-between gap-3 cursor-pointer transition-all group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                      <FileCode className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white group-hover:text-indigo-300">
                          Ficha Técnica y Cotas (.JSON)
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                          Metadatos
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">
                        Medidas en mm, tolerancias métricas, volumen en cm³, peso estimado en filamento y propiedades de superficie.
                      </p>
                    </div>
                  </div>
                  <button className="p-2 rounded-xl bg-zinc-800 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-zinc-950 transition-colors shrink-0">
                    <ArrowDownToLine className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 px-4">
              <span className="flex items-center gap-1.5 font-mono">
                <Box className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {modelData.measurements?.widthMm || Math.round(modelData.dimensions.width * 10)}×
                  {modelData.measurements?.heightMm || Math.round(modelData.dimensions.height * 10)}×
                  {modelData.measurements?.depthMm || Math.round(modelData.dimensions.depth * 10)} mm
                </span>
              </span>
              <button
                onClick={() => {
                  setShowExportModal(false);
                  setExportingFormat(null);
                  setExportComplete(false);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
