# SipSync v3 viewer

A design viewer for the v3 concept: React UI with a Three.js scene.

```
npm install
npm run dev        # http://localhost:5200
```

## The concept

Aimed at people managing polypharmacy at home. Doses are tracked in the MedSync app; there's no care-home eMAR link for now.

| Assembly | What it is | Why |
|---|---|---|
| **Cup** (`src/parts/cup.ts`) | Opaque white tapered cup with a low Oralflo-style snap-on lid. A fixed tube spout sits at the lid's front edge and leans back 20° over the lid, with a ribbed mouthpiece. Under it, a vertical well dips into the cup's headspace with a grill across its floor that holds the tablets 13 mm above the water. A gravity ramp hung under the lid runs from a flush back port down into the well's open back. | It's passive: no power, no chambers, one mouthful at a time, so the cup and lid go in the dishwasher. The cup does the tilting, so the head stays level: tipped ~95° to drink, the back-leaning spout points ~15° up into the mouth, like Oralflo's. |
| **Handle** (`src/parts/handle.ts`) | A passive moulded D-handle that slides down a rail on the cup and clicks in. | Nothing to charge, and the whole cup goes in the dishwasher. The rail stays, so a smart handle could slide on later. |
| **Med tower** (`src/parts/tower.ts`) | Stands behind the cup, which nests into a cove in its front face. You load it through a feed slot one tablet at a time. A wrap station seals each tablet in a marker capsule and files it into one of 4 carousel decks of 7 cells. To dispense, a magnet opens the lid's shutter through the plastic and the mouthful rolls onto the ramp. A breath sensor at the outlet then confirms the swallow. | All the electronics are here. There's no arm over the cup and nothing near the face. Confirmation comes from cheap sensors rather than a camera, listed below. |
| **Swallow-proof pod** (`src/pod.ts`) | Every tablet rides in a clear-bodied over-encapsulation capsule (DBcaps-style). The cap colour is set per medicine, and the seal band carries a food-safe breath marker. | It turns "it left the cup" into "it went down". It also gives the tower one predictable shape to handle. See `docs/swallow-proof-pod.md`. |

### How a dose is confirmed (no camera)

1. **Dropped:** an IR break-beam in the tower's drop channel sees the mouthful fall.
2. **Landed:** a small time-of-flight sensor beside the outlet looks down the ramp at the grill. On every dock it re-reads the empty grill as its baseline, then sees "something on the grill".
3. **Drunk:** the dock's load cell sees the lift and return and measures the water that went.
4. **Gone:** back on the dock, the time-of-flight sensor reads the empty-grill baseline again.
5. **Swallowed:** on sips over the next 5–10 minutes, the magnet reopens the shutter and the breath sensor draws air from the lid, looking for the marker's by-product. Found means confirmed. Nothing found by the end of the window means it didn't go down, which tells the system a retake is safe. The halo asks for a sip if none comes. This step is untested.

### Loading the week

- **Product:** drop tablets into the feed slot one at a time as MedSync calls them out. An optical gauge checks each tablet's size, the wrap station caps it into a marker capsule, and a lift pushes it through the cell's side gate.
- **Pilot:** the pharmacy capsules the week and ships a sealed cartridge that drops in under the service hatch. The wrap station isn't needed.
- **Optional gel doser:** puts a dab of swallowing gel on each mouthful so the capsules go down, or come back, together.

## Design docs

The reasoning behind every decision is in [`docs/DESIGN_RATIONALE.md`](docs/DESIGN_RATIONALE.md). Swallow confirmation is covered in [`docs/swallow-proof-pod.md`](docs/swallow-proof-pod.md), the link to the MedSync app in [`docs/medsync-integration.md`](docs/medsync-integration.md), the original brief in [`docs/source/`](docs/source/), and the DS-2/v2 history in [`docs/history/`](docs/history/).

## Code layout

- `src/dims.ts`: every shared dimension (mm) and the world frame. Change numbers here, not in the builders.
- `src/materials.ts`: the palette. Builders take materials from here.
- `src/pod.ts`: the marker capsule and the sample medicines, shared by the cup and the tower.
- `src/parts/*.ts`: each exports `build…(): PartDef[]`, plain Three.js objects plus metadata (name, role, specs, explode vector, internal flag).
- `src/engine.ts`: renderer, lights, camera and picking. It eases explode, X-ray and selection each frame.
- `src/App.tsx`: the React UI (parts list, info card, toolbar).

The **Sip** slider (or `s`) lifts the cup to a ghost of the drinker and tips it to `SIP.tilt`. The water stays level (a world-space clip plane at the height that holds the fill volume), and once it reaches the grill the mouthful rides up the bore. Turn on X-ray to watch.

### Why the spout leans back

An earlier version had the spout at 58° leaning toward the drinker. Tipped to drink, that points 20–45° down at the chin. Leaning it back 20° (as Oralflo does) makes it level at the lips. That causes two knock-on changes:

- The bore can't run straight down from the spout to the grill, because leaning back above the deck means leaning forward below it, out through the front wall. So the well is vertical and the bore bends 20° at the deck.
- Tipped to drink, the lid's back edge sits at nose height. The ramp used to live in a 33 mm hump at the back of the lid. It now hangs below the rim in the headspace, so the lid is 19–21 mm all round and the back port (and the tower outlet) sit 14 mm lower.
