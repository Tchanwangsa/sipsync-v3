# SmartCup DS-2 — Redesign Spec

**Status:** design sketch, ready to execute
**Supersedes:** the DS-1 concept represented in `smart-cup-3d.html` and `smart-cup-exploded.html`
**Source of requirements:** `Reducing regiment confusion in aged care medication administration.docx`

This document is written to be read cold. It assumes no prior conversation.

---

## 1. What this device is

A smart delivery cup for residential aged care. A resident on a complex polypharmacy regimen drinks from it; at each scheduled time the cup prompts them, releases that dose's tablets into the water they are already drinking, releases them only into a sip it can detect, and writes the administration record straight into the facility's existing eMAR.

The two problems it exists to solve, per the source proposal:

1. **Regimen confusion for the resident** — collapse a complex daily regimen into a single decision point per dose.
2. **Charting burden on nursing staff** — replace a manual charting step with an automatic record. Note that rev J downgrades this from *sensor-confirmed administration* to *sensor-confirmed release*; see §6.

Design constraints carried over from the proposal that must not be broken:

- Tablets are **swallowed whole** — never crushed, never dissolved. Coated and extended-release formulations must survive the trip intact.
- The device is loaded **weekly** by a nurse or pharmacist, not per-dose.
- It integrates with existing eMAR, not a standalone caregiver app.
- Appearance is friendly and non-institutional, to reduce the stigma residents attach to clinical aids.

---

## 2. What changed from DS-1

| DS-1 | DS-2 | Why |
|---|---|---|
| Straw + mouthpiece | Cutout ("nosey") rim, no straw | Straws need sustained suction, which fails with weak orofacial muscles, dentures, COPD. A plain spout is worse still — it forces head extension, the most aspiration-prone swallow posture. A cutout rim lets the cup tilt near-vertical while the head stays neutral or chin-tucked. |
| Sip sensor in mouthpiece | IMU + capacitive level strip | No wetted sensor to clean. Level-drop rate gives true mL/s, and volume consumed comes free — which is also hydration charting, a second clinical win. |
| 7 holes, one per day | Uniform cells, one per *mouthful*, software-grouped into scheduled times | Doses vary from 1 to 8+ tablets. Sizing a cell to a dose forces a huge carousel; sizing it to a swallow removes the entire singulation problem. See §4. |
| Carousel drops dose directly into spout | Two-stage: carousel → staging chamber → fast gate at spout throat | Decouples slow indexing from fast flow-triggered release, and cuts tablet-in-water contact time to well under a second. |
| Dose assumed delivered when commanded | Released only on a confirmed sip; charted as released, not counted | rev J removed the beam-break counter — see §6. |
| Whole magazine lives in the cup | Magazine lives in the base; cup carries one sitting | Weekly loading plus mouthful-sized cells does not fit in a cup-diameter carousel. See §5. |

---

## 3. Design principles

These are the invariants. If an implementation decision conflicts with one of these, the decision is wrong.

1. **A cell is one mouthful, not one dose.** Everything else follows from this.
2. ~~**Never trust the fill; count on the way out.**~~ **Withdrawn at rev J — see §6.** The beam-break counter is gone. What is charted is what was sealed into the slot, released on a sip the cup could actually detect.
3. **Never crush, never soak.** Tablet wet-contact time is a budgeted quantity (§7).
4. **Cue before you dispense.** Never startle someone mid-swallow.
5. **A missed dose is charted as missed.** Never silently rolled forward, never silently re-presented.
6. **The wet path and the dry path never meet except at the throat.** Loose tablets and humidity are incompatible.

---

## 4. The cell model

### The core idea

Size every cell to a **swallow** (2–3 average tablets), not to a dose. Cells are uniform and identical. A scheduled time owns however many **consecutive** cells it needs.

```
08:00  ·  2 tablets  →  cell 4
13:00  ·  8 tablets  →  cells 5, 6, 7
20:00  ·  1 tablet   →  cell 8
```

### Why this is the unlock

Because a cell empties *completely* on every actuation, **nothing anywhere in the device needs to singulate tablets**. There is no escapement, no per-tablet metering, no orifice for mixed-geometry tablets to bridge across. That entire class of mechanical failure is designed out rather than engineered around.

It also caps the swallow. 8 tablets arriving as one clump is a genuine choking hazard; 3 + 3 + 2 across three sips is how a person actually takes 8 tablets. The clinical requirement and the mechanical simplification are the same decision.

### The 13:00 sitting, concretely

```
dump cell 5 → cue → sip → swallow confirmed →
dump cell 6 → cue → sip → swallow confirmed →
dump cell 7 → cue → sip → swallow confirmed →
chart 8 tablets released
```

### Variable dose needs no hardware adjustment

There is nothing physical to configure. The app holds tablet dimensions per drug, computes cells-needed itself, and assigns consecutive cells at schedule time. Staff never do the arithmetic and never set a capacity.

### Cell sizing (rough — verify against a real tablet set)

Working volume ~4–5 cm³; a cell of ~20–22 mm diameter × ~16 mm deep accepts a 20 mm caplet lying flat in any orientation. Confirm against the actual formulary before committing geometry — large calcium and metformin caplets are the binding case.

### Rejected alternatives — do not revisit without new information

- **Movable dividers to make cells resizable.** The device would have to *know* divider positions (magnets + hall sensors, or keyed rings with ID resistors), it is a manual configuration that can be set wrong, and it adds crevices to a component that must be cleaned. Uniform cells solve the same problem in software.
- **One tube per drug, vending-machine style.** Total flexibility and trivial PRN handling, but reliable singulation is tablet-specific — a tube that meters a round 8 mm tablet will not meter a 20 mm caplet — so it needs per-drug inserts, and loading them reintroduces the manual counting job the device exists to eliminate.

---

## 5. Where the magazine lives

### The geometry that forces this

Cup OD 80 mm, walls ~4 mm. A 20 mm cell puts cell centres at r ≤ 26 mm → 52 mm pitch circle → ~163 mm circumference → ~23 mm pitch.

**That is about 7 cells.** (Rough numbers; the conclusion is robust to reasonable variation.)

Worth noting for anyone reading the DS-1 files: the original 7 holes were never a days-of-week decision. That was a geometry limit wearing a calendar costume.

Seven mouthful-sized cells is barely one day for a polypharmacy resident, against a stated requirement of **weekly** loading. A cup-diameter carousel cannot meet the requirement. Something has to give.

### Baseline: cup + base station

**Build this unless §11 is resolved otherwise.**

- The **base** holds the full week's magazine, the charger, and the eMAR uplink.
- The **cup** carries only a small staging chamber — the current sitting's tablets, nothing more.
- Docking the cup loads the next sitting.

This resolves four problems at once: unlimited weekly capacity; a light cup for someone with weak grip and tremor; a wet cup that is trivially cleanable because the tablet store never leaves the dry base; and a natural home for the charging and uplink hardware that DS-1 already had at the bottom of the stack.

### Alternatives considered

- **Stacked discs in the cup** — three 7-cell discs indexing independently onto a shared drop chute. 21 cells in ~60 mm of body height. Works, but squeezes the reservoir and triples the actuator count, and leaves the weight in the resident's hand.
- **Pharmacy-filled sachet cassette** — see §11, this is a live decision.

---

## 6. Trust and counting

### Count out, not in — withdrawn at rev J

The original text: *"IR beam-break at the spout throat is the source of truth. Schedule says 3 expected; counter says 3 passed; chart 3."*

**The counter has been removed.** A photogate looking across the notch has to resolve a 5 mm tablet inside a running stream of water. Refraction at the moving surface, droplets, and two tablets crossing together all read as one count or none, and there is no calibration that fixes it — the interference is the medium the measurement travels through. A number that is wrong in an unknown direction, presented as the source of truth for a medication record, is worse than not measuring: it invites a mismatch alarm on a correct dose and silence on a wrong one.

**What is charted instead.** The commanded quantity — what the nurse sealed into the slot, verified at fill — together with the fact that the mouthful was *released into a confirmed sip*. Release requires three things simultaneously: the dose window is open, the IMU reads drinking attitude, and the level strip sees live flow. A pocket empties completely or not at all (§4), so "the pin moved" and "the pocket is empty" are the same event.

This is an **inference, not a measurement**, and the record says so. The eMAR line reads *"3 released · sip confirmed · loaded as …"*, not *"3 counted"*.

**What this gives up, explicitly:** the cup can no longer detect a tablet that hangs up in the chute. That failure is now unobserved. Mitigations available without new sensing: the chute is short, dry and steep past 30°; the pocket geometry drops a caplet through the gap in one orientation; and a slot that has fired is locked out, so a retained tablet is discovered at the next fill rather than silently redosed. If a facility needs administration confirmed rather than inferred, that requirement should be met by something other than a photogate in a wet path — a load cell under the head is the obvious candidate and is not in this revision.

### Guided fill

Filling is the highest-risk step and currently a memory task. Make it a verified procedure:

1. Carousel rotates cell 5 under the fill port.
2. Screen shows "cell 5 — 2× metformin, 1× perindopril".
3. Staff drop tablets in; a sensor at the fill port counts them.
4. Green on match, auto-index to cell 6. Red and hold on mismatch.

This converts the fill from an unverified human step into a checked one, which is squarely the "regimen confusion" problem the source proposal is aimed at.

**Optional stretch:** a load cell under the magazine. Delta-weight per fill sanity-checks against known tablet mass and catches gross wrong-drug errors. Needs roughly 0.05 g resolution — at the edge of a cheap strain gauge, so treat as a stretch goal, not a dependency.

---

## 7. Sensing and the dispense sequence

### Sensors

| Sensor | Job |
|---|---|
| IMU (accel/gyro) in cup | Is the cup at drinking attitude |
| Capacitive level strip, outside reservoir wall | Rate of level drop = true mL/s; also total volume consumed |
| Dock contacts | Cup present, charging, sitting handoff |

Deliberately **not** a turbine or hall flow meter: a gravity spout runs partially full and sloshing, so a flow meter reads garbage and adds a wetted part that has to be cleaned.

### Sequence

```
armed (schedule window open, cup undocked, cells staged)
  ↓  IMU: drinking attitude    +  level strip: sustained flow ≥ ~1.5 s
priming sip complete
  ↓  haptic + visual cue, ~1 s pre-roll
cue delivered
  ↓  fast solenoid gate at throat opens (~50 ms)
tablets released — no counter; release requires window + attitude + live flow
  ↓  flow resumes, then stops; swallow inferred
sub-bolus confirmed
  ↓  more cells in this sitting?  → back to cue
  ↓  none left
sitting complete → write eMAR record (loaded qty released, timestamp, volume drunk)
```

Two timing decisions worth understanding rather than tuning away:

- **Two-stage gate.** Carousel-to-staging happens in advance and can be slow. Staging-to-mouth is a fast solenoid at the throat, so the latency between "flow detected" and "tablet arrives" is short enough that the tablet lands in water that is still moving.
- **Release on the second sip, not the first.** The ~1.5 s of sustained flow before the first release is not just a debounce. A dry mouth makes tablets materially harder to swallow, so a priming sip is better protocol regardless. The robustness and the clinical benefit point the same way.

### Wet contact budget

The source proposal claims tablets are delivered "without crushing or dissolving, preserving coated and extended-release formulations." That claim has to be engineered for, not assumed:

- Uncoated tablets begin disintegrating within seconds.
- Gelatin capsules turn slick and tacky when wet and will adhere to a spout wall and never arrive.

**Requirement: release at the throat — the last few millimetres — so wet contact time stays under ~0.5 s.** The gate sits essentially at the spout mouth, never upstream of a long channel. Any design that runs tablets down a wetted channel fails this requirement.

---

## 8. Cue design

Haptic-primary. The cup is in their hand, so they feel it even with eyes closed mid-sip; the cup is also below their sightline at drinking attitude, which is exactly when a visual cue is least visible.

- **Haptic** — a light, distinct buzz. Primary channel, for the resident.
- **Visual ring** — secondary, and mostly for the nurse across the room rather than the resident.
- **Tone** — optional, and if used keep it **under ~1 kHz**; high-frequency hearing goes first with age.

Rules:

- The cue fires ~1 s **before** the gate opens, never simultaneously.
- Do not encode meaning in red-versus-green alone — cataracts and colour vision deficiency are both common in this population. Use position, pattern, or motion as the carrier.

---

## 9. Configuration and data model

Sketch, not final schema:

```
Resident
  └── ScheduleEntry
        time            08:00
        drugs           [{drug_id, count}, ...]
        total_tablets   8
        cells_required  3        ← computed by app from drug dimensions
        cells_assigned  [5,6,7]  ← assigned at fill time
        window          ±60 min  ← configurable per drug
        state           pending | dispensing | complete | missed | exception

Cell
  index, contents[], filled_at, verified (bool), state
```

- Cells-required is **computed**, never entered.
- **PRN cells**: reserve cells with no scheduled time for as-needed medication, released on staff authorisation rather than on the clock.
- **Drug dimension table** is a hard dependency — the cell-packing calculation needs per-tablet L/W/H.

---

## 10. Safety and failure handling

| Condition | Behaviour |
|---|---|
| Dose window expires undispensed | Lock the cells out, chart **missed**. Never roll forward. |
| Sitting already dispensed | Index past those cells; they must be physically unable to re-present. |
| Tablet stuck in the chute | **Not detectable at rev J** — the counter that would have caught it is gone. Slot is locked out after firing, so it surfaces at the next fill. |
| Cup undocked mid-sitting | Sitting stays open with staged tablets; timeout returns to exception. |
| Power loss mid-sitting | State must survive; on resume, reconcile released-so-far from the journal before continuing. |
| Cup disassembled for cleaning | Wet assembly (spout, throat, staging chamber) detaches as a unit and is **keyed so it cannot be reassembled wrong**. |
| Humidity reaching the magazine | Hard seal between wet and dry paths, one-way gate only. |

---

## 11. Open decision — resolve before detailed design

**Cup + base station** (§5 baseline) **vs. pharmacy-filled sachet cassette.**

The sachet route: skip loose tablets entirely, ingest a standard sachet roll, cut and drop contents into the staging chamber.

- **For:** Australian aged care already runs on sachet rolls and Webster-paks, so the pharmacy has done the counting under its own existing regulatory regime and the device never touches dose accuracy. That is the single biggest regulatory advantage available to this product.
- **Against:** mechanically hardest option — foil cutting, jam recovery. And a sachet is a whole *dose*, so the staging chamber must meter it into mouthfuls, which puts the escapement problem back. It lands in one place instead of twenty-one, but it comes back.

This is mostly a go-to-market question, not an engineering one: self-contained cup + base suits home and self-managing residents; sachet suits a facility already on a dose-administration-aid contract. The source proposal targets **residential facilities**, which argues for sachet — but the added mechanical risk is real and the pilot timeline in the proposal is 12 months.

Everything in §3, §4, §6, §7, §8 is identical under either choice. Only §5 changes.

---

## 12. Work to do on the existing files

**Status:** `smart-cup-3d.html` has been superseded by `viewer/`, a Vite +
React + TypeScript port with the same renderer split into modules. The DS-2
changes below are done there, plus three that this document did not anticipate:

- **The slot floor is a pair of bomb-bay doors, not a sliding shutter.** A
  tangential shutter drives its leaf through the neighbouring pocket wall, and
  a single full-length hinged leaf fouls the chute 7.4 mm below. Two 11 mm
  leaves hinged at opposite edges clear it at a 30° stop.
- **ARM has a physical referent.** It retracts the latch pin on the three slots
  the sitting owns and leaves the other three latched. It is still a
  permission rather than a movement of medication, but "permission" now has
  something on screen that changes.
- **Drinking needs ~56° of tilt, not 44°.** At a 340 mL fill the notch stands
  55 mm above the surface, so the cup does not pour until it is past 56°, and
  each successive mouthful needs a few degrees more as the level drops. This
  fell out of simulating the water rather than animating it, and it is the
  strongest argument the design has for the nose cutout. Worth carrying into
  any physical prototype: check the tilt against real necks.

### rev J — the head was checked against a face, and failed twice

Superseding the tilt note above. Both failures come from the same unasked
question: where does the mouth actually go?

1. **The shoulders were in the drinker's cheek.** Material *h* mm above the
   lip contact sits *h*·sin(tilt) further back than a plain cup's rim — into
   the face. The crown is 24 mm up and the crest started only 38° off the
   notch, so at 56° a closed slot lid was ~10 mm inside where a nasolabial
   fold is. Contact began at **35°** of tilt. Fixed by azimuth, not height:
   the crest moved to **72°** and the slots to **±88°/±121°**. Face limit
   35° → **56°**.
2. **The cup could never have poured.** Pour threshold is
   atan(freeboard / 34), and the cup carried **52 mm of dry wall above its own
   waterline** — 56.6°, against a face limit of 35°. The head was not too tall
   for the cup; the cup was too tall for the water. The whole head dropped
   30 mm (rigid translation, so it cannot disturb (1)), leaving 21 mm of
   freeboard. Pours at **32.4°**. Cup height 182 → **152 mm**.

Also: `Y_CUT` went from 16 mm below the notch to 4 mm above it. With the new
freeboard, the old low rim would have stood 7 mm over the waterline and
dribbled out of the nose relief at 12° of back-tilt. At 156 the back-tip
margin is 38.5° against the notch's 32.4°, so the cup always pours out of the
edge it is aimed at first.

**Cost: six slots → four.** 120° of mouth relief plus a nose cutout leaves 70°
per shoulder, and three slots at 33° pitch need 72°. Six only fits by spending
the nose cutout entirely. Four is what §5 asks the cup to carry anyway — the
current sitting is at most three mouthfuls, and the week lives in the base.
"Six = a day in the cup" was the outlier, not the constraint.

**Corrected claim.** DS-1 and DS-2 both said the far rim is what arrives at the
nose. It is not — tilt a cup and the far rim swings up and *away*; what closes
on a face is whatever the near rim carries. The nose relief still earns its
place (a full-height far rim binds at ~62°, inside the drawdown range), but it
was never the edge that made this cup undrinkable.

**Unverified.** The near-rim numbers rest on a coarse face profile; the
model-free part — that DS-2 put material 20 mm deeper into the face than a
plain cup's rim does — is what to trust. Check the 24 mm crown against real
cheeks before committing tooling.

`smart-cup-exploded.html` is still DS-1 and still needs the changes below.

**`smart-cup-exploded.html`** — currently "Eight parts, four jobs", parts numbered 1–8: lid & prompt ring, rotating pill carousel, release gate, mixing spout, mouthpiece & sip sensor, water reservoir, smart core & eMAR link, charging base.

Changes:
- Remove **mouthpiece & sip sensor**; replace with **cutout rim** (structure) and move sensing to a **sensor band** part (IMU + capacitive level strip).
- Split **release gate** into **staging chamber** and **throat gate + tablet counter**.
- Rename **mixing spout** → **spout throat**, and reposition it as the *last* few mm before the rim, not a channel.
- Move the **carousel** out of the cup and into the base as the **weekly magazine** (assuming §11 baseline); the cup gains a small staging chamber in its place.
- **Charging base** grows into **base station** — magazine, charger, eMAR uplink, guided-fill port.
- The flow diagram ("From 'it's time' to a charted dose") needs the §7 sequence, including the priming sip and the per-sub-bolus loop.
- The `sip sensed` label in the SVG becomes `flow sensed`.

**`smart-cup-3d.html`** — "SmartCup DS-1 — Assembly Viewer". Contains straw and mouthpiece geometry (search `straw`, `mouthpiece`, `sip sensor`) that must be removed, and a 7-hole carousel whose cell count and location both change.

Also worth surfacing in whichever viewer carries the narrative: the cell-is-a-mouthful idea (§4) is the single most explanatory thing about this design, and neither current file expresses it.

---

## 13. Non-goals

- No crushing, splitting, or dissolving. Ever.
- No standalone caregiver app as the primary interface — eMAR integration is the point.
- No per-tablet singulation mechanism (§4 removes the need; adding one back means something upstream went wrong).
- No tablet counter in the wet path (§6). If administration must be measured rather than inferred, that is a load cell, not a photogate.
- No liquid medication handling in this revision.
- Not a home-consumer product in this revision — the buyer is a facility.
