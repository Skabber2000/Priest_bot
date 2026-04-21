import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { Viseme } from "../hooks/useVisemeTrack";
import { VISEME_BLENDSHAPES, resolveBlendshapeName } from "../lib/arkit";

const BASE = import.meta.env.BASE_URL;
const MODEL_URL = `${BASE}models/facecap.glb`;
const BACKGROUND_URL = `${BASE}visemes/rest.jpg`;

/** How fast the current blendshape weights lerp toward the target (per-second coefficient). */
const BLEND_LERP_PER_SEC = 22;

interface AvatarStage3DProps {
  viseme: Viseme;
}

export function AvatarStage3D({ viseme }: AvatarStage3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const visemeRef = useRef<Viseme>(viseme);

  useEffect(() => {
    visemeRef.current = viseme;
  }, [viseme]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ---- Scene, camera, renderer ----
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      28,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.16, 0.55);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // ---- Lighting: cathedral-inspired three-point ----
    const ambient = new THREE.AmbientLight(0x3a2a20, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xe8a465, 1.25); // warm candle key
    key.position.set(-1.2, 1.5, 1.3);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x5a6aa0, 0.6); // cool stained-glass fill
    fill.position.set(1.4, 0.8, 0.9);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x6a2a6a, 0.45); // purple rim from right
    rim.position.set(2.5, 1.2, -1.5);
    scene.add(rim);

    // ---- Load model ----
    let faceMesh: THREE.Mesh | null = null;
    let headPivot: THREE.Group | null = null;
    const currentWeights: Record<string, number> = {};
    const targetWeights: Record<string, number> = {};
    let disposed = false;

    const loader = new GLTFLoader();
    // facecap.glb uses KTX2-compressed textures; configure the transcoder.
    const ktx2 = new KTX2Loader()
      .setTranscoderPath(`${BASE}libs/basis/`)
      .detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        // Wrap in a pivot so we can rotate the "head" around its center
        // without fighting the raw model's transforms.
        headPivot = new THREE.Group();
        headPivot.add(root);
        scene.add(headPivot);

        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            if (
              mesh.morphTargetDictionary &&
              Object.keys(mesh.morphTargetDictionary).length > 0
            ) {
              faceMesh = mesh;
              for (const name of Object.keys(mesh.morphTargetDictionary)) {
                currentWeights[name] = 0;
                targetWeights[name] = 0;
              }
              console.info(
                "[AvatarStage3D] face mesh ready with",
                Object.keys(mesh.morphTargetDictionary).length,
                "blendshapes",
              );
            }
          }
        });

        if (!faceMesh) {
          console.warn("[AvatarStage3D] no morph-target mesh found in GLB");
        }

        // Auto-frame the camera on the head bounding box so we don't have
        // to hard-code numbers for this particular GLB.
        const box = new THREE.Box3().setFromObject(root);
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);

        // Offset the pivot so the face center sits at the origin.
        root.position.sub(center);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.15;
        camera.position.set(0, 0, distance);
        camera.lookAt(0, 0, 0);
      },
      undefined,
      (err) => console.error("[AvatarStage3D] model load failed:", err),
    );

    // ---- Idle timers ----
    let lastBlinkAt = 0;
    let nextBlinkGapMs = 3500 + Math.random() * 3000;
    let blinkPhase = 0; // 0=idle, 1=closing, 2=open
    let blinkStartedAt = 0;
    const BLINK_DURATION_MS = 140;

    // ---- Animation loop ----
    const clock = new THREE.Clock();

    function animate() {
      if (disposed) return;
      requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();

      if (faceMesh && faceMesh.morphTargetDictionary && faceMesh.morphTargetInfluences) {
        const dict = faceMesh.morphTargetDictionary as Record<string, number>;
        const influences = faceMesh.morphTargetInfluences;

        // Reset target weights each frame
        for (const k of Object.keys(targetWeights)) targetWeights[k] = 0;

        // Apply viseme-driven targets
        const blend = VISEME_BLENDSHAPES[visemeRef.current];
        for (const [rawName, weight] of Object.entries(blend)) {
          const resolved = resolveBlendshapeName(rawName, dict);
          if (resolved) targetWeights[resolved] = weight ?? 0;
        }

        // --- Idle layer: subtle breathing on jawOpen ---
        const breathe = (Math.sin(now * 0.00055) + 1) * 0.5 * 0.015;
        const jawKey = resolveBlendshapeName("jawOpen", dict);
        if (jawKey) {
          targetWeights[jawKey] = Math.max(
            targetWeights[jawKey] ?? 0,
            (targetWeights[jawKey] ?? 0) + breathe,
          );
        }

        // --- Idle layer: blinks ---
        if (blinkPhase === 0 && now - lastBlinkAt > nextBlinkGapMs) {
          blinkPhase = 1;
          blinkStartedAt = now;
          lastBlinkAt = now;
          nextBlinkGapMs = 3500 + Math.random() * 3500;
        }
        if (blinkPhase === 1) {
          const t = (now - blinkStartedAt) / BLINK_DURATION_MS;
          const amt = t < 0.5 ? t * 2 : (1 - t) * 2; // triangle
          const left = resolveBlendshapeName("eyeBlinkLeft", dict);
          const right = resolveBlendshapeName("eyeBlinkRight", dict);
          if (left) targetWeights[left] = Math.max(targetWeights[left] ?? 0, amt);
          if (right) targetWeights[right] = Math.max(targetWeights[right] ?? 0, amt);
          if (t >= 1) blinkPhase = 0;
        }

        // Lerp current toward target; write influences
        const k = 1 - Math.exp(-BLEND_LERP_PER_SEC * dt);
        for (const [name, idx] of Object.entries(dict)) {
          const tgt = targetWeights[name] ?? 0;
          const cur = currentWeights[name] ?? 0;
          const next = cur + (tgt - cur) * k;
          currentWeights[name] = next;
          influences[idx] = next;
        }
      }

      // Gentle head sway
      if (headPivot) {
        headPivot.rotation.x = Math.sin(now * 0.00035) * 0.015;
        headPivot.rotation.y = Math.sin(now * 0.00027) * 0.02;
      }

      renderer.render(scene, camera);
    }

    animate();

    // ---- Resize ----
    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    // ---- Cleanup ----
    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      renderer.forceContextLoss();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
        }
      });
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-altar">
      {/* Blurred cathedral backdrop, no priest visible, just atmosphere */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${BACKGROUND_URL})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          filter: "blur(14px) brightness(0.55) saturate(0.85)",
          transform: "scale(1.05)",
        }}
      />
      {/* Soft vignette over the backdrop so the 3D head reads as foreground */}
      <div className="vignette" />

      {/* The WebGL canvas — transparent so backdrop shows through */}
      <div
        ref={mountRef}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
      />

      {/* Keep the subtitle scrim for readability */}
      <div className="subtitle-scrim" />
    </div>
  );
}
