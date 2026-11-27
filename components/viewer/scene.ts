// The 3D view's scene, in the browser only: ModelViewer imports this module (and three with it) lazily, once the page runs, so a page
// without a model never loads it. A 3MF from OpenSCAD or a slicer is Z-up and in millimetres; it is turned Y-up, set on the ground and
// framed by its bounding sphere, so its units don't matter. Each mesh is tagged with its part of the version's facts and coloured by its
// filament (parts.ts); a part the facts give no colour keeps the loader's (basematerials, colorgroups), else a neutral light grey. Nothing here needs eval, a worker or a blob: URL, so the page's CSP
// has nothing to allow.
import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Sphere,
  Spherical,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import type { Facts } from "@/backend/client";
import { tagParts, type PartMesh } from "./parts";

export interface View {
  /** Back to the camera the view opened with. */
  reset(): void;
  /** Turn the turntable on or off (off for good once the visitor has moved the view, or once it has made its partial turn). */
  setAutoRotate(on: boolean): void;
  /** Handle a key on the focused view: arrows turn it, + and − zoom. True if the key was the view's. */
  key(key: string): boolean;
  dispose(): void;
}

const FOV = 30;
/**
 * The turntable: about 45 degrees in 4.5 seconds, then still. It starts by itself, so it must stop by itself within 5 seconds (WCAG
 * 2.2.2). OrbitControls' speed s turns 6·s degrees a second when given the frame's time.
 */
const TURNTABLE_SPEED = 1.65;
export const TURNTABLE_SECONDS = 4.5;
/** A download that receives nothing for this long is given up, so the view shows its error instead of loading forever. */
export const STALL_MS = 30_000;
const KEY_TURN = Math.PI / 12;

/**
 * The 3MF's bytes, reporting how much has arrived (0..1, or null while the size is unknown). Throws when `signal` aborts, and when nothing
 * arrives (no answer, or no next chunk) for `stallMs`.
 */
export async function fetchModel(src: string, signal: AbortSignal, onProgress: (share: number | null) => void, stallMs = STALL_MS): Promise<ArrayBuffer> {
  const stop = new AbortController();
  const onAbort = () => stop.abort(signal.reason);
  signal.addEventListener("abort", onAbort);
  if (signal.aborted) onAbort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => stop.abort(new Error("3MF download stalled")), stallMs);
  };
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  try {
    arm();
    const res = await fetch(src, { signal: stop.signal });
    if (!res.ok || !res.body) throw new Error(`3MF answered ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const reader = res.body.getReader();
    for (;;) {
      arm();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(total ? Math.min(loaded / total, 1) : null);
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes.buffer;
}

/** The 3MF as three objects, its meshes tagged with the facts' parts (parts.ts), turned Y-up; throws if it is no 3MF or holds no mesh. */
function parse(data: ArrayBuffer, facts: Facts): { model: Object3D; parts: PartMesh[] } {
  const model = new ThreeMFLoader().parse(data);
  if (!model) throw new Error("3MF holds no mesh");
  const parts = tagParts(model, facts);
  let meshes = 0;
  model.traverse((o) => void (o instanceof Mesh && meshes++));
  if (meshes === 0) throw new Error("3MF holds no mesh");
  model.rotation.x = -Math.PI / 2;
  return { model, parts };
}

/** Opens the view in `mount` (a canvas filling it): the model on a soft ground shadow, framed, turnable by touch, mouse and keyboard. */
export interface ViewOptions {
  /** Whether the turntable starts (not for a visitor who turned motion off). */
  autoRotate: boolean;
  onFirstFrame: () => void;
  /** The turntable started or stopped. */
  onRotating: (on: boolean) => void;
  /** Drawing failed (the loop is stopped). */
  onError: (error: unknown) => void;
}

export function openView(mount: HTMLElement, data: ArrayBuffer, facts: Facts, options: ViewOptions): View {
  const { model } = parse(data, facts);
  const scene = new Scene();

  // On the ground (y = 0), centred over the origin.
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model);
  const centre = box.getCenter(new Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  model.updateMatrixWorld(true);
  const sphere = new Box3().setFromObject(model).getBoundingSphere(new Sphere());
  const r = Math.max(sphere.radius, 1e-3);
  scene.add(model);

  scene.add(new HemisphereLight(0xffffff, 0xb4b9c2, 1.5));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.copy(sphere.center).add(new Vector3(-r * 1.4, r * 4, r * 1.2));
  sun.target.position.copy(sphere.center);
  sun.castShadow = true;
  // Wider than the ground (±3r, below): where the shadow camera ends, VSM darkens the ground a little, which shows as a faint line across
  // the view when that end lies on the ground. Seen slanted from the sun, ±4r covers more than ±3r on the ground.
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 16;
  Object.assign(sun.shadow.camera, { left: -r * 4, right: r * 4, top: r * 4, bottom: -r * 4, near: r * 0.1, far: r * 10 });
  scene.add(sun, sun.target);
  const fill = new DirectionalLight(0xffffff, 0.6);
  fill.position.copy(sphere.center).add(new Vector3(r * 2, r, -r * 1.5));
  scene.add(fill);

  // Only where a shadow can fall: the ShadowMaterial draws nothing elsewhere, and its edge must stay inside the shadow camera (above).
  const ground = new Mesh(new PlaneGeometry(r * 6, r * 6), new ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  // VSM, so the shadow's edge can be blurred (shadow.radius): a soft shadow, not a hard cut-out.
  renderer.shadowMap.type = VSMShadowMap;
  // Only the camera ever moves: the shadow is drawn once, not every frame.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  mount.appendChild(canvas);

  // Framed from the front, a little from the right and above; far enough that the sphere fits the narrower of the two angles with room
  // around it (and the reset button clear of it). The sun is front-left, so the shadow falls back-right, where the camera sees it.
  const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1) || 1;
  const camera = new PerspectiveCamera(FOV, aspect, r / 100, r * 100);
  const vertical = (FOV * Math.PI) / 360;
  const half = Math.min(vertical, Math.atan(Math.tan(vertical) * aspect));
  const distance = (r / Math.sin(half)) * 1.4;
  camera.position.copy(sphere.center).add(new Vector3(0.8, 0.65, 1.4).normalize().multiplyScalar(distance));

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(sphere.center);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = r * 1.2;
  controls.maxDistance = distance * 3;
  controls.autoRotate = options.autoRotate;
  controls.autoRotateSpeed = TURNTABLE_SPEED;
  controls.update(0);
  controls.saveState();

  let moved = false;
  let dirty = true;
  let first = true;
  let spun = 0;
  let last: number | undefined;
  const rotate = (on: boolean) => {
    if (controls.autoRotate === on) return;
    controls.autoRotate = on;
    options.onRotating(on);
  };
  const takeOver = () => {
    moved = true;
    rotate(false);
  };
  controls.addEventListener("change", () => (dirty = true));
  controls.addEventListener("start", takeOver);

  const resize = () => {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    dirty = true;
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(mount);

  // Drawn only when something moved: a still view costs the phone nothing but the frame callback. The turntable goes by the clock, not
  // by frames, so a slow phone turns as far in the same time.
  renderer.setAnimationLoop((time) => {
    try {
      const dt = last === undefined ? 0 : (time - last) / 1000;
      last = time;
      if (controls.autoRotate) {
        spun += dt;
        if (spun >= TURNTABLE_SECONDS) rotate(false);
      }
      controls.update(dt);
      if (!dirty) return;
      dirty = false;
      renderer.render(scene, camera);
      if (first) {
        first = false;
        options.onFirstFrame();
      }
    } catch (e) {
      renderer.setAnimationLoop(null);
      options.onError(e);
    }
  });
  if (controls.autoRotate) options.onRotating(true);

  return {
    reset() {
      // Damping would carry the last drag on past the reset: settle it first.
      controls.enableDamping = false;
      controls.update();
      controls.reset();
      controls.enableDamping = true;
      dirty = true;
    },
    setAutoRotate(on) {
      rotate(on && !moved && spun < TURNTABLE_SECONDS);
    },
    key(key) {
      const turn = { ArrowLeft: [-KEY_TURN, 0, 1], ArrowRight: [KEY_TURN, 0, 1], ArrowUp: [0, -KEY_TURN, 1], ArrowDown: [0, KEY_TURN, 1] } as const;
      const zoom: Record<string, number> = { "+": 0.85, "=": 0.85, "-": 1 / 0.85, "−": 1 / 0.85 };
      const [dTheta, dPhi, scale] = key in turn ? turn[key as keyof typeof turn] : key in zoom ? [0, 0, zoom[key]!] : [];
      if (scale === undefined) return false;
      const s = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      s.theta += dTheta;
      s.phi = Math.min(Math.max(s.phi + dPhi, 0.05), Math.PI - 0.05);
      s.radius = Math.min(Math.max(s.radius * scale, controls.minDistance), controls.maxDistance);
      camera.position.copy(controls.target).add(new Vector3().setFromSpherical(s));
      takeOver();
      controls.update();
      dirty = true;
      return true;
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        for (const m of [o.material].flat() as Material[]) {
          (m as Material & { map?: Texture | null }).map?.dispose();
          m.dispose();
        }
      });
      renderer.dispose();
      // Browsers keep only a few WebGL contexts: give this one back now, not when it is collected.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
