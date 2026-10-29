import { type PointerEvent as RPointerEvent, useEffect, useRef, useState } from "react";
import { type Icon, SCENARIOS, type Scenario } from "./scenarios";

// The scenario UI: a launcher button that opens a sheet of clips, and, while one plays,
// a caption and a slim scrub bar. Everything else on screen gets out of the way.

const PATHS: Record<Icon, string> = {
  full: "M7 5.5v13l11-6.5z",
  dispense: "M12 3v9m-3.5-3.5L12 12l3.5-3.5M6 15.5c0 2.5 2.7 4.5 6 4.5s6-2 6-4.5",
  drink: "M6 8h9l-1.3 11H7.3zM15 10.5h2.2a1.8 1.8 0 0 1 0 3.6H14.6M9 8l1.5-4h3",
  breath: "M4 9.5h9a2.5 2.5 0 1 0-2.5-2.5M4 13.5h13a2.5 2.5 0 1 1-2.5 2.5M14.5 7.5l2 2 4-4.5",
  miss: "M4 9.5h9a2.5 2.5 0 1 0-2.5-2.5M4 13.5h13a2.5 2.5 0 1 1-2.5 2.5M16 5l4 4m0-4-4 4",
  load: "M12 3v8m-3-3 3 3 3-3M5 14h14v5H5zM9 14v5m6-5v5",
};

export function Glyph({ icon }: { icon: Icon }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[icon]} fill={icon === "full" ? "currentColor" : "none"} />
    </svg>
  );
}

export function Launcher({ onPick }: { onPick: (s: Scenario) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", off);
    addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", off); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="launcher" ref={ref}>
      <button className={`play-pill ${open ? "on" : ""}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden><path d="M7 5v14l12-7z" fill="currentColor" /></svg>
        Scenarios
      </button>
      {open && (
        <div className="sheet" role="menu">
          {SCENARIOS.map((s, i) => (
            <button key={s.id} role="menuitem" className={`scene ${i === 0 ? "hero" : ""}`} onClick={() => { setOpen(false); onPick(s); }}>
              <span className="glyph"><Glyph icon={s.icon} /></span>
              <b>{s.title}</b>
              <small>{s.line}</small>
              <i>{Math.round(s.duration)}s</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface PlayerProps {
  scenario: Scenario;
  t: number; beat: number; playing: boolean;
  onSeek: (t: number) => void;
  onPlay: (on: boolean) => void;
  onNext: () => void;
  onClose: () => void;
  hasNext: boolean;
}

export function Player({ scenario, t, beat, playing, onSeek, onPlay, onNext, onClose, hasNext }: PlayerProps) {
  const track = useRef<HTMLDivElement>(null);
  const wasPlaying = useRef(false);
  const { beats, duration } = scenario;
  const b = beats[Math.max(beat, 0)];
  const ended = t >= duration - 1e-3 && !playing;

  const seekAt = (e: RPointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    onSeek(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * duration);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); onPlay(!playing); }
      else if (e.key === "ArrowRight") onSeek(beats[Math.min(beat + 1, beats.length - 1)].t0 + (beat + 1 >= beats.length ? duration : 0.01));
      else if (e.key === "ArrowLeft") onSeek(beats[Math.max(t - b.t0 > 0.6 ? beat : beat - 1, 0)].t0 + 0.01);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  return (
    <>
      <div className={`caption ${b.result ?? ""}`} key={`${scenario.id}-${beat}`} aria-live="polite">
        {b.result && <span className="badge" aria-hidden>{b.result === "ok" ? "✓" : "✕"}</span>}
        <h2>{b.caption}</h2>
        {b.note && <p>{b.note}</p>}
      </div>

      <div className="player">
        <button className="round" onClick={() => onPlay(!playing)} aria-label={playing ? "Pause" : ended ? "Replay" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>
          ) : ended ? (
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 12a7 7 0 1 0 2.1-5M5 4v4h4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M7 5v14l12-7z" fill="currentColor" /></svg>
          )}
        </button>
        <div className="who">
          <Glyph icon={scenario.icon} />
          <span>{scenario.title}</span>
        </div>
        <div
          className="track" ref={track}
          role="slider" aria-label="Scenario time" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(t)}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); wasPlaying.current = playing; onPlay(false); seekAt(e); }}
          onPointerMove={(e) => { if (e.buttons) seekAt(e); }}
          onPointerUp={() => { if (wasPlaying.current) onPlay(true); }}
        >
          {beats.map((s, i) => {
            const k = Math.min(Math.max((t - s.t0) / (s.t1 - s.t0), 0), 1);
            return (
              <span key={i} className={`seg ${i === beat ? "now" : ""} ${s.result ?? ""}`} style={{ flexGrow: s.t1 - s.t0 }} title={s.caption}>
                <span style={{ transform: `scaleX(${k})` }} />
              </span>
            );
          })}
        </div>
        {ended && hasNext ? (
          <button className="next" onClick={onNext}>Next <span aria-hidden>→</span></button>
        ) : (
          <span className="count">{Math.max(beat, 0) + 1}/{beats.length}</span>
        )}
        <button className="round ghost" onClick={onClose} aria-label="Close scenario">×</button>
      </div>
    </>
  );
}
