import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { CUP, DOCK, HANDLE } from "../dims";
import { MAT } from "../materials";
import { mesh } from "../geo";
import type { PartDef } from "../types";

// Passive handle: one solid two-shot moulding (white core, sage overmould) in a closed
// D-loop, with no electronics. It slides down onto the cup's +x rail and clicks, and goes
// in the dishwasher with the cup. Cueing, sensing and sync all live in the tower; the rail
// stays so a smart handle could slide on later.
//
// Frame: cup-local (y = 0 at the cup's outside bottom, +x toward the handle, +z toward the drinker).

// The cup wall tapers, so everything that hugs it follows the same slope.
const SLOPE = (CUP.rTop - CUP.rBottom) / CUP.h;
const wallX = (y: number) => CUP.rBottom + SLOPE * y;
const ri = (y: number) => wallX(y) + 0.6;           // spine's cup-facing face

// Local dims. REACH (same as HANDLE.reach) leaves a ~26 mm finger gap,
// enough for four fingers of an arthritic hand; the foot still ends inside DOCK.xMax.
const REACH = 58;                                     // grip outer face from the cup wall
const FOOT_Y = DOCK.seatDepth + 0.5;                  // foot bottom, just clear of the dock top
const TOP_Y = HANDLE.y1;
const ARM = 16;                                       // top arm (thumb rest) thickness (y)
const FOOT = 11;                                      // foot thickness (y): just a rest, nothing inside
const SPINE = 9.2;                                    // spine thickness from ri (x)

/** Extrude an xy outline along z, centred on z = 0, with smooth (merged) normals. */
function smoothExtrude(shape: THREE.Shape, depth: number, bevelT: number, bevelS: number): THREE.BufferGeometry {
  const core = depth - 2 * bevelT;
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: core, bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS,
    bevelSegments: 8, curveSegments: 32,
  });
  g.translate(0, 0, -core / 2);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-3);
  g.computeVertexNormals();
  return g;
}

/** Sage overmould: a "C" (open toward the cup) whose ends butt into the white spine. */
function overmould(): THREE.Mesh {
  const B = 4.5, T = 6;                               // bevel grows the outline by B, so draw it inset
  const xo = (y: number) => wallX(y) + REACH - B;
  const xi = (y: number) => wallX(y) + REACH - HANDLE.grip + B;
  const xe = (y: number) => ri(y) + 6;                // hidden under the spine
  const yb = FOOT_Y + B, yft = FOOT_Y + FOOT - B;     // foot bottom / top
  const yt = TOP_Y - B, yab = TOP_Y - ARM + B;        // thumb rest / arm underside
  const rF = 6, rT = 14, rI = 9;
  const ym = (yb + yt) / 2;

  const s = new THREE.Shape();
  s.moveTo(xe(yb), yb);
  s.lineTo(xo(yb) - rF, yb);
  s.quadraticCurveTo(xo(yb), yb, xo(yb + rF), yb + rF);
  s.quadraticCurveTo(xo(ym) + 3, ym, xo(yt - rT), yt - rT);   // slight palm bulge
  s.quadraticCurveTo(xo(yt), yt, xo(yt) - rT, yt);
  s.lineTo(xe(yt), yt);
  s.lineTo(xe(yab), yab);
  s.lineTo(xi(yab) - rI, yab);
  s.quadraticCurveTo(xi(yab), yab, xi(yab - rI), yab - rI);
  s.lineTo(xi(yft + rI), yft + rI);
  s.quadraticCurveTo(xi(yft), yft, xi(yft) - rI, yft);
  s.lineTo(xe(yft), yft);
  s.closePath();
  return mesh(smoothExtrude(s, HANDLE.depth, T, B), MAT.sage, "overmould");
}

/** Warm-white rigid spine against the cup; the rail's dovetail slot runs inside it. */
function spine(): THREE.Mesh {
  const B = 2.5, T = 3, r = 2;
  const a = (y: number) => ri(y) + 0.3 + B, b = (y: number) => ri(y) + SPINE - B;
  const y0 = FOOT_Y + 2 + B, y1 = TOP_Y - 1 - B;
  const s = new THREE.Shape();
  s.moveTo(a(y0) + r, y0);
  s.lineTo(b(y0) - r, y0);
  s.quadraticCurveTo(b(y0), y0, b(y0 + r), y0 + r);
  s.lineTo(b(y1 - r), y1 - r);
  s.quadraticCurveTo(b(y1), y1, b(y1) - r, y1);
  s.lineTo(a(y1) + r, y1);
  s.quadraticCurveTo(a(y1), y1, a(y1 - r), y1 - r);
  s.lineTo(a(y0 + r), y0 + r);
  s.quadraticCurveTo(a(y0), y0, a(y0) + r, y0);
  return mesh(smoothExtrude(s, HANDLE.depth - 4, T, B), MAT.shell, "spine");
}

/** Three low moulded ribs on the thumb rest: the thumb finds them without looking. */
function thumbRibs(): THREE.Group {
  const grp = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const g = new THREE.CapsuleGeometry(1.4, 12, 6, 12);
    g.rotateX(Math.PI / 2);                           // run along z, across the thumb
    g.scale(1, 0.5, 1);
    const m = mesh(g, MAT.sageDeep, "thumb-rib");
    m.position.set(wallX(TOP_Y) + 22 + i * 6, TOP_Y - 0.2, 0);
    grp.add(m);
  }
  return grp;
}

function latch(): THREE.Group {
  const grp = new THREE.Group();
  const yb = 30;
  // Thumb button on the spine's outer face, inside the finger opening.
  const bg = new THREE.CapsuleGeometry(3.5, 8, 6, 16);
  bg.scale(0.55, 1, 1);
  const button = mesh(bg, MAT.sageDeep, "button");
  button.position.set(ri(yb) + SPINE - 0.3, yb, 0);
  grp.add(button);
  // Sprung steel pawl that drops into a notch in the cup rail.
  const pawl = mesh(new THREE.BoxGeometry(3, 4, 6), MAT.steel, "pawl");
  pawl.position.set(wallX(yb + 4) + 4.5, yb + 4, 0);
  grp.add(pawl);
  const pts: THREE.Vector3[] = [];
  const x0 = wallX(yb) + 6, x1 = ri(yb) + SPINE - 2;
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, a = t * Math.PI * 2 * 5;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, yb + 1.3 * Math.sin(a), 1.3 * Math.cos(a)));
  }
  grp.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.25, 6), MAT.steel, "spring"));
  return grp;
}

export function buildHandle(): PartDef[] {
  const shell = new THREE.Group();
  shell.add(overmould(), spine(), thumbRibs());
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  return [
    {
      id: "handle-shell", name: "Handle", assembly: "handle",
      role: "Passive moulded D-handle with no electronics, so it goes in the dishwasher with the cup. "
        + "Everything smart is in the tower. It still slides onto the cup's rail, which is kept so a smart handle could slide on later.",
      specs: [
        ["Material", "PP core, TPE two-shot overmould"],
        ["Cleaning", "Dishwasher-safe, solid, no cavities"],
        ["Grip", "22 × 26 mm bar, 26 mm finger gap"],
        ["Thumb rest", "Three moulded ribs, found by feel"],
        ["Fit", "Slides down the cup rail, clicks"],
      ],
      object: shell, explode: v(60, 0, 0),
    },
    {
      id: "latch", name: "Rail latch", assembly: "handle",
      role: "Thumb button and sprung steel pawl that lock the handle onto the cup rail. Purely mechanical.",
      specs: [["Release", "Press button, lift handle up"], ["Engages", "Notch at the top of the cup rail"], ["Parts", "Stainless pawl + spring, dishwasher-safe"]],
      object: latch(), explode: v(55, 0, 36),
    },
  ];
}
