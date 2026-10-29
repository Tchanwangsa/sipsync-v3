import * as THREE from "three";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import { CUP, LID, SIP } from "../dims";
import { MAT } from "../materials";
import { lathe, mesh, plinth, roundedRect } from "../geo";
import { MEDS, POD, pod, podD } from "../pod";
import type { PartDef } from "../types";

// Cup assembly, cup-local frame: y = 0 is the outside bottom of the cup, the spout faces +z,
// the tower is behind (-z). Nothing in here is powered: the cup, lid and passive handle all go
// in the dishwasher.
//
// Oralflo-style: an opaque tapered cup, a low snap-on lid with a fixed tube spout at its front
// edge leaning back over the lid, and a grill under the spout that holds the tablets above the
// water until the drink carries them up the tube. The one addition is a gravity ramp hung
// under the lid, fed from the tower through a flush, magnet-opened shutter in the back wall.

/** Outer wall radius at height y. */
export const rOuter = (y: number) => CUP.rBottom + (CUP.rTop - CUP.rBottom) * (y / CUP.h);
export const rInner = (y: number) => rOuter(y) - CUP.wall;
const WALL_LEAN = Math.atan((CUP.rTop - CUP.rBottom) / CUP.h);

/** Lid deck height above the rim at z: high at the back (tower side), low at the front. */
const deckH = (z: number) => LID.deckFront + (LID.deckBack - LID.deckFront) * ((LID.r - z) / (2 * LID.r));
const RAD = Math.PI / 180;

function body(): THREE.Object3D {
  const g = new THREE.Group();
  const H = CUP.h, w = CUP.wall, f = CUP.floor;
  // One closed profile, axis → inner floor → inner wall → rolled rim → outer wall → foot → axis.
  const pts: [number, number][] = [[0, f]];
  pts.push([rInner(f) - 3, f], [rInner(f) - 0.8, f + 0.6], [rInner(f + 3), f + 3]);
  pts.push([rInner(H - 2), H - 2]);
  for (let i = 0; i <= 8; i++) {           // half-round rim bead
    const a = Math.PI - (i / 8) * Math.PI;
    pts.push([rInner(H) + w / 2 + Math.cos(a) * (w / 2 + 0.2), H - 1 + Math.sin(a) * 1.4]);
  }
  pts.push([rOuter(H - 3), H - 3], [rOuter(6), 6]);
  for (let i = 0; i <= 6; i++) {           // foot fillet
    const a = (i / 6) * (Math.PI / 2);
    pts.push([rOuter(0) - 4 + Math.cos(a) * 4, 4 - Math.sin(a) * 4]);
  }
  pts.push([CUP.rBottom - 6, 0], [CUP.rBottom - 7, 1.2], [0, 1.2]);   // shallow foot ring
  g.add(mesh(lathe(pts, 128), MAT.cup, "cup-body"));

  // Dovetail rail on +x, leaning with the wall. Wider at the face so the handle can't pull off.
  const { y0, y1, w: rw, d } = CUP.rail;
  const s = new THREE.Shape();
  s.moveTo(-rw * 0.32, 0); s.lineTo(rw * 0.32, 0); s.lineTo(rw / 2, d); s.lineTo(-rw / 2, d); s.closePath();
  const rail = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 0.6, bevelSegments: 3 });
  rail.rotateX(-Math.PI / 2);            // extrude axis → +y, shape y → -z
  rail.rotateY(Math.PI / 2);             // shape "out" now points +x
  const railMesh = mesh(rail, MAT.cup, "rail");
  railMesh.position.set(rOuter(y0) - 0.6, y0, 0);
  railMesh.rotation.z = -WALL_LEAN;
  g.add(railMesh);
  return g;
}

function water(): THREE.Object3D {
  // The whole interior up to just under the rim. The engine clips it with a world-level plane
  // at the height that holds the fill volume, so the surface stays level as the cup tips.
  const top = CUP.h - 1.5;
  const pts: [number, number][] = [[0, CUP.floor + 0.2], [rInner(CUP.floor) - 1, CUP.floor + 0.2],
    [rInner(CUP.floor + 3) - 0.4, CUP.floor + 3], [rInner(top) - 0.4, top], [0, top]];
  const g = new THREE.Group();
  const m = mesh(lathe(pts, 96), MAT.water, "water");
  m.castShadow = false;
  // The level surface: the engine rebuilds this fan wherever the clip plane cuts the interior.
  const surface = mesh(new THREE.BufferGeometry(), MAT.water, "water-surface");
  surface.castShadow = false;
  surface.frustumCulled = false;
  g.add(m, surface);
  return g;
}

/** The lid deck: a disc whose top is a plane sloping down from back to front, edges kept soft. */
function deckGeometry(): THREE.BufferGeometry {
  const b = 2.5, H = LID.deckBack;
  const circle = new THREE.Shape().absarc(0, 0, LID.r - b, 0, Math.PI * 2, false);
  const g = new THREE.ExtrudeGeometry(circle, {
    depth: H - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 5, curveSegments: 96,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, b, 0);
  // Squash the straight wall to the local deck height but keep the top bevel's shape intact.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), hz = deckH(p.getZ(i));
    p.setY(i, y <= H - b ? y * (hz - b) / (H - b) : hz - b + (y - (H - b)));
  }
  return toCreasedNormals(g, Math.PI / 5);
}

function lid(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(deckGeometry(), MAT.sage, "lid-deck"));
  // Snap skirt over the rim.
  const r = LID.r, sk = LID.skirt, rin = CUP.rTop + 0.4;
  const skirt: [number, number][] = [[rin, 0.5], [rin, -sk + 1], [rin + 0.6, -sk], [r - 0.6, -sk], [r, -sk + 1.5], [r, 0.5]];
  g.add(mesh(lathe(skirt, 128), MAT.sage, "lid-skirt"));
  // Pull tab on the left (-x), away from the handle: Oralflo's lift-off point.
  const tab = mesh(plinth(roundedRect(7, 14, 3), 2.4, 1), MAT.sage, "lid-tab");
  tab.position.set(-r - 2.5, -sk + 0.4, 0);
  g.add(tab);
  return g;
}

// The bore runs grill → up the well → bends 20° back at the deck → out the spout.
const SP = LID.spout, WL = LID.well;
const LEAN = SP.lean * RAD;
const DECK_S = deckH(SP.z);                 // deck height where the spout leaves it
const SPOUT_TIP = new THREE.Vector3(0, DECK_S + SP.len * Math.cos(LEAN), SP.z - SP.len * Math.sin(LEAN));
const GRILL_TOP = WL.y + 0.8;
// The ramp's ends: just inside the back port, and the back edge of the well's pocket.
const RAMP_Z0 = -LID.r + 3, RAMP_Z1 = WL.z - WL.r;
const RAMP_SLOPE = Math.atan2(LID.ramp.yBack - GRILL_TOP, RAMP_Z1 - RAMP_Z0);
const WINDOW = 130 * RAD;                   // the pocket's back opening, where the ramp comes in

/** Cup-local points the mouthful follows on its way out: grill, top of the well, spout tip. */
export const BORE_PATH = [
  new THREE.Vector3(0, CUP.h + GRILL_TOP, WL.z),
  new THREE.Vector3(0, CUP.h + DECK_S, SP.z),
  SPOUT_TIP.clone().setY(SPOUT_TIP.y + CUP.h),
];

/** Cup-local ends of the ramp floor's centre line: just inside the back port, and its foot at the well. */
export const RAMP_PATH = [
  new THREE.Vector3(0, CUP.h + LID.ramp.yBack, RAMP_Z0),
  new THREE.Vector3(0, CUP.h + GRILL_TOP, RAMP_Z1),
];

function spout(): THREE.Object3D {
  const { od, id, len, ribs } = SP;
  const ro = od / 2, ri = id / 2, sink = 6;
  // Tube wall as a lathe along +y, with a rolled lip at the mouth.
  const prof: [number, number][] = [[ri, -sink], [ri, len - 1.2]];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI - (i / 8) * Math.PI;
    prof.push([(ri + ro) / 2 + Math.cos(a) * (ro - ri) / 2, len - 1.2 + Math.sin(a) * 1.4]);
  }
  prof.push([ro, len - 1.2], [ro, -sink]);
  const tube = new THREE.Group();
  tube.add(mesh(lathe(prof, 64), MAT.sage, "spout-tube"));
  // Ribbed mouthpiece: soft rings where the lips close.
  for (let i = 0; i < ribs; i++) {
    const rib = mesh(new THREE.TorusGeometry(ro + 0.1, 0.75, 10, 48), MAT.sageDeep, "rib");
    rib.rotation.x = Math.PI / 2;
    rib.position.y = len - 5 - i * 4.5;
    tube.add(rib);
  }
  // Lean the tube back, away from the drinker: +y axis → (0, cos, -sin).
  tube.rotation.x = -LEAN;
  tube.position.set(0, DECK_S, SP.z);
  // Oralflo's shoulder: an upright boss the tube leans out of, sunk into the deck's slope.
  const boss: [number, number][] = [[0, 9], [ro + 1, 9]];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    boss.push([ro + 1 + 6 * (1 - Math.cos(a)), 9 - 9 * Math.sin(a)]);
  }
  boss.push([ro + 7, -3], [0, -3]);
  const collar = mesh(lathe(boss, 64), MAT.sage, "spout-boss");
  collar.position.set(0, DECK_S, SP.z);
  const g = new THREE.Group();
  g.add(tube, collar);
  return g;
}

function well(): THREE.Object3D {
  // Vertical pocket under the spout, hung from the deck. Its lower 14 mm is open at the back
  // for the ramp; above that a funnel narrows it to the spout's bore.
  const g = new THREE.Group();
  const open = MAT.lid.clone();             // the window shows the wall's inside
  open.side = THREE.DoubleSide;
  const t = 1.4, ri = SP.id / 2, y0 = WL.y - 2, yw = WL.y + 14, yf = WL.y + 22, yTop = DECK_S - 2;
  const pocket: [number, number][] = [[WL.r, y0], [WL.r, yw], [WL.r + t, yw], [WL.r + t, y0], [WL.r, y0]];
  g.add(mesh(new THREE.LatheGeometry(pocket.map(([r, y]) => new THREE.Vector2(r, y)), 48, Math.PI + WINDOW / 2, 2 * Math.PI - WINDOW), open, "well-pocket"));
  const neck: [number, number][] = [[WL.r, yw], [ri, yf], [ri, yTop], [ri + t, yTop], [ri + t, yf + 1], [WL.r + t, yw], [WL.r, yw]];
  g.add(mesh(lathe(neck, 48), open, "well-funnel"));
  g.position.z = WL.z;
  return g;
}

function grill(): THREE.Object3D {
  // Slotted floor across the pocket: tablets sit dry on it, water comes up through it.
  const g = new THREE.Group();
  const r = WL.r - 0.4;
  for (const x of [-8, -4, 0, 4, 8]) {
    const l = 2 * Math.sqrt(r * r - x * x);
    const bar = mesh(new THREE.CapsuleGeometry(0.8, l - 1.6, 4, 8), MAT.lid, "grill-bar");
    bar.rotation.x = Math.PI / 2;
    bar.position.set(x, WL.y, WL.z);
    g.add(bar);
  }
  const ring = mesh(new THREE.TorusGeometry(r, 0.9, 8, 48), MAT.lid, "grill-ring");
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, WL.y - 0.4, WL.z);
  g.add(ring);
  return g;
}

function ramp(): THREE.Object3D {
  // U-channel from just inside the back port, down under the rim, into the well's back opening.
  const g = new THREE.Group();
  const { w, yBack } = LID.ramp;
  const run = RAMP_Z1 - RAMP_Z0, drop = yBack - GRILL_TOP;
  const L = Math.hypot(run, drop);
  const ch = new THREE.Group();
  ch.add(mesh(new THREE.BoxGeometry(w, 1.2, L), MAT.lid, "ramp-floor"));
  for (const sx of [-1, 1]) {
    const wall = mesh(new THREE.BoxGeometry(1.2, 7, L), MAT.lid, "ramp-wall");
    wall.position.set(sx * (w / 2 + 0.6), 3, 0);
    ch.add(wall);
  }
  ch.rotation.x = RAMP_SLOPE;             // front end lower
  ch.position.set(0, (yBack + GRILL_TOP) / 2 - 0.6, (RAMP_Z0 + RAMP_Z1) / 2);
  g.add(ch);
  return g;
}

function shutter(): THREE.Object3D {
  // A curved door flush with the lid's back wall, sprung shut. A steel slug lets the tower's
  // magnet pull it open through the plastic; off the dock it stays shut and can't be poked open.
  const g = new THREE.Group();
  const { w, h, y } = LID.port;
  const half = w / 2 / LID.r;
  const door = mesh(new THREE.CylinderGeometry(LID.r + 0.25, LID.r + 0.25, h, 24, 1, true, Math.PI - half, 2 * half), MAT.sageDeep, "shutter");
  door.position.y = y;
  g.add(door);
  // Thin seam outline so it reads as a door, not a decal.
  const seam = roundedRect(w + 2, h + 2, 2);
  seam.holes.push(roundedRect(w, h, 1.5));
  const seamMesh = mesh(new THREE.ShapeGeometry(seam, 8), MAT.shellDark, "seam");
  seamMesh.position.set(0, y, -LID.r - 0.3);
  seamMesh.rotation.y = Math.PI;
  g.add(seamMesh);
  const slug = mesh(new THREE.BoxGeometry(6, 3, 1.4), MAT.steel, "steel-slug");
  slug.position.set(0, y, -LID.r + 1.4);
  g.add(slug);
  return g;
}

function mouthful(): THREE.Object3D {
  // One cell's worth, each tablet in its marker capsule: two in the well's pocket, the third
  // still on the foot of the ramp. They go up the bore single file, lengthways.
  const g = new THREE.Group();
  const [a, b, c] = MEDS;
  const pa = pod(a); pa.position.set(-0.6, GRILL_TOP + podD(a) / 2, WL.z); pa.rotation.y = 0.05;
  const pb = pod(b, POD.len + 2); pb.position.set(1.2, GRILL_TOP + podD(a) + podD(b) / 2 - 1.2, WL.z + 0.5); pb.rotation.set(-0.12, -0.1, 0.2);
  const zc = RAMP_Z1 - POD.len / 2 - 1;
  const pc = pod(c); pc.position.set(0, GRILL_TOP + (RAMP_Z1 - zc) * Math.tan(RAMP_SLOPE) + podD(c) / 2, zc); pc.rotation.x = RAMP_SLOPE;
  g.add(pa, pb, pc);
  return g;
}

export function buildCup(): PartDef[] {
  const atRim = (o: THREE.Object3D) => { o.position.y += CUP.h; return o; };
  const deg = (r: number) => `${(r / RAD).toFixed(0)}°`;
  return [
    {
      id: "cup-body", name: "Cup body", assembly: "cup",
      role: "Plain tapered cup with a moulded rail for the handle. No electronics, so it goes straight in the dishwasher.",
      specs: [["Material", "Polypropylene, opaque white"], ["Fill", "≈250 mL"], ["Height", `${CUP.h} mm`], ["Rim", `Ø${CUP.rTop * 2} mm`]],
      object: body(), explode: new THREE.Vector3(0, 0, 0),
    },
    {
      id: "water", name: "Water", assembly: "cup",
      role: "Sits 13 mm below the grill, so the tablets stay dry until the cup is tipped to drink. Drag Sip to watch it reach them.",
      specs: [["Fill", "≈250 mL"], ["Dry margin", `${CUP.h - CUP.fillY + WL.y} mm`], ["Measured by", "Load cell in the dock"]],
      object: water(), explode: new THREE.Vector3(0, 0, 0), internal: true,
    },
    {
      id: "lid", name: "Snap-on lid", assembly: "cup",
      role: "Low and nearly flat, because its back edge ends up at nose height when she drinks. Snaps over the rim and lifts off by the tab.",
      specs: [["Material", "Polypropylene"], ["Height", `${LID.deckBack}–${LID.deckFront} mm above rim`], ["Clean", "Dishwasher"]],
      object: atRim(lid()), explode: new THREE.Vector3(0, 80, 0),
    },
    {
      id: "spout", name: "Spout", assembly: "cup",
      role: "Fixed tube at the front edge, leaning back over the lid like Oralflo's. Tipped ~95° to drink, it points slightly up into the mouth, so the head stays level.",
      specs: [["Lean", `${SP.lean}° back from vertical`], ["At the lips", `${90 - SIP.tilt + SP.lean}° above level, cup tipped ${SIP.tilt}°`], ["Bore", `Ø${SP.id} mm (20 mm caplet)`], ["Mouthpiece", `${SP.ribs} soft ribs`]],
      object: atRim(spout()), explode: new THREE.Vector3(0, 80, 0),
    },
    {
      id: "port-shutter", name: "Back port", assembly: "cup",
      role: "Flush sprung shutter in the lid's back wall. The tower's magnet opens it through the plastic: no tongue, no contacts.",
      specs: [["Opening", `${LID.port.w} × ${LID.port.h} mm`], ["Opened by", "Magnet in the tower"], ["Off the dock", "Shut and locked"]],
      object: atRim(shutter()), explode: new THREE.Vector3(0, 80, -28),
    },
    {
      id: "ramp", name: "Lid ramp", assembly: "cup",
      role: "Gravity channel hung under the lid. It dips below the rim into the cup's headspace, so the lid needs no hump at the back to house it.",
      specs: [["Slope", `≈${deg(RAMP_SLOPE)} docked, past vertical when drinking`], ["Run", `${RAMP_Z1 - RAMP_Z0} mm`], ["Width", `${LID.ramp.w} mm`]],
      object: atRim(ramp()), explode: new THREE.Vector3(0, 62, 0), internal: true,
    },
    {
      id: "well", name: "Well", assembly: "cup",
      role: "Vertical pocket under the spout, open at the back to the ramp, then a funnel into the bore. The bore bends back 20° at the deck: a straight one would run out through the cup's front wall.",
      specs: [["Pocket", `Ø${WL.r * 2} mm`], ["Bend", `${SP.lean}° at the deck`], ["Docked", "Points straight up"], ["Drinking", `≈${SIP.tilt - 90}° below level, into the spout`]],
      object: atRim(well()), explode: new THREE.Vector3(0, 62, 0), internal: true,
    },
    {
      id: "grill", name: "Grill", assembly: "cup",
      role: "Oralflo's trick: tablets wait dry on the grill and go up the spout together with the first water.",
      specs: [["Area", `Ø${WL.r * 2} mm`], ["Height", `${-WL.y} mm below the rim`], ["Holds", "1 mouthful (≤3 capsules)"]],
      object: atRim(grill()), explode: new THREE.Vector3(0, 48, 0), internal: true,
    },
    {
      id: "mouthful", name: "Mouthful (marker pods)", assembly: "cup",
      role: "One cell's worth from the tower: up to three whole tablets, each in a clear-bodied capsule whose seal band carries the breath marker.",
      specs: [["Capsule", `Tablet Ø + ${POD.clearance} mm, ≈${POD.len} mm long`], ["Marker", "Food-safe tracer in the seal band"], ["Through the spout", "Single file, lengthways"], ["Wet time", "Only while drinking"]],
      object: atRim(mouthful()), explode: new THREE.Vector3(0, 36, 0), internal: true,
    },
  ];
}
