import { useEffect, useMemo, useRef, useState } from "react";
import { Engine, type PartInfo, type View } from "./engine";
import type { Assembly } from "./types";
import { Launcher, Player } from "./Player";
import { SCENARIOS, type Scenario } from "./scenarios";

const ASSEMBLIES: { id: Assembly; label: string; blurb: string }[] = [
  { id: "cup", label: "Cup", blurb: "Passive, dishwasher-safe" },
  { id: "handle", label: "Handle", blurb: "Passive, on the cup rail" },
  { id: "tower", label: "Med tower", blurb: "Wraps, stores, doses, checks" },
];

const VIEWS: { id: View; label: string }[] = [
  { id: "iso", label: "3/4" },
  { id: "front", label: "Front" },
  { id: "side", label: "Side" },
  { id: "top", label: "Top" },
];

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [parts, setParts] = useState<PartInfo[]>([]);
  const [explode, setExplode] = useState(0);
  const [sip, setSip] = useState(0);
  const [xray, setXray] = useState(false);
  const [view, setView] = useState<View>("iso");
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [hidden, setHidden] = useState<Record<Assembly, boolean>>({ cup: false, handle: false, tower: false });
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 1100);
  const [about, setAbout] = useState(false);
  const [scen, setScen] = useState<Scenario | null>(null);
  const [clock, setClock] = useState({ t: 0, beat: -1, playing: false });

  useEffect(() => {
    const e = new Engine(host.current!);
    engine.current = e;
    if (import.meta.env.DEV) (window as unknown as { engine: Engine }).engine = e;
    setParts(e.partList());
    e.onHover = (id, x, y) => setHover(id ? { id, x, y } : null);
    e.onPick = (id) => setSelected(id);
    e.onScene = (t, beat, playing) => setClock((c) => (c.t === t && c.beat === beat && c.playing === playing ? c : { t, beat, playing }));
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => e.setTheme(mq.matches);
    theme();
    mq.addEventListener("change", theme);
    return () => { mq.removeEventListener("change", theme); e.dispose(); engine.current = null; };
  }, []);

  useEffect(() => engine.current?.setExplode(explode), [explode]);
  useEffect(() => engine.current?.setXray(xray), [xray]);
  useEffect(() => engine.current?.setSip(sip), [sip]);
  useEffect(() => engine.current?.select(selected), [selected]);
  useEffect(() => {
    for (const a of ASSEMBLIES) engine.current?.setAssemblyVisible(a.id, !hidden[a.id]);
  }, [hidden]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.target as HTMLElement).tagName === "INPUT" || document.body.classList.contains("cinema")) return;
      if (ev.key === "Escape") setSelected(null);
      if (ev.key === "x") setXray((v) => !v);
      if (ev.key === "e") setExplode((v) => (v > 0.5 ? 0 : 1));
      if (ev.key === "s") setSip((v) => (v > 0.5 ? 0 : 1));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const sel = selected ? byId.get(selected) : undefined;
  const hov = hover ? byId.get(hover.id) : undefined;

  const goView = (v: View) => { setView(v); engine.current?.setView(v); };
  const play = (s: Scenario | null) => {
    setScen(s);
    setSelected(null);
    setAbout(false);
    engine.current?.playScenario(s);
    document.body.classList.toggle("cinema", !!s);
  };
  const nextScen = scen ? SCENARIOS[SCENARIOS.indexOf(scen) + 1] : undefined;

  return (
    <div className={`app ${scen ? "cinema" : ""}`}>
      <div className="stage" ref={host} />

      <header className="brand">
        <div className="mark">
          <span className="logo" aria-hidden />
          <span>SipSync</span>
          <span className="tag">v3</span>
        </div>
        <p>Oralflo-style cup · medication tower · swallow-proof pods</p>
        {!scen && <button className="link" onClick={() => setAbout((v) => !v)}>{about ? "Hide concept" : "The concept"}</button>}
        {about && !scen && (
          <ol className="about">
            <li><b>The cup is just a cup.</b> Oralflo-style: capsules wait dry on a grill under a spout that leans back over the lid, so when she tips the cup to drink it points level into her mouth. They go down with the first water. Drag Sip to watch. The handle is plain moulding on a rail, so the whole cup goes in the dishwasher.</li>
            <li><b>The tower does the thinking.</b> The cup nests into its cove; a magnet opens a flush shutter in the lid and one mouthful rolls down a ramp onto the grill. Sensors, not a camera, confirm it landed and left. Syncs to the MedSync app.</li>
            <li><b>Every tablet is a swallow-proof pod.</b> At loading you drop tablets in one at a time; the tower seals each in a capsule whose band carries a food-safe breath marker. After a later sip it sniffs the lid: marker by-product found means it went down; none means it didn't, so a retake is safe.</li>
          </ol>
        )}
      </header>

      {!scen && <>
      <button className={`panel-toggle ${panelOpen ? "on" : ""}`} onClick={() => setPanelOpen((v) => !v)} aria-expanded={panelOpen}>
        Parts
      </button>

      {panelOpen && (
        <aside className="panel">
          {ASSEMBLIES.map((a) => (
            <section key={a.id} className={hidden[a.id] ? "off" : ""}>
              <div className="asm">
                <span className={`dot ${a.id}`} />
                <div>
                  <h2>{a.label}</h2>
                  <small>{a.blurb}</small>
                </div>
                <button
                  className="eye" aria-label={hidden[a.id] ? `Show ${a.label}` : `Hide ${a.label}`}
                  onClick={() => setHidden((h) => ({ ...h, [a.id]: !h[a.id] }))}
                >
                  {hidden[a.id] ? "Show" : "Hide"}
                </button>
              </div>
              <ul>
                {parts.filter((p) => p.assembly === a.id).map((p) => (
                  <li key={p.id}>
                    <button
                      className={`row ${selected === p.id ? "sel" : ""}`}
                      onClick={() => setSelected(selected === p.id ? null : p.id)}
                      onMouseEnter={() => engine.current?.hover(p.id)}
                      onMouseLeave={() => engine.current?.hover(null)}
                    >
                      {p.name}
                      {p.internal && <span className="inside">inside</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </aside>
      )}

      {sel && (
        <article className="card">
          <div className="card-head">
            <span className={`dot ${sel.assembly}`} />
            <small>{ASSEMBLIES.find((a) => a.id === sel.assembly)?.label}</small>
            <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          </div>
          <h3>{sel.name}</h3>
          <p>{sel.role}</p>
          <dl>
            {sel.specs.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </article>
      )}

      <nav className="toolbar">
        <Launcher onPick={play} />
        <span className="sep" />
        <label className="slider">
          <span>Explode</span>
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(+e.target.value)} />
        </label>
        <span className="sep" />
        <label className="slider">
          <span>Sip</span>
          <input type="range" min={0} max={1} step={0.01} value={sip} onChange={(e) => setSip(+e.target.value)} />
        </label>
        <span className="sep" />
        <button className={`chip ${xray ? "on" : ""}`} onClick={() => setXray((v) => !v)} aria-pressed={xray}>X-ray</button>
        <span className="sep" />
        <div className="seg" role="group" aria-label="Camera">
          {VIEWS.map((v) => (
            <button key={v.id} className={view === v.id ? "on" : ""} onClick={() => goView(v.id)}>{v.label}</button>
          ))}
        </div>
      </nav>

      {hov && hover && hover.id !== selected && (
        <div className="tip" style={{ left: hover.x + 14, top: hover.y + 14 }}>{hov.name}</div>
      )}
      </>}

      {scen && (
        <Player
          scenario={scen} t={clock.t} beat={clock.beat} playing={clock.playing}
          onSeek={(t) => engine.current?.seek(t)}
          onPlay={(on) => engine.current?.setPlaying(on)}
          onNext={() => nextScen && play(nextScen)}
          onClose={() => play(null)}
          hasNext={!!nextScen}
        />
      )}
    </div>
  );
}
