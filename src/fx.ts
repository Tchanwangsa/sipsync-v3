import * as THREE from "three";
import { CUP, CUP_Y, LID, SIP } from "./dims";
import { BORE_PATH, RAMP_PATH } from "./parts/cup";
import { TOWER_ANCHORS as A } from "./parts/tower";
import { MEDS, POD, pod, podD } from "./pod";
import { tablet } from "./geo";
import type { Hue, SceneState } from "./scenarios";

// What a scenario does to the scene beyond fades and the sip pose: it moves the real parts
// (capsules down the dose path, the shutter, the decks, the filing lift) and adds the things
// you can't see on the product (IR beam, ToF cone, magnet field, breath, sensor glow).

export const HUE: Record<Hue, number> = { warm: 0xffe2b0, amber: 0xf2a33a, green: 0x34b878, coral: 0xe5644f };

const smooth = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const Z = new THREE.Vector3(0, 0, 1);
const RIM = CUP_Y + CUP.h;
const SUPPLY = new Set(["empty-cap", "empty-body", "cap-cartridge", "body-stack"]);                 // world y of the cup frame's rim (docked)

let glowTex: THREE.Texture | null = null;
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function glow(color: number, size: number): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

function line(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, opacity: 0 }));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/** A pod with its own material copies, so it can fade without touching the shared palette. */
function ownPod(i: number): THREE.Group {
  const p = pod(MEDS[i % MEDS.length]);
  p.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.material = (m.material as THREE.Material).clone(); m.castShadow = false; }
  });
  return p;
}
function setOpacity(o: THREE.Object3D, k: number) {
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
    if (!m) return;
    m.userData.base ??= m.opacity;
    m.transparent = true;
    m.opacity = m.userData.base * k;
  });
}

interface Look { get(id: string): THREE.Object3D | undefined; mat(id: string, mesh: string): THREE.MeshStandardMaterial | undefined }

export class ScenarioFx {
  private world = new THREE.Group();
  private inCup = new THREE.Group();
  private beam: THREE.Mesh; private beamGlow: THREE.Sprite;
  private gauge: THREE.Mesh; private gaugeGlow: THREE.Sprite;
  private tof: THREE.Mesh; private tofDot: THREE.Sprite;
  private rings: THREE.Mesh[] = [];
  private haloLight = new THREE.PointLight(HUE.warm, 0, 260, 0);
  private haloGlow = glow(HUE.amber, 40);
  private sensorGlow = glow(HUE.green, 16);
  private bandGlow = glow(HUE.green, 12);
  private breath: THREE.Points;
  private breathPaths: { ex: THREE.CatmullRomCurve3; sa: THREE.CatmullRomCurve3; home: THREE.Vector3 }[] = [];
  private spit = [ownPod(0), ownPod(1), ownPod(2)];
  private loadTablet: THREE.Mesh;
  private loadPod = ownPod(1);
  private rest = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion }>();
  private stations: THREE.Vector3[][] = [];
  private haloEmissive = 0.9;
  private active = false;

  constructor(scene: THREE.Scene, cupRoot: THREE.Object3D, private look: Look) {
    scene.add(this.world);
    cupRoot.add(this.inCup);

    // IR break-beam across the drop channel; the size gauge across the feed tube.
    const s = A.beamAcross.clone().multiplyScalar(9);
    const b0 = new THREE.Vector3(A.drop.x, A.beamY, A.drop.z);
    this.beam = line(b0.clone().sub(s), b0.clone().add(s), 0.5, 0xff4b3a);
    this.beamGlow = glow(0xff4b3a, 22);
    (this.beamGlow.material as THREE.SpriteMaterial).depthTest = false;
    this.beamGlow.position.copy(b0);
    const g0 = new THREE.Vector3(A.wsX, A.gaugeY, A.press.z);
    this.gauge = line(g0.clone().setX(A.wsX - 8), g0.clone().setX(A.wsX + 8), 0.35, 0xff4b3a);
    this.gaugeGlow = glow(HUE.green, 16);
    this.gaugeGlow.position.copy(g0);

    // Time-of-flight cone from the outlet down the ramp to the grill.
    const grill = BORE_PATH[0].clone().add(new THREE.Vector3(0, CUP_Y, 0));
    const len = A.tof.distanceTo(grill);
    const cone = new THREE.ConeGeometry(7, len, 32, 1, true);
    cone.translate(0, -len / 2, 0);
    this.tof = new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0x4fb3c9, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.tof.position.copy(A.tof);
    this.tof.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), grill.clone().sub(A.tof).normalize());
    this.tofDot = glow(0x4fb3c9, 14);
    this.tofDot.position.copy(grill).add(new THREE.Vector3(0, 6, 0));

    // Magnet field: rings around the coil, facing the lid.
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: 0xd88a4a, transparent: true, opacity: 0, depthWrite: false }));
      r.position.copy(A.magnet).add(new THREE.Vector3(0, 0, 9));
      this.rings.push(r);
    }

    this.haloLight.position.copy(A.halo).add(new THREE.Vector3(0, -20, 16));
    this.haloGlow.position.copy(A.halo).add(new THREE.Vector3(0, 0, 8));
    this.sensorGlow.position.copy(A.breathSensor).add(new THREE.Vector3(0, 0, 3));

    this.loadTablet = tablet(MEDS[1].d, MEDS[1].t, MEDS[1].tablet);
    this.loadTablet.castShadow = false;

    this.world.add(this.beam, this.beamGlow, this.gauge, this.gaugeGlow, this.tof, this.tofDot, ...this.rings,
      this.haloLight, this.haloGlow, this.sensorGlow, this.bandGlow, ...this.spit, this.loadTablet, this.loadPod);
    this.breath = this.buildBreath();
    this.inCup.add(this.breath);
    this.world.visible = this.inCup.visible = false;
  }

  /** Breath: out of the mouth, down the spout into the lid; later drawn out through the port to the sensor. */
  private buildBreath(): THREE.Points {
    const N = 90;
    const tip = BORE_PATH[2], out = tip.clone().sub(BORE_PATH[1]).normalize();
    const portIn = new THREE.Vector3(0, CUP.h + LID.port.y, -LID.r + 5);
    const portOut = new THREE.Vector3(0, CUP.h + LID.port.y - 2, -LID.r - 3);
    const local = (w: THREE.Vector3) => w.clone().sub(new THREE.Vector3(0, CUP_Y, 0));
    const inlet = local(A.breathInlet), sensor = local(A.breathSensor);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < N; i++) {
      const a = rnd(0, Math.PI * 2), r = rnd(4, 26);
      const home = new THREE.Vector3(Math.cos(a) * r, CUP.h + rnd(-6, 9), -Math.abs(Math.sin(a) * r) * 0.9 - rnd(0, 8));
      const j = () => new THREE.Vector3(rnd(-2, 2), rnd(-2, 2), rnd(-2, 2));
      const ex = new THREE.CatmullRomCurve3([
        tip.clone().addScaledVector(out, rnd(12, 22)).add(j().multiplyScalar(2)), tip.clone().add(j()),
        BORE_PATH[1].clone().add(j()), new THREE.Vector3(home.x * 0.4, CUP.h + 6, home.z * 0.5 + 8), home,
      ]);
      const sa = new THREE.CatmullRomCurve3([home, home.clone().lerp(portIn, 0.6).add(j()), portIn, portOut, inlet, sensor]);
      this.breathPaths.push({ ex, sa, home });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(N * 4), 4));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({
      size: 5.5, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true,
    }));
    pts.frustumCulled = false;
    pts.renderOrder = 11;
    return pts;
  }

  // ── per frame ───────────────────────────────────────────────────────────

  /** Move parts. Runs before the engine fades and poses its parts. */
  pose(st: SceneState | null, clock: number) {
    if (!st) { if (this.active) this.reset(); return; }
    this.active = true;
    this.world.visible = this.inCup.visible = true;
    const v = st.v;

    // Decks, shutter, filing lift.
    this.rot("magazine-deck-1", v.deck1);
    this.rot("magazine-deck-2", v.deck2);
    const sh = this.look.get("port-shutter");
    if (sh) for (const n of ["shutter", "steel-slug"]) this.offset(sh.getObjectByName(n), 0, -11 * v.shutter, 0);
    this.poseLoad(st);
    this.poseDose(st);

    // Beam: faint while the drop path is in view, bright while a capsule breaks it.
    const beamOn = st.focus.has("index-drive") ? st.xray : 0;
    let broken = 0;
    const mouth = this.look.get("mouthful");
    if (mouth) mouth.children.forEach((c, i) => {
      const u = st.dose[i];
      if (u > 1 && u < 2.2) broken = Math.max(broken, 1 - Math.min(Math.abs(c.position.y + RIM - A.beamY) / 8, 1));
    });
    this.fade(this.beam, beamOn * (0.35 + 0.65 * broken));
    this.fade(this.beamGlow, beamOn * broken);

    // ToF cone, magnet rings.
    this.fade(this.tof, 0.16 * v.tof);
    this.fade(this.tofDot, v.tof * (st.dose[2] > 5.9 ? 0.9 : 0.2));
    this.rings.forEach((r, i) => {
      const k = (clock * 1.4 + i / 3) % 1;
      r.scale.setScalar(5 + 9 * k);
      this.fade(r, v.magnet * (1 - k) * 0.8);
    });

    // Halo and sensor.
    const pulse = 0.85 + 0.15 * Math.sin(clock * 5);
    this.haloLight.color.set(HUE[st.hue]);
    this.haloLight.intensity = 1.6 * v.halo;
    (this.haloGlow.material as THREE.SpriteMaterial).color.set(HUE[st.hue]);
    this.fade(this.haloGlow, 0.35 * v.halo * pulse * (1 - st.xray));
    const sampling = v.sample > 0 && v.sample < 1;
    (this.sensorGlow.material as THREE.SpriteMaterial).color.set(v.sensor > 0.5 ? HUE[st.sensorHue] : 0xbfd3dc);
    this.fade(this.sensorGlow, Math.max(v.sensor, sampling ? 0.35 * pulse : 0) * (st.focus.has("breath-sensor") || st.xray < 0.5 ? 1 : 0.3));

    this.poseBreath(st, clock);
    this.poseSpit(v.spit);
  }

  /** Recolour after the engine has applied its looks (it resets emissive every frame). */
  paint(st: SceneState | null) {
    const halo = this.look.mat("cue-speaker", "halo");
    if (!halo) return;
    if (!st) { halo.emissiveIntensity = this.haloEmissive; return; }
    halo.emissive.set(HUE[st.hue]);
    halo.emissiveIntensity = 0.35 + 2.2 * st.v.halo;
    // Hide the capsules the dose path has taken out of the drop-station cell.
    const deck = this.look.get("magazine-deck-1");
    const da = Math.atan2(-A.dropDir.y, A.dropDir.x);
    if (deck) for (const c of deck.children) {
      if (!(c instanceof THREE.Group)) continue;
      const a = Math.atan2(-c.position.z, c.position.x) + st.v.deck1 - da;
      const near = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < Math.PI / 7;
      c.visible = !(near && st.dose[0] > 0.01 && st.dose[0] < 6);
    }
    const nest = this.look.get("wrap-station")?.getObjectByName("nest-pod");
    if (nest) nest.visible = false;
    const plug = this.look.get("outlet")?.getObjectByName("outlet-mouth");
    if (plug) plug.visible = st.v.shutter < 0.05;
    // Once the pod leaves the press, the refill stock is just clutter in front of the lift.
    if (st.v.load > 0.5 && st.v.shuttle > 0.01)
      this.look.get("wrap-station")?.traverse((o) => { if (SUPPLY.has(o.name)) o.visible = false; });
    // The frosted drop path and feed tubes go clear, so the capsule shows through them.
    for (const [id, names] of [["index-drive", ["drop-channel", "chute"]], ["wrap-station", ["feed-tube", "body-stack", "cap-cartridge"]]] as const)
      for (const n of names) {
        const m = this.look.mat(id, n) as THREE.MeshPhysicalMaterial | undefined;
        if (m && m.opacity > 0.3) { m.transmission = 0; m.opacity = 0.22; m.depthWrite = false; }
      }
    const mouth = this.look.get("mouthful");
    if (mouth) mouth.children.forEach((c, i) => { c.visible = st.dose[i] > 0.01; });
  }

  reset() {
    this.active = false;
    for (const [o, r] of this.rest) { o.position.copy(r.p); o.quaternion.copy(r.q); o.visible = true; }
    for (const id of ["magazine-deck-1", "magazine-deck-2"]) this.look.get(id)?.children.forEach((c) => (c.visible = true));
    const nest = this.look.get("wrap-station")?.getObjectByName("nest-pod");
    if (nest) nest.visible = true;
    const plug = this.look.get("outlet")?.getObjectByName("outlet-mouth");
    if (plug) plug.visible = true;
    this.world.visible = this.inCup.visible = false;
    this.paint(null);
  }

  // ── helpers ─────────────────────────────────────────────────────────

  private remember(o: THREE.Object3D) {
    if (!this.rest.has(o)) this.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() });
    return this.rest.get(o)!;
  }
  private offset(o: THREE.Object3D | undefined, x: number, y: number, z: number) {
    if (!o) return;
    const r = this.remember(o);
    o.position.copy(r.p).add(new THREE.Vector3(x, y, z));
  }
  private rot(id: string, a: number) {
    const o = this.look.get(id);
    if (!o) return;
    const r = this.remember(o);
    o.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a));
  }
  private fade(o: THREE.Mesh | THREE.Sprite, k: number) {
    const m = o.material as THREE.Material;
    m.opacity = k;
    o.visible = k > 0.005;
  }

  /** Capsules along the dose path: cell → drop channel → chute → outlet → ramp → grill. */
  private poseDose(st: SceneState) {
    const mouth = this.look.get("mouthful");
    if (!mouth) return;
    const toLocal = new THREE.Vector3(0, -RIM, 0);
    if (!this.stations.length) {
      const up = new THREE.Vector3(0, 5.2, 0);
      mouth.children.forEach((c, i) => {
        const r = this.remember(c);
        const y = A.magY + 7 + i * 7;
        const cell = new THREE.Vector3(A.deckC.x + A.dropDir.x * (19 - i * 1.5), y, A.deckC.z + A.dropDir.y * (19 - i * 1.5));
        this.stations.push([
          cell, new THREE.Vector3(A.drop.x, y, A.drop.z), A.chuteFrom.clone(), A.chuteTo.clone(),
          RAMP_PATH[0].clone().add(up).add(new THREE.Vector3(0, CUP_Y + 0.6, 2)),
          RAMP_PATH[1].clone().add(up).add(new THREE.Vector3(0, CUP_Y, -6)),
          r.p.clone().sub(toLocal),
        ].map((p) => p.add(toLocal)));
      });
    }
    mouth.children.forEach((c, i) => {
      const r = this.remember(c);
      const u = THREE.MathUtils.clamp(st.dose[i], 0, 6);
      const S = this.stations[i];
      if (u >= 6) { c.position.copy(r.p); c.quaternion.copy(r.q); return; }
      const k = Math.min(Math.floor(u), 5), f = u - k;
      c.position.lerpVectors(S[k], S[k + 1], f);
      const qa = new THREE.Quaternion().setFromUnitVectors(Z, S[k + 1].clone().sub(S[k]).normalize());
      const qb = k < 5 ? new THREE.Quaternion().setFromUnitVectors(Z, S[k + 2].clone().sub(S[k + 1]).normalize()) : r.q;
      c.quaternion.copy(qa).slerp(qb, k < 5 ? smooth(f, 0.7, 1) : smooth(f, 0, 1));
    });
  }

  private poseBreath(st: SceneState, clock: number) {
    const { exhale, sample } = st.v;
    this.breath.visible = exhale > 0;
    if (!this.breath.visible) return;
    const pos = this.breath.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.breath.geometry.attributes.color as THREE.BufferAttribute;
    const plain = new THREE.Color(0x8fa9b8), marked = new THREE.Color(HUE.green);
    const N = this.breathPaths.length;
    const p = new THREE.Vector3();
    this.breathPaths.forEach(({ ex, sa, home }, i) => {
      const e = THREE.MathUtils.clamp((exhale - (i / N) * 0.55) / 0.45, 0, 1);
      const s = THREE.MathUtils.clamp((sample - (i / N) * 0.6) / 0.4, 0, 1);
      let a = 0;
      if (s > 0) { sa.getPoint(s, p); a = 1 - smooth(s, 0.85, 1); }
      else if (e < 1) { ex.getPoint(e, p); a = smooth(e, 0, 0.12); }
      else { p.copy(home).add(new THREE.Vector3(Math.sin(clock * 1.3 + i), Math.sin(clock * 0.9 + i * 2), Math.cos(clock * 1.1 + i)).multiplyScalar(1.2)); a = 1; }
      if (e === 0) a = 0;
      const mk = st.marker && i % 3 === 0;
      const c = mk ? marked : plain;
      pos.setXYZ(i, p.x, p.y, p.z);
      col.setXYZW(i, c.r, c.g, c.b, a * (mk ? 1 : 0.75));
    });
    pos.needsUpdate = col.needsUpdate = true;
  }

  /** Capsules coming back out at the lips and falling away. */
  private poseSpit(k: number) {
    const lips = new THREE.Vector3(SIP.lips.x, SIP.lips.y, SIP.lips.z);
    this.spit.forEach((p, i) => {
      const t = Math.max(k * 1.1 - i * 0.08, 0);
      p.visible = k > 0 && k < 1 && t > 0;
      if (!p.visible) return;
      const sx = (i - 1) * 14;
      p.position.set(lips.x + sx * t, lips.y - 4 + 40 * t - 260 * t * t, lips.z + 8 + 110 * t);
      p.rotation.set(t * 7 * (i + 1), t * 3, 0);
      setOpacity(p, 1 - smooth(k, 0.75, 1));
    });
  }

  /** Loading: tablet into the feed slot, gauge, capsule closing, shuttle, lift, push into the cell. */
  private poseLoad(st: SceneState) {
    const v = st.v;
    const ws = this.look.get("wrap-station");
    const on = v.load > 0.5;
    const L = POD.len, r = podD(MEDS[1]) / 2;
    const standY = A.press.y + L / 2, lowY = A.press.y + r + 0.6;
    const carriageY = lerp(lowY, A.carY, v.lift);
    if (ws) {
      this.offset(ws.getObjectByName("shuttle"), 0, 0, (A.liftZ - A.press.z) * v.shuttle);
      this.offset(ws.getObjectByName("lift-carriage"), 0, carriageY - A.carY, 0);
      this.offset(ws.getObjectByName("pusher"), 14 * v.push, carriageY - A.carY, 0);
    }
    // Tablet: above the slot → into the slot → down the tube to the press.
    const f = v.feed;
    const slotY = A.feed.y, top = slotY + 18, end = standY - L / 4;
    const ty = f < 0.18 ? lerp(top, slotY, f / 0.18) : lerp(slotY, end, (f - 0.18) / 0.82);
    this.loadTablet.position.set(lerp(A.feed.x, A.wsX, smooth(f, 0.18, 1)), ty, A.feed.z);
    this.loadTablet.visible = on && v.wrap <= 0.001;
    const gaugeOn = on && st.focus.has("wrap-station") ? 1 : 0;
    const pass = 1 - Math.min(Math.abs(ty - A.gaugeY) / 6, 1);
    this.fade(this.gauge, gaugeOn * (0.3 + 0.7 * pass) * (v.wrap > 0 ? 0 : 1));
    this.fade(this.gaugeGlow, gaugeOn * (f > 0.9 && v.wrap === 0 ? 0.8 : 0));

    // The capsule: body, then cap snaps down, then the marker band seals it.
    const P = this.loadPod;
    P.visible = on && v.wrap > 0;
    if (!P.visible) { this.fade(this.bandGlow, 0); return; }
    setOpacity(P.getObjectByName("capsule-body")!, smooth(v.wrap, 0, 0.3));
    const cap = P.getObjectByName("capsule-cap")!;
    const capR = this.remember(cap);
    cap.position.copy(capR.p).setZ(capR.p.z + 16 * (1 - smooth(v.wrap, 0.3, 0.7)));
    setOpacity(cap, smooth(v.wrap, 0.25, 0.4));
    P.getObjectByName("marker-band")!.visible = v.wrap > 0.75;
    const standing = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const lying = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
    P.quaternion.copy(standing).slerp(lying, v.tip);
    P.position.set(
      lerp(lerp(A.wsX, A.wsX + 6, v.tip), A.deckC.x - 21, v.push),
      lerp(standY, carriageY + 0.4, v.tip),
      lerp(A.press.z, A.liftZ, v.shuttle),
    );
    this.bandGlow.position.copy(P.position);
    this.fade(this.bandGlow, v.wrap > 0.75 && v.wrap < 1 ? 0.9 * Math.sin(((v.wrap - 0.75) / 0.25) * Math.PI) : 0);
  }
}
