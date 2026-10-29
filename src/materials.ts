import * as THREE from "three";

// A small, calm palette: warm whites, one sage accent, clear Tritan, graphite internals.
// Builders take materials from here so the whole product reads as one family.

const std = (color: number, roughness: number, metalness = 0, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...extra });

export const MAT = {
  // Shells
  shell: std(0xf3f1ec, 0.55),                 // warm white PC/ABS (tower, dock)
  shellDark: std(0xd9d6cf, 0.6),              // seams, recesses, feet
  sage: std(0x8fa79a, 0.62, 0, { sheen: 0.4, sheenColor: new THREE.Color(0xc9d8cf) }), // soft-touch silicone
  sageDeep: std(0x6d8a7b, 0.55),
  lid: std(0xfbfaf7, 0.42),                   // polypropylene lid
  cup: std(0xf8f7f3, 0.38, 0, { clearcoat: 0.3, clearcoatRoughness: 0.4 }), // opaque white PP cup
  tritan: std(0xeaf3f4, 0.06, 0, {            // clear cup body
    transmission: 0.92, thickness: 2.2, ior: 1.52, transparent: true, opacity: 1,
  }),
  window: std(0xf4fafb, 0.04, 0, {            // clear spout roof / dose window
    transmission: 0.95, thickness: 1.2, ior: 1.5, transparent: true,
  }),
  water: std(0xcfe6ea, 0.05, 0, { transmission: 0.85, thickness: 30, ior: 1.33, transparent: true, opacity: 0.9 }),
  silicone: std(0xc9c4ba, 0.7),               // slit valve, seals
  // Light and glass
  led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2b0, emissiveIntensity: 0.9, roughness: 0.3 }),
  ledOff: std(0xf6f2ea, 0.25, 0, { transmission: 0.4, transparent: true }),
  lens: std(0x1b2226, 0.08, 0.2),
  // Internals (seen in X-ray)
  pcb: std(0x2f5d4d, 0.5, 0.1),
  chip: std(0x1f2427, 0.4, 0.2),
  battery: std(0x3a4247, 0.45, 0.3),
  copper: std(0xc07a4a, 0.35, 0.85),
  steel: std(0xb9bec2, 0.3, 0.9),
  motor: std(0x8b9196, 0.35, 0.7),
  // Tablets
  tabletA: std(0xffffff, 0.5),
  tabletB: std(0xf2d38b, 0.45),
  tabletC: std(0xe9a6a0, 0.45),
  // Marker capsules (swallow-proof pod): a frosted body so she can still see her own tablet,
  // a cap coloured per medicine, and the seal band that carries the breath marker.
  capsuleBody: std(0xf4f1ea, 0.3, 0, { transparent: true, opacity: 0.5, depthWrite: false }),
  capA: std(0xdfe6ea, 0.35),
  capB: std(0xf0c96e, 0.35),
  capC: std(0xe39a93, 0.35),
  markerBand: std(0x6d8a7b, 0.4),
  gel: std(0xdcece2, 0.1, 0, { transmission: 0.6, thickness: 3, ior: 1.36, transparent: true, opacity: 0.85 }),
};

export type MatKey = keyof typeof MAT;
