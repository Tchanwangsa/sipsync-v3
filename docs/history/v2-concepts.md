# v2 concepts: how else the cup could work

Follows [DESIGN_NOTES.md](DESIGN_NOTES.md). That document says what broke. This one explores what to build instead.

**Starting brief:** no lids or tablet store on top of the cup, and a different way of getting tablets into the mouth. Everything here must also pass the v2 rules in DESIGN_NOTES §5: plain drinkable rim, a washable cup with no electronics in it, no wet electrical joints, and weekly loading that actually works.

---

## 1. Four ideas that change the problem

**1. The cup doesn't need to store anything.** Rev J spent almost all its complexity keeping four mouthfuls locked, dry and powered on a cup that gets drunk from, dropped and washed. But a mouthful only has to be *in* the cup for the few seconds between being dispensed and being drunk. Everything else can live in a **base station**: storing the week, locking it, deciding when, sensing, talking to the eMAR. The base sits on the table, runs off mains power and never gets washed. The cup can then be a plain moulded object.

**2. Put the tablets where the water already goes.** The old design needed the store *above* the lip so gravity could drop tablets into the stream. You don't need to drop anything if the mouthful already sits **in the drinking path, just inside the lip, below the rim line**. When the cup tilts, the water runs through that spot and carries the tablets into the mouth. This isn't speculative. The [Oralflo pill-swallowing cup](https://oralflo.com/how-to-use-oralflo/) is a shipping product that works this way: the pill sits on a grate in the drinking spout and the water carries it in as you drink ([features](https://oralflo.com/features/)). There's also a US patent for a [cup with a pill shelf](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7500579). What nobody seems to have done is **load that spot automatically and confirm what happened**. That's our product.

**3. One mouthful per lift, not several per drink.** Rev J fired gates mid-drink so three mouthfuls could go down in one tilt. That needs actuators, sensors and a battery in the cup. Instead: the base loads one mouthful, the resident drinks and puts the cup back, and the base loads the next. That's how people take tablets anyway (tablet, sip, put the glass down), and every return to the base is a checkpoint where the base can weigh and look.

**4. If the cup must carry its own store, use the tilt as the lift.** At 45° of drinking tilt, the back of the cup is 50–60 mm *above* the lip (audit §3). A store on the back wall, entirely below the rim when upright, is "above the lip" exactly when it needs to be. Concept C uses this.

---

## 2. The concepts

### A. Smart base + passive "lip-chamber" cup (recommended)

```
   side view, cup docked                       drinking (~30–40° tilt)

        ┌──────┐ tower: camera, cue light,            lip crest (lowest point of the rim)
        │ ◉  ▼ │ dispense chute (swings over          ↓
        │      │ the lip chamber, then parks)     ___╲___        tablets + first water
        │ week │                                 ╱  ╲  ▓▓ ╲──→   leave together
        │ maga-│      ┌──  ▓▓ ──┐ ← lip chamber  ╱ water  ╲_╱
        │ zine │      │  dam│    │   (tablets)   ╱_________╱
        │      │      │     │    │
        │      │    ⊂ │ water    │ ⊃ handles
        └──────┴──────┴──────────┴───  load cell under the cup seat
```

**The cup** is plain and dishwasher-safe, like a two-handled aged-care beaker. Just inside the lip is a small **lip chamber**:

- a shallow pocket about 30 mm wide, 12 mm deep (from the rim inward) and ~8 mm deep
- a low **dam** separates it from the main water
- its floor slopes *inward*, so upright the tablets rest against the dam and stay put
- tilt the cup past the release angle (set by the floor slope, ~25–35°) and the floor runs downhill to the lip
- at about the same angle the water tops the dam and flows through the chamber
- tablets and the first water leave together

No moving parts, no electronics, no lid. Two handles at ±90° fix which side faces the mouth, so the resident drinks from the chamber side without thinking about it.

**The base** does everything else:

- stores the week as mouthful-sized cells (the one-cell-one-mouthful rule is kept)
- keeps it locked; this is where "the lid" goes, one lockable loading door on the base instead of four on the cup
- cues the resident with light, tone and a buzz through the cup seat
- drops the next mouthful into the lip chamber
- weighs the cup before and after each lift
- looks into the cup with a small camera
- posts to the eMAR over Wi-Fi or Ethernet

**A sitting:**

```
dose time → base cues (light + tone + seat buzz)
 → resident lifts cup, priming sip, puts it back   (weight drop = sip confirmed)
 → base drops mouthful 1 into the lip chamber, camera checks it landed
 → cue → resident drinks                            (tablets leave with the water)
 → cup returned: weight drop + chamber empty + nothing lying in the cup bottom
 → next mouthful … → sitting done → eMAR
```

**Solves:** everything in DESIGN_NOTES §3 A–C. Nothing sits above the rim, so the face problem only has to be solved once, for a passive rim. No power in the cup at all. Weekly loading lives in the base. Charting gets *stronger* than rev J, because the base can see the chamber empty and the tablets gone from the cup, and weigh the water that went with them.

**Risks:**

- Do tablets reliably leave with the *first* mouthful of water, or do some sink into the cup? (Oralflo says yes for its spout, but our chamber geometry isn't theirs.)
- Wet capsules can stick in a chamber that's still wet from the last mouthful.
- A tablet could bounce out when dropped into the chamber.
- Someone could carry the cup away with tablets in it. The base sees it; policy decides what happens next.
- The dam must stay clear of the upper lip at steep tilt. Check it against a face model.

### B. Same base, separate dose cup (no tablets in the water)

```
   ┌──────┐
   │ ◉  ▼ │        tablets drop into a small dose cup on its own weighing pad;
   │      │  ╭─╮   the resident tips it into their mouth, then drinks from
   │      │  ╰─╯   the plain cup next to it
   └──────┴──────── two load cells
```

Same base and magazine. Only the drop point changes: a small dose cup (washable or disposable) instead of the lip chamber. This is the conventional nursing method (medicine cup plus water), automated and charted.

**Why keep it:** if a speech pathologist says tablets in thin water are wrong for a given resident, this mode still works, and the dose cup can hold a pill-swallowing gel or a spoon of thickened fluid instead. **One base, two delivery modes, chosen per resident.** It's also the lowest-risk version to pilot.

**Weaker than A on:** two actions instead of one, less "magic", and confirmation that the tablets reached the *mouth* (not a pocket) is weaker.

### C. Self-contained cup with a sealed back module (tilt as the lift)

```
   upright                          drinking (45°): back module is now 50–60 mm above the lip
        ┌─┐ ← sealed module: day cells,
   ─────┤ │   battery, IMU, haptic,          ╲ ┌─┐
   │    │ │   one small release gate          ╲│ │ → port → rim channel → lip
   │    │ │   (clips off; vessel washes)       ╲└─┘
   │    └─┘
```

This is the rev J idea, done properly. The cup carries a day's mouthfuls in a **sealed module on the outside back wall**, entirely below the rim when upright. When the IMU sees drinking attitude, one gate opens and the mouthful falls through a port and down a moulded channel just inside the rim to the lip. The module clips off, so the vessel goes in the dishwasher. Power never crosses a wet joint because the whole electrical system lives in the module, which has its own charging contacts on the dock.

**Why it's third:** it keeps the batteries, actuators and "tablets riding a channel to the lip" risk. Loading is daily (someone swaps a day cartridge) unless a base refills it, and then you've built concept A's base plus a complicated cup. Useful only if the product must work away from a base, for example a resident walking around with it.

### Considered and dropped

- **Dropping tablets into the water before drinking.** They sink, sit in the bottom until the last sip, and soak. That fails "never soak".
- **Straw or spout delivery.** Rejected in DS-2 for good clinical reasons (suction, head extension). Still true.
- **Keeping rim shoulders, just lower.** The height budget is gone once the rim is flat, and it keeps every electrical problem in §3B.

---

## 3. Side by side

| | A · lip chamber + base | B · dose cup + base | C · cup with back module | rev J |
|---|---|---|---|---|
| Nothing above the rim | ✅ | ✅ | ✅ | ❌ 24 mm shoulders |
| Cup dishwasher-safe, no electronics | ✅ passive cup | ✅ | ⚠️ module must clip off | ❌ |
| Power across a wet joint | ✅ none | ✅ none | ✅ none (all in module) | ❌ 6 contacts |
| Weekly loading | ✅ base | ✅ base | ⚠️ daily cartridge | ❌ refill each sitting |
| Confirmation strength | **strong**: weight + chamber empty + cup clear | medium | medium (as rev J) | weak |
| Works for thickened-fluid residents | ⚠️ no (use B mode) | ✅ | ❌ | ❌ |
| Moving parts in the cup | 0 | 0 | 1 gate + electronics | 16 |
| Biggest unknown | tablets leave with the first water | two-step adherence | channel transport, cost | n/a |
| Cost at pilot scale | base is the cost; cups are cheap | same base | highest | high |

**Recommendation: A, with B built into the same base as the fallback mode.** The whole product then comes down to one physical question that can be answered cheaply (below) and one clinical question for a speech pathologist.

---

## 4. The base (shared by A and B)

Rough architecture, to be designed properly once A/B is confirmed:

- **Magazine:** the week as mouthful cells. Options: a two-level carousel (~2 × 28 cells), a pharmacy-filled cartridge, or cut sachet rolls (spec §11). Kept deliberately open for now.
- **One loading door** with a lock, opened from the nurse app. The app names each cell as it's filled. This is where the lids went.
- **One dispense path:** cell → chute → swing-out spout over the lip chamber (or over the dose cup). It parks out of the way so the cup lifts straight up.
- **Sensing:** load cell under the cup seat (sips, volume drunk), camera or IR looking down at the lip chamber and cup bottom (landed, gone, left behind).
- **Cue:** front light, tone under 1 kHz, and a small vibration motor in the cup seat so a hand resting on the cup feels it.
- **Power and data:** mains plus a backup battery, Wi-Fi/Ethernet to the eMAR, a journal for power loss.
- **Looks:** a bedside object like a small coffee machine or radio, not a medical device.

---

## 5. What to test first (mostly no printer needed)

1. **Kitchen-table carry test (today).** Take an ordinary two-handled cup or a paper cup. Build a small dam just inside the lip with Blu-Tack or clay. Put 1–3 **Tic Tacs or small sugar-coated sweets** (stand-ins for tablets, *not real medication*) in the pocket, then drink normally. Record: did they come out with the first mouthful, how often, and at what tilt? Try deeper and shallower pockets and a higher and lower dam. Ten minutes of this is worth more than any simulation.
2. **Face fit of a two-handled nosey beaker** with a shallow lip chamber. When a printer is available, print the concept A cup shell and try it on several real faces. Before that, check it in CAD against a head proxy (next CAD step).
3. **Ask a speech pathologist:** "Is delivering 1–3 whole tablets together with the first mouthful of thin water acceptable for residents without dysphagia? What should we do for residents on thickened fluids?" The answer decides how much of B we need.
4. **Wet-capsule sticking:** repeat test 1 with the pocket wet first, and with a gelatin capsule stand-in (an empty capsule shell from a pharmacy).
5. **Drop into the chamber:** drop sweets from ~40 mm into the pocket and count bounce-outs.

---

## 6. Next CAD steps

- `concepts/lip_chamber.py`: **done as a block-out.** A two-handled nosey cup with a lip chamber and a ghosted base, viewable in `viewer/?m=lip_chamber`. The dimensions are placeholders to react to, not decisions.
- Head/face proxy plus a tilt clearance check for the concept A cup, reported by an audit like rev J's.
- Parametrise the chamber (width, depth, dam height, floor slope) so the carry-test results can be copied straight into the model.
