import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CUP, DOCK, SIP } from "./dims";
import { BORE_PATH, buildCup, rInner } from "./parts/cup";
import { buildHandle } from "./parts/handle";
import { buildTower } from "./parts/tower";
import type { Assembly, PartDef } from "./types";
import { ScenarioFx } from "./fx";
import type { Scenario, SceneState, Shot } from "./scenarios";

// The imperative 3D side of the viewer. React owns the UI and talks to this through
// setters; the engine eases every change (explode, x-ray, selection, camera) per frame.

export type View = "iso" | "front" | "side" | "top";

export interface PartInfo {
  id: string; name: string; assembly: Assembly; role: string; specs: [string, string][]; internal: boolean;
}

interface MatState {
  mat: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial;
  opacity: number; transparent: boolean; transmission: number; emissive: THREE.Color; depthWrite: boolean;
}

interface Part {
  def: PartDef;
  holder: THREE.Group;     // carries the explode offset
  meshes: THREE.Mesh[];
  mats: MatState[];
  fade: number;            // eased 0..1 (1 = fully shown)
  glow: number;            // eased hover highlight
}

const VIEWS: Record<View, [number, number, number]> = {
  iso: [1.1, 0.55, 1.0],
  front: [0, 0.16, 1],
  side: [1, 0.14, 0.02],
  top: [0.001, 1, 0.02],
};

const ease = (cur: number, target: number, dt: number, rate = 10) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = THREE.MathUtils.smoothstep;

// ── Sip pose ─────────────────────────────────────────────────────────
// s = 0 docked, s = 1 at the lips and tipped SIP.tilt. The first third lifts the cup toward
// her; the tip runs from s = 0.2 on, pivoting so the spout tip ends on her lips.
const CUP_Y = DOCK.h - DOCK.seatDepth;
const LIPS = new THREE.Vector3(SIP.lips.x, SIP.lips.y, SIP.lips.z);
const TIP = BORE_PATH[BORE_PATH.length - 1];

/** Cup-frame → world for a sip amount. */
function sipMatrix(s: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  const a = THREE.MathUtils.degToRad(SIP.tilt) * smooth(s, 0.2, 1);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
  const atLips = LIPS.clone().sub(TIP.clone().applyQuaternion(q));
  const pos = new THREE.Vector3(0, CUP_Y, 0).lerp(atLips, smooth(s, 0, 0.35));
  return out.compose(pos, q, new THREE.Vector3(1, 1, 1));
}

// Water: interior sample points (cup frame) for finding the level that holds the fill volume.
const WATER_TOP = CUP.h - 1.5;
const inside = (p: THREE.Vector3) =>
  p.y >= CUP.floor && p.y <= WATER_TOP && Math.hypot(p.x, p.z) <= rInner(p.y) - 0.4;
const SAMPLES: THREE.Vector3[] = [];
for (let y = CUP.floor + 1.5; y < WATER_TOP; y += 3.5)
  for (let x = -CUP.rTop; x < CUP.rTop; x += 3.5)
    for (let z = -CUP.rTop; z < CUP.rTop; z += 3.5) {
      const p = new THREE.Vector3(x, y, z);
      if (inside(p)) SAMPLES.push(p);
    }
const FILL = SAMPLES.filter((p) => p.y < CUP.fillY).length / SAMPLES.length;

/** World height of the water surface for a cup pose. */
function waterLevel(m: THREE.Matrix4): number {
  const e = m.elements;
  const ys = SAMPLES.map((p) => e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13]).sort((a, b) => a - b);
  return ys[Math.round(FILL * (ys.length - 1))];
}

// Where the water first reaches the grill, and the bore's length: the mouthful sets off then.
const BORE_LEN = BORE_PATH[1].distanceTo(BORE_PATH[0]) + BORE_PATH[2].distanceTo(BORE_PATH[1]) + 18;
const S_WET = (() => {
  const m = new THREE.Matrix4();
  for (let s = 0; s <= 1; s += 0.005) {
    sipMatrix(s, m);
    if (BORE_PATH[0].clone().applyMatrix4(m).y < waterLevel(m)) return s;
  }
  return 0.9;
})();

/** A point d mm along the bore (grill → well top → spout tip → into the mouth), and its heading. */
function alongBore(d: number): { p: THREE.Vector3; dir: THREE.Vector3 } {
  for (let i = 0; i < BORE_PATH.length - 1; i++) {
    const a = BORE_PATH[i], b = BORE_PATH[i + 1];
    const len = a.distanceTo(b), last = i === BORE_PATH.length - 2;
    if (d <= len || last) {
      const dir = b.clone().sub(a).normalize();
      return { p: a.clone().addScaledVector(dir, d), dir };
    }
    d -= len;
  }
  throw new Error("unreachable");
}

/** Side-profile silhouette of the drinker, lips at the origin, facing -z (shape x = world z). */
function headShape(): THREE.Shape {
  const pts: [number, number][] = [
    [-3, 0], [-5, 6], [-1, 13], [-19, 24], [-10, 40], [-4, 58], [-10, 84], [-6, 118], [14, 152],
    [70, 176], [140, 166], [184, 116], [182, 46], [160, -6], [150, -60], [148, -150], [60, -150],
    [52, -72], [30, -48], [2, -44], [-8, -32], [-4, -16], [-6, -6],
  ];
  return new THREE.Shape().setFromPoints(new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(160));
}

export class Engine {
  readonly parts = new Map<string, Part>();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 5, 6000);
  private controls: OrbitControls;
  private roots: Record<Assembly, THREE.Group> = { cup: new THREE.Group(), handle: new THREE.Group(), tower: new THREE.Group() };
  private visible: Record<Assembly, boolean> = { cup: true, handle: true, tower: true };
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private pointerIn = false;
  private clock = new THREE.Clock();
  private floor: THREE.Mesh;
  private ro: ResizeObserver;

  // targets
  private explodeT = 0; private explode = 0;
  private xrayT = false; private xray = 0;
  private selected: string | null = null;
  private hovered: string | null = null;
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private sipT = 0; private sip = 0; private sipDrawn = -1;
  private view: View = "iso";
  private cupMatrix = new THREE.Matrix4();
  private waterPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private waterSurface: THREE.Mesh | null = null;
  private head: THREE.Mesh;

  onHover: (id: string | null, x: number, y: number) => void = () => {};
  onPick: (id: string | null) => void = () => {};
  /** Scenario clock, every frame while one is loaded. */
  onScene: (t: number, beat: number, playing: boolean) => void = () => {};

  // scenario player
  private scen: Scenario | null = null;
  private scenT = 0;
  private playing = false;
  private shotBeat = -1;
  private fx: ScenarioFx;
  private elapsed = 0;

  constructor(private host: HTMLElement) {
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.localClippingEnabled = true;            // the water's level surface
    host.appendChild(r.domElement);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d2c8, 0.55);
    const key = new THREE.DirectionalLight(0xfff6ea, 2.1);
    key.position.set(260, 520, 360);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 50, far: 1400 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.6;
    key.shadow.radius = 6;
    const rim = new THREE.DirectionalLight(0xe6f0ff, 0.6);
    rim.position.set(-300, 200, -300);
    this.scene.add(hemi, key, rim);

    this.floor = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.ShadowMaterial({ opacity: 0.12 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    // Cup and handle share the cup frame: cup bottom resting in the dock seat.
    const cupY = DOCK.h - DOCK.seatDepth;
    this.roots.cup.position.y = cupY;
    this.roots.handle.position.y = cupY;
    this.scene.add(this.roots.cup, this.roots.handle, this.roots.tower);

    for (const def of [...buildTower(), ...buildCup(), ...buildHandle()]) this.addPart(def);
    const water = this.parts.get("water")!;
    for (const m of water.meshes) {
      if (m.name === "water") (m.material as THREE.Material).clippingPlanes = [this.waterPlane];
      else this.waterSurface = m;
      (m.material as THREE.Material).side = THREE.DoubleSide;
    }
    // A ghost of the drinker for the Sip pose, set back on -x so it never hides the cup.
    const headGeo = new THREE.ExtrudeGeometry(headShape(), { depth: 8, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 3 });
    headGeo.rotateY(-Math.PI / 2);
    this.head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0x9aa7a0, roughness: 0.9, transparent: true, opacity: 0, depthWrite: false }));
    this.head.position.set(-62, LIPS.y, LIPS.z);
    this.head.visible = false;
    this.scene.add(this.head);

    this.fx = new ScenarioFx(this.scene, this.roots.cup, {
      get: (id) => this.parts.get(id)?.def.object,
      mat: (id, name) => {
        const p = this.parts.get(id);
        const i = p ? p.meshes.findIndex((m) => m.name === name) : -1;
        return i >= 0 ? (p!.mats[i].mat as THREE.MeshStandardMaterial) : undefined;
      },
    });

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 180;
    this.controls.maxDistance = 1800;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener("start", () => (this.camGoal = null));

    const el = r.domElement;
    el.addEventListener("pointermove", (e) => this.pointerAt(e));
    el.addEventListener("pointerleave", () => { this.pointerIn = false; this.setHover(null, 0, 0); });
    let down = { x: 0, y: 0 };
    el.addEventListener("pointerdown", (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener("pointerup", (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // was a drag
      this.pointerAt(e);
      this.onPick(this.pick());
    });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.setView("iso", true);
    r.setAnimationLoop(() => this.frame());
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ── public setters ────────────────────────────────────────────────
  setExplode(v: number) {
    this.explodeT = v;
    // Pull the camera back (same direction) so the exploded set stays in frame.
    const target = this.viewTarget.clone().setY(this.viewTarget.y + 55 * v);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camGoal = { pos: target.clone().addScaledVector(dir, this.viewDist * (1 + 0.42 * v)), target };
  }
  private viewTarget = new THREE.Vector3();
  private viewDist = 800;
  setXray(on: boolean) { this.xrayT = on; }
  setSip(v: number) {
    const was = this.sipT > 0;
    this.sipT = v;
    if (was !== v > 0) this.setView(this.view);   // reframe to take in the drinker, or back
  }
  select(id: string | null) { this.selected = id; }

  /** Load a scenario and play it from the start (null leaves it and restores the free view). */
  playScenario(s: Scenario | null) {
    this.scen = s;
    this.scenT = 0;
    this.playing = !!s;
    this.shotBeat = -1;
    this.controls.minDistance = s ? 40 : 180;
    if (!s) { this.fx.reset(); this.sipDrawn = -1; this.setView(this.view); this.onScene(0, -1, false); }
  }
  seek(t: number) {
    if (!this.scen) return;
    this.scenT = THREE.MathUtils.clamp(t, 0, this.scen.duration);
  }
  setPlaying(on: boolean) {
    if (!this.scen) return;
    if (on && this.scenT >= this.scen.duration - 1e-3) { this.scenT = 0; this.shotBeat = -1; }
    this.playing = on;
  }

  /** Ease the camera to a scenario shot, sized like setView so it frames on any aspect. */
  private shoot(shot: Shot) {
    // Drop the whole shot a little so the subject sits above the caption and the player bar.
    const target = new THREE.Vector3(...shot.target).add(new THREE.Vector3(0, -0.2 * shot.r, 0));
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = shot.r / Math.sin(Math.min(vFov, hFov) / 2);
    this.camGoal = { pos: target.clone().addScaledVector(new THREE.Vector3(...shot.dir).normalize(), dist), target };
  }
  hover(id: string | null) { this.hovered = id; }
  setAssemblyVisible(a: Assembly, on: boolean) { this.visible[a] = on; }

  setTheme(dark: boolean) {
    this.scene.background = new THREE.Color(dark ? 0x1b1d1e : 0xefede8);
    (this.floor.material as THREE.ShadowMaterial).opacity = dark ? 0.32 : 0.12;
    this.renderer.toneMappingExposure = dark ? 0.85 : 1.0;
  }

  setView(v: View, instant = false) {
    this.view = v;
    // Frame the whole set (dock to tower top, ~260 × 310 mm) whatever the aspect ratio;
    // while sipping, the set plus the drinker's head.
    const sip = this.sipT > 0;
    const target = sip ? new THREE.Vector3(0, v === "top" ? 0 : 190, 100) : new THREE.Vector3(18, v === "top" ? 0 : 140, -36);
    const dir = new THREE.Vector3(...VIEWS[v]).normalize();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const radius = sip ? 235 : v === "top" ? 125 : 180;
    const dist = radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.05;
    this.viewTarget.copy(target);
    this.viewDist = dist;
    const e = this.explodeT;
    target.y += 55 * e;
    const pos = target.clone().addScaledVector(dir, dist * (1 + 0.42 * e));
    if (instant) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
    } else this.camGoal = { pos, target };
  }

  partList(): PartInfo[] {
    return [...this.parts.values()].map(({ def }) => ({
      id: def.id, name: def.name, assembly: def.assembly, role: def.role, specs: def.specs, internal: !!def.internal,
    }));
  }

  // ── internals ─────────────────────────────────────────────────────
  private addPart(def: PartDef) {
    const holder = new THREE.Group();
    holder.add(def.object);
    this.roots[def.assembly].add(holder);
    const meshes: THREE.Mesh[] = [];
    const mats: MatState[] = [];
    def.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Each part gets its own material copies so it can fade on its own.
      const src = Array.isArray(m.material) ? m.material[0] : m.material;
      const mat = (src as THREE.MeshStandardMaterial).clone() as MatState["mat"];
      m.material = mat;
      m.userData.partId = def.id;
      meshes.push(m);
      mats.push({
        mat, opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite,
        transmission: (mat as THREE.MeshPhysicalMaterial).transmission ?? 0,
        emissive: mat.emissive.clone(),
      });
    });
    this.parts.set(def.id, { def, holder, meshes, mats, fade: 1, glow: 0 });
  }

  private pointerAt(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.pointerIn = true;
    this.lastClient = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  private lastClient = { x: 0, y: 0 };

  private pick(): string | null {
    if (!this.pointerIn) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: THREE.Object3D[] = [];
    for (const p of this.parts.values()) if (p.fade > 0.45) for (const m of p.meshes) if (m.visible) targets.push(m);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return (hit?.object.userData.partId as string) ?? null;
  }

  private setHover(id: string | null, x: number, y: number) {
    this.onHover(id, x, y);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole set in frame on narrow screens.
    this.camera.fov = w / h < 0.9 ? 40 : 28;
    this.camera.updateProjectionMatrix();
  }

  private hoverTick = 0;

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    let st: SceneState | null = null;
    if (this.scen) {
      if (this.playing) {
        this.scenT += dt;
        if (this.scenT >= this.scen.duration) { this.scenT = this.scen.duration; this.playing = false; }
      }
      st = this.scen.sample(this.scenT);
      if (st.beat !== this.shotBeat) { this.shotBeat = st.beat; this.shoot(this.scen.beats[st.beat].shot); }
      this.onScene(this.scenT, st.beat, this.playing);
      this.explode = 0;
      this.sip = st.v.sip;
    } else {
      this.explode = ease(this.explode, this.explodeT, dt, 7);
      this.sip = ease(this.sip, this.sipT, dt, 6);
      if (Math.abs(this.sip - this.sipT) < 1e-4) this.sip = this.sipT;
    }
    this.xray = ease(this.xray, st ? st.xray : this.xrayT ? 1 : 0, dt, 9);
    this.poseCup();
    this.fx.pose(st, this.elapsed);

    // Throttled hover raycast.
    if ((this.hoverTick = (this.hoverTick + 1) % 3) === 0 && this.pointerIn) {
      this.setHover(this.pick(), this.lastClient.x, this.lastClient.y);
    }

    const showInternals = Math.max(this.xray, THREE.MathUtils.smoothstep(this.explode, 0.02, 0.25));
    for (const p of this.parts.values()) {
      const { def } = p;
      p.holder.position.copy(def.explode).multiplyScalar(this.explode);
      let gone = 1;
      if (def.id === "mouthful") gone = st && st.v.eaten > 0.5 ? 0 : this.carryMouthful(p.holder);

      let target: number;
      if (st) {
        // Scenario: X-ray shows only the parts this beat is about.
        const on = st.focus.has(def.id);
        target = def.internal ? (on ? this.xray : 0) : on ? 1 : 1 - 0.88 * this.xray;
      } else {
        target = this.visible[def.assembly] ? 1 : 0;
        if (def.internal) target *= showInternals;
        else target *= 1 - 0.86 * this.xray;
        if (this.selected && this.selected !== def.id) target *= 0.12;
      }
      target *= gone;
      p.fade = ease(p.fade, target, dt, 10);
      p.glow = ease(p.glow, this.hovered === def.id || this.selected === def.id ? 1 : 0, dt, 14);
      this.applyLook(p);
    }
    this.fx.paint(st);

    if (this.camGoal) {
      this.camera.position.lerp(this.camGoal.pos, 1 - Math.exp(-6 * dt));
      this.controls.target.lerp(this.camGoal.target, 1 - Math.exp(-6 * dt));
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.5) this.camGoal = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Place the cup and handle for the current sip amount, and keep the water level. */
  private poseCup() {
    if (this.sip === this.sipDrawn) return;
    this.sipDrawn = this.sip;
    const m = sipMatrix(this.sip, this.cupMatrix);
    for (const root of [this.roots.cup, this.roots.handle]) {
      m.decompose(root.position, root.quaternion, root.scale);
    }
    const level = waterLevel(m);
    this.waterPlane.constant = level;
    if (this.waterSurface) this.waterSurface.geometry = this.surfaceGeometry(m, level);
    const show = smooth(this.sip, 0.05, 0.4);
    this.head.visible = show > 0.01;
    (this.head.material as THREE.MeshStandardMaterial).opacity = 0.2 * show;
  }

  /** The water's flat top in the cup frame: where the level plane cuts the (convex) interior. */
  private surfaceGeometry(m: THREE.Matrix4, level: number): THREE.BufferGeometry {
    this.waterSurface?.geometry.dispose();
    const e = m.elements;
    const n = new THREE.Vector3(e[1], e[5], e[9]).normalize();     // world up, in the cup frame
    const d = level - e[13];
    const wet = SAMPLES.filter((p) => n.dot(p) < d);
    const c = wet.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(Math.max(wet.length, 1));
    c.addScaledVector(n, d - n.dot(c));
    const u = new THREE.Vector3(1, 0, 0).cross(n).normalize();
    if (u.lengthSq() < 0.5) u.set(0, 0, 1).cross(n).normalize();
    const v = n.clone().cross(u);
    const pos: number[] = [c.x, c.y, c.z];
    const N = 72;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      let lo = 0, hi = 140;
      for (let k = 0; k < 22; k++) {
        const mid = (lo + hi) / 2;
        if (inside(c.clone().addScaledVector(dir, mid))) lo = mid; else hi = mid;
      }
      const p = c.clone().addScaledVector(dir, lo);
      pos.push(p.x, p.y, p.z);
    }
    const idx: number[] = [];
    for (let i = 0; i < N; i++) idx.push(0, 1 + i, 1 + ((i + 1) % N));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(Array.from({ length: N + 1 }, () => [n.x, n.y, n.z]).flat(), 3));
    g.setIndex(idx);
    return g;
  }

  /** Once the water reaches the grill, carry the mouthful up the bore; returns its visibility. */
  private carryMouthful(holder: THREE.Group): number {
    const t = THREE.MathUtils.clamp((this.sip - S_WET) / Math.max(1 - S_WET, 0.05), 0, 1);
    if (t === 0) { holder.quaternion.identity(); return 1; }
    const { p, dir } = alongBore(t * BORE_LEN);
    // Capsules lie along z; turn them to travel lengthways.
    const q = new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), smooth(t, 0, 0.15));
    holder.quaternion.copy(q);
    holder.position.add(p.sub(BORE_PATH[0].clone().applyQuaternion(q)));
    return 1 - smooth(t, 0.82, 1);
  }

  private applyLook(p: Part) {
    const f = p.fade;
    const solid = f > 0.985;
    const accent = new THREE.Color(0x6f9c86);
    p.meshes.forEach((m, i) => {
      const s = p.mats[i];
      const mat = s.mat as THREE.MeshPhysicalMaterial;
      m.visible = f > 0.01;
      m.castShadow = f > 0.6 && m.userData.noShadow !== true;
      // three.js compiles `transparent` into the shader (OPAQUE forces alpha = 1), so a flip
      // needs a recompile; it only happens when a part crosses the solid/ghost boundary.
      const wantTransparent = solid ? s.transparent : true;
      if (mat.transparent !== wantTransparent) mat.needsUpdate = true;
      if (solid) {
        mat.transparent = s.transparent;
        mat.opacity = s.opacity;
        mat.depthWrite = s.depthWrite;
        if (s.transmission) mat.transmission = s.transmission;
      } else {
        mat.transparent = true;
        mat.opacity = s.opacity * Math.max(f, 0.001);
        mat.depthWrite = f > 0.9;
        // Transmission ignores opacity, so drop it while ghosted.
        if (s.transmission) { mat.transmission = s.transmission * f * f; mat.opacity = Math.max(mat.opacity, 0) * (0.25 + 0.75 * f); }
      }
      mat.emissive.copy(s.emissive).lerp(accent, p.glow * 0.22);
    });
  }
}

