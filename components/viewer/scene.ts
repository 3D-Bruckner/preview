// The 3D view's scene, in the browser only: ModelViewer imports this module (and three with it) lazily, once the page runs, so a page
// without a model never loads it. A 3MF from OpenSCAD or a slicer is Z-up and in millimetres; it is turned Y-up, set on the ground and
// framed by its bounding sphere, so its units don't matter. A part keeps the colour the 3MF gives it (basematerials, colorgroups, which
// three's loader reads); a part without one is a neutral light grey. Nothing here needs eval, a worker or a blob: URL, so the page's CSP
// has nothing to allow.
import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  Loader,
  Mesh,
  MeshStandardMaterial,
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
  type MeshPhongMaterial,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";

export interface View {
  /** Back to the camera the view opened with. */
  reset(): void;
  /** Turn the slow turntable on or off (off for good once the visitor has moved the view). */
  setAutoRotate(on: boolean): void;
  /** Handle a key on the focused view: arrows turn it, + and − zoom. True if the key was the view's. */
  key(key: string): boolean;
  dispose(): void;
}

/** The colour of a part the 3MF gives none. */
const GREY = 0xc8ccd2;
const FOV = 30;
/** One turn in about a minute: OrbitControls' speed 2 is a turn in 30 seconds. */
const TURNTABLE = 1;
const KEY_TURN = Math.PI / 12;

/** The 3MF's bytes, reporting how much has arrived (0..1, or null while the size is unknown). */
export async function fetchModel(src: string, signal: AbortSignal, onProgress: (share: number | null) => void): Promise<ArrayBuffer> {
  const res = await fetch(src, { signal });
  if (!res.ok || !res.body) throw new Error(`3MF answered ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(total ? Math.min(loaded / total, 1) : null);
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes.buffer;
}

/** The loader's material as a matte plastic, its colour (or vertex colours, or texture) kept; grey where the 3MF gives no colour. */
function plastic(m: Material): Material {
  if (m instanceof MeshStandardMaterial) return m;
  const from = m as MeshPhongMaterial;
  const out =
    m.name === Loader.DEFAULT_MATERIAL_NAME
      ? new MeshStandardMaterial({ color: GREY, roughness: 0.6, metalness: 0, flatShading: true })
      : new MeshStandardMaterial({
          name: from.name,
          color: from.color,
          map: from.map,
          vertexColors: from.vertexColors,
          transparent: from.transparent,
          opacity: from.opacity,
          roughness: 0.55,
          metalness: 0,
          flatShading: true,
        });
  m.dispose();
  return out;
}

/** The 3MF as three objects, turned Y-up; throws if it is no 3MF or holds no mesh. */
function parse(data: ArrayBuffer): Object3D {
  const model = new ThreeMFLoader().parse(data);
  let meshes = 0;
  model?.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    meshes++;
    o.material = Array.isArray(o.material) ? o.material.map(plastic) : plastic(o.material);
    o.castShadow = true;
  });
  if (!model || meshes === 0) throw new Error("3MF holds no mesh");
  model.rotation.x = -Math.PI / 2;
  return model;
}

/** Opens the view in `mount` (a canvas filling it): the model on a soft ground shadow, framed, turnable by touch, mouse and keyboard. */
export function openView(mount: HTMLElement, data: ArrayBuffer, options: { autoRotate: boolean; onFirstFrame: () => void }): View {
  const model = parse(data);
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
  // Wider than the ground the camera sees: where the shadow camera ends, VSM draws a faint edge.
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 16;
  Object.assign(sun.shadow.camera, { left: -r * 4, right: r * 4, top: r * 4, bottom: -r * 4, near: r * 0.1, far: r * 10 });
  scene.add(sun, sun.target);
  const fill = new DirectionalLight(0xffffff, 0.6);
  fill.position.copy(sphere.center).add(new Vector3(r * 2, r, -r * 1.5));
  scene.add(fill);

  const ground = new Mesh(new PlaneGeometry(r * 10, r * 10), new ShadowMaterial({ opacity: 0.18 }));
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
  controls.autoRotateSpeed = TURNTABLE;
  controls.update();
  controls.saveState();

  let moved = false;
  let dirty = true;
  let first = true;
  controls.addEventListener("change", () => (dirty = true));
  controls.addEventListener("start", () => {
    moved = true;
    controls.autoRotate = false;
  });

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

  // Drawn only when something moved: a still view costs the phone nothing but the frame callback.
  renderer.setAnimationLoop(() => {
    controls.update();
    if (!dirty) return;
    dirty = false;
    renderer.render(scene, camera);
    if (first) {
      first = false;
      options.onFirstFrame();
    }
  });

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
      controls.autoRotate = on && !moved;
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
      moved = true;
      controls.autoRotate = false;
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
