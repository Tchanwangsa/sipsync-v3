# Swallow-proof pod: how we confirm a dose went down

**Status:** chosen direction (2026-10-29). It's a design idea, not tested, and there's no lab access for now. Everything that needs testing is listed under Limitations.
**Context:** SipSync v3 is for people managing their own medicines at home (see `v3/README.md`). There's no nurse to watch or to decide what happens when a dose comes back out.

---

## The problem

The cup can't prove a swallow. The v3 sensors (break-beam, the time-of-flight sensor on the grill, the motion sensor, the load cell) show that a mouthful **left the cup**. They can't tell whether it went down, came back out, or ended up in a tissue.

## The idea

Every tablet travels with a **food-safe breath marker**. Swallowed, the marker breaks down in the body and its by-product shows up in the breath a few minutes later. Spat out, nothing shows up. You breathe into the cup while drinking. When the cup goes back on the dock after a **later drink**, a sensor in the tower draws a sample of the air left in the lid.

```
marked mouthful lands on the grill
 → she drinks, mouthful goes down with the water
 → 5–10 min later: next sip → cup back on the dock → tower samples the air in the lid
 → by-product found → CONFIRMED
 → nothing found by the end of the window → DIDN'T GO DOWN
```

Why it's worth pursuing:

- The evidence comes from inside the body, with no camera and nobody watching.
- A failed dose is **actually detected**, not just unconfirmed. That makes a safe retake possible.

**Precedent:** Xhale's SMART system (University of Florida, 2008) put trace **2-butanol**, a food-safe (GRAS) compound, in a capsule. It could be measured in breath **5–10 minutes** after swallowing. Their patent looks for the marker *and* its by-product, using a miniature gas chromatograph with a metal-oxide sensor. Catalent made SMART softgels that release quickly without the marker evaporating.

---

## Can each tablet be put in a capsule?

**Mostly yes.** Putting a whole tablet inside a capsule ("over-encapsulation") is routine in drug trials, where it's used to disguise which tablet is which.

- **Fit:** Lonza's **DBcaps** are made for this. They're wider than normal capsules and come in 8 gelatin sizes and 3 HPMC (plant-based) sizes. Lonza says they fit about **90% of common tablets**. Round tablets up to roughly **11 mm** across fit the larger sizes. The biggest caplets (some metformin and calcium tablets) are the hard cases.
- **Speed in the body:** a gelatin capsule delays dissolving by about **5 minutes**, which is generally accepted for ordinary tablets. HPMC is closer to **10 minutes**, with less evidence behind it. This evidence comes from the capsule maker.
- **Excluded medicines:**
  - **Slow-release tablets:** we found no data on putting them in capsules, so the pharmacist decides case by case.
  - **Tablets that must stay out of a capsule:** sublingual, orally dissolving and chewable tablets.
  - **Tablets that won't fit**, and anything already a capsule. These may be fine, since the marker could go into a sleeve, but that's untested.
- **The v3 cup:** the mouthful has to pass a back port **20 × 10 mm**, a ramp **17 mm** wide, a grill **15 × 18 mm** and a spout bore **15 mm** across (`LID.port`, `LID.ramp`, `LID.grill`, `LID.spout` in `v3/src/dims.ts`).
  - A capsule about 10 mm across only just clears the 10 mm port height. **Raise the port height to about 13 mm.**
  - A pouch holding a whole mouthful wouldn't fit the spout at all. **Per-tablet capsules suit v3; a per-mouthful pouch doesn't.**
  - **Upside:** capsules roll far more predictably down a chute and ramp than mixed tablet shapes. Wrapping every tablet also makes everything the tower has to handle the same shape.

## Who does the wrapping (from least to most friction for the person at home)

| Option | How it works | Good | Bad |
|---|---|---|---|
| **1. The pharmacy makes the pods** | The pharmacy already packs weekly blister packs and sachet rolls. They'd capsule each tablet with the marker and ship a sealed week cartridge that drops into the tower. | No effort at home. Loading means swapping a cartridge. Changing a medicine's form is the pharmacist's job anyway. | Needs pharmacy partners, adds labour and cost, and handles same-week changes and as-needed medicines poorly. |
| **2. The tower wraps on loading** | **One feed slot instead of 28 cells.** You drop tablets in one at a time, the tower drops each into a marker capsule, snaps the cap on, measures it and files it in the right cell. The app only says "next: metoprolol". | One action per tablet, no cell-picking errors, and the tower can check each tablet's size to catch a wrong one. The slow part happens once a week, not at dose time. Empty capsules are a cheap refill, like printer paper. | The most complex mechanism in the product. Capsule halves must be kept dry. |
| **3. The tower wraps at dose time** | Wrap just before the mouthful drops. | Capsules are never stored. | A jam happens exactly when she needs her dose. **Avoid.** |
| **4. Someone wraps by hand** | Family push tablets into pre-marked capsules. | No mechanism. | Fiddly, impossible with arthritic hands, and error-prone. Fallback only. |

**Recommendation: option 1 for a pilot, option 2 for the product.** The pharmacy route needs almost no new hardware and tests the idea. The feed-slot tower is the version where the person at home does the least, and it makes loading *easier* than today's cell-by-cell hatch, not harder.

**In the v3 model (2026-10-29):** option 2 is built. There's a feed slot on the hatch, a wrap station with a size gauge and a filing lift on the tower's left side, a side gate on every magazine cell, and clear-bodied capsules with the marker in the seal band. The breath sensor sits in the tower behind the outlet. It reads lid air through the gasket while the shutter is held open, so the handle is now passive. The gel dab is modelled as an optional doser beside the outlet. The cells were sized for bare tablets, so two stacked capsules fill one; a three-capsule mouthful needs deeper or wider cells.

## Other ways to attach the marker (no capsule)

- **Marker in the capsule band.** Liquid-filled capsules get a thin seal band around the join. Put the marker in the band. The band makes the capsule tamper-evident and carries the tag, so the capsules themselves can be plain stock.
- **A gel dab at dose time.** As the mouthful lands on the grill, the tower squirts a small dab of swallowing gel containing the marker through the back port. Gloup, an existing swallowing gel sold in Australian pharmacies, shows the category works. The gel sticks the 1–3 tablets into **one slippery lump**, so they tend to go down or come back together. It also makes them easier to swallow, and there's no limit on tablet size. The gel is a refill cartridge. **Downsides:** gel residue on the grill, keeping the pump clean, and a wet product next to the "never soak" rule, although the time is seconds.
- **A tracer bead per mouthful.** Add one small marked bead to each cell, without wrapping anything. This is the simplest option, but it proves the *bead* went down, not the tablets. Too weak on its own.

---

## Limitations (untested; no lab access for now)

1. **Sensor in the tower.** SMART used a lab-grade detector. Nobody knows whether a small metal-oxide sensor sampling diluted air in a cup, with water vapour and food smells around, can detect the by-product. The sample is taken after the cup is back on the dock, so the breath has had a few seconds to mix and escape up the spout. A smart handle on the rail could sample during the sip instead.
2. **Held in the mouth vs. swallowed.** A capsule softening in the mouth could release the marker straight into the breath. Only the by-product, made after the body processes the marker, separates the two cases, and that's unproven in a cup.
3. **All tablets vs. some.** If every capsule carries the same marker, a positive breath result means *at least one* went down, not all three. Gel binding, or one tablet per mouthful for the critical medicine, would reduce this.
4. **Breath for the last mouthful.** It needs a "have a sip" cue about 10 minutes after the sitting.
5. **Dissolving and absorption** with the capsule or gel. The evidence covers ordinary tablets only; slow-release is unknown.
6. **Capsule storage.** Capsules go brittle in dry air and soften in humid air; behaviour in a sealed magazine over a week is unknown.
7. **Regulation.** Putting a medicine in a capsule and adding a marker may change how regulators classify both the device and the pharmacy's role. Ask early.
8. **Clinical.** A speech pathologist's view on capsules or gel with thin water for this group of users.

## Pairs well with (not decided)

- **Swallow-timed release:** release the mouthful at the start of a gulp, sensed from the flow rhythm, so it never rests on the tongue. This needs a smart handle on the rail, now that the default handle is passive.
- **Borrow from tomorrow:** when the breath check shows a dose didn't go down, the tower moves tomorrow's identical mouthful forward and asks for one extra at the next refill. A retake only happens after a confirmed failure, never after a missing confirmation, so no double doses.

## Sources

- [MIT Technology Review: Breath analyzer monitors drug compliance (2008)](https://www.technologyreview.com/2008/05/02/220643/breath-analyzer-monitors-drug-compliance/)
- [UF Health: Scientists test device to track medication adherence (2008)](https://ufhealth.org/news/2008/scientists-test-device-track-medication-adherence-patients-hivaids)
- [Xhale patent: SMART solid oral dosage forms](https://patents.justia.com/patent/20140341983)
- [Catalent: encapsulating a volatile compound in softgels](https://www.catalent.com/?p=216177)
- [Lonza/Capsugel: DBcaps over-encapsulation](https://www.capsugel.com/pharmaceutical-solutions/hard-empty-capsules/dbcaps-capsules)
- [Lonza/Capsugel: DBcaps clinical trials sizing guide (PDF)](https://www.capsugel.com/cpsl-web/kc/DBcaps-Clinical-Trials-Over-Encapsulation-Guide.pdf)
- [Effect of over-encapsulation on dissolution (gelatin vs HPMC)](https://www.americanpharmaceuticalreview.com/Featured-Articles/181890-Comparative-Human-In-Vivo-Study-of-an-Immediate-Release-Tablet-Over-Encapsulated-by-Gelatin-and-Hydroxypropyl-Methyl-Cellulose-Capsules-Impact-Of-Dissolution-Rate-on-Bioequivalence/)
- [Gloup medication lubricant](https://www.healthylife.com.au/products/gloup-medication-lubricant-150ml)
- [Swallowable film that turns to jelly (Fujita Health University)](https://pure.fujita-hu.ac.jp/en/publications/development-of-an-easily-swallowed-film-formulation/)
