/**
 * Illustrative static content for the HOIDSS design.
 * Presentation-only sample values — no fetching, no persistence, no business logic.
 */

export type Health = "ok" | "warn" | "crit";

export const HOSTEL = {
  name: "PICT Boys Hostel",
  campus: "Pune Institute of Computer Technology",
  shift: "Morning shift · 06:00 — 14:00",
  status: "Strained" as "Stable" | "Strained" | "Critical",
  healthScore: 78,
  healthDelta: -4,
};

export const OVERNIGHT_LEDGER: {
  text: string;
  emphasis?: Health;
  scope?: { category?: string; block?: string };
}[] = [
    { text: "18 complaints received overnight", scope: {} },
    { text: "12 resolved before 06:00", emphasis: "ok" },
    { text: "4 complaints approaching SLA breach", emphasis: "warn", scope: { category: "Electrical" } },
    { text: "2 of 5 scheduled inspections completed", emphasis: "warn" },
    { text: "Hostel A occupancy reached 98%", scope: { block: "Block A" } },
    { text: "Internet outage in Block C restored at 04:12", emphasis: "ok", scope: { block: "Block C" } },
    {
      text: "One urgent electrical issue awaits your approval",
      emphasis: "crit",
      scope: { category: "Electrical", block: "Block B" },
    },
  ];

export const AI_BRIEF = [
  "Operations are stable on housekeeping and occupancy, but electrical load in Block B is degrading faster than maintenance can absorb.",
  "Four SLA clocks expire before midnight and all four sit with one electrician who is already at 141% of a normal day.",
  "Nothing in the water or network domain needs your attention today.",
];

export const TODAY_PRIORITY = {
  title: "Approve the Block B electrical inspection",
  detail: "Third fan failure on floor 2 in nine days. Approving now keeps 4 SLA clocks green.",
  owner: "R. Kulkarni · Electrical",
};

export type Signal = {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaDir: "up" | "down" | "flat";
  health: Health;
  consequence: string;
  action: string | null;
  series: number[];
  scope?: { category?: string; block?: string };
};

export const SIGNALS: Signal[] = [
  {
    id: "occupancy",
    label: "Occupancy",
    value: "94.2%",
    delta: "+1.8 pts",
    deltaDir: "up",
    health: "ok",
    consequence: "Within tolerance. Block A is at 98% and has no spare rooms for reallocation.",
    action: null,
    series: [88, 89, 90, 91, 92, 93, 94],
  },
  {
    id: "satisfaction",
    label: "Student Satisfaction",
    value: "4.1 / 5",
    delta: "-0.2",
    deltaDir: "down",
    health: "warn",
    consequence: "Down for a third week, driven entirely by Block B electrical feedback.",
    action: "Read Block B feedback",
    scope: { block: "Block B", category: "Electrical" },
    series: [4.5, 4.5, 4.4, 4.3, 4.3, 4.2, 4.1],
  },
  {
    id: "infrastructure",
    label: "Infrastructure Health",
    value: "72",
    delta: "-6",
    deltaDir: "down",
    health: "warn",
    consequence: "9 of 12 failing assets are ceiling fans older than seven years.",
    action: "Review ageing assets",
    scope: { category: "Electrical" },
    series: [82, 81, 80, 78, 76, 74, 72],
  },
  {
    id: "complaints",
    label: "Complaint Health",
    value: "63 open",
    delta: "+11",
    deltaDir: "up",
    health: "crit",
    consequence: "Electrical is 38% of all open complaints and growing 62% over 14 days.",
    action: "Investigate Electrical",
    scope: { category: "Electrical" },
    series: [41, 44, 47, 49, 55, 58, 63],
  },
  {
    id: "housekeeping",
    label: "Housekeeping Status",
    value: "81%",
    delta: "-4 pts",
    deltaDir: "down",
    health: "warn",
    consequence: "Block C is below the 90% target with 14 rooms uncleaned since yesterday.",
    action: "Schedule extra round",
    scope: { block: "Block C", category: "Housekeeping" },
    series: [92, 91, 89, 88, 86, 84, 81],
  },
  {
    id: "maintenance",
    label: "Maintenance Status",
    value: "88% SLA",
    delta: "-3 pts",
    deltaDir: "down",
    health: "warn",
    consequence: "Six complaints will breach SLA before midnight, four of them electrical.",
    action: "Assign 2 electricians",
    scope: { category: "Electrical" },
    series: [95, 94, 93, 92, 91, 90, 88],
  },
];

export const CATEGORIES = [
  { name: "Electrical", count: 24, growth: "+62%", health: "crit" as Health },
  { name: "Water", count: 13, growth: "+8%", health: "warn" as Health },
  { name: "Housekeeping", count: 11, growth: "-4%", health: "warn" as Health },
  { name: "Internet", count: 8, growth: "-21%", health: "ok" as Health },
  { name: "Furniture", count: 5, growth: "+2%", health: "ok" as Health },
  { name: "Plumbing", count: 2, growth: "-11%", health: "ok" as Health },
];

export const COMPLAINT_TREND = [
  { day: "23 Jul", all: 22, electrical: 5 },
  { day: "26 Jul", all: 26, electrical: 7 },
  { day: "29 Jul", all: 24, electrical: 9 },
  { day: "01 Aug", all: 31, electrical: 13 },
  { day: "03 Aug", all: 34, electrical: 16 },
  { day: "04 Aug", all: 38, electrical: 21 },
  { day: "05 Aug", all: 41, electrical: 24 },
];

export const AGING = [
  { bucket: "0–8 h", count: 21, health: "ok" as Health },
  { bucket: "8–24 h", count: 17, health: "ok" as Health },
  { bucket: "1–3 d", count: 13, health: "warn" as Health },
  { bucket: "3–7 d", count: 8, health: "warn" as Health },
  { bucket: "7 d+", count: 4, health: "crit" as Health },
];

export const SEVERITY = [
  { name: "Critical", value: 9 },
  { name: "High", value: 18 },
  { name: "Medium", value: 24 },
  { name: "Low", value: 12 },
];

export const PEAK_HOURS = [
  { hour: "00", value: 2 },
  { hour: "03", value: 1 },
  { hour: "06", value: 4 },
  { hour: "09", value: 9 },
  { hour: "12", value: 6 },
  { hour: "15", value: 5 },
  { hour: "18", value: 12 },
  { hour: "21", value: 14 },
];

export const SEASONAL = [
  { month: "Mar", thisYear: 118, lastYear: 104 },
  { month: "Apr", thisYear: 143, lastYear: 121 },
  { month: "May", thisYear: 96, lastYear: 92 },
  { month: "Jun", thisYear: 132, lastYear: 118 },
  { month: "Jul", thisYear: 168, lastYear: 131 },
  { month: "Aug", thisYear: 181, lastYear: 139 },
];

export const RESOLUTION = [
  { band: "< 4 h", value: 34 },
  { band: "4–12 h", value: 27 },
  { band: "12–24 h", value: 19 },
  { band: "1–3 d", value: 14 },
  { band: "> 3 d", value: 6 },
];

export const REPEAT_STATS = [
  { label: "Repeat complaints", value: "19%", note: "Same room, same category, within 30 days" },
  { label: "Reopened", value: "7%", note: "Closed then reopened within 72 hours" },
  { label: "Median resolution", value: "9 h 40 m", note: "Electrical median is 22 h 10 m" },
];

export type Block = {
  id: string;
  name: string;
  score: number;
  health: Health;
  floors: {
    id: string;
    name: string;
    score: number;
    rooms: {
      id: string;
      score: number;
      complaints: number;
      types: string[];
      occupant: string;
      inspection: number;
      infra: number;
      cost: string;
      lastRepair: string;
    }[];
  }[];
};

const roomTypes = [
  ["Electrical"],
  ["Electrical", "Water"],
  ["Housekeeping"],
  ["Internet"],
  ["Furniture"],
  [],
];

function makeFloor(blockId: string, floor: number, bias: number) {
  return {
    id: `${blockId}-F${floor}`,
    name: `Floor ${floor}`,
    score: Math.max(28, 92 - bias * floor),
    rooms: Array.from({ length: 12 }, (_, i) => {
      const seed = (floor * 7 + i * 13 + bias * 5) % 100;
      const score = Math.max(18, Math.min(97, 96 - (seed % 70) - (bias > 8 && floor === 2 ? 22 : 0)));
      const complaints = score > 80 ? 0 : score > 60 ? 1 : score > 40 ? 3 : 6;
      return {
        id: `${blockId}-${floor}${String(i + 1).padStart(2, "0")}`,
        score,
        complaints,
        types: complaints === 0 ? [] : (roomTypes[(seed + floor) % roomTypes.length] ?? []),
        occupant: `Student ${1200 + seed + floor * 11}`,
        inspection: Math.max(42, Math.min(98, 70 + ((seed * 3) % 29) - (score < 40 ? 20 : 0))),
        infra: Math.max(20, score - 4),
        cost: `₹${(complaints * 1450 + (seed % 9) * 120).toLocaleString("en-IN")}`,
        lastRepair: complaints === 0 ? "No repairs in 12 months" : `${(seed % 26) + 2} days ago · fan rewiring`,
      };
    }),
  };
}

export const BLOCKS: Block[] = [
  {
    id: "A",
    name: "Block A",
    score: 86,
    health: "ok",
    floors: [1, 2, 3, 4].map((f) => makeFloor("A", f, 3)),
  },
  {
    id: "B",
    name: "Block B",
    score: 54,
    health: "crit",
    floors: [1, 2, 3, 4].map((f) => makeFloor("B", f, 11)),
  },
  {
    id: "C",
    name: "Block C",
    score: 71,
    health: "warn",
    floors: [1, 2, 3, 4].map((f) => makeFloor("C", f, 7)),
  },
  {
    id: "D",
    name: "Block D",
    score: 83,
    health: "ok",
    floors: [1, 2, 3].map((f) => makeFloor("D", f, 4)),
  },
];

export const PROBLEM_ROOMS = [
  { room: "B-214", complaints: 7, category: "Electrical", cost: "₹9,850", score: 22 },
  { room: "B-207", complaints: 6, category: "Electrical", cost: "₹7,400", score: 27 },
  { room: "C-118", complaints: 5, category: "Water", cost: "₹5,200", score: 34 },
  { room: "B-231", complaints: 4, category: "Electrical", cost: "₹4,100", score: 38 },
  { room: "C-126", complaints: 4, category: "Housekeeping", cost: "₹1,900", score: 41 },
];

export type QueueItem = {
  id: string;
  kind: "Emergency" | "SLA breach" | "Inspection" | "Maintenance" | "Housekeeping" | "Escalation";
  title: string;
  location: string;
  block: string;
  category: string;
  severity: Health;
  age: string;
  owner: string | null;
  slaIn: string;
};

export const QUEUE: QueueItem[] = [
  {
    id: "q1",
    kind: "Emergency",
    title: "Exposed wiring near corridor distribution box",
    location: "Block B · Floor 2 · Corridor",
    block: "Block B",
    category: "Electrical",
    severity: "crit",
    age: "Unowned for 41 min",
    owner: null,
    slaIn: "Breach in 1 h 20 m",
  },
  {
    id: "q2",
    kind: "SLA breach",
    title: "Ceiling fan dead — third failure this month",
    location: "Block B · Room 214",
    block: "Block B",
    category: "Electrical",
    severity: "crit",
    age: "Open 3 d 6 h",
    owner: "R. Kulkarni",
    slaIn: "Breached 6 h ago",
  },
  {
    id: "q3",
    kind: "SLA breach",
    title: "No hot water on the east riser",
    location: "Block C · Floor 1",
    block: "Block C",
    category: "Water",
    severity: "warn",
    age: "Open 1 d 4 h",
    owner: "S. Pawar",
    slaIn: "Breach in 3 h 10 m",
  },
  {
    id: "q4",
    kind: "Inspection",
    title: "Monthly safety inspection overdue",
    location: "Block B · Floors 2–4",
    block: "Block B",
    category: "Inspection",
    severity: "warn",
    age: "Overdue 9 d",
    owner: null,
    slaIn: "Escalates tomorrow",
  },
  {
    id: "q5",
    kind: "Housekeeping",
    title: "14 rooms uncleaned since yesterday",
    location: "Block C · Floor 3",
    block: "Block C",
    category: "Housekeeping",
    severity: "warn",
    age: "Open 19 h",
    owner: "M. Shinde",
    slaIn: "Breach in 5 h",
  },
  {
    id: "q6",
    kind: "Maintenance",
    title: "Water pump bearing noise flagged twice",
    location: "Block A · Plant room",
    block: "Block A",
    category: "Water",
    severity: "warn",
    age: "Open 2 d",
    owner: "S. Pawar",
    slaIn: "Breach in 22 h",
  },
  {
    id: "q7",
    kind: "Escalation",
    title: "Student escalation — repeated fan complaint",
    location: "Block B · Room 207",
    block: "Block B",
    category: "Electrical",
    severity: "crit",
    age: "Escalated 2 h ago",
    owner: null,
    slaIn: "Warden review due today",
  },
  {
    id: "q8",
    kind: "Maintenance",
    title: "Corridor light circuit intermittent",
    location: "Block D · Floor 2",
    block: "Block D",
    category: "Electrical",
    severity: "ok",
    age: "Open 8 h",
    owner: "A. Jadhav",
    slaIn: "Breach in 2 d",
  },
];

export const STAFF = [
  {
    name: "R. Kulkarni",
    role: "Electrician",
    load: 141,
    open: 17,
    response: "38 m",
    resolution: "22 h 10 m",
    sla: 71,
    availability: "On duty",
    health: "crit" as Health,
  },
  {
    name: "S. Pawar",
    role: "Plumber",
    load: 96,
    open: 9,
    response: "26 m",
    resolution: "8 h 05 m",
    sla: 92,
    availability: "On duty",
    health: "ok" as Health,
  },
  {
    name: "M. Shinde",
    role: "Housekeeping lead",
    load: 108,
    open: 12,
    response: "19 m",
    resolution: "5 h 40 m",
    sla: 88,
    availability: "On duty",
    health: "warn" as Health,
  },
  {
    name: "A. Jadhav",
    role: "Electrician",
    load: 42,
    open: 4,
    response: "31 m",
    resolution: "7 h 20 m",
    sla: 96,
    availability: "Idle · 3 h",
    health: "ok" as Health,
  },
  {
    name: "P. Deshmukh",
    role: "Carpenter",
    load: 38,
    open: 3,
    response: "44 m",
    resolution: "11 h 30 m",
    sla: 94,
    availability: "Idle · 5 h",
    health: "ok" as Health,
  },
  {
    name: "V. Rane",
    role: "Inspector",
    load: 87,
    open: 7,
    response: "1 h 05 m",
    resolution: "—",
    sla: 84,
    availability: "Field rounds",
    health: "warn" as Health,
  },
];

export type Recommendation = {
  id: string;
  title: string;
  urgency: "Critical" | "High" | "Medium";
  why: string;
  evidence: string[];
  confidence: number;
  impact: string;
  money: string;
  action: string;
  evidenceTarget: "complaints" | "heatmap" | "queue" | "forecast";
  scope?: { category?: string; block?: string };
};

export const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "r1",
    title: "Block B electrical system",
    urgency: "Critical",
    why: "Electrical complaints in Block B rose 62% over the last 14 days while one electrician carries all of them.",
    evidence: [
      "24 open electrical complaints, 16 of them in Block B",
      "Room B-214 has failed three times in nine days",
      "R. Kulkarni is at 141% of a normal workload",
    ],
    confidence: 94,
    impact: "Protects 4 SLA clocks expiring before midnight",
    money: "₹18,000 avoided repair cost if acted on today",
    action: "Schedule preventive inspection today",
    evidenceTarget: "heatmap",
    scope: { category: "Electrical", block: "Block B" },
  },
  {
    id: "r2",
    title: "Replace 9 ageing ceiling fans",
    urgency: "High",
    why: "Nine fans older than seven years account for 38% of electrical repeat complaints and are repaired on average every 24 days.",
    evidence: [
      "Repeat complaint rate for these rooms is 19%",
      "Cumulative repair spend already exceeds replacement cost",
    ],
    confidence: 88,
    impact: "Removes an estimated 11 complaints per month",
    money: "₹42,000 replacement · payback in 5 months",
    action: "Raise replacement request",
    evidenceTarget: "forecast",
    scope: { category: "Electrical" },
  },
  {
    id: "r3",
    title: "Add one housekeeping round in Block C",
    urgency: "Medium",
    why: "Cleaning completion in Block C sits at 81% against a 90% target and satisfaction there fell 0.3 in two weeks.",
    evidence: ["14 rooms uncleaned since yesterday", "Failed verification on 3 of 11 spot checks"],
    confidence: 81,
    impact: "Returns Block C to target within a week",
    money: "₹6,500 per month additional cost",
    action: "Approve extra round",
    evidenceTarget: "queue",
    scope: { block: "Block C", category: "Housekeeping" },
  },
  {
    id: "r4",
    title: "Rebalance two electrical jobs to A. Jadhav",
    urgency: "High",
    why: "One electrician is at 141% load while another has been idle for three hours.",
    evidence: ["17 open jobs vs 4", "SLA compliance gap of 25 points between the two"],
    confidence: 91,
    impact: "Two SLA clocks return to green today",
    money: "No additional cost",
    action: "Reassign now",
    evidenceTarget: "queue",
  },
];

export const FORECAST = [
  {
    id: "f1",
    label: "Complaint forecast · next 7 days",
    value: "48 – 56",
    note: "Electrical carries the entire increase.",
    inaction: "Two more SLA breaches if staffing is unchanged.",
    confidence: 86,
  },
  {
    id: "f2",
    label: "High-risk rooms · next 30 days",
    value: "11 rooms",
    note: "9 in Block B floor 2, 2 in Block C floor 1.",
    inaction: "Expect 3 emergency callouts at weekend rates.",
    confidence: 79,
  },
  {
    id: "f3",
    label: "Expected maintenance cost · August",
    value: "₹1.42 L",
    note: "24% above the monthly budget line.",
    inaction: "Budget overrun of ₹27,000 by month end.",
    confidence: 83,
  },
];

export const FORECAST_SERIES = [
  { day: "05 Aug", actual: 41, low: 41, high: 41 },
  { day: "07 Aug", actual: null as number | null, low: 42, high: 47 },
  { day: "09 Aug", actual: null, low: 44, high: 50 },
  { day: "11 Aug", actual: null, low: 45, high: 53 },
  { day: "13 Aug", actual: null, low: 47, high: 56 },
];

export const ASSETS = [
  { asset: "Ceiling fans (7 yr+)", repairs: 34, failure: "1 in 24 days", cost: "₹38,400", verdict: "Replace" },
  { asset: "Corridor light circuits", repairs: 19, failure: "1 in 41 days", cost: "₹12,100", verdict: "Rewire" },
  { asset: "Water pumps (Block A)", repairs: 11, failure: "1 in 68 days", cost: "₹22,600", verdict: "Overhaul" },
  { asset: "Geysers (Block C)", repairs: 9, failure: "1 in 74 days", cost: "₹9,800", verdict: "Monitor" },
  { asset: "Wi-Fi access points", repairs: 6, failure: "1 in 96 days", cost: "₹7,200", verdict: "Monitor" },
];

export const COST_BY_BLOCK = [
  { block: "Block A", cost: 24000 },
  { block: "Block B", cost: 58000 },
  { block: "Block C", cost: 36000 },
  { block: "Block D", cost: 19000 },
];

export const COST_BY_CATEGORY = [
  { category: "Electrical", cost: 61000 },
  { category: "Water", cost: 31000 },
  { category: "Housekeeping", cost: 22000 },
  { category: "Internet", cost: 14000 },
  { category: "Furniture", cost: 9000 },
];

export const MONTHLY_SPEND = [
  { month: "Mar", spend: 92000, budget: 115000 },
  { month: "Apr", spend: 104000, budget: 115000 },
  { month: "May", spend: 87000, budget: 115000 },
  { month: "Jun", spend: 111000, budget: 115000 },
  { month: "Jul", spend: 128000, budget: 115000 },
  { month: "Aug", spend: 142000, budget: 115000 },
];

export const NOTIFICATIONS = [
  {
    group: "Critical",
    items: [
      { title: "Exposed wiring reported", meta: "Block B · Floor 2 · 41 min ago", severity: "crit" as Health },
      { title: "SLA breached on Room B-214", meta: "Electrical · 6 h ago", severity: "crit" as Health },
    ],
  },
  {
    group: "Escalations",
    items: [
      { title: "Student escalation — Room B-207", meta: "Second escalation · 2 h ago", severity: "warn" as Health },
    ],
  },
  {
    group: "Maintenance",
    items: [
      { title: "Pump bearing noise logged", meta: "Block A plant room · 4 h ago", severity: "warn" as Health },
      { title: "Corridor circuit repaired", meta: "Block D · 7 h ago", severity: "ok" as Health },
    ],
  },
  {
    group: "Inspections",
    items: [
      { title: "Safety inspection overdue", meta: "Block B floors 2–4 · 9 days", severity: "warn" as Health },
      { title: "Inspection passed", meta: "Block A floor 3 · today 07:20", severity: "ok" as Health },
    ],
  },
];

export const DRAWER_TIMELINE = [
  { time: "Today 06:12", text: "Complaint reopened by occupant — fan dead again", tone: "crit" as Health },
  { time: "02 Aug 18:40", text: "Marked resolved by R. Kulkarni — capacitor replaced", tone: "ok" as Health },
  { time: "02 Aug 09:05", text: "Assigned to R. Kulkarni", tone: "warn" as Health },
  { time: "01 Aug 21:30", text: "Complaint raised — fan not rotating", tone: "warn" as Health },
  { time: "27 Jul 11:00", text: "Previous repair closed — wiring re-terminated", tone: "ok" as Health },
];
