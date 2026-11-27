// The view's lifecycle without a browser: WebGL, the 3MF parser (DOMParser) and OrbitControls (pointer events) are stood in for, the rest of
// three is real. What is checked is what a page can't see: the frame loop, the turntable's clock, a drawing error, and that dispose gives
// everything back.
import { BoxGeometry, BufferGeometry, Group, Material, Mesh, MeshPhongMaterial, MeshStandardMaterial, Vector3 } from "three";
import type { Facts } from "@/backend/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  renderer: undefined as unknown as Record<"setPixelRatio" | "render" | "dispose" | "forceContextLoss" | "setAnimationLoop", ReturnType<typeof vi.fn>> & {
    loop: ((t: number) => void) | null;
    domElement: { remove: ReturnType<typeof vi.fn> };
  },
  controls: undefined as unknown as { autoRotate: boolean; dispose: ReturnType<typeof vi.fn>; target: import("three").Vector3; object: import("three").Camera },
  /** What the stand-in loader returns; a 20 × 10 × 5 grey box unless a test sets its own. */
  build: null as null | (() => import("three").Group),
  observer: { observe: vi.fn(), disconnect: vi.fn() },
}));

vi.mock("three", async (importOriginal) => {
  const three = await importOriginal<typeof import("three")>();
  class WebGLRenderer {
    shadowMap = {};
    domElement = { style: {}, remove: vi.fn() };
    loop: ((t: number) => void) | null = null;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    setAnimationLoop = vi.fn((f: ((t: number) => void) | null) => (this.loop = f));
    constructor() {
      fake.renderer = this as never;
    }
  }
  return { ...three, WebGLRenderer };
});

vi.mock("three/addons/controls/OrbitControls.js", async () => {
  const { Vector3 } = await import("three");
  class OrbitControls {
    target = new Vector3();
    autoRotate = false;
    minDistance = 0;
    maxDistance = Infinity;
    update = vi.fn(() => false);
    saveState = vi.fn();
    reset = vi.fn();
    dispose = vi.fn();
    addEventListener = vi.fn();
    constructor(public object: unknown) {
      fake.controls = this as never;
    }
  }
  return { OrbitControls };
});

vi.mock("three/addons/loaders/3MFLoader.js", async () => {
  const { Loader } = await import("three");
  class ThreeMFLoader {
    parse() {
      if (fake.build) return fake.build();
      const group = new Group();
      group.add(new Mesh(new BoxGeometry(20, 10, 5), new MeshPhongMaterial({ name: Loader.DEFAULT_MATERIAL_NAME })));
      return group;
    }
  }
  return { ThreeMFLoader };
});

const { openView, TURNTABLE_SECONDS } = await import("./scene");
const { emptyFacts } = await import("@/backend/client");

const mount = () => ({ clientWidth: 300, clientHeight: 300, appendChild: vi.fn() }) as unknown as HTMLElement;
const callbacks = () => ({ onFirstFrame: vi.fn(), onRotating: vi.fn(), onError: vi.fn() });

beforeEach(() => {
  vi.stubGlobal("window", { devicePixelRatio: 3 });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = fake.observer.observe;
      disconnect = fake.observer.disconnect;
    },
  );
});
afterEach(() => {
  fake.build = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("openView", () => {
  it("draws the first frame, then only when something moved, at no more than twice the CSS pixels", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), emptyFacts(), { autoRotate: false, ...on });
    expect(fake.renderer.setPixelRatio).toHaveBeenCalledWith(2);
    fake.renderer.loop!(0);
    expect(fake.renderer.render).toHaveBeenCalledTimes(1);
    expect(on.onFirstFrame).toHaveBeenCalledTimes(1);
    fake.renderer.loop!(16);
    expect(fake.renderer.render).toHaveBeenCalledTimes(1);
  });

  it("turns by itself for a few seconds of the clock, then stops by itself (within the 5 seconds WCAG 2.2.2 allows)", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), emptyFacts(), { autoRotate: true, ...on });
    expect(on.onRotating).toHaveBeenLastCalledWith(true);
    fake.renderer.loop!(1000);
    fake.renderer.loop!(1000 + (TURNTABLE_SECONDS - 0.1) * 1000);
    expect(fake.controls.autoRotate).toBe(true);
    fake.renderer.loop!(1000 + (TURNTABLE_SECONDS + 0.1) * 1000);
    expect(fake.controls.autoRotate).toBe(false);
    expect(on.onRotating).toHaveBeenLastCalledWith(false);
    expect(TURNTABLE_SECONDS).toBeLessThan(5);
  });

  it("doesn't turn for a visitor who turned motion off", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), emptyFacts(), { autoRotate: false, ...on });
    expect(fake.controls.autoRotate).toBe(false);
    expect(on.onRotating).not.toHaveBeenCalled();
  });

  it("stops the loop and reports a drawing error, also before the first frame", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), emptyFacts(), { autoRotate: false, ...on });
    fake.renderer.render.mockImplementation(() => {
      throw new Error("context lost");
    });
    fake.renderer.loop!(0);
    expect(on.onError).toHaveBeenCalledTimes(1);
    expect(on.onFirstFrame).not.toHaveBeenCalled();
    expect(fake.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });

  it("gives everything back on dispose: the loop, the observer, the controls, the meshes, the renderer and its context, the canvas", () => {
    const view = openView(mount(), new ArrayBuffer(0), emptyFacts(), { autoRotate: true, ...callbacks() });
    const geometries = vi.spyOn(BufferGeometry.prototype, "dispose");
    const materials = vi.spyOn(Material.prototype, "dispose");
    view.dispose();
    expect(fake.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(fake.observer.disconnect).toHaveBeenCalled();
    expect(fake.controls.dispose).toHaveBeenCalled();
    // The model's mesh and the ground: two geometries, two materials (the model's grey plastic and the shadow).
    expect(geometries).toHaveBeenCalledTimes(2);
    expect(materials).toHaveBeenCalledTimes(2);
    expect(fake.renderer.dispose).toHaveBeenCalled();
    expect(fake.renderer.forceContextLoss).toHaveBeenCalled();
    expect(fake.renderer.domElement.remove).toHaveBeenCalled();
  });
});

/** A box of `size` with its corner at x0 (the file's axes, Z up), in a group as the loader makes a mesh object. */
function box(x0: number, size: number) {
  const g = new BoxGeometry(size, size, size).translate(x0 + size / 2, size / 2, size / 2);
  return new Group().add(new Mesh(g, new MeshPhongMaterial()));
}
/** plates.3mf as the loader builds it: item 2 (one component, a 20 mm box), item 4 at x 300 (10 mm boxes at 0, 12 and 24). */
function plates() {
  const halter = new Group().add(box(0, 20));
  const spule = new Group().add(box(0, 10), box(12, 10), box(24, 10));
  spule.position.x = 300;
  return new Group().add(halter, spule);
}
const PLATES: Facts = {
  reader: 1,
  unit: 1,
  items: ["2", "4"],
  slots: [
    { slot: 1, type: "PLA", color: "#00ae42" },
    { slot: 2, type: "PETG", color: "#ffffff" },
  ],
  parts: [
    { key: "2:0", name: "Halter", object: "2", components: [0], slot: 1 },
    { key: "4:0", name: "Spule", object: "4", components: [0], slot: 2 },
    { key: "4:1", name: "Spule", object: "4", components: [1], slot: 1 },
  ],
};

function openPlates(opts: { animate?: boolean; autoRotate?: boolean } = {}) {
  fake.build = plates;
  const on = { ...callbacks(), onSize: vi.fn() };
  const view = openView(mount(), new ArrayBuffer(0), PLATES, {
    autoRotate: opts.autoRotate ?? false,
    animate: opts.animate ?? false,
    accent: "#ff0000",
    ...on,
  });
  return { view, on };
}
const meshesOf = (view: ReturnType<typeof openView>, key: string) => view.meshes().filter((m) => m.name === key);
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe("the view's parts and camera", () => {
  it("measures what is shown in mm, the file's axes: x width, y depth, z height", () => {
    const { view, on } = openPlates();
    const all = view.size();
    near(all.x, 322); // 0 to 322: the modifier at 324 is not drawn
    near(all.y, 20);
    near(all.z, 20);
    expect(on.onSize).toHaveBeenCalledWith(all);
  });

  it("focus shows only that part, measures it, and null shows everything again", () => {
    const { view, on } = openPlates();
    view.focus("4:0");
    expect(
      view
        .meshes()
        .filter((m) => m.visible)
        .map((m) => m.name),
    ).toEqual(["4:0"]);
    const s = view.size();
    [s.x, s.y, s.z].forEach((v) => near(v, 10));
    expect(on.onSize).toHaveBeenLastCalledWith(s);
    view.focus(null);
    expect(view.meshes().every((m) => m.visible)).toBe(true);
  });

  it("frames the focused part: the camera looks at its centre", () => {
    const { view } = openPlates();
    view.focus("4:1");
    const target = fake.controls.target;
    const world = meshesOf(view, "4:1")[0]!;
    world.geometry.computeBoundingBox();
    const c = world.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(world.matrixWorld);
    near(target.distanceTo(c), 0);
  });

  it("hides exactly the parts asked, every placement of them", () => {
    const { view } = openPlates();
    view.setHidden(new Set(["4:0"]));
    expect(meshesOf(view, "4:0").every((m) => !m.visible)).toBe(true);
    expect(
      view
        .meshes()
        .filter((m) => m.name !== "4:0")
        .every((m) => m.visible),
    ).toBe(true);
    near(view.size().x, 322);
    view.setHidden(new Set(["2:0"]));
    near(view.size().x, 22);
  });

  it("looks from above on top, and stops the turntable", () => {
    const { view, on } = openPlates({ autoRotate: true });
    view.setCamera("top");
    const camera = fake.controls.object;
    const d = camera.position.clone().sub(fake.controls.target);
    expect(d.y / d.length()).toBeGreaterThan(0.999);
    expect(on.onRotating).toHaveBeenLastCalledWith(false);
  });

  it("highlights a part's meshes in the accent, and null clears it", () => {
    const { view } = openPlates();
    view.highlight("2:0");
    const mat = (m: Mesh) => m.material as MeshStandardMaterial;
    expect(mat(meshesOf(view, "2:0")[0]!).emissive.getHexString()).toBe("ff0000");
    expect(mat(meshesOf(view, "4:0")[0]!).emissive.getHexString()).toBe("000000");
    view.highlight(null);
    expect(mat(meshesOf(view, "2:0")[0]!).emissive.getHexString()).toBe("000000");
  });

  it("moves the camera over a few frames, or at once for a visitor who turned motion off", () => {
    const still = openPlates({ animate: false });
    const before = fake.controls.target.clone();
    still.view.focus("4:0");
    expect(fake.controls.target.distanceTo(before)).toBeGreaterThan(1);

    const moving = openPlates({ animate: true });
    const from = fake.controls.target.clone();
    moving.view.focus("4:0");
    expect(fake.controls.target.distanceTo(from)).toBe(0);
    fake.renderer.loop!(1000);
    fake.renderer.loop!(1150);
    const half = fake.controls.target.distanceTo(from);
    expect(half).toBeGreaterThan(0);
    fake.renderer.loop!(1400);
    expect(fake.controls.target.distanceTo(from)).toBeGreaterThan(half);
    const settled = fake.controls.target.clone();
    fake.renderer.loop!(1600);
    expect(fake.controls.target.distanceTo(settled)).toBe(0);
  });
});
