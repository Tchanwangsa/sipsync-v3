import type * as THREE from "three";

export type Assembly = "cup" | "handle" | "tower";

export interface PartDef {
  id: string;               // kebab-case, unique
  name: string;             // short label for the part list
  assembly: Assembly;
  role: string;             // one sentence: what it does
  specs: [string, string][]; // a few key facts, e.g. ["Material", "Tritan"]
  object: THREE.Object3D;   // already positioned in its assembly's local frame
  explode: THREE.Vector3;   // offset at full explode, in the assembly's frame (mm)
  internal?: boolean;       // hidden inside a shell; shown when X-ray is on
}
