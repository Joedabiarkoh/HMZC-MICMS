// Checklist and equipment-type definitions.
//
// Ported directly from the previous standalone tool
// (hmzc_certificate_system_v3.html) — same section codes, same item
// wording, transcribed from HMZC's own paper check sheets and the Deck
// Crane Inspection Report. Nothing here was reworded; only the JS ->
// TypeScript object shape changed (see ../types/inspection.types.ts).

import { ChecklistSectionDef, EquipmentTypeConfig, EquipmentTypeKey } from "../types/inspection.types";

const SPECIAL = (label: string, presetRemark: string) => ({ label, presetRemark });

// ---- Lifeboat (conventional) ----
const LB_GENERAL_BOAT_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "D-2", name: "Lifeboat General", items: [
      "Outside hull", "Outside canopy", "Buoyant lifeline", "Enclosure structure", "Inside structure",
      "Painter release device", "Doors and hatches", "Window", "Ventilator", "Handrail",
      "Air balance valve", "Rope ladder", "Drain plug", "Rainwater collector", "Safety belt",
      "Hand pump", "Equipment",
    ],
  },
  {
    code: "D-3", name: "Machinery", items: [
      "Starting and running of engine", "Engine oil", "Clutch oil", "Fuel oil tank",
      "Lubrication oil of aft shaft body", "Fuel oil pipe", "Fuel oil filter", "Engine oil filter",
      "Air filter", "Fuel valve", "Cooling water system", "Propeller system", "V type belt",
      "Fuel oil pump", "Sea water pump (if fitted)", "Instrument panel", "Spare parts", "Tools",
      "Operation instruction plate",
    ],
  },
  {
    code: "D-4", name: "Electric", items: [
      "Battery", "Room light", "Position light", "Search light", "Compass light", "Engine belt",
      "Electric wiring", "Battery charger",
    ],
  },
  {
    code: "D-5", name: "Release Gear",
    items: [
      "Locking condition of hook", "Locking of release control lever",
      "Push-pull flexible cable, safety pin of release hook",
      "The condition of locking indication for hook device", "Locking device of safety box",
      "Loosening condition of all fittings", "Interlock for hydrostatic release device",
      "Wearing of hook hole and shaft", "Wearing of the end of hook",
      "Connection condition of hook device and hull", "Condition of all lubricating",
    ],
    special: [
      SPECIAL("Operation test of release device", "Annual"),
      SPECIAL("Operation test of release device", "1.1 times load (Five-yearly)"),
    ],
  },
  { code: "D-6", name: "Manipulative System", items: ["Speed control device", "Steering device"] },
];

const LB_D7D8_SECTIONS: ChecklistSectionDef[] = [
  { code: "D-7", name: "Water Spray System", items: ["Water spray system"] },
  { code: "D-8", name: "Air Supply System", items: ["High pressure pipe", "Pressure of air cylinder"] },
];

const LB_DAVIT_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "D-2", name: "Lifeboat Davit System", items: [
      "Tackle, shaft, oil cup", "Frame", "Jib arm, shaft, bolt", "Slip hook", "Remote control rope",
      "Release hook unit", "Boat fall unit", "Deck operation device", "Shackle, alloy",
      "Floating tackle", "Boat support", "Stop unit", "Hanging unit", "Recovery unit", "Fastening unit",
    ],
  },
  {
    code: "D-3", name: "Electric Lifeboat Winch System",
    items: ["Gear", "Bearing", "Oil sealing", "Speed limit friction line", "Brake friction line", "Rotate handle", "Lubricating oil", "Brake level"],
    special: [SPECIAL("Brake test", "Annual"), SPECIAL("Brake test", "1.1 times load (Each five years)")],
  },
  { code: "D-4", name: "Electric System", items: ["Electric motor", "Limit switch", "Push button", "Ele. control box", "Cable"] },
];

const LB_EQUIP_ITEMS = [
  { n: "Food Ration", qty: "10000KJ / Person", unit: "ea", exp: true },
  { n: "Fresh Water", qty: "3 L / Person", unit: "pk", exp: true },
  { n: "First Aid Kit", qty: "1", unit: "Kit", exp: true },
  { n: "Anti-Sea Sickness Tablet", qty: "6 / Person", unit: "Tab", exp: true },
  { n: "Rocket Parachute Signal", qty: "4", unit: "ea", exp: true },
  { n: "Buoyant Smoke Signal", qty: "2", unit: "ea", exp: true },
  { n: "Red Hand Flare", qty: "6", unit: "ea", exp: true },
  { n: "Sea Sickness Bag", qty: "1 / Person", unit: "pc" },
  { n: "Boat Hook", qty: "1", unit: "Set" },
  { n: "Buoyant Oars", qty: "1", unit: "Set" },
  { n: "Rowlock with Lanyard", qty: "1", unit: "St" },
  { n: "Buoyant Bailer", qty: "1", unit: "ea" },
  { n: "Buoyant Rescue Quoit", qty: "2", unit: "ea" },
  { n: "Bucket", qty: "2", unit: "ea" },
  { n: "Survival Manual", qty: "1", unit: "ea" },
  { n: "Sea Anchor with Hawser", qty: "1", unit: "ea" },
  { n: "Hatchet with Bag", qty: "1", unit: "ea" },
  { n: "Rust Proof Dipper with Lanyard", qty: "1", unit: "ea" },
  { n: "Rust Proof Drinking Vessel", qty: "1", unit: "ea" },
  { n: "Waterproof Electric Torch (with Spare Battery & Bulb)", qty: "1", unit: "Set" },
  { n: "Daylight Signalling Mirror", qty: "1", unit: "ea" },
  { n: "Life-Saving Signal Table", qty: "1", unit: "ea" },
  { n: "Whistle with Lanyard", qty: "1", unit: "ea" },
  { n: "Jack-Knife with Lanyard", qty: "1", unit: "ea" },
  { n: "Tin-Opener with Lanyard", qty: "1", unit: "ea" },
  { n: "Set of Fishing Tackle", qty: "1", unit: "St" },
  { n: "Thermal Protective Aid", qty: "10% of Full Personnel", unit: "ea" },
  { n: "Radar Reflector", qty: "1", unit: "ea" },
  { n: "Rainwater Collector", qty: "1", unit: "St" },
  { n: "Buoyant Rescue Line", qty: "1", unit: "ea" },
  { n: "Fire Extinguisher", qty: "1", unit: "bt" },
];

// ---- Rescue boat (FRC) ----
const RB_BOAT_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "D-2", name: "Rescue Boat General", items: [
      "Outside hull", "Outside canopy", "Buoyant lifeline", "Enclosure structure", "Inside structure",
      "Painter release device", "Doors and hatches", "Ventilator", "Handrail", "Rope ladder",
      "Drain plug", "Hand pump", "Equipment",
    ],
  },
  {
    code: "D-3", name: "Machinery", items: [
      "Starting and running of engine", "Engine oil (if fitted)", "Fuel valve (if fitted)",
      "Engine oil filter (if fitted)", "Air filter (if fitted)", "Clutch oil", "Fuel oil tank",
      "Fuel oil pipe", "Fuel oil filter", "Cooling water system", "V type belt", "Fuel oil pump",
      "Instrument panel", "Spare parts", "Tools", "Operation instruction plate",
    ],
  },
  { code: "D-4", name: "Electric", items: ["Battery", "Position light", "Search light", "Compass light", "Electric wiring", "Battery charger"] },
  {
    code: "D-5", name: "Release Gear",
    items: [
      "Locking condition of hook", "Locking of release control lever",
      "Loosening condition of all fittings", "Wearing of hook hole and shaft",
      "Wearing of the end of hook", "Connection condition of hook device and hull",
      "Condition of all lubricating",
    ],
    special: [
      SPECIAL("Operation test of release device", "Annual"),
      SPECIAL("Operation test of release device", "1.1 times load (Five-yearly)"),
    ],
  },
  { code: "D-6", name: "Manipulative System", items: ["Speed control device", "Steering device"] },
];

const RB_DAVIT_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "D-2", name: "Rescue Boat Davit System",
    items: ["Tackle, shaft, oil cup", "Jib arm, shaft, bolt", "Remote control rope", "Release hook unit", "Boat fall unit", "Shackle, alloy"],
  },
  {
    code: "D-3", name: "Electric Rescue Boat Winch System",
    items: ["Gear", "Bearing", "Oil sealing", "Speed limit friction line", "Brake friction line", "Rotate handle", "Lubricating oil", "Brake level"],
    special: [SPECIAL("Brake test", "Annual"), SPECIAL("Brake test", "1.1 times load (Each five years)")],
  },
  {
    code: "D-4", name: "Hydraulic System (If Fitted)", conditional: true, hydraulicGate: true,
    items: ["Accumulator", "Slewing unit", "Connection bolt", "Hydraulic oil", "Pipelines", "Pump station", "Oil filter", "Air filter", "Oil from pump station", "Control valve"],
  },
];

const RB_EQUIP_ITEMS = [
  { n: "First Aid Kit", qty: "1", unit: "Kit", exp: true },
  { n: "Boat Hook", qty: "1", unit: "Set" },
  { n: "Buoyant Oars", qty: "1", unit: "Set" },
  { n: "Rowlock with Lanyard", qty: "1", unit: "St" },
  { n: "Buoyant Bailer", qty: "1", unit: "ea" },
  { n: "Buoyant Rescue Quoit", qty: "1", unit: "ea" },
  { n: "Bucket", qty: "1", unit: "ea" },
  { n: "Survival Manual", qty: "1", unit: "ea" },
  { n: "Sea Anchor with Hawser", qty: "1", unit: "ea" },
  { n: "Whistle with Lanyard", qty: "1", unit: "ea" },
  { n: "Jack-Knife with Lanyard", qty: "1", unit: "ea" },
  { n: "Thermal Protective Aid", qty: "10% of Full Personnel", unit: "ea" },
  { n: "Radar Reflector", qty: "1", unit: "ea" },
  { n: "Buoyant Rescue Line", qty: "1", unit: "ea" },
  { n: "Fire Extinguisher", qty: "1", unit: "bt" },
];

// ---- Free-fall launching appliance (shared by dry-cargo & tanker types) ----
const FF_LAUNCH_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "D-2", name: "Free-Fall Launching System", items: [
      "Skid / ramp structure", "Ramp surface & rollers", "Ramp angle & locking pins",
      "Bowsing tackle / gripes", "Cradle chocks & release", "Painter / secondary strop",
      "Hydrostatic release unit (if fitted)", "Structural support frame / trestle",
    ],
  },
  {
    code: "D-3", name: "Hydraulic Release System",
    items: ["Hydraulic ram / release cylinder", "Hydraulic power pack", "Hydraulic hoses & fittings", "Accumulator pressure", "On-load release mechanism"],
  },
  {
    code: "D-4", name: "Control System", items: [
      "Remote release control (embarkation station)", "Local manual release lever",
      "Control panel & indicator lights", "Emergency / battery back-up power", "Cabling & junction boxes",
    ],
  },
];

// ---- Deck crane (transcribed from HMZC's Deck Crane Inspection Report) ----
const CRANE_SECTIONS: ChecklistSectionDef[] = [
  {
    code: "A", name: "General", items: [
      "Availability of service/maintenance manual",
      "Inspections recorded in the registry of lifting appliances (ILO Form I)",
      "Identification plate",
      "Load sign",
    ],
  },
  {
    code: "B", name: "Construction",
    items: [
      "Mounting bolts", "Foundation", "Base column", "Main jib", "Knuckle jib",
      "Extension jib (telescope boom)", "Wear blocks (gliders in telescope boom)",
      "Pin bolt and bushings", "Access platform and parking position",
    ],
  },
  {
    code: "C", name: "Winch, Wire Sheave, Wire, Slewing", items: [
      "Winch inspected", "Motor inspected", "Inspection of wire stop", "Brake function test",
      "Wire sheave and guide", "Inspection of wire rope certificate", "Inspection of wire rope",
      "Master link(s)", "Wire rope end termination", "Hook block sheaves", "Hook swivel",
      "Motor inspected", "Wear in slewing system",
    ],
  },
  {
    code: "D", name: "Electrical System",
    items: ["Panel, cables, sockets", "Emergency stop — Function test", "General Function test", "Symbols/signs"],
  },
  {
    code: "E", name: "Hydraulic System", items: [
      "Pump function tested", "Oil level in tank", "Suction filter", "Pressure filter", "Return filter",
      "Hydraulic oil", "Main control valve, function test", "Control handles — wear/function",
      "Symbols/signs", "Pressure adjustment entire system", "Hydraulic cylinders",
      "Hydraulic hose, pipes and attachments", "Counterbalance valves",
      "Accumulator — Pressure setting", "Emergency operation — Function test",
    ],
  },
  {
    code: "F", name: "Remote Control",
    items: ["Panel, cables, sockets", "Symbols/signs", "Emergency stop — Function test", "General Function test"],
  },
];

// ---- Type configuration (drives the whole UI) ----
export const INSPECTION_TYPES: Record<EquipmentTypeKey, EquipmentTypeConfig> = {
  lifeboat: {
    kind: "boat", typeName: "Conventional Lifeboat", label: "Life Boat",
    statementIntro: "This is to confirm that the following lifeboat and davits have been carried out periodic maintenance by the undersigned licensed service engineer in accordance with SOLAS Regulation III 20.3.2 and MSC.402 (96) and that these lifeboat and davits have been found to fit for purpose.",
    remarksTemplate: (loc) => `${(loc || "").toUpperCase()} LIFE BOAT, DAVIT & WINCH INSPECTION CARRIED OUT IN ACCORDANCE WITH SOLAS REGULATION III 20.3.2 & MSC/CIRCULAR 402 (96) AND FOUND SATISFACTORY. ALL ARRANGEMENTS WERE FOUND IN GOOD WORKING ORDER AND FIT FOR PURPOSE.`,
    sideOptions: ["Port Side", "Stbd Side 1", "Stbd Side 2", "Port Side 1", "Port Side 2"],
    boatTitle: "Totally Enclosed Lifeboat Checklist", boatSections: [...LB_GENERAL_BOAT_SECTIONS, ...LB_D7D8_SECTIONS],
    davitTitle: "Lifeboat Davit Checklist", davitSections: LB_DAVIT_SECTIONS,
    equipListTitle: "Lifeboat — Equipment List", equipItems: LB_EQUIP_ITEMS,
    minPhotos: { boatChecklist: 6, davitChecklist: 4, equip: 0 },
  },
  rescueboat: {
    kind: "boat", typeName: "Rescue Boat (FRC)", label: "Life Boat (FRC)",
    statementIntro: "This is to confirm that the following FRC and davits have been carried out periodic maintenance by the undersigned licensed service engineer in accordance with SOLAS Regulation III 20.3.2 and MSC.402 (96) and that these lifeboat and davits have been found to fit for purpose.",
    remarksTemplate: (loc) => `${(loc || "").toUpperCase()} FAST RESCUE BOAT, DAVIT & WINCH INSPECTION CARRIED OUT IN ACCORDANCE WITH SOLAS REGULATION III 20.3.2 & MSC/CIRCULAR 402 (96) AND FOUND SATISFACTORY. ALL ARRANGEMENTS WERE FOUND IN GOOD WORKING ORDER AND FIT FOR PURPOSE.`,
    sideOptions: ["Port Side", "Stbd Side"],
    boatTitle: "Rescue Boat Checklist", boatSections: RB_BOAT_SECTIONS,
    davitTitle: "Single Arm Davit Checklist", davitSections: RB_DAVIT_SECTIONS,
    equipListTitle: "Rescue Boat — Equipment List", equipItems: RB_EQUIP_ITEMS,
    minPhotos: { boatChecklist: 4, davitChecklist: 3 },
  },
  freefall_dry: {
    kind: "boat", typeName: "Free-Fall Lifeboat — Dry Cargo Type", label: "Free-Fall Life Boat",
    statementIntro: "This is to confirm that the following free-fall lifeboat and launching appliance have been carried out periodic maintenance by the undersigned licensed service engineer in accordance with SOLAS Regulation III 20.3.2 and MSC.402 (96) and that this lifeboat and launching appliance have been found to fit for purpose.",
    remarksTemplate: (loc) => `${(loc || "").toUpperCase()} FREE-FALL LIFEBOAT, LAUNCHING APPLIANCE & WINCH INSPECTION CARRIED OUT IN ACCORDANCE WITH SOLAS REGULATION III 20.3.2 & MSC/CIRCULAR 402 (96) AND FOUND SATISFACTORY. ALL ARRANGEMENTS WERE FOUND IN GOOD WORKING ORDER AND FIT FOR PURPOSE. (DRY CARGO TYPE — WATER SPRAY & AIR SUPPLY SYSTEMS NOT FITTED.)`,
    sideOptions: ["Stern (Free-Fall)"],
    boatTitle: "Free-Fall Lifeboat Checklist (Dry Cargo Type)", boatSections: LB_GENERAL_BOAT_SECTIONS,
    davitTitle: "Free-Fall Launching Appliance Checklist", davitSections: FF_LAUNCH_SECTIONS,
    equipListTitle: "Free-Fall Lifeboat — Equipment List", equipItems: LB_EQUIP_ITEMS,
    divisionNote: "Free-fall launching appliance items reflect general skid/ramp launch system industry practice (hydraulic ram release). Verify against the specific manufacturer's maintenance manual.",
    minPhotos: { boatChecklist: 6, davitChecklist: 4 },
  },
  freefall_tanker: {
    kind: "boat", typeName: "Free-Fall Lifeboat — Tanker Type", label: "Free-Fall Life Boat",
    statementIntro: "This is to confirm that the following free-fall lifeboat and launching appliance have been carried out periodic maintenance by the undersigned licensed service engineer in accordance with SOLAS Regulation III 20.3.2 and MSC.402 (96) and that this lifeboat and launching appliance have been found to fit for purpose.",
    remarksTemplate: (loc) => `${(loc || "").toUpperCase()} FREE-FALL LIFEBOAT, LAUNCHING APPLIANCE & WINCH INSPECTION CARRIED OUT IN ACCORDANCE WITH SOLAS REGULATION III 20.3.2 & MSC/CIRCULAR 402 (96) AND FOUND SATISFACTORY. ALL ARRANGEMENTS WERE FOUND IN GOOD WORKING ORDER AND FIT FOR PURPOSE. (TANKER TYPE — INCLUDING WATER SPRAY & SELF-CONTAINED AIR SUPPORT SYSTEM.)`,
    sideOptions: ["Stern (Free-Fall)"],
    boatTitle: "Free-Fall Lifeboat Checklist (Tanker Type)", boatSections: [...LB_GENERAL_BOAT_SECTIONS, ...LB_D7D8_SECTIONS],
    davitTitle: "Free-Fall Launching Appliance Checklist", davitSections: FF_LAUNCH_SECTIONS,
    equipListTitle: "Free-Fall Lifeboat — Equipment List", equipItems: LB_EQUIP_ITEMS,
    divisionNote: "Free-fall launching appliance items reflect general skid/ramp launch system industry practice (hydraulic ram release). Verify against the specific manufacturer's maintenance manual.",
    minPhotos: { boatChecklist: 6, davitChecklist: 4 },
  },
  crane: {
    kind: "crane", typeName: "Deck Crane / Lifting Appliance", label: "Crane",
    statementIntro: "This is to confirm that the following deck crane has been thoroughly examined and load tested by the undersigned licensed service engineer with reference to the manufacturer's maintenance manual and the registry of lifting appliances (ILO Form I), and has been found fit for purpose.",
    remarksTemplate: (loc) => `${(loc || "").toUpperCase()} DECK CRANE INSPECTION CARRIED OUT AND FOUND SATISFACTORY. LIFTING APPLIANCE FOUND IN GOOD WORKING ORDER AND FIT FOR PURPOSE.`,
    sideOptions: ["Port Crane", "Stbd Crane", "Provision Crane", "Engine Room Crane", "Deck Crane No.1", "Deck Crane No.2"],
    checklistTitle: "Deck Crane Inspection Report", checklistSections: CRANE_SECTIONS,
    minPhotos: { checklist: 2 },
  },
  firefighting: {
    kind: "ffe", typeName: "Firefighting Equipment", label: "Firefighting Equipment",
  },
  loosegear: {
    kind: "placeholder", typeName: "Loose Gear & Lifting Equipment", label: "Loose Gear & Lifting Equipment",
    divisionNote: "Loose Gear & Lifting Equipment inspection checklist has not been loaded yet. Send HMZC's loose gear inspection sheet (shackles, slings, chain blocks, wire strops, etc.) and it will be built into this division with the same item-by-item structure as the other checklists.",
  },
};
