// SipSync v3 — every shared dimension, in millimetres.
//
// World frame: y up, table top at y = 0. The drinker sits on +z looking toward -z,
// so the spout points at them (+z) and their right hand is +x (handle side).
// The medication tower stands BEHIND the cup (-z): load from the back, drink from the front.
//
// Parts build in their own local frame and are placed by the assembly using the
// anchors below, so a builder only needs the numbers from this file.

export const DOCK = {
  // One moulded base plate shared by the tower, the cup seat and the handle charge pad.
  xMin: -70, xMax: 104,
  zMin: -132, zMax: 56,
  h: 12,            // plate thickness; top surface is y = DOCK.h
  r: 26,            // plan-view corner radius
  seatR: 36,        // cup seat recess radius (load cell platen underneath)
  seatDepth: 2.5,
};

/** World y of the cup's outside bottom (it sits in the dock seat). */
export const CUP_Y = DOCK.h - DOCK.seatDepth;

export const CUP = {
  // Opaque white tapered cup, Oralflo proportions. Origin: centre of the outside bottom.
  h: 104,
  rBottom: 31,
  rTop: 40,
  wall: 2.2,
  floor: 3.2,
  fillY: 76,        // ~250 mL fill line, measured from the cup's own bottom
  // Dovetail rail moulded on the +x wall. The handle slides down onto it (a smart handle could, later).
  rail: { y0: 14, y1: 96, w: 15, d: 5 },
};

export const LID = {
  // Snap-on lid. Origin: rim centre at y = CUP.h (cup-local). All y below are above the rim.
  r: 42,            // outer skirt radius
  skirt: 9,         // skirt drop over the rim
  // A low, nearly flat lid. When she drinks, the cup tips ~95° toward her, so the lid's back
  // edge ends up at nose height: every mm of lid back is a mm off her nose clearance.
  deckFront: 21,    // deck height at the front (spout side)
  deckBack: 19,     // deck height at the back: just enough for the port
                    // (straight wall ends 2.5 mm lower, at the bevel; it must clear the port seam)
  // Fixed tube spout at the front edge, leaning BACK over the lid like Oralflo's. Tipped ~95°
  // to drink, it points ~15° up into the mouth with the head level. (Leaning toward the
  // drinker instead, it would point down at the chin.)
  spout: {
    z: 22,          // where the tube's axis leaves the deck (same axis as the well below)
    lean: 20,       // degrees back from vertical, away from the drinker
    len: 30,        // along its axis, from the deck
    od: 21, id: 15, // bore fits a 20 mm caplet lengthways
    ribs: 3,        // ribbed mouthpiece rings near the tip
  },
  // Well under the spout: a vertical pocket that dips into the cup's headspace, with the grill
  // across its floor. Tablets wait here 13 mm above the water; a funnel narrows it into the
  // bore. Its back is open to the ramp. It can't follow the spout's lean down: that would run
  // it out through the front wall, so the bore bends 20° at the deck.
  well: { z: 22, y: -15, r: 11 },   // y = grill (below the rim), r = pocket inner radius
  // Gravity ramp hung under the lid from the back port down into the well (~18° over a 50 mm
  // run; a 17 mm channel keeps marker capsules lengthways, so they slide rather than roll).
  // It drops below the rim, so the lid no longer needs a hump at the back to house it.
  ramp: { w: 17, yBack: 2.5 },
  // Flush back port: sprung shutter in the back wall, opened by a magnet in the tower.
  // 13 mm tall for ~10 mm marker capsules; sill 0.5 mm under the ramp's back lip (y - h/2).
  port: { w: 20, h: 13, y: 8.5 },
};

export const SIP = {
  // The drinking pose, for the viewer's Sip slider: cup tipped toward her about x, the spout
  // tip at her lips, head level. Oralflo users finish a mouthful at roughly 90–100°.
  tilt: 95,         // degrees from upright at the end of the sip
  lips: { x: 0, y: 270, z: 190 }, // world point the spout tip meets
};

export const HANDLE = {
  // Passive moulded handle (no electronics). Origin: where its spine meets the rail, at the
  // cup's outer wall on +x, y = 0 at the cup bottom (cup-local).
  y0: 0,            // foot sits on the dock next to the cup
  y1: CUP.h - LID.skirt - 3, // top stays under the lid skirt so the lid snaps on clear of it
  reach: 58,        // outer face of the grip from the cup wall (26 mm finger gap)
  depth: 26,        // z thickness
  grip: 22,         // grip bar thickness in x
};

export const TOWER = {
  // Medication tower, behind the cup. Origin: centre of its footprint on top of the dock.
  x: 0,
  z: -80,           // footprint centre (world)
  w: 126,           // x
  d: 96,            // z; front face at z = TOWER.z + d/2 = -32
  h: 270,           // shell top 4 mm over the magazine (12 + magY0 + decks × deckH)
  r: 28,            // plan-view corner radius
  // A full-height concave cove in the front face that the cup nests into.
  coveR: 47,        // centred on the cup axis (world x = 0, z = 0)
  // Week magazine: 4 stacked carousel decks × 7 cells = 28 mouthfuls, above the outlet.
  // deckH = 22 mm cell wall (two stacked capsules) + 4 mm; keep it ≥ 26. magY0 puts the
  // lowest deck 2 mm above the drop channel's break-beam (chute starts at world y 152).
  decks: 4, cellsPerDeck: 7, deckH: 26, magY0: 152,
};

// World position of the centre of the lid's back port (where the tower outlet meets it).
export const PORT_WORLD = {
  x: 0,
  y: CUP_Y + CUP.h + LID.port.y,
  z: -LID.r,
};
