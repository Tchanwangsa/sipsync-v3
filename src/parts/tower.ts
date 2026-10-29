import * as THREE from "three";
import type { PartDef } from "../types";
import { MAT } from "../materials";
import { roundedRect, plinth, lathe, mesh } from "../geo";
import { DOCK, TOWER, LID, PORT_WORLD } from "../dims";
import { MEDS, POD, pod, podD } from "../pod";
import { toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";

// Medication tower + dock, built directly in WORLD coordinates (see dims.ts).
// The tower stands behind the cup (-z) with a full-height cove the cup nests into.
//
// Loading, once a week: tablet into the feed slot → size gauge → wrap station puts it in a
//   marker capsule → filing lift pushes it into its cell. (Pilot: a pharmacy-packed week
//   cartridge replaces the magazine and the wrap station is skipped.)
// Dose path, all by gravity, nothing reaches over the cup:
//   magazine cell → drop channel (break-beam) → sloped chute → flush outlet in the cove
//   → lid's back shutter (pulled open by the tower magnet) → lid ramp → grill.
// Proof: after a sip the cup comes back to the dock, the magnet opens the shutter again and
//   the breath sensor draws a sample from the lid through the outlet.

const DK = { xMin: -70, xMax: DOCK.xMax, zMin: -132, zMax: DOCK.zMax }; // dock grown 2–4 mm past the tower
const FRONT_R = 12;      // front corner radius (back corners use TOWER.r)
const HATCH_H = 10;      // top hatch thickness
const BODY_H = TOWER.h - HATCH_H;
const DECK_R = 36;       // carousel deck radius, clears the cove
const DECK_WALL = 22;

const T0 = DOCK.h;                              // tower floor, world y
const FRONT_Z = TOWER.z + TOWER.d / 2;          // flat front shoulders, z = -32
const BACK_Z = TOWER.z - TOWER.d / 2;
const COVE_X = Math.sqrt(TOWER.coveR ** 2 - FRONT_Z ** 2); // where the cove meets the front face
const PY = PORT_WORLD.y;                        // outlet centre height
const DECK_C = { x: TOWER.x, z: TOWER.z - 6 };
const MAG_Y = T0 + TOWER.magY0;
const DROP_DIR = new THREE.Vector2(44 - DECK_C.x, -66 - DECK_C.z).normalize();
const DROP = { x: DECK_C.x + DROP_DIR.x * (DECK_R + 7), z: DECK_C.z + DROP_DIR.y * (DECK_R + 7) };
const CHUTE_FROM = new THREE.Vector3(DROP.x, 152, DROP.z);
const CHUTE_TO = new THREE.Vector3(PORT_WORLD.x, PY - 1, -TOWER.coveR - 3);

// Wrap station: a strip down the left (-x) side, between the decks and the shell wall.
const WS_X = TOWER.x - TOWER.w / 2 + 13;
const MAG_TOP = MAG_Y + TOWER.decks * TOWER.deckH;
const PRESS_Y = T0 + 66;
const FEED = { x: WS_X + 2, z: FRONT_Z - 14 };   // feed slot / tube, front-left
const LIFT_Z = DECK_C.z;                          // lift faces the decks' filing gate at 180°
const BODY_Z = LIFT_Z - 18, CAPS_Z = LIFT_Z + 20;
const CAR_Y = MAG_Y + TOWER.deckH + 6;            // filing lift carriage, parked at deck 2
const BREATH_INLET = new THREE.Vector3(LID.port.w / 2 + 2.5, PY - LID.port.h / 2 - 1, -TOWER.coveR + 1.6);
const BREATH_AT = new THREE.Vector3(20, PY - 6, -TOWER.coveR - 12);

/** World anchors the scenario player animates along (see scenarios.ts). */
export const TOWER_ANCHORS = {
  deckC: DECK_C, magY: MAG_Y, deckR: DECK_R, dropDir: DROP_DIR, drop: DROP,
  chuteFrom: CHUTE_FROM, chuteTo: CHUTE_TO,
  beamY: CHUTE_FROM.y + 8, beamAcross: new THREE.Vector3(-DROP_DIR.y, 0, -DROP_DIR.x),
  magnet: new THREE.Vector3(0, PY - 16, -TOWER.coveR - 10),
  tof: new THREE.Vector3(-1, PY + 4.5, -TOWER.coveR - 1.4),
  breathInlet: BREATH_INLET, breathSensor: BREATH_AT,
  halo: new THREE.Vector3(0, T0 + BODY_H - 18, -TOWER.coveR + 4),
  feed: new THREE.Vector3(FEED.x, T0 + TOWER.h, FEED.z),
  press: new THREE.Vector3(WS_X, PRESS_Y + 14, FEED.z), gaugeY: PRESS_Y + 36,
  wsX: WS_X, liftZ: LIFT_Z, carY: CAR_Y,
};

const deg = (r: number) => Math.round(THREE.MathUtils.radToDeg(r));
const disc = (r: number, h: number, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg);
function faceDisc(r: number, h: number, seg = 48): THREE.BufferGeometry {
  const g = disc(r, h, seg);
  g.rotateX(Math.PI / 2);
  return g;
}
/** Rounded panel in the xy plane, extruded toward +z from z = 0. */
function facePanel(w: number, h: number, r: number, depth: number, bevel = 0.8): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.5)), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16,
  });
  g.translate(0, 0, bevel);
  return toCreasedNormals(g, Math.PI / 5);
}

/**
 * Tower plan outline in world (x, -z): rounded rectangle with a circular bite
 * (the cove, centred on the cup axis) out of the front edge. `inset` shrinks it
 * so a plinth bevel of the same size lands back on the true outline.
 */
function towerOutline(inset: number): THREE.Shape {
  const R = TOWER.coveR + inset;
  const xl = TOWER.x - TOWER.w / 2 + inset, xr = TOWER.x + TOWER.w / 2 - inset;
  const yf = -FRONT_Z + inset, yb = -BACK_Z - inset;
  const rf = FRONT_R - inset, rb = TOWER.r - inset;
  const xc = Math.sqrt(R * R - yf * yf);
  const s = new THREE.Shape();
  s.moveTo(xc, yf);
  s.lineTo(xr - rf, yf); s.quadraticCurveTo(xr, yf, xr, yf + rf);
  s.lineTo(xr, yb - rb); s.quadraticCurveTo(xr, yb, xr - rb, yb);
  s.lineTo(xl + rb, yb); s.quadraticCurveTo(xl, yb, xl, yb - rb);
  s.lineTo(xl, yf + rf); s.quadraticCurveTo(xl, yf, xl + rf, yf);
  s.lineTo(-xc, yf);
  s.absarc(0, 0, R, Math.atan2(yf, -xc), Math.atan2(yf, xc), true);
  return s;
}

/** Vertical prism from a world-coordinate plan shape (geo.plinth with more arc segments). */
function towerPrism(inset: number, height: number, bevel: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(towerOutline(inset), {
    depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 6, curveSegments: 40,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return toCreasedNormals(g, Math.PI / 5);
}

// ─────────────────────────────────────────────────────────────── dock

function buildDock(): PartDef {
  const g = new THREE.Group();
  const w = DK.xMax - DK.xMin, d = DK.zMax - DK.zMin;
  const cx = (DK.xMin + DK.xMax) / 2, cz = (DK.zMin + DK.zMax) / 2;
  const b = 3;

  // Plate with a through-hole for the seat; the bevel rounds the seat lip too.
  const outline = roundedRect(w - 2 * b, d - 2 * b, DOCK.r - b);
  const hole = new THREE.Path();
  hole.absarc(-cx, cz, DOCK.seatR + b, 0, Math.PI * 2, true);
  outline.holes.push(hole);
  const plate = mesh(plinth(outline, DOCK.h, b), MAT.shell, "dock-plate");
  plate.position.set(cx, 0, cz);
  g.add(plate);

  // Floating seat platen (rides on the load cell), recessed DOCK.seatDepth below the top.
  const top = DOCK.h - DOCK.seatDepth;
  g.add(mesh(lathe([
    [0, top - 4], [DOCK.seatR - 0.8, top - 4], [DOCK.seatR - 0.8, top - 0.8], [DOCK.seatR - 1.6, top], [0, top],
  ]), MAT.sage, "seat-platen"));

  for (const [fx, fz] of [[DK.xMin + 18, DK.zMin + 18], [DK.xMin + 18, DK.zMax - 18],
                          [DK.xMax - 18, DK.zMin + 18], [DK.xMax - 18, DK.zMax - 18]]) {
    const foot = mesh(disc(7, 1.2, 24), MAT.shellDark, "foot");
    foot.position.set(fx, 0.2, fz);
    g.add(foot);
  }

  return {
    id: "dock", name: "Dock", assembly: "tower",
    role: "One moulded base under the tower and the cup seat, so the cup always lands with its back port on the outlet.",
    specs: [
      ["Footprint", `${w} × ${d} mm`],
      ["Cup seat", `Ø${DOCK.seatR * 2} mm recess on a floating platen`],
      ["Locating", "Seat magnets pull the cup square to the cove"],
      ["Power at the cup", "None: the cup and handle are passive"],
    ],
    object: g, explode: new THREE.Vector3(0, 0, 0),
  };
}

function buildLoadCell(): PartDef {
  const g = new THREE.Group();
  const beam = mesh(plinth(roundedRect(64, 12, 2), 6, 0.8), MAT.steel, "load-beam");
  beam.position.set(0, 1.2, 0);
  g.add(beam);
  const gauge = mesh(new THREE.BoxGeometry(10, 0.4, 7), MAT.copper, "strain-gauge");
  gauge.position.set(0, 7.4, 0);
  g.add(gauge);
  const mount = mesh(plinth(roundedRect(12, 16, 2), 3, 0.6), MAT.motor, "mount");
  mount.position.set(-26, 0, 0);
  g.add(mount);
  const post = mesh(disc(6, 1.6, 32), MAT.motor, "post");
  post.position.set(26, 7.6, 0);
  g.add(post);
  // Locating magnets around the seat rim: they pull the cup's foot ring square to the cove.
  for (const a of [Math.PI / 2, Math.PI / 2 + 2.1, Math.PI / 2 - 2.1]) {
    const m = mesh(disc(3, 2, 20), MAT.steel, "seat-magnet");
    m.position.set(Math.cos(a) * (DOCK.seatR - 7), 5.2, -Math.sin(a) * (DOCK.seatR - 7));
    g.add(m);
  }
  return {
    id: "load-cell", name: "Seat load cell", assembly: "tower",
    role: "Weighs the cup on every lift and return: cup present, sip taken, and how much was drunk.",
    specs: [
      ["Type", "Single-point strain-gauge beam"],
      ["Range", "0–1 kg, ~0.5 g resolution"],
      ["Confirms", "Lifted, returned, volume drunk"],
      ["Can't see", "Tablet mass under water noise"],
    ],
    object: g, explode: new THREE.Vector3(0, 0, 95), internal: true,
  };
}

// ─────────────────────────────────────────────────────────────── tower shell

function buildBody(): PartDef {
  const g = new THREE.Group();
  const b = 6;
  const shell = mesh(towerPrism(b, BODY_H, b), MAT.shell, "tower-shell");
  shell.position.y = T0;
  g.add(shell);

  // USB-C power inlet on the back.
  const inlet = mesh(facePanel(12, 5, 2.4, 0.5, 0.4), MAT.chip, "usb-c");
  inlet.rotation.y = Math.PI;
  inlet.position.set(TOWER.x, T0 + 22, BACK_Z + 0.4);
  g.add(inlet);

  return {
    id: "tower-body", name: "Tower shell", assembly: "tower",
    role: "Bench-top housing behind the cup; its full-height cove cradles the cup so it docks by just being set down.",
    specs: [
      ["Size", `${TOWER.w} × ${TOWER.d} × ${TOWER.h} mm`],
      ["Cove", `R${TOWER.coveR} mm, centred on the cup`],
      ["Material", "Warm-white PC/ABS"],
      ["Power", "USB-C, backup cell inside"],
    ],
    object: g, explode: new THREE.Vector3(0, 0, 0),
  };
}

function buildHatch(): PartDef {
  const g = new THREE.Group();
  const y0 = T0 + BODY_H + 0.8;
  const lid = mesh(towerPrism(3, HATCH_H - 0.8, 3), MAT.shell, "hatch");
  lid.position.y = y0;
  g.add(lid);
  // Soft-touch sage inlay.
  const inlay = mesh(plinth(roundedRect(TOWER.w - 40, 38, 14), 1.6, 0.6), MAT.sage, "hatch-inlay");
  inlay.position.set(TOWER.x, y0 + HATCH_H - 1.6, TOWER.z - 18);
  g.add(inlay);
  // Lock indicator near the front right shoulder.
  const lock = mesh(plinth(roundedRect(10, 3.6, 1.8), 0.8, 0.3), MAT.sageDeep, "lock-pill");
  lock.position.set(TOWER.x + 44, y0 + HATCH_H - 1, FRONT_Z - 9);
  g.add(lock);
  const dot = mesh(disc(1, 0.6, 16), MAT.led, "lock-led");
  dot.position.set(TOWER.x + 44, y0 + HATCH_H - 0.4, FRONT_Z - 16);
  g.add(dot);
  // Hinge knuckles at the back.
  for (const x of [-36, 36]) {
    const k = mesh(disc(2.6, 16, 20), MAT.shellDark, "hinge");
    k.rotation.z = Math.PI / 2;
    k.position.set(TOWER.x + x, y0 + 2, BACK_Z + 4);
    g.add(k);
  }
  return {
    id: "top-hatch", name: "Top hatch", assembly: "tower",
    role: "Service lid over the magazine and the capsule supply. Day to day you load through the feed slot; the pilot's pharmacy cartridge drops in here instead.",
    specs: [
      ["Lock", "Solenoid latch, app-unlocked"],
      ["Opens for", "Capsule refills · pharmacy week cartridge"],
      ["Indicator", "Sage pill + dot lit while open"],
      ["Hinge", "Rear, stays open at 100°"],
    ],
    object: g, explode: new THREE.Vector3(0, 120, 0),
  };
}

function buildCue(): PartDef {
  const g = new THREE.Group();
  // Halo: a warm light arc high in the cove, right above the cup.
  const rh = TOWER.coveR - 0.6, yh = T0 + BODY_H - 18;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 32; i++) {
    const a = THREE.MathUtils.degToRad(62 + (56 * i) / 32);
    pts.push(new THREE.Vector3(Math.cos(a) * rh, yh, -Math.sin(a) * rh));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 1.4, 10, false), MAT.led, "halo"));

  // Next-dose display: a vertical pill on the right shoulder.
  const sx = (COVE_X + TOWER.w / 2 - FRONT_R) / 2 + 3;
  const disp = mesh(facePanel(11, 40, 5, 0.4, 0.4), MAT.lens, "display");
  disp.position.set(sx, T0 + 200, FRONT_Z - 0.3);
  g.add(disp);
  for (const [dy, w] of [[8, 6], [0, 7], [-8, 5]] as const) {
    const seg = mesh(facePanel(w, 2, 1, 0.1, 0.2), MAT.led, "display-glyph");
    seg.position.set(sx, T0 + 200 + dy, FRONT_Z + 0.75);
    g.add(seg);
  }
  // Speaker grille on the left shoulder.
  const holeGeo = faceDisc(1.1, 0.6, 12);
  const cols = 2, rows = 6, step = 5.5;
  const grille = new THREE.InstancedMesh(holeGeo, MAT.shellDark, cols * rows);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(-sx + (c - 0.5) * step, T0 + 60 + (r - (rows - 1) / 2) * step, FRONT_Z + 0.1);
      grille.setMatrixAt(i++, m);
    }
  }
  grille.name = "grille";
  g.add(grille);
  return {
    id: "cue-speaker", name: "Halo, display & tone", assembly: "tower",
    role: "Dose-time cue: the halo above the cup glows, a low tone plays, and the shoulder display shows what's next.",
    specs: [
      ["Halo", "Warm light arc in the cove"],
      ["Tone", "Below 1 kHz, for hearing loss"],
      ["Display", "Next dose, low-glare"],
      ["Also cues", "MedSync phone alert · \"have a sip\" for the breath check"],
    ],
    object: g, explode: new THREE.Vector3(0, 0, 0),
  };
}

// ─────────────────────────────────────────────────────────────── magazine

function buildDeck(k: number): PartDef {
  const g = new THREE.Group();
  const n = TOWER.cellsPerDeck;
  const floor = mesh(disc(DECK_R, 1.6, 64), MAT.lid, "deck-floor");
  floor.position.y = 0.8;
  g.add(floor);
  g.add(mesh(lathe([[DECK_R - 1.4, 0], [DECK_R, 0], [DECK_R, DECK_WALL], [DECK_R - 1.4, DECK_WALL], [DECK_R - 1.4, 0]], 64),
    MAT.lid, "deck-wall"));
  const hub = mesh(disc(7, TOWER.deckH - 2, 32), MAT.sage, "deck-hub");
  hub.position.y = (TOWER.deckH - 2) / 2;
  g.add(hub);
  const divLen = DECK_R - 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const div = mesh(new THREE.BoxGeometry(divLen, DECK_WALL - 2, 1.4), MAT.shellDark, "divider");
    div.position.set(Math.cos(a) * (7 + divLen / 2), (DECK_WALL - 2) / 2 + 1.6, -Math.sin(a) * (7 + divLen / 2));
    div.rotation.y = a;
    g.add(div);
    const mid = a + Math.PI / n;
    // Filing gate in the outer wall of every cell: the wrap station's lift pushes capsules in here.
    const gate = mesh(new THREE.BoxGeometry(1, 10, 9), MAT.sageDeep, "filing-gate");
    gate.position.set(Math.cos(mid) * (DECK_R + 0.3), 7, -Math.sin(mid) * (DECK_R + 0.3));
    gate.rotation.y = mid;
    g.add(gate);
    // Most cells hold a mouthful of capsules lying radially, stacked (a fixed pattern, not real data).
    if ((i + k) % 4 === 3) continue;
    const count = 1 + ((i * 2 + k) % 2);
    let y = 1.6;
    for (let j = 0; j < count; j++) {
      const med = MEDS[(i + j + k) % MEDS.length];
      const p = pod(med);
      const rr = 21 - j * 1.5;
      p.position.set(Math.cos(mid) * rr, y + podD(med) / 2, -Math.sin(mid) * rr);
      p.rotation.y = mid + Math.PI / 2;     // capsule's long axis along the radius
      y += podD(med) - 0.4;
      g.add(p);
    }
  }
  g.position.set(DECK_C.x, MAG_Y + k * TOWER.deckH, DECK_C.z);
  const total = TOWER.decks * n;
  return {
    id: `magazine-deck-${k + 1}`, name: `Magazine deck ${k + 1}`, assembly: "tower",
    role: `Deck ${k + 1} of ${TOWER.decks} in the week magazine: ${n} mouthful cells, filled through their side gates at loading and turned past the drop station one at a time.`,
    specs: [
      ["Cells", `${n} × one mouthful (1–3 marker capsules)`],
      ["Cell", `${DECK_R - 7} mm radial × ${DECK_WALL} mm deep`],
      ["Magazine", `${total} mouthfuls = 7 days × ${total / 7}`],
      ["Storage", "Dry and locked in the tower"],
    ],
    object: g, explode: new THREE.Vector3(0, 30 + k * 20, 0), internal: true,
  };
}

function buildIndexDrive(): PartDef {
  const g = new THREE.Group();
  const stepper = mesh(plinth(roundedRect(35, 35, 4), 22, 1.2), MAT.motor, "stepper");
  stepper.position.set(DECK_C.x, MAG_Y - 25, DECK_C.z);
  g.add(stepper);
  const spindleH = TOWER.decks * TOWER.deckH + 4;
  const spindle = mesh(disc(2.5, spindleH, 20), MAT.steel, "spindle");
  spindle.position.set(DECK_C.x, MAG_Y - 3 + spindleH / 2, DECK_C.z);
  g.add(spindle);
  for (let k = 0; k < TOWER.decks; k++) {
    const clutch = mesh(disc(8.5, 2, 32), MAT.copper, "clutch");
    clutch.position.set(DECK_C.x, MAG_Y + k * TOWER.deckH - 0.5, DECK_C.z);
    g.add(clutch);
  }
  // Vertical drop channel beside the decks.
  const rotY = -Math.atan2(DROP_DIR.y, DROP_DIR.x);
  const chanH = MAG_Y + TOWER.decks * TOWER.deckH - CHUTE_FROM.y;
  const chan = mesh(plinth(roundedRect(11, 20, 4), chanH, 1), MAT.ledOff, "drop-channel");
  chan.rotation.y = rotY;
  chan.position.set(DROP.x, CHUTE_FROM.y, DROP.z);
  g.add(chan);
  // IR break-beam pair across the bottom of the channel: "a mouthful dropped".
  const across = new THREE.Vector3(-DROP_DIR.y, 0, -DROP_DIR.x); // perpendicular in plan
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.BoxGeometry(4, 4, 4), MAT.chip, s < 0 ? "ir-emitter" : "ir-receiver");
    eye.position.set(DROP.x + across.x * s * 9, CHUTE_FROM.y + 8, DROP.z + across.z * s * 9);
    eye.rotation.y = rotY;
    g.add(eye);
  }
  // Sloped chute from the channel foot to the outlet slot.
  g.add(mesh(new THREE.TubeGeometry(new THREE.LineCurve3(CHUTE_FROM, CHUTE_TO), 1, 7, 20), MAT.ledOff, "chute"));

  const slope = Math.atan2(CHUTE_FROM.y - CHUTE_TO.y, Math.hypot(CHUTE_TO.x - CHUTE_FROM.x, CHUTE_TO.z - CHUTE_FROM.z));
  return {
    id: "index-drive", name: "Index drive & drop path", assembly: "tower",
    role: "One stepper turns the selected deck to the drop station; the cell tips into the drop channel and rolls down the chute to the outlet.",
    specs: [
      ["Motor", "NEMA-14 stepper, shared spindle"],
      ["Selection", "Clutch engages one deck at a time"],
      ["Chute", `${deg(slope)}° to the outlet`],
      ["Sensing", "IR break-beam: mouthful dropped"],
    ],
    object: g, explode: new THREE.Vector3(-110, 0, 0), internal: true,
  };
}

// ─────────────────────────────────────────────────────────────── outlet & sensing

function buildOutlet(): PartDef {
  const g = new THREE.Group();
  const w = LID.port.w + 1, h = LID.port.h + 1;
  const outer = roundedRect(w + 8, h + 8, 6);
  const hole = new THREE.Path(roundedRect(w, h, 4).getPoints(12).reverse());
  outer.holes.push(hole);
  const ring = new THREE.ExtrudeGeometry(outer, {
    depth: 1, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 3, curveSegments: 16,
  });
  const gasket = mesh(toCreasedNormals(ring, Math.PI / 5), MAT.silicone, "gasket");
  gasket.position.set(PORT_WORLD.x, PY, -TOWER.coveR + 1);
  g.add(gasket);
  const mouth = mesh(new THREE.BoxGeometry(w, h, 0.4), MAT.chip, "outlet-mouth");
  mouth.position.set(PORT_WORLD.x, PY, -TOWER.coveR + 0.8);
  g.add(mouth);
  return {
    id: "outlet", name: "Outlet", assembly: "tower",
    role: "Flush slot in the cove that meets the lid's back shutter; the mouthful rolls straight through onto the lid ramp.",
    specs: [
      ["Opening", `${w} × ${h} mm`],
      ["Seal", "Soft silicone gasket"],
      ["Gap to lid", `${TOWER.coveR - LID.r - 2} mm`],
      ["Moving parts", "None at the slot"],
      ["Also", "Breath sample inlet in the gasket"],
    ],
    object: g, explode: new THREE.Vector3(0, 0, 0),
  };
}

function buildShutterMagnet(): PartDef {
  const g = new THREE.Group();
  const y = PY - 16, z = -TOWER.coveR - 10;
  const coil = mesh(faceDisc(5.5, 13, 32), MAT.copper, "coil");
  coil.position.set(0, y, z);
  g.add(coil);
  const core = mesh(faceDisc(2.2, 15, 20), MAT.steel, "core");
  core.position.set(0, y, z + 0.5);
  g.add(core);
  const yoke = mesh(new THREE.BoxGeometry(14, 2, 15), MAT.motor, "yoke");
  yoke.position.set(0, y - 6.5, z);
  g.add(yoke);
  return {
    id: "shutter-magnet", name: "Shutter magnet", assembly: "tower",
    role: "Electromagnet just under the outlet: pulls the steel slug in the lid's shutter down through the plastic to open it.",
    specs: [
      ["Type", "Pull solenoid, energised ~1 s"],
      ["Coupling", "Through ~4 mm plastic, no contacts"],
      ["Default", "Off: shutter springs shut"],
    ],
    object: g, explode: new THREE.Vector3(-75, 0, 0), internal: true,
  };
}

function buildGrillSensor(): PartDef {
  const g = new THREE.Group();
  const y = PY + 4.5, z = -TOWER.coveR - 2;
  const board = mesh(new THREE.BoxGeometry(12, 6, 1), MAT.pcb, "tof-board");
  board.position.set(0, y, z - 1);
  g.add(board);
  const chip = mesh(new THREE.BoxGeometry(4.4, 2.4, 1), MAT.chip, "tof-chip");
  chip.position.set(0, y, z);
  g.add(chip);
  const win = mesh(faceDisc(1.2, 0.3, 16), MAT.lens, "tof-window");
  win.position.set(-1, y, z + 0.6);
  g.add(win);
  return {
    id: "grill-sensor", name: "Grill sensor", assembly: "tower",
    role: "Tiny time-of-flight sensor in the outlet that looks down the lid ramp at the grill: empty baseline, mouthful there, mouthful gone.",
    specs: [
      ["Type", "VL53L-class ToF, ~$2"],
      ["Baseline", "Re-read empty grill every dock"],
      ["Confirms", "Landed before lift, gone after return"],
      ["Privacy", "Distance only, no images"],
    ],
    object: g, explode: new THREE.Vector3(75, 0, 0), internal: true,
  };
}

// ─────────────────────────────────────────────────────────────── swallow-proof pod

function buildFeedSlot(): PartDef {
  const g = new THREE.Group();
  const y = T0 + TOWER.h;
  // Soft sage funnel ring on the hatch's front-left corner; one tablet at a time.
  const ring = mesh(lathe([[5.5, 0], [9, 0.2], [10, 1.4], [9.4, 2.2], [6.5, 1.2], [5.5, 0.6]], 48), MAT.sage, "feed-funnel");
  ring.position.set(FEED.x, y, FEED.z);
  g.add(ring);
  const mouth = mesh(disc(5.5, 0.4, 32), MAT.chip, "feed-mouth");
  mouth.position.set(FEED.x, y + 0.1, FEED.z);
  g.add(mouth);
  return {
    id: "feed-slot", name: "Feed slot", assembly: "tower",
    role: "Load the week one tablet at a time while the app says \"next: metoprolol\". No cells to pick, so no cell-picking errors.",
    specs: [
      ["Opening", "Ø11 mm, one tablet at a time"],
      ["Prompt", "MedSync app + shoulder display"],
      ["Wrong tablet", "Size gauge sends it back out"],
      ["When", "Weekly, not at dose time"],
    ],
    object: g, explode: new THREE.Vector3(0, 120, 0),
  };
}

function buildWrapStation(): PartDef {
  const g = new THREE.Group();
  const clear = MAT.ledOff;
  const tube = (x: number, z: number, y0: number, y1: number, r: number, name: string) => {
    const t = mesh(lathe([[r - 0.6, y0], [r, y0], [r, y1], [r - 0.6, y1]], 32), clear, name);
    t.position.set(x, 0, z);
    g.add(t);
  };
  // Feed tube from the slot straight down to the press.
  tube(FEED.x, FEED.z, PRESS_Y + 14, T0 + TOWER.h - HATCH_H, 6, "feed-tube");
  // Capsule supply: a stack of empty bodies and a three-lane cap cartridge (one colour per medicine).
  const stackTop = MAG_TOP - 4;
  tube(WS_X, BODY_Z, PRESS_Y + 14, stackTop, 6, "body-stack");
  for (let y = PRESS_Y + 20; y < stackTop - 6; y += 10) {
    const b = mesh(new THREE.CylinderGeometry(4.8, 4.8, 9, 20, 1, true), MAT.capsuleBody, "empty-body");
    b.position.set(WS_X, y, BODY_Z);
    g.add(b);
  }
  const cart = mesh(plinth(roundedRect(14, 22, 3), stackTop - PRESS_Y - 14, 1), clear, "cap-cartridge");
  cart.position.set(WS_X, PRESS_Y + 14, CAPS_Z);
  g.add(cart);
  const caps = [MAT.capA, MAT.capB, MAT.capC];
  for (let lane = 0; lane < 3; lane++) {
    for (let y = PRESS_Y + 20; y < stackTop - 6; y += 9) {
      const c = mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), caps[lane], "empty-cap");
      c.position.set(WS_X, y, CAPS_Z - 7 + lane * 7);
      g.add(c);
    }
  }
  // Press: a shuttle rail along z under the three feeds, the capsule being closed over the
  // feed tube, and the optical size gauge that checks each tablet before it is sealed.
  const z0 = BODY_Z - 6, z1 = FEED.z + 6;
  const rail = mesh(plinth(roundedRect(16, z1 - z0, 3), 6, 1), MAT.motor, "shuttle-rail");
  rail.position.set(WS_X, PRESS_Y, (z0 + z1) / 2);
  g.add(rail);
  const shuttle = mesh(plinth(roundedRect(14, 16, 3), 8, 1), MAT.sage, "shuttle");
  shuttle.position.set(WS_X, PRESS_Y + 6, FEED.z);
  g.add(shuttle);
  const nest = pod(MEDS[0]);
  nest.name = "nest-pod";
  nest.rotation.x = -Math.PI / 2;      // wrapped standing up; the lift lays it down in the cell
  nest.position.set(WS_X, PRESS_Y + 14 + POD.len / 2, FEED.z);
  g.add(nest);
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.BoxGeometry(3, 4, 4), MAT.chip, "size-gauge");
    eye.position.set(WS_X + s * 8, PRESS_Y + 36, FEED.z);
    g.add(eye);
  }
  // Filing lift: lead screw beside the decks with a carriage that pushes the capsule into its cell.
  const screwH = MAG_TOP - PRESS_Y;
  const screw = mesh(disc(2, screwH, 16), MAT.steel, "lead-screw");
  screw.position.set(WS_X - 4, PRESS_Y + screwH / 2, LIFT_Z);
  g.add(screw);
  const liftMotor = mesh(plinth(roundedRect(14, 14, 2), 12, 1), MAT.motor, "lift-motor");
  liftMotor.position.set(WS_X - 4, PRESS_Y - 12, LIFT_Z);
  g.add(liftMotor);
  const carY = CAR_Y;
  const carriage = mesh(new THREE.BoxGeometry(12, 8, 14), MAT.sage, "lift-carriage");
  carriage.position.set(WS_X, carY, LIFT_Z);
  g.add(carriage);
  const reach = DECK_C.x - DECK_R - (WS_X + 6);
  const pusher = mesh(new THREE.BoxGeometry(reach, 2, 8), MAT.steel, "pusher");
  pusher.position.set(WS_X + 6 + reach / 2, carY, LIFT_Z);
  g.add(pusher);
  return {
    id: "wrap-station", name: "Wrap station & filing lift", assembly: "tower",
    role: "At loading, measures each tablet, drops it into an empty marker capsule, snaps the cap on and lifts it to its cell. The slow mechanical work happens once a week, never at dose time.",
    specs: [
      ["Capsules", "DBcaps-style, gelatin or HPMC"],
      ["Marker", "Pre-loaded in the seal band"],
      ["Check", "Optical size gauge per tablet"],
      ["Refill", "Empty bodies + 3-lane cap cartridge"],
      ["Storage", "Sealed, humidity-buffered"],
    ],
    object: g, explode: new THREE.Vector3(-120, 30, 0), internal: true,
  };
}

function buildBreathSensor(): PartDef {
  const g = new THREE.Group();
  const inlet = BREATH_INLET, sensorAt = BREATH_AT;
  const ring = mesh(faceDisc(1.2, 0.6, 16), MAT.chip, "sample-inlet");
  ring.position.copy(inlet);
  g.add(ring);
  const line = new THREE.CatmullRomCurve3([inlet, inlet.clone().add(new THREE.Vector3(2, -1, -6)), sensorAt.clone().add(new THREE.Vector3(0, 0, 4))]);
  g.add(mesh(new THREE.TubeGeometry(line, 24, 0.9, 8, false), MAT.silicone, "sample-line"));
  const board = mesh(new THREE.BoxGeometry(14, 12, 1.2), MAT.pcb, "breath-board");
  board.position.copy(sensorAt).add(new THREE.Vector3(0, 0, -3));
  g.add(board);
  const can = mesh(faceDisc(3.6, 3.5, 24), MAT.steel, "mox-sensor");
  can.position.copy(sensorAt);
  g.add(can);
  const pump = mesh(plinth(roundedRect(10, 12, 2), 7, 1), MAT.motor, "micro-pump");
  pump.position.set(sensorAt.x + 4, PY - 22, sensorAt.z - 2);
  g.add(pump);
  return {
    id: "breath-sensor", name: "Breath sensor", assembly: "tower",
    role: "Proof of swallow. After a sip, back on the dock, the magnet reopens the shutter and a micro-pump draws the air you breathed into the lid past a gas sensor, looking for the marker's by-product 5–10 min after the dose.",
    specs: [
      ["Sensor", "Metal-oxide gas sensor (MOX)"],
      ["Sample", "Lid air via the outlet gasket"],
      ["Window", "Sips 5–10 min after; halo asks for one"],
      ["Result", "Confirmed · didn't go down · no sample"],
      ["Status", "Untested: needs lab work"],
    ],
    object: g, explode: new THREE.Vector3(80, -20, 0), internal: true,
  };
}

function buildGelDoser(): PartDef {
  const g = new THREE.Group();
  const zf = -TOWER.coveR;
  const cart = new THREE.Vector3(-24, PY + 2, zf - 17);
  const body = mesh(disc(7, 34, 32), MAT.gel, "gel-cartridge");
  body.position.copy(cart);
  g.add(body);
  const cap = mesh(disc(7.4, 4, 32), MAT.sage, "gel-cap");
  cap.position.copy(cart).add(new THREE.Vector3(0, 18, 0));
  g.add(cap);
  const pump = mesh(faceDisc(6, 6, 24), MAT.motor, "gel-pump");
  pump.position.set(cart.x + 8, PY - 14, zf - 9);
  g.add(pump);
  const nozzle = new THREE.Vector3(-LID.port.w / 2 + 2.5, PY + LID.port.h / 2 - 2, zf - 0.5);
  const line = new THREE.CatmullRomCurve3([cart.clone().add(new THREE.Vector3(0, -17, 0)), new THREE.Vector3(cart.x + 8, PY - 10, zf - 6), nozzle.clone().add(new THREE.Vector3(0, 0, -3)), nozzle]);
  g.add(mesh(new THREE.TubeGeometry(line, 32, 0.8, 8, false), MAT.silicone, "gel-line"));
  const tip = mesh(new THREE.ConeGeometry(1.4, 3, 12), MAT.sageDeep, "gel-nozzle");
  tip.rotation.x = Math.PI / 2;
  tip.position.copy(nozzle);
  g.add(tip);
  return {
    id: "gel-doser", name: "Gel doser (optional)", assembly: "tower",
    role: "Optional module: a dab of swallowing gel through the port as the mouthful drops, sticking the capsules into one slippery lump so they go down, or come back, together.",
    specs: [
      ["Gel", "Gloup-style swallowing gel"],
      ["Dose", "A small dab per mouthful"],
      ["Helps with", "\"At least one went down\" ambiguity"],
      ["Refill", "Clip-in cartridge"],
      ["Watch", "Residue on the grill, pump hygiene"],
    ],
    object: g, explode: new THREE.Vector3(-90, -20, 40), internal: true,
  };
}

function buildBaseElectronics(): PartDef {
  const g = new THREE.Group();
  const z0 = TOWER.z - 26;
  const main = mesh(new THREE.BoxGeometry(70, 1.6, 40), MAT.pcb, "main-board");
  main.position.set(0, T0 + 34, z0);
  g.add(main);
  const radio = mesh(new THREE.BoxGeometry(16, 3, 12), MAT.steel, "wifi-ble");
  radio.position.set(20, T0 + 36.3, z0 + 8);
  g.add(radio);
  const mcu = mesh(new THREE.BoxGeometry(9, 1.6, 9), MAT.chip, "mcu");
  mcu.position.set(-6, T0 + 35.6, z0 - 4);
  g.add(mcu);
  const drivers = mesh(new THREE.BoxGeometry(12, 2, 8), MAT.chip, "drivers");
  drivers.position.set(-24, T0 + 35.8, z0 + 10);
  g.add(drivers);
  const psu = mesh(new THREE.BoxGeometry(50, 14, 26), MAT.motor, "psu");
  psu.position.set(0, T0 + 12, z0);
  g.add(psu);
  const cell = mesh(disc(9, 65, 28), MAT.battery, "backup-cell");
  cell.rotation.z = Math.PI / 2;
  cell.position.set(0, T0 + 52, z0 - 4);
  g.add(cell);
  return {
    id: "base-electronics", name: "Base electronics", assembly: "tower",
    role: "Brains of the system: drives the decks, wrap station, magnet and cues, reads every sensor, times the breath check, and syncs each dose to the MedSync app.",
    specs: [
      ["Link", "Wi-Fi + BLE to MedSync"],
      ["Power", "USB-C PD, 18650 backup"],
      ["Journal", "Survives power cuts"],
      ["Reads", "Scale, break-beam, ToF, breath"],
    ],
    object: g, explode: new THREE.Vector3(100, 0, -40), internal: true,
  };
}

export function buildTower(): PartDef[] {
  return [
    buildDock(),
    buildLoadCell(),
    buildBody(),
    buildHatch(),
    buildCue(),
    buildOutlet(),
    ...Array.from({ length: TOWER.decks }, (_, k) => buildDeck(k)),
    buildIndexDrive(),
    buildShutterMagnet(),
    buildGrillSensor(),
    buildFeedSlot(),
    buildWrapStation(),
    buildBreathSensor(),
    buildGelDoser(),
    buildBaseElectronics(),
  ];
}
