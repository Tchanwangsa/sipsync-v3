import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

// Geometry helpers shared by the part builders. Keep them generic.

/** Rounded rectangle centred on the origin, in the shape's xy plane. */
export function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Vertical prism from a plan-view shape: the shape's (x, y) map to world (x, -z)
 * so a shape drawn "top-down" with +y pointing away from the drinker comes out right.
 * The solid runs from y = 0 to y = height, with a soft bevel on both caps.
 */
export function plinth(shape: THREE.Shape, height: number, bevel = 2, segments = 4): THREE.BufferGeometry {
  const b = Math.min(bevel, height / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: height - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b,
    bevelSegments: segments, curveSegments: 24,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  // Extrusions come out non-indexed (faceted); smooth everything below the crease angle.
  return toCreasedNormals(g, Math.PI / 5);
}

/** Lathe from (radius, y) pairs, smooth. */
export function lathe(points: [number, number][], segments = 96): THREE.BufferGeometry {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
}

/** Mesh with shadows on, the default for every visible part. */
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, name = ""): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.name = name;
  return m;
}

/** Capsule-ish tablet lying flat; d = diameter, t = thickness. */
export function tablet(d: number, t: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(d / 2, d / 2, t, 28, 1);
  return mesh(g, mat, "tablet");
}
