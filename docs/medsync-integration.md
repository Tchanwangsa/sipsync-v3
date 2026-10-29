# SipSync v3 + MedSync: one-page summary

**Status:** 2026-10-29. Hardware from this repo ([`../README.md`](../README.md), `src/dims.ts`, `src/parts/*`) and [`swallow-proof-pod.md`](swallow-proof-pod.md). App from `b0nnie150/medsync` at `a02c547`. The link in part 3 is a **proposal**; none of it is built yet.

## 1. The three pieces

| Piece | What it does | Power |
|---|---|---|
| **Cup** | ~250 mL tapered cup, snap-on lid, Oralflo-style spout leaning back 20°. A ramp under the lid runs from a back port (sprung, magnet-opened shutter) to a grill that holds the mouthful 13 mm above the water. Tipped ~95° to drink, the mouthful rides up the bore with the water. Passive handle on a rail. | None. Dishwasher-safe. |
| **Tower** | Stands behind the cup, which nests in its cove. Holds the week: 4 carousel decks × 7 cells = **28 mouthfuls** (1 mouthful = the tablets for one dose time; a cell holds 2 stacked capsules, 3 needs bigger cells). Feed slot + wrap station seal each tablet in a marker capsule. Dock under the cup has a load cell. Halo, low tone and display cue each dose. | All electronics. Wi-Fi + BLE, USB-C, backup cell, power-cut journal. |
| **MedSync** | Expo app on Supabase. Holds the care space, medication plan (name, dose, times), plan version, dose reports, family roles, and a `care_devices` table. | Phone / web. |

## 2. One dose, end to end

1. **Cue:** at the dose time, the halo glows and MedSync sends a phone alert.
2. **Dropped:** the tower turns the right deck, the cell tips, and an IR break-beam sees the mouthful fall. The magnet opens the lid shutter and it rolls down the ramp.
3. **Landed:** the time-of-flight sensor in the outlet sees something on the grill.
4. **Drunk:** the load cell sees the cup lift and return, and how much water went.
5. **Gone:** the grill reads empty again.
6. **Swallowed (untested):** on sips over the next 5–10 min, the tower samples lid air for the breath marker's by-product. Found = confirmed. Nothing by the end = didn't go down, so a retake is safe.

**Loading:** once a week, drop tablets into the feed slot as MedSync calls them out ("next: metoprolol"). A size gauge rejects a wrong tablet. Pilot version: the pharmacy ships a sealed, pre-capsuled cartridge instead.

## 3. The MedSync ↔ SipSync link (proposed)

**What MedSync already has:** a `care_devices` row with `hardware_id`, `acknowledged_version` and `last_seen_at`; a Devices screen showing "current plan acknowledged"; and a rule that only a trusted server writes device data. Dose reports are typed in by a caregiver. Only the demo cup syncs, and it's simulated.

**What has to change:**

- **The device is the tower, not the cup.** The v3 cup has no electronics. `hardware_id` belongs to the tower; the UI can still say "your SipSync".
- **Plan → magazine manifest.** MedSync groups active medications by time into *sittings* (e.g. 08:00 Metformin + Vitamin D; 20:00 Metformin + Atorvastatin = 14 cells a week). The server sends the tower a manifest: deck, cell, date, time, medicines. Limits the app must enforce: **≤ 4 sittings a day** (28 cells ÷ 7) and **≤ 2 capsules per sitting** (raise to 3 only once the cells are enlarged; open question 8 in [`DESIGN_RATIONALE.md`](DESIGN_RATIONALE.md#8-open-questions)).
- **New medication fields.** Tablet size (for the gauge), cap colour, and *can go on the tower* (no for slow-release, sublingual, chewable, or too big: some Metformin caplets). Medicines that can't go on stay in MedSync as manual reports.
- **Two plan numbers, not one.** *Received* (the tower has the new plan) and *loaded* (the magazine physically matches it). If the plan changes mid-week, the tower holds any cell that no longer matches and MedSync asks for a reload. It never dispenses a stale cell silently.
- **Device dose events.** A new table written only by the server, one row per stage: *dispensed → landed → drunk (mL) → gone → swallow confirmed / not detected / no sample* (the last stage is untested). Each row carries an event ID from the tower so offline catch-up never double-counts. History shows the furthest stage reached, next to (not instead of) a caregiver's "Report taken". MedSync's current note, "device activity alone is not proof of ingestion", stays true until the breath check is validated.
- **Commands from app to tower.** Unlock the top hatch, start a loading session, approve a retake. Caregivers only, using the existing `care_access(write)` check, and each logged in `care_events`.
- **Retakes.** "Not detected" lets the tower offer tomorrow's matching mouthful early and flags one extra for the next refill. Missing confirmation never triggers a retake. Who approves it, and when it's switched on, is decision 2 and 3 below.
- **Pairing and ingestion.** Pair over BLE from the Devices screen. The server registers the tower and gives it its own credential. A single Supabase edge function (`device-sync`) hands out the manifest and accepts acknowledgements and events. The app itself still can't write device data.

## 4. Decisions (2026-10-29)

1. **The tower runs the schedule; MedSync mirrors it.** The tower keeps the current manifest, cues and dispenses on its own clock, and journals every event. Wi-Fi going down or the phone being off doesn't stop a dose. MedSync's phone alert is a backup cue. Events sync when the tower is back online, in order, using the event IDs.
   *Why:* a dose that depends on home Wi-Fi or a charged phone will eventually be missed. The tower already has the clock, the cue, the tablets and a power-cut journal, so it's the one place that can't be out of step with what's physically loaded.
2. **The person approves their own retake on the tower; the pharmacist decides which medicines allow one.** When setting the plan, each medicine gets *retake allowed: yes/no* and a time limit, set from the pharmacist's advice. It's **off by default**. After a "not detected", the tower display asks "Take it again?" and the person presses to confirm. Family carers get a MedSync notice and can also approve from the app. Nobody approved = no retake.
   *Why:* the person lives alone, so waiting on a remote carer would let the retake window pass. But whether a medicine is safe to retake is clinical, so that call is made ahead of time by the pharmacist, not in the moment. Off by default means a mistake in setup can only cause a missed retake, never a double dose.
3. **"Swallow confirmed" stays hidden until the breath check passes lab tests.** The tower still runs it and the server stores the result, labelled *experimental*. MedSync shows doses only up to "gone (drunk)". Because a retake depends on "not detected", **retakes stay switched off** too. Until then, a "not detected" just goes to carers as a notice.
   *Why:* the breath check is untested. A false "confirmed" would hide a missed dose, and a false "not detected" would trigger an extra one. Storing the result anyway builds up the data needed to validate it against what carers report.
4. **As-needed medicines stay off the tower; mid-week changes trigger a partial reload.** As-needed medicines become a MedSync medication type with no fixed times, reported by hand. When the plan changes mid-week, the tower holds the affected cells. MedSync lists them, the person unlocks the hatch and empties just those cells, then the feed slot reloads them against the new manifest. While a cell is held, that dose is reported by hand in MedSync.
   *Why:* as-needed doses have no time, so they can't be given a cell in a magazine filled a week ahead. For mid-week changes, a cell already loaded under the old plan is exactly the wrong-dose risk the tower exists to prevent. Holding just those cells keeps every other dose running and makes the person reload only what changed.
