// The parts of the version's facts (backend/threemf) found in what three's ThreeMFLoader built. Its output follows the file: one child of
// the root per build item, in order; in an object made of components (a Bambu project's) one child per component, in order; a mesh
// object is a group of its meshes. So the facts' item list and component indices name each mesh's part, without a parser of our own.
// What no part claims (a modifier, a negative part, a support blocker) is dropped.
import { Loader, Mesh, MeshStandardMaterial, type Material, type MeshPhongMaterial, type Object3D } from "three";
import type { Facts, FactsPart } from "@/backend/client";

/** The colour of a part the 3MF gives none. */
export const GREY = 0xc8ccd2;

export type PartMesh = { key: string; mesh: Mesh };

const matte = { roughness: 0.55, metalness: 0, flatShading: true } as const;

/** The loader's material as a matte plastic of its own, its colour (or vertex colours, or texture) kept; grey where the 3MF gives none. */
export function plastic(m: Material): MeshStandardMaterial {
  const from = m as MeshPhongMaterial;
  if (m.name === Loader.DEFAULT_MATERIAL_NAME && !from.vertexColors) return new MeshStandardMaterial({ color: GREY, ...matte, roughness: 0.6 });
  return new MeshStandardMaterial({
    name: from.name,
    color: from.color,
    map: from.map ?? null,
    vertexColors: from.vertexColors,
    transparent: from.transparent,
    opacity: from.opacity,
    ...matte,
  });
}

/** The mesh's new material; the loader's is given back (disposing one a clone shares again is harmless). */
function material(m: Material, part: FactsPart | null, facts: Facts): MeshStandardMaterial {
  const colour = part?.slot ? facts.slots[part.slot - 1]?.color : null;
  const out = colour && !(m as MeshPhongMaterial).vertexColors ? new MeshStandardMaterial({ color: colour, ...matte }) : plastic(m);
  m.dispose();
  return out;
}

/** Every mesh under `o`: a material of its own (a clone shares its original's), the part's name, a shadow. */
function dress(o: Object3D, part: FactsPart | null, facts: Facts, out: PartMesh[]): void {
  o.traverse((m) => {
    if (!(m instanceof Mesh)) return;
    m.material = Array.isArray(m.material) ? m.material.map((x: Material) => material(x, part, facts)) : material(m.material, part, facts);
    m.castShadow = true;
    if (part) {
      m.name = part.key;
      out.push({ key: part.key, mesh: m });
    }
  });
}

/**
 * Tags the loader's meshes with the facts' parts and gives them their filament's colour; drops what no part claims. Facts without parts
 * (a version not read yet) keep every mesh, untagged, in the loader's colours.
 */
export function tagParts(root: Object3D, facts: Facts): PartMesh[] {
  const out: PartMesh[] = [];
  if (facts.parts.length === 0) {
    dress(root, null, facts, out);
    return out;
  }
  const drop: Object3D[] = [];
  root.children.forEach((item, i) => {
    const parts = facts.parts.filter((p) => p.object === facts.items[i]);
    const whole = parts.find((p) => p.components === null);
    if (parts.length === 0) drop.push(item);
    else if (whole) dress(item, whole, facts, out);
    else
      item.children.forEach((component, j) => {
        const part = parts.find((p) => p.components?.includes(j));
        if (part) dress(component, part, facts, out);
        else drop.push(component);
      });
  });
  for (const o of drop) o.removeFromParent();
  return out;
}
