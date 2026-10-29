import * as THREE from "three";
import { MAT } from "./materials";
import { lathe, mesh, tablet } from "./geo";

// The swallow-proof pod: every tablet rides in its own over-encapsulation capsule
// (DBcaps-style, ~90% of common tablets fit) whose seal band carries a food-safe breath
// marker. Shared by the cup (the mouthful on the grill) and the tower (magazine, wrap station).
// See ../swallow-proof-pod.md for the evidence and the limitations.

export const POD = {
  clearance: 1.2,   // capsule bore over the tablet's diameter
  wall: 0.3,
  len: 17,          // typical closed length; caplets get a longer one
  capFrac: 0.55,    // the cap overlaps a little over half the body
  band: 1.6,        // marker seal band width
};

/** One medicine as the tower sees it: tablet size plus the cap colour the pharmacist assigned. */
export interface Med { d: number; t: number; tablet: THREE.Material; cap: THREE.Material }

export const MEDS: Med[] = [
  { d: 8.5, t: 3.4, tablet: MAT.tabletA, cap: MAT.capA },
  { d: 6.5, t: 2.8, tablet: MAT.tabletB, cap: MAT.capB },
  { d: 7.5, t: 3.6, tablet: MAT.tabletC, cap: MAT.capC },
];

/** Closed capsule diameter for a tablet. */
export const podD = (m: Med) => m.d + POD.clearance + 2 * POD.wall;

/**
 * Closed marker capsule lying along z, centred on the origin: frosted body with the tablet
 * standing inside it, a coloured cap over the +z end, and the marker band over the join.
 */
export function pod(m: Med, len = POD.len): THREE.Group {
  const g = new THREE.Group();
  const r = podD(m) / 2;
  const capLen = len * POD.capFrac;
  const bodyGeo = new THREE.CapsuleGeometry(r - 0.25, len - 2 * r, 6, 24);
  bodyGeo.rotateX(Math.PI / 2);
  const body = mesh(bodyGeo, MAT.capsuleBody, "capsule-body");
  body.userData.noShadow = true;
  g.add(body);
  // Cap: a slightly fatter open shell (domed end, straight skirt) over the front of the body.
  const prof: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    prof.push([r * Math.sin(a), capLen - r + r * Math.cos(a)]);
  }
  prof.push([r, 0], [r - POD.wall, 0]);
  const capGeo = lathe(prof, 24);
  capGeo.rotateX(Math.PI / 2);           // lathe axis +y → +z
  const cap = mesh(capGeo, m.cap, "capsule-cap");
  cap.position.z = len / 2 - capLen;
  g.add(cap);
  // Marker band sealed over the cap's open edge: carries the tag and shows if it was opened.
  const band = mesh(new THREE.CylinderGeometry(r + 0.15, r + 0.15, POD.band, 24, 1, true), MAT.markerBand, "marker-band");
  band.rotation.x = Math.PI / 2;
  band.position.z = len / 2 - capLen + POD.band / 2 - 0.3;
  g.add(band);
  // The tablet stands across the bore, visible through the frosted body.
  const t = tablet(m.d, m.t, m.tablet);
  t.rotation.x = Math.PI / 2;
  t.position.z = -len / 4;
  g.add(t);
  return g;
}
