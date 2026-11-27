// The view's lifecycle without a browser: WebGL, the 3MF parser (DOMParser) and OrbitControls (pointer events) are stood in for, the rest of
// three is real. What is checked is what a page can't see: the frame loop, the turntable's clock, a drawing error, and that dispose gives
// everything back.
import { BoxGeometry, BufferGeometry, Group, Material, Mesh, MeshPhongMaterial } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  renderer: undefined as unknown as Record<"setPixelRatio" | "render" | "dispose" | "forceContextLoss" | "setAnimationLoop", ReturnType<typeof vi.fn>> & {
    loop: ((t: number) => void) | null;
    domElement: { remove: ReturnType<typeof vi.fn> };
  },
  controls: undefined as unknown as { autoRotate: boolean; dispose: ReturnType<typeof vi.fn> },
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
    constructor() {
      fake.controls = this;
    }
  }
  return { OrbitControls };
});

vi.mock("three/addons/loaders/3MFLoader.js", async () => {
  const { Loader } = await import("three");
  class ThreeMFLoader {
    parse() {
      const group = new Group();
      group.add(new Mesh(new BoxGeometry(20, 10, 5), new MeshPhongMaterial({ name: Loader.DEFAULT_MATERIAL_NAME })));
      return group;
    }
  }
  return { ThreeMFLoader };
});

const { openView, TURNTABLE_SECONDS } = await import("./scene");

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("openView", () => {
  it("draws the first frame, then only when something moved, at no more than twice the CSS pixels", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), { autoRotate: false, ...on });
    expect(fake.renderer.setPixelRatio).toHaveBeenCalledWith(2);
    fake.renderer.loop!(0);
    expect(fake.renderer.render).toHaveBeenCalledTimes(1);
    expect(on.onFirstFrame).toHaveBeenCalledTimes(1);
    fake.renderer.loop!(16);
    expect(fake.renderer.render).toHaveBeenCalledTimes(1);
  });

  it("turns by itself for a few seconds of the clock, then stops by itself (within the 5 seconds WCAG 2.2.2 allows)", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), { autoRotate: true, ...on });
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
    openView(mount(), new ArrayBuffer(0), { autoRotate: false, ...on });
    expect(fake.controls.autoRotate).toBe(false);
    expect(on.onRotating).not.toHaveBeenCalled();
  });

  it("stops the loop and reports a drawing error, also before the first frame", () => {
    const on = callbacks();
    openView(mount(), new ArrayBuffer(0), { autoRotate: false, ...on });
    fake.renderer.render.mockImplementation(() => {
      throw new Error("context lost");
    });
    fake.renderer.loop!(0);
    expect(on.onError).toHaveBeenCalledTimes(1);
    expect(on.onFirstFrame).not.toHaveBeenCalled();
    expect(fake.renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });

  it("gives everything back on dispose: the loop, the observer, the controls, the meshes, the renderer and its context, the canvas", () => {
    const view = openView(mount(), new ArrayBuffer(0), { autoRotate: true, ...callbacks() });
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
