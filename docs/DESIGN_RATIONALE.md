# SipSync v3: design rationale

Written 2026-10-29 alongside the first push of the v3 viewer. For every decision in v3 it gives the choice, the reason, and what it costs. The numbers come from `src/dims.ts`. If this document and that file ever disagree, the code is right.

**Read in this order:** this file → [`swallow-proof-pod.md`](swallow-proof-pod.md) (how we confirm a swallow) → [`../README.md`](../README.md) (what the viewer shows) → [`history/`](history/) (how we got here).

**Status:** concept model only. Nothing has been printed, held to a face or tested on a person. Untested claims are marked **[untested]**.

---

## 1. Who it's for

| | |
|---|---|
| **Decision** | An independent person managing 5+ medicines at home. Doses are tracked in a companion app (MedSync; how the two link is in [`medsync-integration.md`](medsync-integration.md)). No facility eMAR link. |
| **Why** | The [original proposal](source/original-proposal.md) targeted residential aged care: nurses load it, eMAR charts it. On 2026-10-29 we moved to home use, because facility features (nurse witness, per-resident verification levels, eMAR charting) don't help someone living alone and add cost and integration work. |
| **What carried over** | Collapse a complex regimen into one action per dose time. Load weekly, not dose by dose. Swallow tablets **whole** (never crush or dissolve, so coated and slow-release tablets still work). Look friendly, not clinical. |
| **What it changes** | Nobody is there to watch a dose or decide on a retake. So v3 needs (a) **positive** proof that a dose went down, not just that it left the cup, and (b) rules a pharmacist sets in advance for what happens when it didn't. That is the job of the swallow-proof pod (§6). |

## 2. Why v3 is a restart, not DS-2 rev K

DS-2 (the old `viewer/`, spec in [`history/ds2-spec.md`](history/ds2-spec.md)) went through ten revisions. The v2 audit ([`history/v2-design-notes.md`](history/v2-design-notes.md) §3) found three problems, each enough on its own to start again:

1. **You couldn't drink from it.** The tablet store sat in the rim, 24 mm shoulders stood beside the mouth, and the opening was 62% of a normal cup's. The cause was one early decision: tablets must sit *above the lip* so gravity can drop them.
2. **The electronics were drawn in afterwards.** Ten powered parts sat in a detachable head, wired through a wet twist-off joint, while the cup was still called "dishwasher-safe".
3. **It didn't meet the brief.** With 4 slots in the cup and nothing moving tablets from the base, someone had to refill it at every dose time.

v3 keeps what survived every revision:

- **one cell = one mouthful** (not one dose)
- **the week's supply lives outside the cup**
- **sensing with no wetted parts**
- **cue before release**
- **never crush, never soak**

It also follows the v2 rules: nothing above the lip line, the part you drink from has no electronics, no bare contacts in a wet joint, and the power route is planned before the mechanism.

The idea that unlocked v3 came from [`history/v2-concepts.md`](history/v2-concepts.md) §1: **put the tablets where the water already goes.** [Oralflo](https://oralflo.com/how-to-use-oralflo/), a pill-swallowing cup already on sale, holds the pill on a grate in its spout, and the drink carries it in. Nobody loads that spot automatically or confirms what happened. That's our product.

---

## 3. The cup and lid (`src/parts/cup.ts`, `CUP` / `LID` in `dims.ts`)

| Decision | Why | Cost / open question |
|---|---|---|
| **Copy Oralflo's form: opaque white tapered cup, 104 mm tall, Ø62 → Ø80, ~250 mL fill** | A shipping product people already drink from proves the pose works. The taper sits well in the hand and nests into the tower's cove. A smaller fill than DS-2's 350 mL keeps the cup light for a weak or shaky hand. | The size is borrowed, not tested on our users. |
| **No power anywhere in the cup, lid or handle** | The whole cup goes in the dishwasher, with nothing to charge, seal or corrode. This is the direct fix for DS-2's wet-joint wiring (§2.2). | Every sensor has to work from the dock, so it can only sense while docked. |
| **Low snap-on lid, 19 mm at the back and 21 mm at the front** | Tipped ~95° to drink, the lid's back edge ends up at nose height. Every mm of lid height at the back is a mm off nose clearance. | The ramp had to move under the rim to make room (see below). |
| **Fixed tube spout at the front edge, leaning 20° back over the lid** | An earlier v3 spout leaned 58° *toward* the drinker. Docked it looked right, but tipped to drink it pointed 20–45° down at the chin. Leaning back like Oralflo's, at 95° of tilt it points ~15° up into the mouth with the head level. It never makes her tip her head back, which is the swallow posture most prone to aspiration (DS-2 spec §2). | Every lid change must now be checked in the Sip pose, not just docked. The viewer's Sip slider exists for this. |
| **Bore Ø15 mm inside, Ø21 mm outside, 30 mm long, ribbed mouthpiece** | A 20 mm caplet fits lengthways, which covers the large metformin and calcium tablets. The ribs give soft lips something to seal on. | — |
| **Vertical well under the spout, so the bore bends 20° at the deck** | A bore that kept the spout's lean below the deck would leave through the front wall. Making the well vertical keeps it inside the cup. | One bend in the tablet path. Capsules go up single file, lengthways. **[untested]** |
| **Slotted grill 15 mm below the rim, 13 mm above the water when upright** | Tablets stay **dry** until she drinks (the "never soak" rule). The water only reaches the grill near full tilt, then carries the mouthful up the bore with the first gulp. This is Oralflo's mechanism. | Wet contact time is short in theory, but not yet measured. |
| **Gravity ramp hung *under* the lid, ~18° over 50 mm, channel 17 mm wide** | It used to sit in a 33 mm hump at the back of the lid, right where the nose goes (above). Under the rim it costs no height. 17 mm keeps capsules lengthways so they **slide** rather than roll and twist. | Takes some headspace. Moving the ramp dropped the back port and tower outlet by 14 mm. |
| **Flush back port, 20 × 13 mm, with a sprung shutter opened by a magnet in the tower** | A magnet pulls a steel slug through the plastic, so the cup stays unpowered. Off the dock the shutter stays shut and can't be poked open. 13 mm tall (up from 10) clears a ~10 mm marker capsule. | The magnet and shutter spring need a real tolerance check. |
| **Pull tab on the left (−x), opposite the handle** | Oralflo's lift-off point. One hand holds the handle and the other peels the lid. | — |

## 4. The handle (`src/parts/handle.ts`, `HANDLE`)

| Decision | Why | Cost |
|---|---|---|
| **Passive: one two-shot moulding (white core, sage overmould), closed D-loop** | We weighed three options: passive with everything in the tower; a smart handle with sensors and a battery; and a hybrid. Passive is the cheapest and simplest, and it makes the whole drinking set dishwasher-safe. Moving the breath sensor into the tower (§6) took away the last reason for a powered handle. | No sensing during the sip itself (for example swallow-timed release, or sampling breath mid-drink). |
| **Slides down a dovetail rail on the cup and clicks in with a sprung pawl** | The handle comes off for washing and storage. The **rail stays**, so a smart handle could slide on later without changing the cup. | A rail on the cup wall. |
| **58 mm reach, 26 mm finger gap, 22 mm grip bar** | Fits four fingers of an arthritic hand, and the foot still ends inside the dock. | Sized by reasoning, not by trials. |
| **Top ends 3 mm under the lid skirt** | The lid snaps on without hitting the handle. | — |

## 5. The med tower and dock (`src/parts/tower.ts`, `TOWER` / `DOCK`)

| Decision | Why | Cost |
|---|---|---|
| **All the electronics in one mains-powered tower *behind* the cup (−z)** | One sealed module that's never washed, with nothing to route through the cup (v2 rules 4–6). Behind the cup means nothing reaches over the cup and nothing is near the face: you load from the back and drink from the front. | A bigger footprint on the table (dock 174 × 188 mm). |
| **A full-height cove in the front face that the cup nests into; locating magnets around the seat** | Putting the cup back squares it to the outlet by itself, so the port and outlet line up without fiddling. | The cup must go back the right way round. The magnets help, but this is **[untested]**. |
| **Dose path runs entirely by gravity: cell → drop channel → sloped chute → outlet → lid shutter → ramp → grill** | No arm, no pusher, nothing moving near the cup. The only actuators are the carousel index and the shutter magnet. | Needs height. The tower is 270 mm tall. |
| **Week magazine of 4 carousel decks × 7 cells = 28 mouthfuls, decks 26 mm high** | One cell is one mouthful (2–3 tablets), the core DS-2 idea. A cell always empties completely, so **nothing ever has to meter single tablets**, and big doses are split over several swallows, which is also safer. 28 cells is a week at four one-mouthful dose times a day; bigger sittings use consecutive cells. The 26 mm decks hold two stacked capsules. | The cells were sized for bare tablets. A **three-capsule** mouthful needs deeper or wider cells. |
| **Load a week through one feed slot, one tablet at a time** | The app calls each tablet out ("next: metoprolol"). The tower checks its size with an optical gauge, caps it in a marker capsule and files it in its cell through a side gate. The person never picks a cell, so they can't put a tablet in the wrong one. | The wrap station is the most complex mechanism in the product (pod doc, option 2). |
| **Pilot shortcut: a pharmacy-packed week cartridge under the service hatch** | Tests the idea without building the wrap station. Pharmacies already pack weekly blister and sachet rolls. | Needs pharmacy partners, and copes badly with same-week changes and as-needed medicines. |
| **Cues: a warm halo arc in the cove, a next-dose display on the right shoulder, a speaker on the left** | Cue *before* releasing a dose, never startle. Light, text and sound together, never colour alone (hearing loss, cataracts, colour-vision deficiency). | — |
| **Floating seat platen on a load cell** | Weighs the lift and the return. It confirms a drink happened and measures how much water went, which also tracks hydration. | — |

## 6. How a dose is confirmed (no camera)

Each step answers a different question, using the cheapest sensor that can answer it.

| Step | Sensor | What it proves |
|---|---|---|
| Dropped | IR break-beam in the drop channel | the mouthful left the cell |
| Landed | time-of-flight sensor beside the outlet, looking down the ramp at the grill (re-reads the empty grill as its baseline on every dock) | it reached the grill |
| Drunk | load cell under the seat | the cup was lifted, how much water went |
| Gone | time-of-flight again, back to the empty-grill baseline | it left the grill |
| **Swallowed** | breath sensor in the tower, sampling lid air through the open shutter on later sips | **it went down** **[untested]** |

**Why no camera:** cheap single-purpose sensors cost less than a camera, they don't film someone in their own home, and a camera still can't see a swallow. **Why not just stop at "gone":** the first four steps only prove the mouthful *left the cup*. At home, with nobody watching, that isn't good enough for a safe retake.

**Why a breath marker (the swallow-proof pod):** we looked at the obvious options (sensors around the cup, a carer confirming in the app, a camera) and rejected them as weak or simply surveillance. The pod puts the evidence **inside the body**. Every tablet rides in a clear over-encapsulation capsule (DBcaps-style, which fit ~90% of common tablets). The capsule's seal band carries a food-safe marker. The marker's by-product shows up in the breath 5–10 minutes after swallowing, and the precedent is Xhale's SMART system (2-butanol, University of Florida, 2008). The key result is that a failed dose is **actually detected**, not just unconfirmed, so a retake is safe. Evidence, alternatives and the eight open risks are in [`swallow-proof-pod.md`](swallow-proof-pod.md).

**Why the breath sensor is in the tower, not the handle:** it keeps the handle passive (§4). The cost is that the sample is taken after the cup is docked, from air that has had a few seconds to mix and escape up the spout. A smart handle on the rail could sample during the sip if the tower turns out not to be sensitive enough.

**Why a capsule per tablet, not a pouch per mouthful:** a whole-mouthful pouch won't pass the 15 mm bore. Single capsules also roll far more predictably down a chute than mixed tablet shapes, and they give the tower one shape to handle.

## 7. The viewer (how this repo is built)

| Decision | Why |
|---|---|
| **React UI + plain Three.js scene** (`App.tsx`, `engine.ts`) | Light, runs in a browser, and is easy to share. Selecting a part shows its role and specs; explode and X-ray show the inside. |
| **Every shared dimension in one file, `dims.ts`, in mm, with one world frame** | DS-2's hand-written meshes had numbers copied between files, and contradictions piled up in comments instead of being caught. Here builders only read `dims.ts`, so changing a number moves everything that depends on it. |
| **Each part exports `build…(): PartDef[]`** | The UI gets the same metadata (name, role, specs, explode vector, internal flag) from every part. |
| **One palette in `materials.ts`: warm whites, one sage accent, clear Tritan, graphite internals** | Makes the product read as one calm, non-clinical family (the brief's anti-stigma goal). |
| **Sip slider: tips the cup to 95° at a ghost drinker, with the water surface held level by a world-space clip plane** | The 58° spout looked fine docked and was wrong at the lips. We now judge the design by how it's used, comparing against Oralflo footage, and the slider makes that check part of every change. |

---

## 8. Open questions

1. **Speech pathology:** capsules or gel with thin water for this group of users. Ask before committing to the delivery concept.
2. **Breath detection:** can a small metal-oxide sensor pick up the marker's by-product in diluted, humid lid air? Can it tell "held in the mouth" from "swallowed"?
3. **Swallow pose:** print the cup and lid and drink from them. Check the spout angle, nose clearance and when the water reaches the grill.
4. **Tablet path:** do capsules pass the bend in the bore lengthways and in single file, every time?
5. **Wet contact:** how long do capsules sit wet on the grill?
6. **Capsule storage:** how do capsules hold up in a sealed magazine for a week (brittle when dry, soft when humid)?
7. **Regulation:** over-encapsulating plus a marker may change how the device and the pharmacy's role are classified. Ask early.
8. **Three-capsule mouthfuls:** need bigger cells, or a rule of two per cell.
9. **Retake rules:** proposed in [`medsync-integration.md`](medsync-integration.md) §4: the person approves on the tower, the pharmacist sets in advance which medicines may be retaken (off by default), and retakes stay switched off until the breath check is validated. Not built.

## 9. Document map

| File | What it is |
|---|---|
| `DESIGN_RATIONALE.md` | this file: every v3 decision and its reasoning |
| `swallow-proof-pod.md` | ingestion confirmation: evidence, wrap options, limitations, sources |
| `medsync-integration.md` | how the tower links to the MedSync app (proposed), plus 4 decisions with reasons: schedule on the tower, retake approval, hiding "swallow confirmed", as-needed and mid-week changes |
| `source/original-proposal.docx` / `.md` | the original brief (Bonnie Lin, Aug 2026) |
| `history/ds2-spec.md` | the DS-2 spec (rev J), the design v3 replaces. Written for aged care. |
| `history/v2-design-notes.md` | the v2 audit of DS-2: what broke and the rules that came out of it |
| `history/v2-concepts.md` | v2 concept options, including the Oralflo "lip chamber" idea v3 grew from |
| `history/v2-research.md` | v2 background research |

The `history/` docs still assume aged care (nurses, eMAR). Read them for the reasoning, not the target user.
