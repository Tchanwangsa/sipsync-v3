# SipSync cup: where the design stands and what has to change

Written 24 Sep 2026 as the starting point for v2. It covers:

1. what the product must do (the fixed brief)
2. the cup as it stands (DS-2 rev J)
3. what is wrong with it
4. what to keep
5. what has to change
6. the decisions we still need to make
7. how we'll work in v2

Sources: `../Reducing regiment confusion in aged care medication administration.docx` (the proposal), `../smart-cup-v2-spec.md` (the DS-2 spec), `../viewer/` (the React/WebGL model), and the build123d port in `ds2_baseline/`. Numbers marked **[audit]** come from `uv run python -m ds2_baseline.audit`.

---

## 1. The brief (from the proposal, unchanged)

**Problem.** Aged-care residents on 5+ medications get confused by complicated dosing schedules. Nurses spend a lot of time sorting, giving and charting doses by hand.

**What the product must do:**

- Turn a resident's regimen into **one simple action per dose time**.
- **Confirm intake** within seconds and write it into the facility's **existing eMAR**. No separate caregiver app.
- Be **loaded weekly** by a nurse or pharmacist, not dose by dose.
- Tablets are **swallowed whole**. No crushing or dissolving, so coated and extended-release tablets still work.
- Look **friendly and non-clinical**.
- Pilot: 100 residents over 12 months. Device budget is about **US$400 per cup**.

The proposal's own mechanism was a weekly pill carousel, a release gate that drops the dose into the spout, and a sip sensor. DS-1 built that literally. DS-2 then revised it ten times (rev A→J) into what's below.

---

## 2. The cup as it stands (DS-2 rev J)

### 2.1 Side view: what sits at which height

```
 z (mm)
 176 ┬─ shoulder crown ─ 4 hinged lids, 4 lid bolts + 4 lid solenoids (z≈172)
     │
 164 ├─ slot floors = pairs of "bomb-bay" doors; latch pins + 4 door solenoids (z≈159)
     │  dry chutes run under the pockets toward the notch (z≈149–151)
 152 ├─ DRINKING NOTCH = lower-lip contact ─ LED cue ring (z 150), haptic motor (z 146)
 147 ├─ "ring bus": a flex loop all the way round the head carrying power
 142 ┼─ TWIST-OFF JOINT ─ 6 sprung contacts + O-ring (z≈138–141). Head lifts off here.
 129 ├─ water surface at rest (350 mL)
     │  Tritan reservoir, Ø76 inside ─ level-sensing strip + flex bonded on the outside
  41 ├─ tank floor
  40 ┼─ smart core: PCB, 1800 mAh battery, BLE radio
  16 ├─ 3 charge pads
   0 ┴─ charging dock (a weighted coaster with 3 pogo pins)
```

Plan view: the notch faces the drinker. Two raised **shoulders** stand either side of it, from 72° to about 140° round the rim. Each shoulder holds **two tablet slots**, at ±88° and ±121°. Opposite the notch is a small **nose relief**, where the rim is only 4 mm above the lip line.

### 2.2 Parts (the old viewer's numbering)

| # | Part | What it was meant to do |
|---|---|---|
| 1 | Twist-off collar & slot lids | Four lids, each hinged on its outer edge and each locked by its own solenoid bolt. The nurse's app unlocks one lid at a time for filling. A keyed quarter-turn collar lets the whole head come off for cleaning. |
| 2 | Cue ring & haptic driver | LED ring round the head plus a vibration motor. Three buzz patterns: "gate opens on next sip", "rest the cup", "sitting done". |
| 3 | Sitting magazine | Four pockets, 22 × 13 × 8.6 mm, each holding **one mouthful** (up to 3 tablets lying across the pocket). Four = one sitting plus a spare. |
| 4 | Slot gates & latches | Each pocket's floor is two 11 mm doors. One latch pin holds both, and a solenoid pulls it on a detected sip. The tablets fall onto a dry chute and slide to the notch. |
| 5 | Nosey rim, notch & chutes | The drinking rim, the 32 mm notch the water and tablets leave over, and the chutes. |
| 6 | Sensor band | Motion sensor (IMU) for "is the cup at drinking angle". Capacitive strip on the outside wall reads the level falling, giving mL/s and volume drunk. |
| 7 | Water reservoir | 350 mL, Tritan, 2 mm wall, "dishwasher-safe". |
| 8 | Smart core & eMAR link | Board, battery, BLE radio, and the day's plan. Journals state so a power cut can't lose track. |
| 9 | Charging dock | "A coaster and nothing more." It holds no medication. |
| 10 | Harness & contact ring | A flex up the outside of the tank to 6 gold pads under the joint. Sprung pins in the head press onto them. |

### 2.3 How a sitting was meant to run

```
armed (dose window open, cup off the dock)
 → priming sip: IMU at drinking angle + level strip sees ≥1.5 s of flow
 → buzz (cue) ~1 s before release
 → latch pin pulls → doors drop → tablets slide down the chute into the stream at the notch
 → keep drinking, swallow
 → next slot for this sitting? → back to cue
 → done → eMAR: "N released · sip confirmed · loaded as …"
```

A missed window charts **missed** and locks the slot. The tablet counter at the notch was dropped in rev J. The record now says *released on a confirmed sip*, not *taken*.

---

## 3. What's wrong with it

Grouped by severity. **A**, **B** and **C** are each enough to restart the design on their own.

### A. You can't drink from it

- **24 mm shoulders sit right beside the mouth.** The rim is flat for ±60° round the notch, then rises 24 mm to the shoulder crown by 72°, where the cheeks and the sides of the nose are **[audit §2]**. As the cup tilts, anything standing above the lip line moves back into the face.
- **The opening is only 62% of a normal cup mouth.** It's 29.7 cm² against 47.8 cm² for a plain Ø78 rim, and only **Ø36 mm** between the shoulders **[audit §1]**. When you tilt a cup past ~45°, your nose goes *into* the mouth of the cup, and here there's no room for it.
- **The nose relief is small**: about 41° of arc. Commercial nosey cups cut away a large U.
- **The face reasoning was wrong.** Rev J says the far rim "swings up and away" from the face as you tilt. It doesn't. At 56° of tilt the far rim has moved from 84 mm to 44 mm out from the face and risen 72 mm, toward the nose and brow **[audit §3]**. That's the whole reason nosey cups exist.
- **No face check was ever real.** Every number in revs H–J was tuned against a "coarse face profile" in code. None was checked against an actual head or an actual printed cup.

**Root cause.** Rev C decided the tablets must sit *above the lip* so gravity could drop them into the stream. The only place above the lip is the rim, so the tablet store went into the rim, beside the face. Everything in A follows from that one decision.

### B. Power and electronics weren't designed. They were drawn in afterwards.

This is the problem you hit when you asked "how does power get to the top?".

- **10 powered things live in the detachable head**: 4 door solenoids, 4 lid solenoids, the LED ring and the haptic motor. The battery is at the very bottom of the cup. Power has to climb the full height of the tank and then cross a joint that is taken apart every day.
- **The contacts sit in a wet joint.** To reach the notch the water has to pass the twist-off joint at z 142, so the joint must be a water seal. The 6 sprung contacts were drawn at the same radius and height as the O-ring: 91 mm³ of pad sits *inside* the seal **[audit §4]**. Exposed electrical contacts in a joint that sees water and daily washing corrode and short.
- **Wiring was added only when someone asked.** The ring bus, shoulder risers and lid feeds all came in revs G–J as "this load had nothing reaching it". Rev J then moved the slots and left a third of the wiring floating in mid-air over the mouth. The layout followed the mechanism instead of being planned with it.
- **The flex is bonded to the outside of a "dishwasher-safe" tank**, and nothing covers it.
- **Two parts are drawn where they physically can't be.** The **IMU** is half inside the water and half through the tank wall (652 of 1232 mm³ in the water). The **haptic motor** is two-thirds inside the open mouth of the cup, where the water climbs when you tilt (943 of 1386 mm³) **[audit §4]**.
- **The 8 solenoids stick 5.4 mm out of the head** (to r 47.4 against a shell at r 42). They're exposed, knockable, and in the hand's grip zone.
- **The cleaning story contradicts itself.** The head is "wipe only, never washed", yet it carries the rim your lips touch and the notch the water pours over. The body is "dishwasher", yet it holds the battery, the charger contacts and the radio.

### C. The system doesn't meet the brief

- **Weekly loading is gone.** The spec says the week's supply lives in a base station and the cup carries one sitting. But the dock was built as "a coaster, nothing more", and nothing moves tablets from a base into the cup. With 4 slots, a nurse has to refill the cup **every sitting**. That's more nursing work than a pill cup, which is the opposite of the goal.
- **Charting got weaker.** The proposal promises "confirm intake". Rev J charts "released on a confirmed sip". That's honest, but it means the headline benefit (automatic, trustworthy charting) is now an inference.
- **Budget.** 8 solenoids, 4 hinged lids, 8 tiny door leaves, a sealed electrical joint and a radio, in a dishwasher-proof cup, is a lot to fit in ~US$400 per unit for a 100-unit pilot.

### D. The mechanism is too small and too fragile

- Latch overlaps of **1.3 mm**, door leaves **1.6 mm** thick, hinge pins **Ø1.8 mm**, lug-to-bolt clearance **0.2 mm**. That's watch-scale detail in a product that gets dropped, knocked and washed in a care facility, and whose failure means a missed or double dose.
- A tablet must fall through a **9.4 × 13 mm** gap. A large caplet (calcium, metformin, up to ~20 mm long) can only lie lengthways along the 22 mm pocket, and lying that way it can't drop through the gap.
- **Max 3 tablets per slot, 4 slots**, so 12 tablets is the ceiling for a whole sitting, spare included.

### E. Clinical questions nobody answered

- **Tablets in thin water are a mixed-consistency swallow.** For residents with dysphagia (common in aged care), that's a recognised choking and aspiration risk. Many are prescribed thickened fluids, which this cup was never designed to pour. **Ask a speech pathologist before anything else.** The answer could decide the delivery concept.
- **Pour angle.** Rev J pours at ~32° and each later mouthful needs more tilt. None of this has been tried by a real person holding a cup.
- **Wet contact.** Tablets land on a wet notch and ride the stream. The "<0.5 s wet" budget was never tested.

### F. How it got here (process)

The design moved forward by patching: each rev fixed the last visible problem (lids hit the cheek → move the slots; cup doesn't pour → drop the head 30 mm; no wire to the far shoulder → add a ring bus). The model was hand-written triangle meshes with numbers copied between files, so there were no real solids, no collision checks and no printable output. Contradictions piled up in the comments instead of being caught by the geometry. v2 fixes this by working in solid CAD and checking the key constraints (face clearance, wet/dry separation, power route) in code on every build.

---

## 4. What to keep

These ideas survived every revision for good reasons. They don't depend on the rim-magazine geometry.

| Keep | Why |
|---|---|
| **One cell = one mouthful (2–3 tablets), not one dose** | The best idea in the project. A cell always empties completely, so nothing ever has to meter single tablets. Big doses are split across several swallows, which is also safer. |
| **Week's supply outside the cup; the cup carries one sitting** | Light cup for weak or shaky hands, dry tablet storage. But this time the base actually has to do the job (see C). |
| **Sensing with no wetted parts**: IMU for attitude + level/weight for flow and volume | Nothing to clean, and it gives hydration charting for free. |
| **Honest charting**: record what's known, say "inferred" when it is | Clinical records must not overclaim. |
| **Cue before release; buzz first; never colour alone** | Right for this population (hearing loss, cataracts, colour-vision deficiency). |
| **Rules**: missed = charted missed and locked; never crush or soak; tablet path stays dry until the last moment | These are product rules, not geometry. |
| **Fill ~350 mL; ~21–23 mm of rim above the water; cup ~150 mm tall** | Sensible proportions for a tremoring hand. Re-check once the rim changes. |
| **Nurse workflow**: pick a resident, app names each cell's contents as it's sealed, one cell open at a time | Good for fill accuracy. It lives in the old viewer's `model/profiles.ts` and `model/meds.ts` if we want it for a demo later. |

---

## 5. What has to change (v2 design rules)

Hard constraints, written so the CAD can check them:

1. **Nothing stands above the lip line** within ±90° of where the lips go. The rim is an ordinary cup rim.
2. **Full-width mouth**: the open area at the top is at least ~90% of the rim's inner circle (rev J: 62%).
3. **A real nose relief**, sized against a face model, and checked at 30°, 45° and 60° of tilt on every build.
4. **The part you drink from is dishwasher-safe and has no electronics in it.** All electronics and actuators sit in one sealed module.
5. **No bare electrical contacts in any joint that sees water.** If power has to cross a detachable joint, use a sealed or contactless method (inductive/Qi, or sealed pogo pins in a dry zone), or better, don't cross a joint at all.
6. **Plan the power and data route before the mechanism.** Every powered part must have a drawn path to the battery before its geometry is accepted.
7. **Minimum feature sizes fit for moulding and abuse** (working numbers until we pick a process): walls ≥ 1.5 mm, moving latches ≥ 2 mm overlap, no functional gap under 0.3 mm.
8. **Pocket size set by the worst real tablet in the formulary**, not by what fits the rim.
9. **Weekly loading must really happen**: either the base loads the cup each sitting, or the cup holds a week and stays light. Pick one and design it end to end.

---

## 6. Decisions to make together

These come before any new geometry. Each one changes the shape of the product.

1. **Do tablets go into the water at all?**
   - (a) Yes, into the stream at the lip (the old approach, fixed so it's drinkable)
   - (b) Yes, but from a pocket **inside** the cup just below the lip, washed out by the tilt
   - (c) **No**: the device presents the mouthful separately (tray, spoon, small cup) and the cup confirms the drink
   - Get the speech-pathology answer first (§3E).
2. **Where does the week's supply live, and how does one sitting get into the cup?** Base station with a transfer mechanism, pharmacy sachet rolls (spec §11), or a swappable daily cartridge.
3. **Where do the electronics live?** A sealed base or "puck" under a plain washable cup (the cup lifts off to drink and wash, and all motors, sensors and battery stay in the puck), or electronics in the cup with a sealed wireless-charged module.
4. **What does "confirmed" mean on the chart?** Released on a sip (rev J), or something stronger (weight change, camera, nurse tap)?
5. **Who is the first user?** Residents who can lift and tip a cup unaided, or also those who need help? This decides handles, weight and tilt.

---

## 7. How we'll work in v2

- **Solid CAD, generated from code** (build123d). Every part is a real solid you can section, measure, export to STEP for other CAD tools, and export to STL for printing later.
- **Constraints are code.** Face clearance, opening size, wet/dry separation and "every load has a wire" become checks in an audit script that runs on every build, the way `ds2_baseline/audit.py` already measures rev J.
- **Start with the thing that failed.** First deliverable: a **face/head proxy** (from published adult head dimensions) plus a **plain nosey cup shell** with no mechanism, tilted through 0–70°, with clearance reported. Once a plain cup passes, we add the concept chosen in §6.1.
- **Print early when a printer is available.** A plain printed shell held to real faces beats any model. Until then, STLs are exported on every build.
- **The old viewer stays as it is**, as a record of DS-2. `ds2_baseline/` is its CAD twin and is also frozen.
