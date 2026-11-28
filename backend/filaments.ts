// The operator's filaments: what a customer can pick for each part of a model (the 3D view recolours it) and send back as a colour wish
// (feedback.ts). An unavailable one is kept, and still names a file's filament (filamentName), but isn't offered.
import { randomUUID } from "node:crypto";
import type { FilamentRow } from "./db";
import { invalid, notFound, ok, type Outcome } from "./outcome";
import { mutation, type Runtime } from "./runtime";

export type Filament = {
  id: string;
  name: string;
  material: string;
  /** #rrggbb, lower case. */
  color: string;
  available: boolean;
  /** Its place in the list, from 1. */
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type FilamentInput = { name: string; material: string; color: string; available?: boolean };
export type FilamentPatch = Partial<FilamentInput> & { position?: number };

export const FILAMENT_NAME_MAX = 60;
export const FILAMENT_MATERIAL_MAX = 20;

const filament = (r: FilamentRow): Filament => ({
  id: r.id,
  name: r.name,
  material: r.material,
  color: r.color,
  available: r.available === 1,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** The patch as columns, checked; what is not given stays. */
function columns(input: FilamentPatch): Outcome<Partial<Omit<FilamentRow, "id" | "created_at" | "updated_at">>> {
  const set: Partial<Omit<FilamentRow, "id" | "created_at" | "updated_at">> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name === "" || name.length > FILAMENT_NAME_MAX) return invalid(`name: 1 to ${FILAMENT_NAME_MAX} characters`);
    set.name = name;
  }
  if (input.material !== undefined) {
    const material = input.material.trim();
    if (material === "" || material.length > FILAMENT_MATERIAL_MAX) return invalid(`material: 1 to ${FILAMENT_MATERIAL_MAX} characters, e.g. PLA`);
    set.material = material;
  }
  if (input.color !== undefined) {
    if (!/^#[0-9a-f]{6}$/i.test(input.color)) return invalid("color: #rrggbb, e.g. #00ae42");
    set.color = input.color.toLowerCase();
  }
  if (input.available !== undefined) set.available = input.available ? 1 : 0;
  if (input.position !== undefined) {
    if (!Number.isInteger(input.position) || input.position < 1) return invalid("position: a whole number from 1");
    set.position = input.position;
  }
  return ok(set);
}

/** Every filament in its order; with `available`, only those that are (or aren't) offered. */
export function listFilaments(rt: Runtime, filter: { available?: boolean } = {}): Filament[] {
  const all = rt.store.filaments().map(filament);
  return filter.available === undefined ? all : all.filter((f) => f.available === filter.available);
}

/** A new filament, last in the list. */
export function createFilament(rt: Runtime, input: FilamentInput): Outcome<Filament> {
  const set = columns({ available: true, ...input });
  if (!set.ok) return set;
  return mutation(rt, () => {
    const now = rt.clock().toISOString();
    const row: FilamentRow = {
      id: randomUUID(),
      name: set.value.name!,
      material: set.value.material!,
      color: set.value.color!,
      available: set.value.available!,
      position: rt.store.nextFilamentPosition(),
      created_at: now,
      updated_at: now,
    };
    rt.store.insertFilament(row);
    return ok(filament(row));
  });
}

export function updateFilament(rt: Runtime, id: string, patch: FilamentPatch): Outcome<Filament> {
  const set = columns(patch);
  if (!set.ok) return set;
  return mutation(rt, () => {
    if (!rt.store.updateFilament(id, { ...set.value, updated_at: rt.clock().toISOString() })) return notFound(`No filament ${id}.`);
    return ok(filament(rt.store.filament(id)!));
  });
}

/** Deletes a filament; feedback that named it keeps its name, material and colour (feedback.ts copies them). */
export function deleteFilament(rt: Runtime, id: string): Outcome<{ id: string }> {
  return mutation(rt, () => (rt.store.deleteFilament(id) ? ok({ id }) : notFound(`No filament ${id}.`)));
}

/** The name of the list's filament with exactly this colour and material (the material in any case), or null. */
export function filamentName(list: Filament[], f: { type: string | null; color: string | null }): string | null {
  if (!f.type || !f.color) return null;
  const color = f.color.toLowerCase();
  const material = f.type.toLowerCase();
  return list.find((x) => x.color === color && x.material.toLowerCase() === material)?.name ?? null;
}
