// tagParts on a tree shaped as three's ThreeMFLoader builds it (checked against plates.3mf and SpoolBuddy in a browser): one child of the
// root per build item, in order; in an object made of components one child per component, in order; a mesh object a group of meshes.
import { BoxGeometry, BufferAttribute, Group, Loader, Mesh, MeshPhongMaterial, MeshStandardMaterial } from "three";
import { describe, expect, it } from "vitest";
import type { Facts } from "@/backend/client";
import { emptyFacts } from "@/backend/client";
import { tagParts } from "./parts";

const mesh = (colour?: number) =>
  new Mesh(new BoxGeometry(1, 1, 1), new MeshPhongMaterial(colour === undefined ? { name: Loader.DEFAULT_MATERIAL_NAME } : { color: colour }));
const meshGroup = (colour?: number) => new Group().add(mesh(colour));
const composite = (n: number) => {
  const g = new Group();
  for (let i = 0; i < n; i++) g.add(meshGroup());
  return g;
};

/** plates.3mf's facts (backend/threemf/facts.test.ts). */
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

const colourOf = (m: Mesh) => `#${(m.material as MeshStandardMaterial).color.getHexString()}`;

describe("tagParts", () => {
  it("tags each component's meshes with its part, colours them by slot and drops what no part claims (a modifier)", () => {
    const root = new Group().add(composite(1), composite(3));
    const parts = tagParts(root, PLATES);
    expect(parts.map((p) => p.key)).toEqual(["2:0", "4:0", "4:1"]);
    expect(parts.every((p) => p.mesh.name === p.key)).toBe(true);
    expect(root.children[1]!.children).toHaveLength(2);
    expect(colourOf(parts.find((p) => p.key === "4:0")!.mesh)).toBe("#ffffff");
    expect(colourOf(parts.find((p) => p.key === "2:0")!.mesh)).toBe("#00ae42");
    expect(parts.every((p) => p.mesh.material instanceof MeshStandardMaterial && p.mesh.castShadow)).toBe(true);
  });

  it("gives each mesh a material of its own, so highlighting one part leaves the others", () => {
    const root = new Group().add(composite(1), composite(3));
    const parts = tagParts(root, PLATES);
    expect(new Set(parts.map((p) => p.mesh.material)).size).toBe(parts.length);
  });

  it("tags both placements of an object placed twice with the same part", () => {
    const facts: Facts = { ...PLATES, items: ["2", "4", "2"] };
    const parts = tagParts(new Group().add(composite(1), composite(3), composite(1)), facts);
    expect(parts.filter((p) => p.key === "2:0")).toHaveLength(2);
  });

  it("claims a mesh object whole and keeps the colours of a mesh painted per vertex", () => {
    const painted = mesh(0x123456);
    painted.geometry.setAttribute("color", new BufferAttribute(new Float32Array(painted.geometry.attributes.position!.count * 3), 3));
    (painted.material as MeshPhongMaterial).vertexColors = true;
    const facts: Facts = {
      reader: 1,
      unit: 1,
      items: ["1", "2"],
      slots: [{ slot: 1, type: null, color: "#d62828" }],
      parts: [
        { key: "1:0", name: null, object: "1", components: null, slot: 1 },
        { key: "2:0", name: null, object: "2", components: null, slot: null },
      ],
    };
    const parts = tagParts(new Group().add(meshGroup(0xd62828), new Group().add(painted)), facts);
    expect(parts.map((p) => p.key)).toEqual(["1:0", "2:0"]);
    expect(colourOf(parts[0]!.mesh)).toBe("#d62828");
    expect((parts[1]!.mesh.material as MeshStandardMaterial).vertexColors).toBe(true);
  });

  it("keeps every mesh, untagged, when the facts have no parts (a version not read yet); grey where the file gives no colour", () => {
    const root = new Group().add(composite(2));
    expect(tagParts(root, emptyFacts())).toEqual([]);
    const meshes: Mesh[] = [];
    root.traverse((o) => o instanceof Mesh && meshes.push(o));
    expect(meshes).toHaveLength(2);
    expect(meshes.map(colourOf)).toEqual(["#c8ccd2", "#c8ccd2"]);
  });

  it("drops an object no part names", () => {
    const root = new Group().add(composite(1), composite(3));
    tagParts(root, { ...PLATES, parts: PLATES.parts.filter((p) => p.object === "2") });
    expect(root.children).toHaveLength(1);
  });
});
