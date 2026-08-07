// Mock property-management data, shaped to mirror the Buildium resources the app
// consumes. This is the seed for the in-memory dev store. When real Buildium keys
// are present, lib/buildium/real.js serves the same shapes from the live API.

export const VENDORS = [
  { id: 1, name: "Zimmerman Plumbing & HVAC", initials: "Z", color: "#1B3A6B", specialty: "HVAC · Plumbing · Electrical", phone: "(717) 737-3700", location: "Mechanicsburg, PA", logo: "https://www.ezimmerman.com/wp-content/uploads/2017/06/ez-logo.jpg" },
  { id: 2, name: "Fetrow Electric", initials: "F", color: "#B45309", specialty: "Electrical · Commercial & Residential", phone: "(717) 766-5795", location: "Mechanicsburg, PA", logo: null },
  { id: 3, name: "Mitchell's Landscaping", initials: "M", color: "#166534", specialty: "Landscaping · Snow Removal · Grounds", phone: "(717) 555-0193", location: "Camp Hill, PA", logo: "https://images.squarespace-cdn.com/content/v1/6499b43c65992b46d5ab2ce1/e8a5f36c-2676-479c-8b48-95ec00f073e2/MLC-Mitchells+Landscaping+Company_Logo_FINAL-04.png?format=300w" },
  { id: 4, name: "FlyLock Security", initials: "FL", color: "#1E3A5F", specialty: "Locks · Access Control · Doors", phone: "(717) 707-2399", location: "Lemoyne, PA", logo: "https://flylock.com/wp-content/uploads/2025/07/cropped-Flylock-Favicon-270x270.png" },
  { id: 5, name: "Murray Plumbing", initials: "MP", color: "#7C3AED", specialty: "Plumbing · Drains · Water Heaters", phone: "(717) 555-0147", location: "Mechanicsburg, PA", logo: null },
];

export const ORDERS = [
  { id: "WO-0041", title: "HVAC not cooling", unit: "Unit 4B", address: "214 Walnut St", status: "urgent", vendorId: null, reported: "2h ago", category: "HVAC", residentName: "Sarah M.", notes: "Resident says it's been out since last night. High priority given heat." },
  { id: "WO-0039", title: "Water leak under sink", unit: "Unit 1C", address: "330 Pine Ave", status: "urgent", vendorId: 1, reported: "5h ago", category: "Plumbing", residentName: "James T.", notes: "Active leak. Bucket placed. Vendor contacted, awaiting confirmation." },
  { id: "WO-0037", title: "Front door lock broken", unit: "Unit 8A", address: "812 Market St", status: "urgent", vendorId: 4, reported: "Yesterday", category: "Security", residentName: "Linda R.", notes: "Resident cannot fully lock door. Safety concern." },
  { id: "WO-0035", title: "Bathroom exhaust fan", unit: "Unit 2A", address: "214 Walnut St", status: "pending", vendorId: 2, reported: "2 days ago", category: "General", residentName: "Tom B.", notes: "Fan rattling loudly. Resident available afternoons." },
  { id: "WO-0033", title: "Parking lot light out", unit: "Lot B", address: "330 Pine Ave", status: "pending", vendorId: 3, reported: "3 days ago", category: "Electrical", residentName: null, notes: "Two lights out on east side. Safety concern at night." },
  { id: "WO-0030", title: "Semi-annual inspection", unit: "6 units", address: "330 Pine Ave", status: "scheduled", vendorId: 1, reported: "Scheduled", category: "Inspection", residentName: null, notes: "Bi-annual walkthrough. All 6 units. Residents notified." },
  { id: "WO-0028", title: "Carpet replacement", unit: "Unit 6B", address: "812 Market St", status: "review", vendorId: 2, reported: "Completed Jun 7", category: "Move-out", residentName: "Prior tenant", notes: "Completed. Awaiting owner approval before closing." },
  { id: "WO-0025", title: "Window seal repair", unit: "Unit 3A", address: "214 Walnut St", status: "done", vendorId: 2, reported: "Jun 5", category: "General", residentName: "Mark D.", notes: "Completed and closed." },
];

export const OWNER_PROPS = [
  { id: 1, name: "214 Walnut St", units: 12, occupied: 11, openOrders: 3, urgentOrders: 1, nextInspection: "Sep 2026", monthlyRev: "$14,400" },
  { id: 2, name: "330 Pine Ave", units: 8, occupied: 8, openOrders: 4, urgentOrders: 1, nextInspection: "Aug 2026", monthlyRev: "$9,600" },
  { id: 3, name: "812 Market St", units: 18, occupied: 16, openOrders: 2, urgentOrders: 0, nextInspection: "Oct 2026", monthlyRev: "$21,600" },
];

export const RESIDENT_BALANCES = [
  { property: "214 Walnut St", unit: "Unit 4B", resident: "Sarah M.", balance: 0 },
  { property: "214 Walnut St", unit: "Unit 2A", resident: "Tom B.", balance: 145 },
  { property: "214 Walnut St", unit: "Unit 5C", resident: "Priya N.", balance: 0 },
  { property: "330 Pine Ave", unit: "Unit 1C", resident: "James T.", balance: 0 },
  { property: "330 Pine Ave", unit: "Unit 3B", resident: "Derek W.", balance: 1200 },
  { property: "812 Market St", unit: "Unit 6B", resident: "Ana R.", balance: 0 },
  { property: "812 Market St", unit: "Unit 8A", resident: "Linda R.", balance: 75 },
];

const INSPECTION_ITEMS = [
  { id: "i1", category: "Exterior", label: "Entry doors & locks functional", critical: true },
  { id: "i2", category: "Exterior", label: "Windows — no cracks or broken seals", critical: false },
  { id: "i3", category: "Exterior", label: "Exterior lighting working", critical: false },
  { id: "i4", category: "Exterior", label: "No visible water damage / staining", critical: true },
  { id: "i5", category: "Kitchen", label: "Appliances functioning", critical: false },
  { id: "i6", category: "Kitchen", label: "Faucet — no leaks, proper pressure", critical: true },
  { id: "i7", category: "Kitchen", label: "Cabinet doors / hinges intact", critical: false },
  { id: "i8", category: "Bathroom", label: "Toilet flushes correctly", critical: true },
  { id: "i9", category: "Bathroom", label: "Exhaust fan working", critical: false },
  { id: "i10", category: "Bathroom", label: "No mold or mildew visible", critical: true },
  { id: "i11", category: "HVAC", label: "Thermostat responsive", critical: true },
  { id: "i12", category: "HVAC", label: "Vents clear and unobstructed", critical: false },
  { id: "i13", category: "HVAC", label: "Filter replaced", critical: false },
  { id: "i14", category: "Safety", label: "Smoke detector functional", critical: true },
  { id: "i15", category: "Safety", label: "CO detector present and functional", critical: true },
  { id: "i16", category: "Safety", label: "Fire extinguisher in date", critical: true },
  { id: "i17", category: "General", label: "Walls — no major holes or damage", critical: false },
  { id: "i18", category: "General", label: "Flooring in good condition", critical: false },
  { id: "i19", category: "General", label: "Ceilings — no stains or damage", critical: false },
  { id: "i20", category: "General", label: "All lights functional", critical: false },
];

const MOVEOUT_ITEMS = [
  { id: "m1", category: "General", label: "Walls patched & repainted", critical: false },
  { id: "m2", category: "General", label: "Carpets professionally cleaned", critical: false },
  { id: "m3", category: "Kitchen", label: "Appliances cleaned & functional", critical: true },
  { id: "m4", category: "Kitchen", label: "Countertops undamaged", critical: false },
  { id: "m5", category: "Bathroom", label: "No mold; grout & caulk intact", critical: true },
  { id: "m6", category: "Keys", label: "All keys & fobs returned", critical: true },
];

export const TEMPLATES = [
  { id: "t1", name: "Semi-Annual Standard", desc: "Full 20-point unit walkthrough", items: INSPECTION_ITEMS },
  { id: "t2", name: "Move-Out Inspection", desc: "Turnover & deposit checklist", items: MOVEOUT_ITEMS },
];

export const INSPECTIONS = [
  { id: "IN-204", property: "812 Market St", scope: "Semi-annual · 18 units", date: "May 12, 2026", passed: 16, failed: 2, nextDate: "Nov 12, 2026", by: "Marcus J." },
  { id: "IN-198", property: "214 Walnut St", scope: "Semi-annual · 12 units", date: "Apr 3, 2026", passed: 20, failed: 0, nextDate: "Oct 3, 2026", by: "Marcus J." },
];

// Message threads shown per role (read-only seed for the Messages screen).
export const MESSAGES = {
  employee: [
    { name: "Daflure HVAC", last: "On my way to 330 Pine. ETA 20min.", time: "9:32am", unread: 1, color: "#5B6AE8", init: "D", type: "vendor", role: "Vendor" },
    { name: "HandyPro Services", last: "Completed the exhaust fan repair.", time: "Yesterday", unread: 0, color: "#D46B08", init: "H", type: "vendor", role: "Vendor" },
    { name: "Elite Electric", last: "Can schedule Lot B lights for Friday.", time: "Yesterday", unread: 2, color: "#389E0D", init: "E", type: "vendor", role: "Vendor" },
    { name: "Locksmith Pro", last: "Confirmed for 10am tomorrow at 812 Market.", time: "Yesterday", unread: 0, color: "#CF1322", init: "L", type: "vendor", role: "Vendor" },
    { name: "Sarah M.", last: "Is someone coming today for the AC?", time: "2h ago", unread: 1, color: "#5B6AE8", init: "S", type: "resident", role: "Resident · Unit 4B" },
    { name: "James T.", last: "Thank you, the leak is fixed!", time: "Jun 8", unread: 0, color: "#531DAB", init: "J", type: "resident", role: "Resident · Unit 1C" },
    { name: "Linda R.", last: "The lock still feels loose after repair.", time: "Jun 9", unread: 1, color: "#0958D9", init: "L", type: "resident", role: "Resident · Unit 8A" },
    { name: "Tom B.", last: "Afternoons work best for me this week.", time: "Jun 7", unread: 0, color: "#389E0D", init: "T", type: "resident", role: "Resident · Unit 2A" },
    { name: "Robert H.", last: "What is the status on 330 Pine Ave?", time: "Jun 8", unread: 1, color: "#065F46", init: "R", type: "owner", role: "Owner · 330 Pine" },
    { name: "Patricia L.", last: "Approved the carpet replacement invoice.", time: "Jun 7", unread: 0, color: "#92400E", init: "P", type: "owner", role: "Owner · 812 Market" },
    { name: "Jordan K.", last: "When can I schedule a move-in walkthrough?", time: "Jun 6", unread: 1, color: "#5B21B6", init: "J", type: "applicant", role: "Applicant" },
    { name: "Alex P.", last: "I submitted my application last Tuesday.", time: "Jun 5", unread: 0, color: "#1D4ED8", init: "A", type: "applicant", role: "Applicant" },
  ],
  resident: [
    { name: "Stephen Fleming Realty", last: "Your HVAC request assigned to Daflure HVAC.", time: "1h ago", unread: 1, color: "#1F2EAD", init: "F", type: "manager", role: "Property Manager" },
    { name: "Daflure HVAC", last: "We'll be there between 2–4pm today.", time: "3h ago", unread: 0, color: "#5B6AE8", init: "D", type: "vendor", role: "Vendor · HVAC" },
  ],
  owner: [
    { name: "Marcus J.", last: "Carpet replacement at 812 Market complete.", time: "Jun 7", unread: 1, color: "#1F2EAD", init: "M", type: "employee", role: "Employee · Leasing" },
    { name: "Stephen Fleming Realty", last: "Monthly report for May is ready to review.", time: "Jun 1", unread: 0, color: "#065F46", init: "F", type: "manager", role: "Property Manager" },
    { name: "Denise K.", last: "330 Pine inspection is scheduled for next week.", time: "Jun 3", unread: 0, color: "#1B3A6B", init: "D", type: "employee", role: "Employee · Inspections" },
  ],
  vendor: [
    { name: "Marcus J.", last: "Can you come today for the AC at Unit 4B?", time: "9:15am", unread: 1, color: "#1F2EAD", init: "M", type: "employee", role: "Employee · Stephen Fleming Realty" },
    { name: "Stephen Fleming Realty", last: "New work order assigned: Water leak, 330 Pine.", time: "5h ago", unread: 1, color: "#065F46", init: "F", type: "manager", role: "Property Manager" },
  ],
  applicant: [
    { name: "Stephen Fleming Realty", last: "Your application is under review.", time: "Jun 8", unread: 1, color: "#1F2EAD", init: "F", type: "manager", role: "Property Manager" },
  ],
};
