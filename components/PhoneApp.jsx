"use client";
import { useState, createContext, useContext } from "react";

// Live Buildium data that deep children need without threading props through
// every screen: the real vendor roster (100+, vs the 5-company demo list) and
// whether writes/notifications actually reach anything yet.
const LiveCtx = createContext(null);
const useLive = () => useContext(LiveCtx) || {};

const C = {
  primary:"#1F2EAD", primaryLight:"#EDEFFC", bg:"#F0F2F5", card:"#fff",
  border:"#E4E7EC", text:"#0A0F1E", muted:"#667085", faint:"#98A2B3",
  urgent:   {bg:"#FEF2F2",text:"#B91C1C",border:"#FECACA",bar:"#EF4444"},
  pending:  {bg:"#FFF7ED",text:"#C2410C",border:"#FED7AA",bar:"#F97316"},
  scheduled:{bg:"#EFF6FF",text:"#1D4ED8",border:"#BFDBFE",bar:"#3B82F6"},
  review:   {bg:"#F5F3FF",text:"#6D28D9",border:"#DDD6FE",bar:"#7C3AED"},
  done:     {bg:"#F0FDF4",text:"#15803D",border:"#BBF7D0",bar:"#22C55E"},
};

const ROLES = {
  employee:{key:"employee",name:"Marcus J.",sub:"Leasing & Inspections",init:"M",color:"#1F2EAD",label:"Employee", labelBg:"#EDEFFC",labelText:"#1F2EAD",homeIcon:"⊞"},
  vendor:  {key:"vendor",  name:"Daflure HVAC",sub:"HVAC · Plumbing Vendor",init:"Z",color:"#1B3A6B",label:"Vendor",  labelBg:"#E6EDF7",labelText:"#1B3A6B",homeIcon:"🔧"},
  resident:{key:"resident",name:"Sarah M.", sub:"Unit 4B · 214 Walnut St",init:"S",color:"#C2410C",label:"Resident",labelBg:"#FFF7ED",labelText:"#C2410C",homeIcon:"🏠"},
  owner:   {key:"owner",   name:"Robert H.",sub:"Portfolio · 3 Properties",init:"R",color:"#15803D",label:"Owner",   labelBg:"#F0FDF4",labelText:"#15803D",homeIcon:"🏢"},
  applicant:{key:"applicant",name:"Jordan K.",sub:"Prospective Resident",init:"J",color:"#0958D9",label:"Applicant",labelBg:"#EFF6FF",labelText:"#0958D9",homeIcon:"📋"},
};

const VENDORS = [
  {id:1,name:"Zimmerman Plumbing & HVAC",initials:"Z",color:"#1B3A6B",specialty:"HVAC · Plumbing · Electrical",    phone:"(717) 737-3700",location:"Mechanicsburg, PA",logo:"https://www.ezimmerman.com/wp-content/uploads/2017/06/ez-logo.jpg"},
  {id:2,name:"Fetrow Electric",          initials:"F",color:"#B45309",specialty:"Electrical · Commercial & Residential",phone:"(717) 766-5795",location:"Mechanicsburg, PA",logo:null},
  {id:3,name:"Mitchell's Landscaping",   initials:"M",color:"#166534",specialty:"Landscaping · Snow Removal · Grounds",phone:"(717) 555-0193",location:"Camp Hill, PA",      logo:"https://images.squarespace-cdn.com/content/v1/6499b43c65992b46d5ab2ce1/e8a5f36c-2676-479c-8b48-95ec00f073e2/MLC-Mitchells+Landscaping+Company_Logo_FINAL-04.png?format=300w"},
  {id:4,name:"FlyLock Security",         initials:"FL",color:"#1E3A5F",specialty:"Locks · Access Control · Doors",   phone:"(717) 707-2399",location:"Lemoyne, PA",         logo:"https://flylock.com/wp-content/uploads/2025/07/cropped-Flylock-Favicon-270x270.png"},
  {id:5,name:"Murray Plumbing",          initials:"MP",color:"#7C3AED",specialty:"Plumbing · Drains · Water Heaters",phone:"(717) 555-0147",location:"Mechanicsburg, PA",logo:null},
];

const INIT_ORDERS = [
  {id:"WO-0041",title:"HVAC not cooling",      unit:"Unit 4B",address:"214 Walnut St",status:"urgent",   vendorId:null,reported:"2h ago",       category:"HVAC",      residentName:"Sarah M.",   notes:"Resident says it's been out since last night. High priority given heat."},
  {id:"WO-0039",title:"Water leak under sink", unit:"Unit 1C",address:"330 Pine Ave", status:"urgent",   vendorId:1,   reported:"5h ago",       category:"Plumbing",  residentName:"James T.",   notes:"Active leak. Bucket placed. Vendor contacted, awaiting confirmation."},
  {id:"WO-0037",title:"Front door lock broken",unit:"Unit 8A",address:"812 Market St",status:"urgent",   vendorId:4,   reported:"Yesterday",    category:"Security",  residentName:"Linda R.",   notes:"Resident cannot fully lock door. Safety concern."},
  {id:"WO-0035",title:"Bathroom exhaust fan",  unit:"Unit 2A",address:"214 Walnut St",status:"pending",  vendorId:2,   reported:"2 days ago",   category:"General",   residentName:"Tom B.",     notes:"Fan rattling loudly. Resident available afternoons."},
  {id:"WO-0033",title:"Parking lot light out", unit:"Lot B",  address:"330 Pine Ave", status:"pending",  vendorId:3,   reported:"3 days ago",   category:"Electrical",residentName:null,         notes:"Two lights out on east side. Safety concern at night."},
  {id:"WO-0030",title:"Semi-annual inspection",unit:"6 units",address:"330 Pine Ave", status:"scheduled",vendorId:1,   reported:"Scheduled",    category:"Inspection",residentName:null,         notes:"Bi-annual walkthrough. All 6 units. Residents notified."},
  {id:"WO-0028",title:"Carpet replacement",    unit:"Unit 6B",address:"812 Market St",status:"review",   vendorId:2,   reported:"Completed Jun 7",category:"Move-out",residentName:"Prior tenant",notes:"Completed. Awaiting owner approval before closing."},
  {id:"WO-0025",title:"Window seal repair",    unit:"Unit 3A",address:"214 Walnut St",status:"done",     vendorId:2,   reported:"Jun 5",        category:"General",   residentName:"Mark D.",    notes:"Completed and closed."},
];

const OWNER_PROPS = [
  {id:1,name:"214 Walnut St", units:12,occupied:11,openOrders:3,urgentOrders:1,nextInspection:"Sep 2026",monthlyRev:"$14,400"},
  {id:2,name:"330 Pine Ave",  units:8, occupied:8, openOrders:4,urgentOrders:1,nextInspection:"Aug 2026",monthlyRev:"$9,600" },
  {id:3,name:"812 Market St", units:18,occupied:16,openOrders:2,urgentOrders:0,nextInspection:"Oct 2026",monthlyRev:"$21,600"},
];

// Resident balances across all owner units (balance = amount currently owed)
const RESIDENT_BALANCES = [
  {property:"214 Walnut St", unit:"Unit 4B", resident:"Sarah M.",  balance:0},
  {property:"214 Walnut St", unit:"Unit 2A", resident:"Tom B.",    balance:145},
  {property:"214 Walnut St", unit:"Unit 5C", resident:"Priya N.",  balance:0},
  {property:"330 Pine Ave",  unit:"Unit 1C", resident:"James T.",  balance:0},
  {property:"330 Pine Ave",  unit:"Unit 3B", resident:"Derek W.",  balance:1200},
  {property:"812 Market St", unit:"Unit 6B", resident:"Ana R.",    balance:0},
  {property:"812 Market St", unit:"Unit 8A", resident:"Linda R.",  balance:75},
];

const SM = {
  urgent:   {label:"Urgent",      bg:"#FEF2F2",text:"#B91C1C",border:"#FECACA",bar:"#EF4444"},
  pending:  {label:"Awaiting",    bg:"#FFF7ED",text:"#C2410C",border:"#FED7AA",bar:"#F97316"},
  scheduled:{label:"Scheduled",   bg:"#EFF6FF",text:"#1D4ED8",border:"#BFDBFE",bar:"#3B82F6"},
  review:   {label:"Needs review",bg:"#F5F3FF",text:"#6D28D9",border:"#DDD6FE",bar:"#7C3AED"},
  done:     {label:"Done",        bg:"#F0FDF4",text:"#15803D",border:"#BBF7D0",bar:"#22C55E"},
};

// ── SHARED ────────────────────────────────────────────────────────────────────
// Buildium dates arrive as "YYYY-MM-DD". Render them human-readably, and render
// nothing we don't actually have.
const fmtDate = (d) => {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  if (!m) return String(d);
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${MON[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
};
const Badge = ({status}) => { const m=SM[status]; return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,fontWeight:700,letterSpacing:".02em",padding:"3px 10px",borderRadius:20,background:m.bg,color:m.text,border:`1px solid ${m.border}`,whiteSpace:"nowrap"}}><span style={{width:5,height:5,borderRadius:"50%",background:m.bar,flexShrink:0}} />{m.label}</span>; };

const VendorAvatar = ({v, size=20}) => {
  const [imgErr, setImgErr] = useState(false);
  if (v?.logo && !imgErr) {
    return <img src={v.logo} alt={v.name} onError={()=>setImgErr(true)} style={{width:size,height:size,borderRadius:"50%",objectFit:"contain",background:"#fff",border:"1px solid #E4E7EC",flexShrink:0,padding:2}} />;
  }
  return <div style={{width:size,height:size,borderRadius:"50%",background:v?v.color:"#B0B5C3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size<=18?7:size<=24?9:11,fontWeight:700,color:"#fff",flexShrink:0,letterSpacing:"-.5px"}}>{v?v.initials:"?"}</div>;
};

const VendorChip = ({vendorId,small}) => {
  const {vendors=VENDORS} = useLive();
  const v = vendors.find(v=>v.id===vendorId);
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:"#F8FAFC",padding:small?"3px 8px 3px 4px":"4px 10px 4px 5px",borderRadius:20,border:"1px solid #E4E7EC"}}>
      <VendorAvatar v={v} size={small?16:20} />
      <span style={{fontSize:small?10:11,color:"#5A5F72",fontWeight:500}}>{v?v.name:"Unassigned"}</span>
    </div>
  );
};

// ── ROLE SWITCHER SHEET ───────────────────────────────────────────────────────
const RoleSwitcherSheet = ({role,setRole,onClose}) => (
  <>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(10,15,30,0.5)",backdropFilter:"blur(3px)",WebkitBackdropFilter:"blur(3px)",zIndex:50,borderRadius:36}} />
    <div style={{position:"absolute",bottom:0,left:0,right:0,background:"#fff",borderRadius:"24px 24px 0 0",zIndex:51,paddingBottom:28,boxShadow:"0 -12px 48px rgba(10,15,30,0.25)"}}>
      <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
        <div style={{width:40,height:5,borderRadius:3,background:"#D6DAE1"}} />
      </div>
      <div style={{padding:"6px 20px 14px",borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:C.faint}}>Switch view</div>
      </div>
      {Object.values(ROLES).map(r => {
        const active = r.key===role;
        return (
          <div key={r.key} onClick={()=>{setRole(r.key);onClose();}} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 20px",background:active?C.primaryLight:"transparent",borderLeft:active?`3px solid ${C.primary}`:"3px solid transparent",cursor:"pointer"}}>
            <div style={{width:44,height:44,borderRadius:"50%",background:active?C.primary:r.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:active?"#fff":r.color,flexShrink:0}}>{r.init}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:C.text}}>{r.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:1}}>{r.sub}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3}}>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:r.labelBg,color:r.labelText}}>{r.label}</span>
              {active && <span style={{fontSize:10,color:C.primary,fontWeight:600}}>Active ✓</span>}
            </div>
          </div>
        );
      })}
    </div>
  </>
);

// ── APP HEADER (replaces StatusBar everywhere) ────────────────────────────────
// Demo role switching only when NOT running real Supabase logins.
const CAN_SWITCH_ROLES = !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const AppHeader = ({role,setRole}) => {
  const [open,setOpen] = useState(false);
  const p = ROLES[role];
  return (
    <>
      <div style={{background:"#fff",padding:"12px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"relative",zIndex:10,flexShrink:0}}>
        <span style={{fontSize:13,fontWeight:600,color:C.text}}>9:41</span>
        <div onClick={()=>CAN_SWITCH_ROLES&&setOpen(true)} style={{display:"flex",alignItems:"center",gap:7,background:p.labelBg,border:`1px solid ${p.labelText}30`,padding:"5px 12px 5px 7px",borderRadius:20,cursor:CAN_SWITCH_ROLES?"pointer":"default",userSelect:"none",boxShadow:"0 1px 3px rgba(16,24,40,0.08)"}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{p.init}</div>
          <span style={{fontSize:12,fontWeight:700,color:p.labelText,letterSpacing:".01em"}}>{p.label}</span>
          {CAN_SWITCH_ROLES && <span style={{fontSize:9,color:p.labelText,opacity:.65}}>▾</span>}
        </div>
        <span style={{fontSize:11,color:C.text}}>●●●● ⬛</span>
      </div>
      {open && CAN_SWITCH_ROLES && <RoleSwitcherSheet role={role} setRole={setRole} onClose={()=>setOpen(false)} />}
    </>
  );
};

// ── NAV BAR ───────────────────────────────────────────────────────────────────
const NavBar = ({active,onNav,role}) => {
  const p = ROLES[role];
  const items = [{id:"home",icon:p.homeIcon,label:"Home"},{id:"orders",icon:"🔧",label:"Orders"},{id:"messages",icon:"💬",label:"Messages"},{id:"profile",icon:"👤",label:"Profile"}];
  return (
    <div style={{background:"#fff",borderTop:"1px solid #E4E7EC",boxShadow:"0 -4px 16px rgba(16,24,40,0.05)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",padding:"10px 0 18px",flexShrink:0}}>
      {items.map(it=>(
        <div key={it.id} onClick={()=>onNav(it.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
          <span style={{fontSize:20,lineHeight:1,color:active===it.id?C.primary:C.faint,filter:active===it.id?"none":"grayscale(1)",opacity:active===it.id?1:.55}}>{it.icon}</span>
          <span style={{fontSize:10,fontWeight:active===it.id?700:600,letterSpacing:".01em",color:active===it.id?C.primary:C.faint}}>{it.label}</span>
          {active===it.id && <div style={{width:4,height:4,borderRadius:"50%",background:C.primary}} />}
        </div>
      ))}
    </div>
  );
};

// ── EMPLOYEE HOME ─────────────────────────────────────────────────────────────
function EmployeeHome({me,orders,onNav,onOrder,role,setRole}) {
  const urgent=orders.filter(o=>o.status==="urgent");
  const open=orders.filter(o=>["urgent","pending","scheduled"].includes(o.status));
  const done=orders.filter(o=>o.status==="done");
  // Triage list: anything still open, urgent first — with live Buildium statuses
  // "review" is never produced, so filtering on it alone left this empty.
  const attention=[...orders]
    .filter(o=>o.status!=="done")
    .sort((a,b)=>(a.status==="urgent"?0:1)-(b.status==="urgent"?0:1))
    .slice(0,3);
  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Good morning 👋</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-.02em"}}>{me?.entity?.name||"Marcus J."}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>{[today,me?.entity?.sub].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Today's pulse</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{n:urgent.length,label:"Urgent",...C.urgent},{n:open.length,label:"Open",...C.pending},{n:done.length,label:"Done",...C.done}].map(s=>(
            <div key={s.label} style={{textAlign:"center",padding:"8px 6px",borderRadius:10,background:s.bg,border:`1px solid ${s.border}`}}>
              <div style={{fontSize:24,fontWeight:700,color:s.text,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:10,fontWeight:600,color:s.text,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Needs attention</span>
        <span onClick={()=>onNav("orders")} style={{fontSize:12,color:C.primary,fontWeight:600,cursor:"pointer"}}>See all →</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px"}}>
        {attention.map(o=>(
          <div key={o.id} onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{fontSize:13.5,fontWeight:700,color:C.text,flex:1,paddingRight:8,lineHeight:1.3}}>{o.title}</div>
                <Badge status={o.status} />
              </div>
              <div style={{fontSize:11.5,color:C.muted,marginBottom:8}}>{[o.address,o.unit].filter(Boolean).join(" · ")||"Property not linked"}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <VendorChip vendorId={o.vendorId} small />
                <span style={{fontSize:11,color:o.vendorId?C.faint:C.primary,fontWeight:o.vendorId?400:600}}>{o.vendorId?"View details":"Assign now"}</span>
              </div>
            </div>
            <div style={{height:3,background:SM[o.status].bar}} />
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Quick actions</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 16px 20px"}}>
        {[
          {icon:"🔧",label:"New work order",sub:"Log maintenance",cb:()=>onNav("orders")},
          {icon:"📋",label:"Start inspection",sub:"Open form",cb:()=>onNav("inspection")},
          {icon:"💬",label:"Message vendor",sub:"Daflure + others",cb:()=>onNav("messages")},
          {icon:"📊",label:"Owner report",sub:"Send update",cb:()=>onNav("profile")},
        ].map(q=>(
          <div key={q.label} onClick={q.cb} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 15px",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{width:36,height:36,borderRadius:12,background:"#EDEFFC",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,marginBottom:10}}>{q.icon}</div>
            <div style={{fontSize:12.5,fontWeight:700,color:C.text,marginBottom:2}}>{q.label}</div>
            <div style={{fontSize:11,color:C.faint}}>{q.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RESIDENT HOME ─────────────────────────────────────────────────────────────
function ResidentHome({me,api,orders,onOrder,onCreated,onNav,submissionsReachOffice=true,role,setRole}) {
  const myName = me?.entity?.name || "Sarah M.";
  const firstName = myName.split(" ")[0];
  // Server already scopes to this resident (by Buildium tenant id when available);
  // re-filtering by name here would drop their own orders when the requestor name
  // on the ticket differs from the tenant record (e.g. a middle initial).
  const myOrders = orders;
  const openCount = myOrders.filter(o=>o.status!=="done").length;
  // "Pending assignment" means their signup email isn't linked to a Buildium unit.
  const isLinked = me?.matched !== false && me?.entity?.unit && me.entity.unit !== "Pending assignment";
  const [chatOpen,  setChatOpen]  = useState(false);
  const [messages,  setMessages]  = useState([
    {from:"ai", text:`Hi ${firstName}! I'm the Fleming Realty assistant. Just describe your maintenance issue in plain English and I'll take care of the rest.`}
  ]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [preview,   setPreview]   = useState(null);  // parsed work order

  const categoryColor = {
    HVAC:"#1F2EAD", Plumbing:"#0958D9", Electrical:"#B45309",
    Security:"#B91C1C", General:"#15803D", Appliance:"#6D28D9", Other:"#667085"
  };
  const urgencyMeta = {
    urgent:   {label:"Urgent",    ...C.urgent},
    pending:  {label:"Standard",  ...C.pending},
    scheduled:{label:"Low",       ...C.scheduled},
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(prev => [...prev, {from:"user", text}]);
    setLoading(true);

    try {
      // Server-side proxy holds the Anthropic key and does the parsing.
      const data = await api.ai(text);
      setMessages(prev => [...prev, {from:"ai", text: data.reply || "Got it — let me create that work order for you."}]);
      if (data.workOrder) setPreview(data.workOrder);
    } catch(e) {
      setMessages(prev => [...prev, {from:"ai", text:"Sorry, I had trouble connecting. Please try again or use the manual form."}]);
    }
    setLoading(false);
  };

  const confirm = () => {
    if (!preview) return;
    const newOrder = {
      id: `WO-${String(Math.floor(Math.random()*9000)+1000)}`,
      title: preview.title,
      unit: me?.entity?.unit || "Unit 4B",
      address: me?.entity?.address || "214 Walnut St",
      status: preview.urgency || "pending",
      vendorId: null,
      reported: "Just now",
      category: preview.category || "General",
      residentName: myName,
      notes: preview.notes || preview.title,
    };
    onCreated(newOrder);
    setPreview(null);
    setMessages(prev => [...prev, {from:"ai", text: submissionsReachOffice
      ? "✅ Work order created and sent to the maintenance team. You'll get a notification once a vendor is assigned."
      : "✅ I've recorded your request. Heads up — sending requests straight into Fleming's maintenance system isn't switched on yet, so please call the office for anything urgent."
    }]);
  };

  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Hi {firstName} 👋</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-.02em"}}>{myName}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>{isLinked?[me.entity.unit,me.entity.address].filter(x=>x&&x!=="—"&&x!=="-").join(" · "):"Unit not linked yet"}</div>
      </div>

      {/* Pending-assignment guidance: their email isn't linked to a unit yet. */}
      {!isLinked && (
        <div style={{margin:"16px 16px 0",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:16,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
          <span style={{fontSize:18,lineHeight:1.2}}>👋</span>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.pending.text,marginBottom:3}}>We're still linking your account</div>
            <div style={{fontSize:12,color:C.pending.text,opacity:.9,lineHeight:1.5}}>
              We couldn't match <b>{me?.email||"your email"}</b> to a unit yet. Your property manager can link it — until then you can still send a request below and we'll route it.
            </div>
          </div>
        </div>
      )}

      {/* Lease — only real Buildium values. Anything we don't have shows "—"
          rather than a comforting guess (a resident in arrears must never be
          told their balance is $0.00). */}
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>My lease</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            {label:"Lease ends", val:fmtDate(me?.entity?.leaseEnd)},
            {label:"Monthly rent", val:me?.entity?.rent?`$${Number(me.entity.rent).toLocaleString("en-US")}`:"—"},
            {label:"Status", val:me?.entity?.leaseStatus||"—"},
            {label:"Unit", val:isLinked?(me?.entity?.unit||"—"):"—"},
          ].map(s=>{
            const known=s.val&&s.val!=="—";
            return (
              <div key={s.label} style={{padding:"10px 12px",borderRadius:10,background:known?"#F7F8FA":"#FBFBFC",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9.5,fontWeight:600,color:C.faint,textTransform:"uppercase",letterSpacing:".06em",marginBottom:3}}>{s.label}</div>
                <div style={{fontSize:13,fontWeight:700,color:known?C.text:C.faint}}>{s.val}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:11,color:C.faint,marginTop:10,lineHeight:1.45}}>
          Account balance isn't shown here yet — contact the office for billing questions.
        </div>
      </div>

      {/* Open requests */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>My requests</span>
        <span style={{fontSize:11,color:C.faint}}>{openCount} open{myOrders.length>openCount&&<> · {myOrders.length-openCount} closed</>}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px"}}>
        {myOrders.map(o=>(
          <div key={o.id} onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text,flex:1,paddingRight:8,lineHeight:1.3}}>{o.title}</div>
                <Badge status={o.status} />
              </div>
              <div style={{fontSize:11.5,color:C.muted}}>{o.reported}</div>
            </div>
            <div style={{height:3,background:SM[o.status].bar}} />
          </div>
        ))}
      </div>

      {/* AI Receptionist button / chat */}
      <div style={{padding:"16px 16px 20px"}}>
        {!chatOpen ? (
          <div onClick={()=>setChatOpen(true)} style={{background:"linear-gradient(135deg,#1F2EAD,#3B4FD8)",borderRadius:18,padding:"18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:"0 6px 20px rgba(31,46,173,0.30)"}}>
            <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🤖</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,color:"#fff",marginBottom:2}}>Report an issue</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.7)"}}>Describe it in plain English — AI creates the work order</div>
            </div>
            <div style={{fontSize:18,color:"rgba(255,255,255,0.6)"}}>›</div>
          </div>
        ) : null}
        {!chatOpen && (
          <div onClick={()=>onNav && onNav("neworder")} style={{marginTop:10,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px",borderRadius:14,border:`1px solid ${C.border}`,background:"#fff",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04)"}}>
            <span style={{fontSize:15}}>📝</span>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>Submit a request to my property manager</span>
          </div>
        )}
        {chatOpen && (
          <div style={{background:"#fff",borderRadius:18,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 8px 28px rgba(16,24,40,0.10)"}}>
            {/* Chat header */}
            <div style={{background:"linear-gradient(135deg,#1F2EAD,#3B4FD8)",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🤖</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:"#fff"}}>Fleming AI Receptionist</div>
                <div style={{fontSize:10.5,color:"rgba(255,255,255,0.65)"}}>Powered by Claude · Fleming Realty</div>
              </div>
              <div onClick={()=>setChatOpen(false)} style={{fontSize:18,color:"rgba(255,255,255,0.6)",cursor:"pointer",lineHeight:1}}>✕</div>
            </div>

            {/* Messages */}
            <div style={{maxHeight:260,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
              {messages.map((m,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.from==="user"?"flex-end":"flex-start"}}>
                  {m.from==="ai" && (
                    <div style={{display:"flex",alignItems:"flex-end",gap:6,maxWidth:"88%"}}>
                      <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,#1F2EAD,#3B4FD8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0,marginBottom:2}}>🤖</div>
                      <div style={{background:"#F0F2F5",borderRadius:"12px 12px 12px 2px",padding:"10px 13px",fontSize:13,color:C.text,lineHeight:1.5}}>{m.text}</div>
                    </div>
                  )}
                  {m.from==="user" && (
                    <div style={{background:C.primary,borderRadius:"12px 12px 2px 12px",padding:"10px 13px",fontSize:13,color:"#fff",lineHeight:1.5,maxWidth:"82%"}}>{m.text}</div>
                  )}
                </div>
              ))}
              {loading && (
                <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
                  <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,#1F2EAD,#3B4FD8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🤖</div>
                  <div style={{background:"#F0F2F5",borderRadius:"12px 12px 12px 2px",padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.faint,animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${i*0.2}s`}} />)}
                    </div>
                  </div>
                </div>
              )}

              {/* Work order preview */}
              {preview && (
                <div style={{background:"#fff",border:`2px solid ${C.primary}`,borderRadius:12,padding:"13px 14px",marginTop:4}}>
                  <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:C.primary,marginBottom:8}}>Work order preview</div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{preview.title}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:C.primaryLight,color:C.primary}}>{preview.category}</span>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:urgencyMeta[preview.urgency||"pending"].bg,color:urgencyMeta[preview.urgency||"pending"].text}}>{urgencyMeta[preview.urgency||"pending"].label}</span>
                  </div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:12}}>{preview.notes}</div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>setPreview(null)} style={{flex:1,background:"#F8FAFC",color:C.muted,fontSize:12,fontWeight:600,padding:"10px",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                    <button onClick={confirm} style={{flex:2,background:C.primary,color:"#fff",fontSize:12,fontWeight:700,padding:"10px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"inherit"}}>✓ Confirm & submit</button>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{borderTop:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",gap:8,alignItems:"center"}}>
              <input
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&send()}
                placeholder="Describe your issue..."
                disabled={loading}
                style={{flex:1,border:`1px solid ${C.border}`,borderRadius:20,padding:"9px 14px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#F8FAFC"}}
              />
              <div onClick={send} style={{width:36,height:36,borderRadius:"50%",background:input.trim()&&!loading?C.primary:C.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:input.trim()&&!loading?"pointer":"default",flexShrink:0,transition:"background .15s"}}>
                <span style={{fontSize:14,color:"#fff",marginLeft:2}}>➤</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  );
}

// ── OWNER HOME ────────────────────────────────────────────────────────────────
function OwnerHome({inspections=[],balances=RESIDENT_BALANCES,properties=OWNER_PROPS,role,setRole}) {
  const props=properties&&properties.length?properties:OWNER_PROPS;
  const totalUnits=props.reduce((n,p)=>n+(p.units||0),0);
  const totalOcc=props.reduce((n,p)=>n+(p.occupied||0),0);
  const totalOrders=props.reduce((n,p)=>n+(p.openOrders||0),0);
  const totalUrgent=props.reduce((n,p)=>n+(p.urgentOrders||0),0);
  // monthlyRev arrives as a formatted string ("$13,699") from both mock and live.
  const money=s=>Number(String(s||"").replace(/[^0-9.]/g,""))||0;
  const totalRev=props.reduce((n,p)=>n+money(p.monthlyRev),0);
  const totalOwed=balances.reduce((n,r)=>n+r.balance,0);
  const owingCount=balances.filter(r=>r.balance>0).length;
  const fmt=n=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  // Large real portfolios: show the busiest properties first, cap the list.
  const LIST_CAP=25;
  const listed=props.slice().sort((a,b)=>(b.openOrders||0)-(a.openOrders||0)).slice(0,LIST_CAP);
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Welcome back 👋</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-.02em"}}>Robert H.</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Portfolio Owner · {props.length} {props.length===1?"Property":"Properties"}</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Portfolio overview</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          {[{n:totalUnits,label:"Units",bg:"#EEF0FD",border:"#C7CCF7",text:"#3730A3"},{n:`${totalOcc}/${totalUnits}`,label:"Occupied",bg:"#F0FDF4",border:"#BBF7D0",text:"#15803D"},{n:totalOrders,label:"Open WOs",bg:"#FFF7ED",border:"#FED7AA",text:"#C2410C"},{n:totalUrgent,label:"Urgent",bg:"#FEF2F2",border:"#FECACA",text:"#B91C1C"}].map(s=>(
            <div key={s.label} style={{textAlign:"center",padding:"8px 4px",borderRadius:10,background:s.bg,border:`1px solid ${s.border}`}}>
              <div style={{fontSize:16,fontWeight:700,color:s.text,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:9,fontWeight:600,color:s.text,marginTop:2,lineHeight:1.2}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,padding:"10px 12px",borderRadius:10,background:"#F0FDF4",border:"1px solid #BBF7D0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:11.5,fontWeight:600,color:"#065F46"}}>Monthly revenue</span>
          <span style={{fontSize:15,fontWeight:700,color:"#065F46"}}>${totalRev.toLocaleString("en-US")}</span>
        </div>
      </div>
      {/* Resident balances across all units */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Resident balances</span>
        <span style={{fontSize:11,color:C.faint}}>{owingCount} of {balances.length} owing</span>
      </div>
      <div style={{margin:"0 16px",flexShrink:0,background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:totalOwed>0?"#FEF2F2":"#F0FDF4",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:11.5,fontWeight:700,color:totalOwed>0?C.urgent.text:C.done.text}}>Total outstanding</span>
          <span style={{fontSize:16,fontWeight:800,letterSpacing:"-.01em",color:totalOwed>0?C.urgent.text:C.done.text}}>{fmt(totalOwed)}</span>
        </div>
        {balances.map((r,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 14px",borderBottom:i<balances.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:C.text}}>{r.resident}</div>
              <div style={{fontSize:11,color:C.faint,marginTop:1}}>{r.property} · {r.unit}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <span style={{fontSize:13,fontWeight:700,color:r.balance>0?C.urgent.text:C.done.text}}>{fmt(r.balance)}</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",padding:"2px 7px",borderRadius:10,background:r.balance>0?C.urgent.bg:C.done.bg,color:r.balance>0?C.urgent.text:C.done.text,border:`1px solid ${r.balance>0?C.urgent.border:C.done.border}`}}>{r.balance>0?"Owing":"Current"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Completed inspections — read-only for owner */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Inspections</span>
        <span style={{fontSize:11,color:C.faint}}>View only</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px"}}>
        {inspections.map(ins=>(
          <div key={ins.id} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"13px 14px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:13.5,fontWeight:700,color:C.text}}>{ins.property}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{ins.scope} · {ins.by}</div>
              </div>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:".04em",textTransform:"uppercase",padding:"3px 8px",borderRadius:10,background:C.done.bg,color:C.done.text,border:`1px solid ${C.done.border}`}}>Completed</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1,padding:"7px 10px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>Completed</div>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{ins.date}</div>
                <div style={{fontSize:10,color:C.done.text,fontWeight:600,marginTop:1}}>{ins.passed} passed · {ins.failed} flagged</div>
              </div>
              <div style={{flex:1,padding:"7px 10px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>Next scheduled</div>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{ins.nextDate}</div>
                <div style={{fontSize:10,color:C.faint,marginTop:1}}>Managed by Fleming</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>My properties</span>
        {props.length>listed.length&&<span style={{fontSize:11,color:C.faint}}>Top {listed.length} of {props.length}</span>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px 20px"}}>
        {listed.map(p=>(
          <div key={p.id} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{padding:"13px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{p.name}</div>
                  <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{p.occupied}/{p.units} units · {p.monthlyRev}/mo</div>
                </div>
                {p.urgentOrders>0&&<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:C.urgent.bg,color:C.urgent.text,border:`1px solid ${C.urgent.border}`}}>{p.urgentOrders} urgent</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div style={{padding:"7px 10px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:9.5,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>Open orders</div>
                  <div style={{fontSize:13,fontWeight:700,color:p.openOrders>0?C.pending.text:C.done.text}}>{p.openOrders}</div>
                </div>
                <div style={{padding:"7px 10px",borderRadius:8,background:"#F7F8FA",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:9.5,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>Next inspection</div>
                  <div style={{fontSize:12,fontWeight:700,color:C.text}}>{p.nextInspection}</div>
                </div>
              </div>
            </div>
            <div style={{height:3,background:p.urgentOrders>0?C.urgent.bar:C.done.bar}} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ORDERS LIST ───────────────────────────────────────────────────────────────
function OrdersScreen({me,orders,onOrder,onNav,onNewOrder,onInspection,role,setRole}) {
  const [filter,setFilter]=useState("all");
  const [q,setQ]=useState("");
  // The server already scopes orders to this user's role/identity (by Buildium
  // tenant id for residents). Re-filtering by name here would drop correctly
  // scoped orders whose requestor name differs from the tenant record.
  const scoped=orders;
  const needle=q.trim().toLowerCase();
  const visible=needle
    ? scoped.filter(o=>[o.id,o.title,o.address,o.unit,o.category,o.residentName].filter(Boolean).join(" ").toLowerCase().includes(needle))
    : scoped;
  const counts={all:visible.length,urgent:visible.filter(o=>o.status==="urgent").length,pending:visible.filter(o=>o.status==="pending").length,scheduled:visible.filter(o=>o.status==="scheduled").length,review:visible.filter(o=>o.status==="review").length,done:visible.filter(o=>o.status==="done").length};
  const filtered=filter==="all"?visible:visible.filter(o=>o.status===filter);
  const sections=[{key:"urgent",label:"Urgent"},{key:"pending",label:"Open"},{key:"scheduled",label:"Scheduled"},{key:"review",label:"Awaiting review"},{key:"done",label:"Completed"}];
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 12px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <span className="fl-tap" onClick={()=>onNav("home")} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Home</span>
          <span style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>Work Orders</span>
          {role!=="owner"&&<button onClick={onNewOrder} style={{background:C.primary,color:"#fff",fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>+ New</button>}
          {role==="owner"&&<span style={{fontSize:12,color:C.faint}}>View only</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#F7F8FA",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 13px"}}>
          <span style={{fontSize:14,color:C.faint}}>🔍</span>
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            placeholder="Search address, unit, resident, WO#…"
            style={{border:"none",background:"transparent",fontSize:13,color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}}
          />
          {q&&<span onClick={()=>setQ("")} style={{fontSize:14,color:C.faint,cursor:"pointer",padding:"0 2px",lineHeight:1}}>✕</span>}
        </div>
        {needle&&<div style={{fontSize:11.5,color:C.muted,marginTop:8}}>{visible.length} {visible.length===1?"match":"matches"} for “{q.trim()}”</div>}
      </div>
      <div style={{display:"flex",gap:6,padding:"10px 16px 6px",overflowX:"auto",flexShrink:0}}>
        {[["all","All"],["urgent","Urgent"],["pending","Open"],["scheduled","Sched."],["review","Review"],["done","Done"]].map(([k,l])=>(
          <div key={k} onClick={()=>setFilter(k)} style={{fontSize:11.5,fontWeight:700,padding:"6px 12px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,border:filter===k?`1px solid ${C.primary}`:`1px solid ${C.border}`,background:filter===k?C.primary:"#fff",color:filter===k?"#fff":C.muted,boxShadow:filter===k?"0 2px 8px rgba(31,46,173,0.25)":"none"}}>
            {l} <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:filter===k?"rgba(255,255,255,0.25)":"#F2F3F7",color:filter===k?"#fff":C.primary}}>{counts[k]}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 16px 20px"}}>
        {(filter==="all"?sections:[{key:filter,label:SM[filter]?.label||filter}]).map(sec=>{
          const items=filtered.filter(o=>o.status===sec.key);
          if(!items.length) return null;
          return (
            <div key={sec.key}>
              <div style={{padding:"8px 0 4px"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.faint}}>{sec.label}</span></div>
              {items.map(o=>(
                <div key={o.id} onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)",marginBottom:10}}>
                  <div style={{padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                      <span style={{fontSize:10,fontWeight:600,color:C.faint,letterSpacing:".04em"}}>{o.id}</span>
                      <Badge status={o.status} />
                    </div>
                    <div style={{fontSize:13.5,fontWeight:700,color:C.text,marginBottom:3,lineHeight:1.3}}>{o.title}</div>
                    <div style={{fontSize:11.5,color:C.muted,marginBottom:8}}>{[o.address,o.unit,o.reported].filter(Boolean).join(" · ")}</div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <VendorChip vendorId={o.vendorId} small />
                      <span style={{fontSize:11,color:C.faint}}>{o.category}</span>
                    </div>
                  </div>
                  <div style={{height:3,background:SM[o.status].bar}} />
                </div>
              ))}
            </div>
          );
        })}

        {filtered.length===0&&(
          <div style={{textAlign:"center",padding:"36px 20px"}}>
            <div style={{fontSize:32,marginBottom:10}}>{needle?"🔍":"📭"}</div>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>
              {needle?"No matching work orders":"Nothing here yet"}
            </div>
            <div style={{fontSize:12.5,color:C.muted,lineHeight:1.5,maxWidth:250,margin:"0 auto"}}>
              {needle
                ? <>Nothing matches “{q.trim()}”{filter!=="all"&&<> in <b>{SM[filter]?.label||filter}</b></>}. Try an address, unit, resident name, or WO number.</>
                : filter!=="all"
                ? <>No orders with status <b>{SM[filter]?.label||filter}</b> right now.</>
                : role==="resident"
                ? "You haven't submitted any maintenance requests yet."
                : "No work orders to show."}
            </div>
            {(needle||filter!=="all")&&(
              <button onClick={()=>{setQ("");setFilter("all");}} style={{marginTop:14,background:C.primaryLight,color:C.primary,fontSize:12.5,fontWeight:700,padding:"9px 16px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Clear filters</button>
            )}
          </div>
        )}

        {filtered.length>0&&role!=="resident"&&(
          <div style={{textAlign:"center",fontSize:11,color:C.faint,padding:"6px 0 2px",lineHeight:1.5}}>
            Showing {filtered.length} of {scoped.length} work order{scoped.length===1?"":"s"}
            {scoped.length>=75&&<><br/>Newest 75 from Buildium — search to find older ones</>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── VENDOR MESSAGE THREAD ────────────────────────────────────────────────────
const INIT_VENDOR_MSGS = [
  {id:1,from:"employee",text:"Hi, we have an urgent HVAC issue at Unit 4B — resident is without AC. Can you come today?",time:"9:15am"},
  {id:2,from:"vendor",  text:"Got it. We have a slot at 2pm today. Can the resident be home?",time:"9:22am"},
  {id:3,from:"employee",text:"Confirmed — resident will be home from 1pm onwards.",time:"9:28am"},
  {id:4,from:"vendor",  text:"Perfect. Technician will arrive between 2–3pm. We'll call 30 min before.",time:"9:31am"},
];

function VendorThread({vendor, role}) {
  const {notificationsEnabled=true} = useLive();
  // The seeded thread is demo fiction. Against a real vendor record it would read
  // as genuine history ("technician will arrive 2-3pm") that nobody ever sent.
  const [msgs, setMsgs] = useState(notificationsEnabled ? INIT_VENDOR_MSGS : []);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(false);

  const send = () => {
    if (!input.trim()) return;
    setMsgs(prev => [...prev, {id:Date.now(), from:"employee", text:input.trim(), time:"Just now"}]);
    setInput("");
    // Simulated vendor replies are demo-only — faking one would suggest a real
    // contractor answered when no message was actually delivered.
    if (notificationsEnabled) {
      setTimeout(() => {
        setMsgs(prev => [...prev, {id:Date.now()+1, from:"vendor", text:"Thanks, we'll update you once the tech is on the way.", time:"Just now"}]);
      }, 1800);
    }
  };

  const visible = expanded ? msgs : msgs.slice(-2);

  return (
    <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint}}>Thread with {vendor.name}</span>
        <span onClick={()=>setExpanded(e=>!e)} style={{fontSize:10,color:C.primary,fontWeight:600,cursor:"pointer"}}>{expanded?"Show less":"Show all"}</span>
      </div>
      {msgs.length===0&&(
        <div style={{fontSize:11.5,color:C.muted,lineHeight:1.5,padding:"2px 0 8px"}}>
          No messages yet. Vendor messaging isn't connected — reach them at {vendor.phone||"the number on file"}.
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
        {!expanded && msgs.length > 2 && (
          <div style={{textAlign:"center",fontSize:11,color:C.faint,padding:"4px 0"}}>{msgs.length - 2} earlier messages</div>
        )}
        {visible.map(m=>(
          <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from==="employee"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"82%",padding:"8px 11px",borderRadius:m.from==="employee"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.from==="employee"?C.primary:"#F0F2F5",color:m.from==="employee"?"#fff":C.text,fontSize:12.5,lineHeight:1.45}}>
              {m.text}
            </div>
            <span style={{fontSize:10,color:C.faint,marginTop:3,marginLeft:4,marginRight:4}}>{m.from==="vendor"?vendor.name:"You"} · {m.time}</span>
          </div>
        ))}
      </div>
      {role==="employee" && (
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <input
            value={input}
            onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder={`Message ${vendor.name}...`}
            style={{flex:1,border:`1px solid ${C.border}`,borderRadius:20,padding:"8px 14px",fontSize:12.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#F8FAFC"}}
          />
          <div onClick={send} style={{width:34,height:34,borderRadius:"50%",background:input.trim()?C.primary:C.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:input.trim()?"pointer":"default",transition:"background .15s",flexShrink:0}}>
            <span style={{fontSize:14,color:"#fff",marginLeft:2}}>➤</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DETAIL ────────────────────────────────────────────────────────────────────
function DetailScreen({order,orders,setOrders,onUpdateOrder,onBack,onAssign,role,setRole}) {
  const {vendors=VENDORS,syncs=true,notificationsEnabled=true}=useLive();
  const [notified,setNotified]=useState(false);
  const [ownerNotified,setOwnerNotified]=useState(false);
  const [completionNotified,setCompletionNotified]=useState(false);
  const [schedulingRequested,setSchedulingRequested]=useState(false);
  const vendor=vendors.find(v=>v.id===order.vendorId);
  // Always read the live row, not the object captured when the card was tapped,
  // so status changes made on this screen are reflected everywhere.
  const cur=orders.find(o=>o.id===order.id)||order;
  const apply=(patch)=> onUpdateOrder ? onUpdateOrder(order.id,patch) : setOrders(prev=>prev.map(o=>o.id===order.id?{...o,...patch}:o));
  const markDone=()=>{apply({status:"done"});setOwnerNotified(true);setCompletionNotified(true);};
  const [showComplete,setShowComplete]=useState(false);
  const [photoAdded,setPhotoAdded]=useState(false);
  const [completionNote,setCompletionNote]=useState("");
  const vendorComplete=()=>{
    apply({status:"review",vendorCompleted:true,completionNote,photoAdded});
    setShowComplete(false);
  };
  const employeeClose=()=>{apply({status:"done"});setOwnerNotified(true);setCompletionNotified(true);};
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Orders</span>
          <Badge status={cur?.status||order.status} />
        </div>
        <div style={{fontSize:10,fontWeight:600,color:C.faint,letterSpacing:".04em",marginBottom:4}}>{order.id} · {order.category}</div>
        <div style={{fontSize:19,fontWeight:800,letterSpacing:"-.02em",color:C.text,lineHeight:1.3,marginBottom:4}}>{order.title}</div>
        <div style={{fontSize:12.5,color:C.muted}}>{[order.address,order.unit].filter(Boolean).join(" · ")||"Property not linked"}</div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Buildium writes aren't implemented, so anything changed here lives on
            this device only. Saying so beats letting an employee believe the
            office record was updated. */}
        {!syncs&&role!=="resident"&&(
          <div style={{display:"flex",gap:10,alignItems:"flex-start",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:14,padding:"11px 13px"}}>
            <span style={{fontSize:15,lineHeight:1.2}}>⚠️</span>
            <div style={{fontSize:11.5,color:C.pending.text,lineHeight:1.5}}>
              <b>Viewing live Buildium data.</b> Changes you make here (assigning, closing, notes) stay on this device — they don't write back to Buildium yet.
            </div>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Issue notes</div>
          {/* Real Buildium descriptions are long free text with newlines. */}
          <div style={{fontSize:13,color:C.text,lineHeight:1.5,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{cur?.notes||order.notes||"No description provided."}</div>
        </div>
        {order.residentName&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:8}}>Resident</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:C.primary}}>{order.residentName[0]}</div>
                <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{order.residentName}</div><div style={{fontSize:11,color:C.faint}}>{order.unit}</div></div>
              </div>
              {role==="employee"&&(notificationsEnabled
                ? <button onClick={()=>setNotified(true)} style={{background:notified?C.done.bg:C.primaryLight,color:notified?C.done.text:C.primary,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>{notified?"✓ Notified":"Notify"}</button>
                : <span style={{fontSize:10.5,color:C.faint,textAlign:"right",maxWidth:110,lineHeight:1.35}}>Notifications not connected yet</span>
              )}
            </div>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:8}}>Vendor</div>
          {vendor?(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <VendorAvatar v={vendor} size={34} />
                  <div><div style={{fontSize:13,fontWeight:600,color:C.text}}>{vendor.name}</div><div style={{fontSize:11,color:C.faint}}>{vendor.specialty}</div></div>
                </div>
                {role==="employee"&&<button onClick={()=>onAssign(order)} style={{background:C.primaryLight,color:C.primary,fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Change</button>}
              </div>
              <VendorThread vendor={vendor} role={role} />
            </div>
          ):(
            role==="employee"
              ?<button onClick={()=>onAssign(order)} style={{width:"100%",background:C.primary,color:"#fff",fontSize:13,fontWeight:700,padding:"12px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(31,46,173,0.28)"}}>+ Assign a vendor</button>
              :<div style={{fontSize:13,color:C.muted}}>Not yet assigned</div>
          )}
        </div>
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:10}}>Timeline</div>
          {[
            {label:"Reported",done:true,time:order.reported},
            {label:"Work order created",done:true,time:order.reported},
            {label:"Vendor assigned",done:!!vendor,time:vendor?"Assigned":null},
            {label:"Resident notified",done:notified,time:notified?"Just now":null},
            {label:"Work completed by vendor",done:cur?.vendorCompleted||cur?.status==="done",time:cur?.vendorCompleted?"With photo":null},
            {label:"Closed by employee",done:cur?.status==="done",time:null},
            {label:"Resident notified of completion",done:completionNotified,time:completionNotified?"Just now":null},
            {label:"Owner notified",done:ownerNotified,time:ownerNotified?"Just now":null},
          ].map((step,i)=>(
            <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:i<7?10:0}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:step.done?C.primary:C.border,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {step.done&&<span style={{fontSize:9,color:"#fff",fontWeight:700}}>✓</span>}
                </div>
                {i<7&&<div style={{width:2,height:14,background:C.border,borderRadius:1,marginTop:2}} />}
              </div>
              <div style={{paddingTop:1}}>
                <div style={{fontSize:12.5,fontWeight:step.done?600:400,color:step.done?C.text:C.faint}}>{step.label}</div>
                {step.time&&<div style={{fontSize:11,color:C.faint}}>{step.time}</div>}
              </div>
            </div>
          ))}
        </div>
        {/* Completion proof — shown once vendor has completed */}
        {cur?.vendorCompleted&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:10}}>Completion proof from vendor</div>
            {cur.photoAdded&&(
              <div style={{height:120,borderRadius:10,background:"linear-gradient(135deg,#E6EDF7,#D4E0F0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10,border:`1px solid ${C.border}`}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:30,marginBottom:4}}>📷</div>
                  <div style={{fontSize:11,color:"#1B3A6B",fontWeight:600}}>Completion photo attached</div>
                  <div style={{fontSize:10,color:C.faint,marginTop:2}}>IMG_4471.jpg · uploaded by vendor</div>
                </div>
              </div>
            )}
            {cur.completionNote&&<div style={{fontSize:12.5,color:C.text,lineHeight:1.5,background:"#F8FAFC",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`}}>{cur.completionNote}</div>}
          </div>
        )}

        {/* VENDOR view: contact office about scheduling */}
        {role==="vendor"&&cur?.status!=="done"&&(
          schedulingRequested?(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:C.scheduled.bg,borderRadius:14,border:`1px solid ${C.scheduled.border}`}}>
              <span style={{fontSize:18}}>📅</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.scheduled.text}}>Scheduling request sent</div>
                <div style={{fontSize:11.5,color:C.scheduled.text,opacity:.85,marginTop:2}}>Fleming Realty will reach out to coordinate a time.</div>
              </div>
            </div>
          ):(
            <button onClick={()=>setSchedulingRequested(true)} style={{width:"100%",background:"#fff",color:C.primary,fontSize:13.5,fontWeight:700,padding:"13px",borderRadius:14,border:`1.5px solid ${C.primary}`,cursor:"pointer",fontFamily:"inherit"}}>📅 Contact Fleming about scheduling</button>
          )
        )}

        {/* VENDOR view: complete the job */}
        {role==="vendor"&&cur?.status!=="done"&&cur?.status!=="review"&&(
          !showComplete?(
            <button onClick={()=>setShowComplete(true)} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(31,46,173,0.28)"}}>✓ Mark work complete</button>
          ):(
            <div style={{background:"#fff",borderRadius:14,border:`2px solid ${C.primary}`,padding:"14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Complete this work order</div>
              <div style={{fontSize:11,fontWeight:600,color:C.faint,marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Photo of completed work <span style={{color:C.urgent.text}}>*</span></div>
              {!photoAdded?(
                <div onClick={()=>setPhotoAdded(true)} style={{height:90,borderRadius:10,border:`2px dashed ${C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",marginBottom:12,background:"#F8FAFC"}}>
                  <div style={{fontSize:24,marginBottom:4}}>📷</div>
                  <div style={{fontSize:12,color:C.muted,fontWeight:500}}>Tap to add photo</div>
                </div>
              ):(
                <div style={{height:90,borderRadius:10,background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,border:`1px solid ${C.done.border}`,position:"relative"}}>
                  <div style={{textAlign:"center"}}><div style={{fontSize:24,marginBottom:2}}>✓</div><div style={{fontSize:11,color:C.done.text,fontWeight:600}}>Photo added</div></div>
                </div>
              )}
              <div style={{fontSize:11,fontWeight:600,color:C.faint,marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Work details <span style={{color:C.urgent.text}}>*</span></div>
              <textarea value={completionNote} onChange={e=>setCompletionNote(e.target.value)} placeholder="Describe what was done..." rows={2} style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",resize:"none",boxSizing:"border-box",marginBottom:12}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowComplete(false)} style={{flex:1,background:"#F8FAFC",color:C.muted,fontSize:13,fontWeight:600,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                <button onClick={vendorComplete} disabled={!photoAdded||!completionNote.trim()} style={{flex:2,background:(photoAdded&&completionNote.trim())?C.primary:"#E4E7EC",color:(photoAdded&&completionNote.trim())?"#fff":C.faint,fontSize:13,fontWeight:700,padding:"11px",borderRadius:10,border:"none",cursor:(photoAdded&&completionNote.trim())?"pointer":"default",fontFamily:"inherit"}}>Submit completion</button>
              </div>
            </div>
          )
        )}

        {/* EMPLOYEE view: close out after vendor completed */}
        {role==="employee"&&cur?.status==="review"&&(
          <button onClick={employeeClose} style={{width:"100%",background:C.done.bg,color:C.done.text,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:`1px solid ${C.done.border}`,cursor:"pointer",fontFamily:"inherit"}}>✓ Approve & close — notify owner</button>
        )}

        {/* EMPLOYEE view: manual close if no vendor flow */}
        {role==="employee"&&cur?.status!=="done"&&cur?.status!=="review"&&(
          <button onClick={markDone} style={{width:"100%",background:"#F8FAFC",color:C.muted,fontSize:13,fontWeight:600,padding:"12px",borderRadius:14,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Close without vendor completion</button>
        )}

        {/* Vendor waiting on employee */}
        {role==="vendor"&&cur?.status==="review"&&(
          <div style={{textAlign:"center",padding:"12px",background:C.review.bg,borderRadius:14,border:`1px solid ${C.review.border}`}}>
            <div style={{fontSize:14,fontWeight:700,color:C.review.text}}>✓ Submitted for review</div>
            <div style={{fontSize:11.5,color:C.review.text,marginTop:3,opacity:.8}}>Awaiting employee approval</div>
          </div>
        )}

        {cur?.status==="done"&&(
          <div style={{textAlign:"center",padding:"12px",background:C.done.bg,borderRadius:14,border:`1px solid ${C.done.border}`}}>
            <div style={{fontSize:14,fontWeight:700,color:C.done.text}}>✓ Completed & closed</div>
            <div style={{fontSize:11.5,color:C.done.text,marginTop:3,opacity:.8}}>Resident &amp; owner have been notified</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ASSIGN VENDOR ─────────────────────────────────────────────────────────────
function AssignScreen({order,orders,setOrders,onUpdateOrder,onBack,role,setRole}) {
  const {vendors=VENDORS,syncs=true}=useLive();
  const [selected,setSelected]=useState(order.vendorId);
  const [confirmed,setConfirmed]=useState(false);
  const [vq,setVq]=useState("");
  const vNeedle=vq.trim().toLowerCase();
  const shownVendors=(vNeedle
    ? vendors.filter(v=>[v.name,v.specialty,v.location].filter(Boolean).join(" ").toLowerCase().includes(vNeedle))
    : vendors
  ).slice(0,40);
  const confirm=()=>{ (onUpdateOrder?onUpdateOrder(order.id,{vendorId:selected}):setOrders(prev=>prev.map(o=>o.id===order.id?{...o,vendorId:selected}:o))); setConfirmed(true); setTimeout(()=>onBack(),1400); };
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Back</span>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>Assign vendor</div>
        <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>{order.title} · {order.unit}</div>
      </div>
      {/* Real rosters run to 100+ vendors, so this needs a filter to be usable. */}
      <div style={{padding:"12px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#F7F8FA",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 13px"}}>
          <span style={{fontSize:14,color:C.faint}}>🔍</span>
          <input value={vq} onChange={e=>setVq(e.target.value)} placeholder={`Search ${vendors.length} vendors…`} style={{border:"none",background:"transparent",fontSize:13,color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}} />
          {vq&&<span onClick={()=>setVq("")} style={{fontSize:14,color:C.faint,cursor:"pointer",lineHeight:1}}>✕</span>}
        </div>
      </div>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {shownVendors.map(v=>(
          <div key={v.id} onClick={()=>setSelected(v.id)} style={{background:"#fff",borderRadius:16,border:selected===v.id?`2px solid ${C.primary}`:`1px solid ${C.border}`,padding:"14px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"border-color .15s ease, box-shadow .15s ease",boxShadow:selected===v.id?"0 0 0 4px rgba(31,46,173,0.10)":"0 1px 2px rgba(16,24,40,0.04)"}}>
            <VendorAvatar v={v} size={44} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:700,color:C.text,marginBottom:2}}>{v.name}</div>
              {v.specialty&&<div style={{fontSize:11,color:C.muted,marginBottom:2}}>{v.specialty}</div>}
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                {v.location&&<span style={{fontSize:10,color:C.faint}}>📍 {v.location}</span>}
                {v.phone&&<span style={{fontSize:10,color:C.faint}}>{v.phone}</span>}
              </div>
            </div>
            {selected===v.id&&<div style={{width:22,height:22,borderRadius:"50%",background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0}}>✓</div>}
          </div>
        ))}
        {shownVendors.length===0&&<div style={{textAlign:"center",padding:"26px 16px",fontSize:12.5,color:C.muted}}>No vendors match “{vq.trim()}”.</div>}
        {!vq&&vendors.length>shownVendors.length&&<div style={{textAlign:"center",fontSize:11,color:C.faint,padding:"2px 0 4px"}}>Showing {shownVendors.length} of {vendors.length} — search to narrow</div>}
        {selected&&!confirmed&&<button onClick={confirm} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(31,46,173,0.28)",marginTop:6}}>Assign {vendors.find(v=>v.id===selected)?.name}</button>}
        {confirmed&&(
          <div style={{textAlign:"center",padding:"14px",background:C.done.bg,borderRadius:14,border:`1px solid ${C.done.border}`}}>
            <div style={{fontSize:14,fontWeight:700,color:C.done.text}}>✓ Vendor assigned</div>
            <div style={{fontSize:12,color:C.done.text,opacity:.85,marginTop:3}}>
              {syncs?"Resident notified automatically":"Saved on this device — not yet synced to Buildium"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MESSAGES ──────────────────────────────────────────────────────────────────
function MessagesScreen({messages,messagingEnabled=true,onNav,role,setRole}) {
  const [filter,setFilter]=useState("all");
  const [activeChat,setActiveChat]=useState(null);
  const [threads,setThreads]=useState({});
  const [readNames,setReadNames]=useState([]);
  const [draft,setDraft]=useState("");
  const allConvos=[
    {name:"Daflure HVAC",     last:"On my way to 330 Pine. ETA 20min.",           time:"9:32am",   unread:1,color:"#5B6AE8",init:"D",type:"vendor",   role:"Vendor"             },
    {name:"HandyPro Services",last:"Completed the exhaust fan repair.",            time:"Yesterday",unread:0,color:"#D46B08",init:"H",type:"vendor",   role:"Vendor"             },
    {name:"Elite Electric",   last:"Can schedule Lot B lights for Friday.",        time:"Yesterday",unread:2,color:"#389E0D",init:"E",type:"vendor",   role:"Vendor"             },
    {name:"Locksmith Pro",    last:"Confirmed for 10am tomorrow at 812 Market.",   time:"Yesterday",unread:0,color:"#CF1322",init:"L",type:"vendor",   role:"Vendor"             },
    {name:"Sarah M.",         last:"Is someone coming today for the AC?",          time:"2h ago",   unread:1,color:"#5B6AE8",init:"S",type:"resident", role:"Resident · Unit 4B" },
    {name:"James T.",         last:"Thank you, the leak is fixed!",                time:"Jun 8",    unread:0,color:"#531DAB",init:"J",type:"resident", role:"Resident · Unit 1C" },
    {name:"Linda R.",         last:"The lock still feels loose after repair.",     time:"Jun 9",    unread:1,color:"#0958D9",init:"L",type:"resident", role:"Resident · Unit 8A" },
    {name:"Tom B.",           last:"Afternoons work best for me this week.",       time:"Jun 7",    unread:0,color:"#389E0D",init:"T",type:"resident", role:"Resident · Unit 2A" },
    {name:"Robert H.",        last:"What is the status on 330 Pine Ave?",          time:"Jun 8",    unread:1,color:"#065F46",init:"R",type:"owner",    role:"Owner · 330 Pine"   },
    {name:"Patricia L.",      last:"Approved the carpet replacement invoice.",     time:"Jun 7",    unread:0,color:"#92400E",init:"P",type:"owner",    role:"Owner · 812 Market" },
    {name:"Jordan K.",        last:"When can I schedule a move-in walkthrough?",   time:"Jun 6",    unread:1,color:"#5B21B6",init:"J",type:"applicant",role:"Applicant"          },
    {name:"Alex P.",          last:"I submitted my application last Tuesday.",     time:"Jun 5",    unread:0,color:"#1D4ED8",init:"A",type:"applicant",role:"Applicant"          },
  ];
  // Threads come from the server. On live Buildium data the server sends an empty
  // list, because there is no real message backend yet — inventing a thread would
  // tell a resident a vendor is coming to their unit today. The demo threads below
  // are only used in mock/demo mode.
  const demoConvos=role==="resident"
    ?[{name:"Fleming Realty",last:"Your HVAC request assigned to Daflure HVAC.",time:"1h ago",unread:1,color:C.primary,init:"F",type:"manager",role:"Property Manager"},{name:"Daflure HVAC",last:"We'll be there between 2–4pm today.",time:"3h ago",unread:0,color:"#5B6AE8",init:"D",type:"vendor",role:"Vendor · HVAC"}]
    :role==="owner"
    ?[{name:"Marcus J.",last:"Carpet replacement at 812 Market complete.",time:"Jun 7",unread:1,color:C.primary,init:"M",type:"employee",role:"Employee · Leasing"},{name:"Fleming Realty",last:"Monthly report for May is ready to review.",time:"Jun 1",unread:0,color:"#065F46",init:"F",type:"manager",role:"Property Manager"},{name:"Denise K.",last:"330 Pine inspection is scheduled for next week.",time:"Jun 3",unread:0,color:"#1B3A6B",init:"D",type:"employee",role:"Employee · Inspections"}]
    :allConvos;
  const convos=Array.isArray(messages)?messages:demoConvos;
  const tabs=role==="employee"?[{key:"all",label:"All"},{key:"vendor",label:"Vendors"},{key:"resident",label:"Residents"},{key:"owner",label:"Owners"},{key:"applicant",label:"Applicants"}]:[{key:"all",label:"All"}];
  const typeColors={vendor:{bg:"#EEF0FD",text:"#3730A3"},resident:{bg:"#FFF7ED",text:"#92400E"},owner:{bg:"#D1FAE5",text:"#065F46"},applicant:{bg:"#F3EEFE",text:"#5B21B6"},employee:{bg:"#EEF0FD",text:"#3730A3"},manager:{bg:"#D1FAE5",text:"#065F46"}};
  const REPLIES={vendor:"Got it — we'll confirm a time and update you shortly.",resident:"Thank you! I'll keep an eye out for the update.",owner:"Great — thanks for keeping me posted.",applicant:"Thank you! Please let me know if you need anything else.",employee:"Thanks — I'll follow up on that today.",manager:"Thanks — noted. We'll be in touch."};
  const unreadOf=c=>readNames.includes(c.name)?0:c.unread;
  const openChat=c=>{setThreads(prev=>prev[c.name]?prev:{...prev,[c.name]:[{id:1,from:"them",text:c.last,time:c.time}]});setReadNames(prev=>prev.includes(c.name)?prev:[...prev,c.name]);setDraft("");setActiveChat(c);};
  const sendChat=()=>{
    const text=draft.trim();
    if(!text||!activeChat)return;
    const name=activeChat.name;
    setThreads(prev=>({...prev,[name]:[...(prev[name]||[]),{id:Date.now(),from:"me",text,time:"Just now"}]}));
    setDraft("");
    // Simulated replies only exist in demo mode. Faking an answer from a real
    // property manager would make someone believe a message was received when
    // nothing left the browser.
    if(messagingEnabled){
      const reply=REPLIES[activeChat.type]||"Thanks — noted.";
      setTimeout(()=>{setThreads(prev=>({...prev,[name]:[...(prev[name]||[]),{id:Date.now()+1,from:"them",text:reply,time:"Just now"}]}));},1500);
    }
  };
  const filtered=filter==="all"?convos:convos.filter(c=>c.type===filter);
  const totalUnread=convos.reduce((n,c)=>n+unreadOf(c),0);

  if(activeChat){
    const c=activeChat;
    const msgs=threads[c.name]||[];
    const tc=typeColors[c.type]||{bg:"#F2F3F7",text:C.muted};
    return (
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <AppHeader role={role} setRole={setRole} />
        <div style={{background:"#fff",padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <span onClick={()=>setActiveChat(null)} style={{fontSize:15,color:C.primary,fontWeight:600,cursor:"pointer",padding:"2px 6px 2px 0"}}>←</span>
          <div style={{width:38,height:38,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff",flexShrink:0}}>{c.init}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14.5,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>{c.name}</div>
            <span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:8,background:tc.bg,color:tc.text}}>{c.role}</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {msgs.map(m=>(
            <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from==="me"?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"82%",padding:"9px 13px",borderRadius:m.from==="me"?"14px 14px 3px 14px":"14px 14px 14px 3px",background:m.from==="me"?C.primary:"#fff",color:m.from==="me"?"#fff":C.text,fontSize:13,lineHeight:1.5,border:m.from==="me"?"none":`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04)"}}>{m.text}</div>
              <span style={{fontSize:10,color:C.faint,marginTop:3,marginLeft:4,marginRight:4}}>{m.from==="me"?"You":c.name} · {m.time}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderTop:`1px solid ${C.border}`,padding:"10px 12px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder={`Message ${c.name}...`} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:20,padding:"9px 14px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#F8FAFC"}} />
          <div onClick={sendChat} style={{width:36,height:36,borderRadius:"50%",background:draft.trim()?C.primary:C.border,display:"flex",alignItems:"center",justifyContent:"center",cursor:draft.trim()?"pointer":"default",flexShrink:0,transition:"background .15s"}}>
            <span style={{fontSize:14,color:"#fff",marginLeft:2}}>➤</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 12px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={()=>onNav("home")} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Home</span>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>Messages</div>
          {totalUnread>0&&<div style={{background:C.primary,color:"#fff",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:20}}>{totalUnread} unread</div>}
        </div>
      </div>
      {tabs.length>1&&(
        <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"0 16px"}}>
          <div style={{display:"flex",gap:0,overflowX:"auto",scrollbarWidth:"none"}}>
            {tabs.map(t=>{
              const count=t.key==="all"?convos.reduce((n,c)=>n+unreadOf(c),0):convos.filter(c=>c.type===t.key).reduce((n,c)=>n+unreadOf(c),0);
              const isActive=filter===t.key;
              return <div key={t.key} onClick={()=>setFilter(t.key)} style={{padding:"10px 14px 8px",cursor:"pointer",whiteSpace:"nowrap",borderBottom:isActive?`2px solid ${C.primary}`:"2px solid transparent",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:12.5,fontWeight:isActive?700:500,color:isActive?C.primary:C.muted}}>{t.label}</span>
                {count>0&&<span style={{fontSize:9,fontWeight:700,background:isActive?C.primary:C.border,color:isActive?"#fff":C.muted,padding:"1px 5px",borderRadius:10}}>{count}</span>}
              </div>;
            })}
          </div>
        </div>
      )}
      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"44px 26px"}}>
          <div style={{fontSize:34,marginBottom:12}}>💬</div>
          <div style={{fontSize:14.5,fontWeight:700,color:C.text,marginBottom:6}}>No messages yet</div>
          <div style={{fontSize:12.5,color:C.muted,lineHeight:1.55}}>
            In-app messaging isn't switched on yet. For anything you need right now,
            call the Fleming Realty office and we'll take care of it.
          </div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column"}}>
        {filtered.map((c,i)=>(
          <div key={i} onClick={()=>openChat(c)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:unreadOf(c)>0?"#FAFBFF":"#fff"}}>
            <div style={{position:"relative",flexShrink:0}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>{c.init}</div>
              {unreadOf(c)>0&&<div style={{position:"absolute",top:-1,right:-1,width:14,height:14,borderRadius:"50%",background:C.primary,border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#fff"}}>{unreadOf(c)}</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                <span style={{fontSize:13.5,fontWeight:unreadOf(c)>0?700:600,color:C.text}}>{c.name}</span>
                <span style={{fontSize:10.5,color:C.faint,flexShrink:0,marginLeft:8}}>{c.time}</span>
              </div>
              <div style={{marginBottom:3}}><span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:8,background:typeColors[c.type]?.bg||"#F2F3F7",color:typeColors[c.type]?.text||C.muted}}>{c.role}</span></div>
              <div style={{fontSize:12,color:unreadOf(c)>0?C.text:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:unreadOf(c)>0?500:400}}>{c.last}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────────────────────
function ProfileScreen({me,role,setRole,onNav,onSignOut,canViewAs}) {
  const p=ROLES[role];
  const displayName = me?.entity?.name || p.name;
  const displaySub = me?.entity?.sub || (me?.entity?.unit ? `${me.entity.unit}${me.entity.address&&me.entity.address!=="—"?` · ${me.entity.address}`:""}` : p.sub);
  const initial = (displayName||"?").trim()[0]?.toUpperCase() || p.init;
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={()=>onNav("home")} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Home</span>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:20,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 4px 16px rgba(16,24,40,0.06)"}}>
        <div style={{background:`linear-gradient(135deg,${p.color}22 0%,${p.color}08 100%)`,padding:"24px 20px",display:"flex",flexDirection:"column",alignItems:"center",borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:72,height:72,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:700,color:"#fff",marginBottom:12,boxShadow:`0 4px 16px ${p.color}44`}}>{initial}</div>
          <div style={{fontSize:19,fontWeight:700,color:C.text,marginBottom:4}}>{displayName}</div>
          <div style={{fontSize:12.5,color:C.muted,marginBottom:4}}>{displaySub}</div>
          {me?.email&&<div style={{fontSize:11.5,color:C.faint,marginBottom:10}}>{me.email}</div>}
          <span style={{fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,background:p.labelBg,color:p.labelText}}>{p.label}</span>
        </div>
        <div style={{padding:"14px 20px"}}>
          <div style={{fontSize:12.5,color:C.muted,lineHeight:1.55}}>
            {role==="employee"&&"Full work order management, vendor assignment, and team oversight."}
            {role==="resident"&&"Submit maintenance requests, track your open issues, and manage your lease."}
            {role==="owner"&&"Portfolio visibility, work order status, and property health at a glance."}
            {role==="vendor"&&"Your assigned jobs, scheduling, and completion submissions."}
            {role==="applicant"&&"Track your application status and next steps."}
          </div>
        </div>
      </div>
      {canViewAs && (
        <div style={{margin:"12px 16px 0"}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:8,paddingLeft:2}}>Demo · view as another role</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.values(ROLES).map(r=>{
              const active=r.key===role;
              return (
                <div key={r.key} onClick={()=>{setRole(r.key);onNav("home");}} style={{background:"#fff",borderRadius:16,border:active?`2px solid ${C.primary}`:`1px solid ${C.border}`,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:active?"0 0 0 4px rgba(31,46,173,0.10)":"0 1px 2px rgba(16,24,40,0.04)"}}>
                  <div style={{width:44,height:44,borderRadius:"50%",background:active?C.primary:r.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:active?"#fff":r.color,flexShrink:0}}>{r.init}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{r.name}</div>
                    <div style={{fontSize:11.5,color:C.muted,marginTop:1}}>{r.sub}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,background:r.labelBg,color:r.labelText}}>{r.label}</span>
                    {active&&<span style={{fontSize:10,fontWeight:600,color:C.primary}}>Active ✓</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{margin:"12px 16px 0",padding:"14px 16px",background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏢</div>
        <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>Fleming Realty Group</div><div style={{fontSize:11.5,color:C.faint}}>325 units · Camp Hill, PA</div></div>
      </div>
      <div style={{margin:"12px 16px 20px"}}>
        <button onClick={onSignOut} style={{width:"100%",background:"#fff",color:C.urgent.text,fontSize:13.5,fontWeight:700,padding:"13px",borderRadius:14,border:`1px solid ${C.urgent.border}`,cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
      </div>
    </div>
  );
}

// ── INSPECTION SCREEN ────────────────────────────────────────────────────────
const INSPECTION_ITEMS = [
  {id:"i1", category:"Exterior",  label:"Entry doors & locks functional",       critical:true },
  {id:"i2", category:"Exterior",  label:"Windows — no cracks or broken seals",  critical:false},
  {id:"i3", category:"Exterior",  label:"Exterior lighting working",             critical:false},
  {id:"i4", category:"Exterior",  label:"No visible water damage / staining",    critical:true },
  {id:"i5", category:"Kitchen",   label:"Appliances functioning",               critical:false},
  {id:"i6", category:"Kitchen",   label:"Faucet — no leaks, proper pressure",   critical:true },
  {id:"i7", category:"Kitchen",   label:"Cabinet doors / hinges intact",        critical:false},
  {id:"i8", category:"Bathroom",  label:"Toilet flushes correctly",             critical:true },
  {id:"i9", category:"Bathroom",  label:"Exhaust fan working",                  critical:false},
  {id:"i10",category:"Bathroom",  label:"No mold or mildew visible",            critical:true },
  {id:"i11",category:"HVAC",      label:"Thermostat responsive",                critical:true },
  {id:"i12",category:"HVAC",      label:"Vents clear and unobstructed",         critical:false},
  {id:"i13",category:"HVAC",      label:"Filter replaced",                      critical:false},
  {id:"i14",category:"Safety",    label:"Smoke detector functional",            critical:true },
  {id:"i15",category:"Safety",    label:"CO detector present and functional",   critical:true },
  {id:"i16",category:"Safety",    label:"Fire extinguisher in date",            critical:true },
  {id:"i17",category:"General",   label:"Walls — no major holes or damage",     critical:false},
  {id:"i18",category:"General",   label:"Flooring in good condition",           critical:false},
  {id:"i19",category:"General",   label:"Ceilings — no stains or damage",       critical:false},
  {id:"i20",category:"General",   label:"All lights functional",                critical:false},
];

const MOVEOUT_ITEMS = [
  {id:"m1",category:"General",  label:"Walls patched & repainted",        critical:false},
  {id:"m2",category:"General",  label:"Carpets professionally cleaned",   critical:false},
  {id:"m3",category:"Kitchen",  label:"Appliances cleaned & functional",  critical:true },
  {id:"m4",category:"Kitchen",  label:"Countertops undamaged",            critical:false},
  {id:"m5",category:"Bathroom", label:"No mold; grout & caulk intact",    critical:true },
  {id:"m6",category:"Keys",     label:"All keys & fobs returned",         critical:true },
];

// Employee-managed inspection templates (pre-populated checklists)
const DEFAULT_TEMPLATES = [
  {id:"t1", name:"Semi-Annual Standard", desc:"Full 20-point unit walkthrough", items:INSPECTION_ITEMS},
  {id:"t2", name:"Move-Out Inspection",  desc:"Turnover & deposit checklist",   items:MOVEOUT_ITEMS},
];

// Completed inspections the owner can view (read-only)
const INIT_INSPECTIONS = [
  {id:"IN-204", property:"812 Market St", scope:"Semi-annual · 18 units", date:"May 12, 2026", passed:16, failed:2, nextDate:"Nov 12, 2026", by:"Marcus J."},
  {id:"IN-198", property:"214 Walnut St", scope:"Semi-annual · 12 units", date:"Apr 3, 2026",  passed:20, failed:0, nextDate:"Oct 3, 2026",  by:"Marcus J."},
];

function InspectionScreen({onBack,templates=[],onManageTemplates,onInspectionDone,role,setRole}) {
  const PROPERTY = "330 Pine Ave";
  const [templateId, setTemplateId] = useState(templates[0]?.id);
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState({});
  const [photos, setPhotos] = useState({});
  const [nextDate, setNextDate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const template = templates.find(t=>t.id===templateId) || templates[0];
  const items = template?.items || [];
  const nextOptions = ["Oct 15, 2026","Nov 15, 2026","Dec 15, 2026","Jan 15, 2027"];

  const toggle = (id, val) => setChecks(prev => ({...prev, [id]: val}));
  const categories = [...new Set(items.map(i=>i.category))];
  const total = items.length;
  const done = Object.keys(checks).filter(k=>checks[k]!==undefined).length;
  const fails = Object.keys(checks).filter(k=>checks[k]==="fail").length;
  const pct = total ? Math.round((done/total)*100) : 0;
  const canSubmit = done>0 && !!nextDate;

  const submit = () => {
    if (!canSubmit) return;
    onInspectionDone && onInspectionDone({
      id: `IN-${String(Math.floor(Math.random()*900)+100)}`,
      property: PROPERTY,
      scope: template?.name || "Inspection",
      date: "Today",
      passed: done - fails,
      failed: fails,
      nextDate,
      by: "Marcus J.",
    });
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16}}>
        <div style={{fontSize:52}}>✅</div>
        <div style={{fontSize:18,fontWeight:700,color:C.text,textAlign:"center"}}>Inspection submitted</div>
        <div style={{fontSize:13.5,color:C.muted,textAlign:"center",lineHeight:1.6,maxWidth:260}}>
          Report saved. {fails > 0 ? `${fails} issue${fails>1?"s":""} flagged — work orders will be created automatically.` : "No issues found."}
        </div>
        {fails > 0 && (
          <div style={{background:C.urgent.bg,border:`1px solid ${C.urgent.border}`,borderRadius:12,padding:"12px 16px",width:"100%",textAlign:"center"}}>
            <div style={{fontSize:13,fontWeight:700,color:C.urgent.text}}>{fails} item{fails>1?"s":""} need attention</div>
            <div style={{fontSize:11.5,color:C.urgent.text,opacity:.8,marginTop:3}}>Work orders created & vendors notified</div>
          </div>
        )}
        <div style={{background:C.done.bg,border:`1px solid ${C.done.border}`,borderRadius:12,padding:"12px 16px",width:"100%",textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:700,color:C.done.text}}>✓ Owner notified</div>
          <div style={{fontSize:11.5,color:C.done.text,opacity:.85,marginTop:3}}>Next inspection scheduled for {nextDate}</div>
        </div>
        <button onClick={onBack} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(31,46,173,0.28)",marginTop:8}}>Back to orders</button>
      </div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Orders</span>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>Unit Inspection</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{PROPERTY} · {template?.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:700,color:pct===100?C.done.text:C.primary}}>{pct}%</div>
            <div style={{fontSize:10,color:C.faint}}>{done}/{total} items</div>
          </div>
        </div>
        <div style={{marginTop:10,height:4,background:C.border,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:pct===100?C.done.bar:C.primary,borderRadius:2,transition:"width .3s"}} />
        </div>
      </div>

      {/* Template picker */}
      <div style={{padding:"12px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint}}>Checklist template</span>
          <span onClick={onManageTemplates} style={{fontSize:11.5,fontWeight:700,color:C.primary,cursor:"pointer"}}>Manage templates →</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {templates.map(t=>(
            <div key={t.id} onClick={()=>{setTemplateId(t.id);setChecks({});setNotes({});setPhotos({});}} style={{flex:1,padding:"10px 12px",borderRadius:12,cursor:"pointer",border:templateId===t.id?`2px solid ${C.primary}`:`1px solid ${C.border}`,background:templateId===t.id?C.primaryLight:"#fff",boxShadow:templateId===t.id?"0 0 0 3px rgba(31,46,173,0.08)":"none"}}>
              <div style={{fontSize:12.5,fontWeight:700,color:templateId===t.id?C.primary:C.text}}>{t.name}</div>
              <div style={{fontSize:10.5,color:C.faint,marginTop:2}}>{t.items.length} items</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:C.faint,marginBottom:8,paddingLeft:2}}>{cat}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {items.filter(i=>i.category===cat).map(item => {
                const val = checks[item.id];
                return (
                  <div key={item.id} style={{background:"#fff",borderRadius:12,border:`1px solid ${val==="fail"?C.urgent.border:val==="pass"?C.done.border:C.border}`,padding:"11px 13px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:500,color:C.text,lineHeight:1.3}}>{item.label}</div>
                        {item.critical && <span style={{fontSize:9,fontWeight:700,color:C.urgent.text,letterSpacing:".06em",textTransform:"uppercase"}}>Critical</span>}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <div onClick={()=>toggle(item.id,"pass")} style={{width:32,height:32,borderRadius:8,background:val==="pass"?C.done.bg:"#F8FAFC",border:`1.5px solid ${val==="pass"?C.done.bar:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>✓</div>
                        <div onClick={()=>toggle(item.id,"fail")} style={{width:32,height:32,borderRadius:8,background:val==="fail"?C.urgent.bg:"#F8FAFC",border:`1.5px solid ${val==="fail"?C.urgent.bar:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>✗</div>
                      </div>
                    </div>
                    {val==="fail" && (
                      <div style={{marginTop:8}}>
                        <input
                          placeholder="Note the issue..."
                          value={notes[item.id]||""}
                          onChange={e=>setNotes(prev=>({...prev,[item.id]:e.target.value}))}
                          style={{width:"100%",border:`1px solid ${C.urgent.border}`,borderRadius:8,padding:"7px 10px",fontSize:12,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:8}}
                        />
                        {photos[item.id] ? (
                          <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:C.done.bg,border:`1px solid ${C.done.border}`}}>
                            <span style={{fontSize:13}}>📷</span>
                            <span style={{flex:1,fontSize:11.5,fontWeight:600,color:C.done.text}}>Photo attached · IMG_{item.id.toUpperCase()}.jpg</span>
                            <span onClick={()=>setPhotos(prev=>{const n={...prev};delete n[item.id];return n;})} style={{fontSize:11,fontWeight:700,color:C.muted,cursor:"pointer"}}>Remove</span>
                          </div>
                        ) : (
                          <div onClick={()=>setPhotos(prev=>({...prev,[item.id]:true}))} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 10px",borderRadius:8,border:`1.5px dashed ${C.urgent.border}`,background:"#fff",cursor:"pointer"}}>
                            <span style={{fontSize:13}}>📷</span>
                            <span style={{fontSize:11.5,fontWeight:600,color:C.urgent.text}}>Attach photo of issue</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Schedule next inspection — required before completion */}
        <div style={{background:"#fff",borderRadius:12,border:`1px solid ${nextDate?C.primary:C.border}`,padding:"13px 14px",boxShadow:"0 1px 2px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:4}}>Schedule next inspection <span style={{color:C.urgent.text}}>*</span></div>
          <div style={{fontSize:11.5,color:C.muted,marginBottom:8,lineHeight:1.4}}>Required before completing. The owner is notified of this date automatically.</div>
          <select value={nextDate} onChange={e=>setNextDate(e.target.value)} style={{width:"100%",border:`1px solid ${nextDate?C.primary:C.border}`,borderRadius:10,padding:"11px 12px",fontSize:13,fontFamily:"inherit",color:nextDate?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}>
            <option value="">Select next inspection date…</option>
            {nextOptions.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <button
          onClick={submit}
          style={{width:"100%",background:canSubmit?C.primary:"#E4E7EC",color:canSubmit?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:canSubmit?"pointer":"default",fontFamily:"inherit",marginTop:4,boxShadow:canSubmit?"0 2px 10px rgba(31,46,173,0.28)":"none"}}
        >
          {done===0?"Complete checklist to submit":!nextDate?"Schedule next inspection to submit":`Complete & confirm (${done}/${total} items)`}
        </button>
      </div>
    </div>
  );
}

// ── INSPECTION TEMPLATES (employee-managed) ──────────────────────────────────
function TemplatesScreen({onBack,templates,setTemplates,api,role,setRole}) {
  const [editing, setEditing] = useState(null); // template being created/edited
  const blankItem = () => ({id:`n${Math.floor(Math.random()*100000)}`, category:"General", label:"", critical:false});

  const startNew  = () => setEditing({id:`t${Math.floor(Math.random()*100000)}`, name:"", desc:"", items:[blankItem()], isNew:true});
  const startEdit = (t) => setEditing({...t, items:t.items.map(i=>({...i})), isNew:false});
  const remove    = (id) => { setTemplates(prev=>prev.filter(t=>t.id!==id)); api?.deleteTemplate(id).catch(()=>{}); };

  const save = () => {
    const cleanItems = editing.items.filter(i=>i.label.trim());
    if (!editing.name.trim() || !cleanItems.length) return;
    const rec = {id:editing.id, name:editing.name.trim(), desc:editing.desc.trim()||`${cleanItems.length} items`, items:cleanItems};
    setTemplates(prev => editing.isNew ? [...prev, rec] : prev.map(t=>t.id===rec.id?rec:t));
    if (editing.isNew) api?.createTemplate(rec).catch(()=>{}); else api?.updateTemplate(rec.id, rec).catch(()=>{});
    setEditing(null);
  };

  const setItem = (idx, patch) => setEditing(prev=>({...prev, items:prev.items.map((it,i)=>i===idx?{...it,...patch}:it)}));
  const addItem = () => setEditing(prev=>({...prev, items:[...prev.items, blankItem()]}));
  const delItem = (idx) => setEditing(prev=>({...prev, items:prev.items.filter((_,i)=>i!==idx)}));
  const CATS = ["Exterior","Kitchen","Bathroom","HVAC","Safety","General","Keys"];
  const editorValid = editing && editing.name.trim() && editing.items.some(i=>i.label.trim());

  // ── Editor view ──
  if (editing) return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={()=>setEditing(null)} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Cancel</span>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>{editing.isNew?"New template":"Edit template"}</div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Template name <span style={{color:C.urgent.text}}>*</span></div>
          <input value={editing.name} onChange={e=>setEditing(prev=>({...prev,name:e.target.value}))} placeholder="e.g. Annual Safety Check" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint}}>Checklist items</span>
            <span style={{fontSize:11,color:C.faint}}>{editing.items.filter(i=>i.label.trim()).length} items</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {editing.items.map((it,idx)=>(
              <div key={it.id} style={{background:"#fff",borderRadius:12,border:`1px solid ${C.border}`,padding:"11px 12px"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <input value={it.label} onChange={e=>setItem(idx,{label:e.target.value})} placeholder="Item to check…" style={{flex:1,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",fontSize:12.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
                  <span onClick={()=>delItem(idx)} style={{fontSize:16,color:C.faint,cursor:"pointer",flexShrink:0,padding:"0 2px"}}>✕</span>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <select value={it.category} onChange={e=>setItem(idx,{category:e.target.value})} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 8px",fontSize:11.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff"}}>
                    {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  <div onClick={()=>setItem(idx,{critical:!it.critical})} style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",padding:"5px 10px",borderRadius:20,border:`1px solid ${it.critical?C.urgent.border:C.border}`,background:it.critical?C.urgent.bg:"#fff"}}>
                    <span style={{width:14,height:14,borderRadius:4,background:it.critical?C.urgent.bar:"#fff",border:`1.5px solid ${it.critical?C.urgent.bar:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#fff",fontWeight:700}}>{it.critical?"✓":""}</span>
                    <span style={{fontSize:11,fontWeight:600,color:it.critical?C.urgent.text:C.muted}}>Critical</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div onClick={addItem} style={{marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px",borderRadius:10,border:`1.5px dashed ${C.border}`,cursor:"pointer",background:"#fff"}}>
            <span style={{fontSize:14,color:C.primary,fontWeight:700}}>+</span>
            <span style={{fontSize:12.5,fontWeight:700,color:C.primary}}>Add item</span>
          </div>
        </div>
        <button onClick={save} style={{width:"100%",background:editorValid?C.primary:"#E4E7EC",color:editorValid?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:editorValid?"pointer":"default",fontFamily:"inherit"}}>
          {editing.isNew?"Create template":"Save changes"}
        </button>
      </div>
    </div>
  );

  // ── List view ──
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 12px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Inspection</span>
          <span style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>Templates</span>
          <button onClick={startNew} style={{background:C.primary,color:"#fff",fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>+ New</button>
        </div>
        <div style={{fontSize:11.5,color:C.faint}}>Pre-populated checklists your team can reuse</div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {templates.map(t=>(
          <div key={t.id} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0,paddingRight:8}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{t.name}</div>
                <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{t.desc} · {t.items.length} items</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>startEdit(t)} style={{background:C.primaryLight,color:C.primary,fontSize:11.5,fontWeight:700,padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>Edit</button>
                <button onClick={()=>remove(t.id)} style={{background:C.urgent.bg,color:C.urgent.text,fontSize:11.5,fontWeight:700,padding:"6px 12px",borderRadius:20,border:`1px solid ${C.urgent.border}`,cursor:"pointer",fontFamily:"inherit"}}>Delete</button>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>
              {[...new Set(t.items.map(i=>i.category))].map(c=>(
                <span key={c} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#F2F3F7",color:C.muted}}>{c}</span>
              ))}
            </div>
          </div>
        ))}
        {templates.length===0 && (
          <div style={{textAlign:"center",padding:"32px 16px",color:C.faint,fontSize:13}}>No templates yet. Tap “+ New” to create one.</div>
        )}
      </div>
    </div>
  );
}

// ── NEW WORK ORDER SCREEN ────────────────────────────────────────────────────
function NewWorkOrderScreen({me,properties,onBack,onCreated,role,setRole}) {
  const isResident = role==="resident";
  const residentUnit = me?.entity?.unit && me.entity.unit !== "Pending assignment" ? me.entity.unit : "";
  const residentAddr = me?.entity?.address && me.entity.address !== "—" ? me.entity.address : "";
  const [title,setTitle]       = useState("");
  const [unit,setUnit]         = useState(isResident?residentUnit:"");
  const [address,setAddress]   = useState(isResident?residentAddr:"");
  const [category,setCategory] = useState("");
  const [urgency,setUrgency]   = useState("");
  const [notes,setNotes]       = useState("");
  const [submitted,setSubmitted] = useState(false);

  const categories = ["HVAC","Plumbing","Electrical","Security","General","Inspection","Move-out","Landscaping"];
  const urgencies  = [{key:"urgent",label:"Urgent — same day",color:C.urgent},{key:"pending",label:"Standard — within 3 days",color:C.pending},{key:"scheduled",label:"Scheduled — pick a date",color:C.scheduled}];
  // Real portfolios have hundreds of properties; a 3-item hardcoded list made it
  // impossible to file a work order against any actual address.
  const addresses = (properties?.length
    ? [...new Set(properties.map(p=>p.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
    : ["214 Walnut St","330 Pine Ave","812 Market St"]);

  const canSubmit = title.trim() && unit.trim() && address && category && urgency;

  const submit = () => {
    if (!canSubmit) return;
    const newOrder = {
      id: `WO-${String(Math.floor(Math.random()*9000)+1000)}`,
      title: title.trim(),
      unit: unit.trim(),
      address,
      status: urgency,
      vendorId: null,
      reported: "Just now",
      category,
      residentName: isResident ? (me?.entity?.name || "Sarah M.") : null,
      notes: notes.trim() || "New work order submitted via app.",
    };
    onCreated(newOrder);
    setSubmitted(true);
    setTimeout(()=>onBack(), 1600);
  };

  if (submitted) return (
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:12}}>
        <div style={{fontSize:48}}>🔧</div>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>{isResident?"Request submitted!":"Work order created!"}</div>
        <div style={{fontSize:13,color:C.muted,textAlign:"center",lineHeight:1.6}}>{isResident?`"${title}" was sent directly to your property manager (Marcus J.). You'll be notified when a vendor is assigned.`:`${title} has been logged and is now visible in the orders list.`}</div>
      </div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Cancel</span>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:"-.02em",color:C.text}}>{isResident?"Submit a request":"New work order"}</div>
        {isResident&&<div style={{fontSize:11.5,color:C.faint,marginTop:2}}>Goes directly to your property manager</div>}
      </div>

      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>

        {isResident&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",borderRadius:12,background:C.primaryLight,border:`1px solid ${C.primary}22`}}>
            <span style={{fontSize:16}}>🏢</span>
            <span style={{fontSize:11.5,color:C.primary,fontWeight:600,lineHeight:1.4}}>Fleming Realty (Marcus J.) will receive this request and assign a vendor.</span>
          </div>
        )}

        {/* Title */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Issue title <span style={{color:C.urgent.text}}>*</span></div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. HVAC not cooling, Leaking faucet..." style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",fontSize:13.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
        </div>

        {/* Property + Unit */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Property <span style={{color:C.urgent.text}}>*</span></div>
            <select value={address} onChange={e=>setAddress(e.target.value)} style={{width:"100%",border:`1px solid ${address?C.primary:C.border}`,borderRadius:12,padding:"12px 10px",fontSize:13,fontFamily:"inherit",color:address?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}>
              <option value="">Select...</option>
              {addresses.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Unit <span style={{color:C.urgent.text}}>*</span></div>
            <input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="e.g. Unit 4B" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 10px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
          </div>
        </div>

        {/* Category */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:8}}>Category <span style={{color:C.urgent.text}}>*</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {categories.map(c=>(
              <div key={c} onClick={()=>setCategory(c)} style={{padding:"7px 14px",borderRadius:20,border:category===c?`2px solid ${C.primary}`:`1px solid ${C.border}`,background:category===c?C.primaryLight:"#fff",color:category===c?C.primary:C.muted,fontSize:12.5,fontWeight:category===c?700:500,cursor:"pointer"}}>
                {c}
              </div>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:8}}>Priority <span style={{color:C.urgent.text}}>*</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            {urgencies.map(u=>(
              <div key={u.key} onClick={()=>setUrgency(u.key)} style={{padding:"11px 14px",borderRadius:12,border:urgency===u.key?`2px solid ${u.color.bar}`:`1px solid ${C.border}`,background:urgency===u.key?u.color.bg:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:u.color.bar,flexShrink:0}} />
                <span style={{fontSize:13,fontWeight:urgency===u.key?700:500,color:urgency===u.key?u.color.text:C.text}}>{u.label}</span>
                {urgency===u.key && <span style={{marginLeft:"auto",fontSize:12,color:u.color.text}}>✓</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.faint,marginBottom:6}}>Additional notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any extra context for the vendor..." rows={3} style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",resize:"none",boxSizing:"border-box"}} />
        </div>

        <button onClick={submit} style={{width:"100%",background:canSubmit?C.primary:"#E4E7EC",color:canSubmit?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:canSubmit?"pointer":"default",fontFamily:"inherit"}}>
          {canSubmit?"Create work order →":"Fill in required fields"}
        </button>
      </div>
    </div>
  );
}

// ── VENDOR HOME ───────────────────────────────────────────────────────────────
function VendorHome({me,orders,onOrder,role,setRole}) {
  const myVendorId = me?.entity?.vendorId ?? 1;
  // vendor sees orders assigned to their own vendor id (identity-driven)
  const myJobs = orders.filter(o=>o.vendorId===myVendorId);
  const active = myJobs.filter(o=>["urgent","pending","scheduled"].includes(o.status));
  const review = myJobs.filter(o=>o.status==="review");
  const done = myJobs.filter(o=>o.status==="done");
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Good morning 👋</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-.02em"}}>{me?.entity?.name || "Daflure HVAC"}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>5 active jobs from Fleming Realty</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>My jobs</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{n:active.length,label:"Active",...C.pending},{n:review.length,label:"In review",...C.review},{n:done.length,label:"Done",...C.done}].map(s=>(
            <div key={s.label} style={{textAlign:"center",padding:"8px 6px",borderRadius:10,background:s.bg,border:`1px solid ${s.border}`}}>
              <div style={{fontSize:24,fontWeight:700,color:s.text,lineHeight:1}}>{s.n}</div>
              <div style={{fontSize:10,fontWeight:600,color:s.text,marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Jobs to complete</span>
        <span style={{fontSize:11,color:C.faint}}>{active.length} active</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px 20px"}}>
        {myJobs.map(o=>(
          <div key={o.id} onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{fontSize:13.5,fontWeight:700,color:C.text,flex:1,paddingRight:8,lineHeight:1.3}}>{o.title}</div>
                <Badge status={o.status} />
              </div>
              <div style={{fontSize:11.5,color:C.muted,marginBottom:8}}>{[o.address,o.unit,o.reported].filter(Boolean).join(" · ")}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:11,color:C.faint}}>{o.category}</span>
                <span style={{fontSize:11,color:o.status==="done"?C.done.text:o.status==="review"?C.review.text:C.primary,fontWeight:600}}>
                  {o.status==="done"?"Closed":o.status==="review"?"In review":"Complete job →"}
                </span>
              </div>
            </div>
            <div style={{height:3,background:SM[o.status].bar}} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APPLICANT HOME ──────────────────────────────────────────────────────────
function ApplicantHome({role,setRole}) {
  const [coEmail,setCoEmail]=useState("");
  const [invited,setInvited]=useState(false);
  const invite=()=>{ if(coEmail.trim()) setInvited(true); };
  const steps = [
    {label:"Application submitted",done:true, date:"Jun 5"},
    {label:"Documents verified",   done:true, date:"Jun 6"},
    {label:"Background check",      done:true, date:"Jun 8"},
    {label:"Under review",          done:false,date:"In progress",active:true},
    {label:"Decision",             done:false,date:"Pending"},
    {label:"Move-in scheduling",    done:false,date:"Pending"},
  ];
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Hi Jordan 👋</div>
        <div style={{fontSize:22,fontWeight:800,color:C.text,letterSpacing:"-.02em"}}>Jordan K.</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Application #APP-2026-0142</div>
      </div>

      {/* Status banner */}
      <div style={{margin:"16px 16px 0",background:"linear-gradient(135deg,#0958D9,#3B82F6)",borderRadius:18,padding:"18px",color:"#fff",boxShadow:"0 6px 20px rgba(9,88,217,0.28)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",opacity:.8,marginBottom:4}}>Application status</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:2}}>Under Review</div>
        <div style={{fontSize:12,opacity:.85}}>330 Pine Ave, Unit 2C · $1,200/mo</div>
      </div>

      {/* Verification email confirmation */}
      <div style={{margin:"12px 16px 0",background:"#fff",borderRadius:16,border:`1px solid ${C.done.border}`,padding:"13px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 2px rgba(16,24,40,0.04)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:C.done.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✉️</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>Email verified ✓</div>
          <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Verification sent to jordan.k@email.com on submission</div>
        </div>
      </div>

      {/* Invite an additional applicant */}
      <div style={{margin:"12px 16px 0",background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:invited?0:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>👥</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>Add a co-applicant</div>
            <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Applying with a roommate or partner? Invite them.</div>
          </div>
        </div>
        {invited ? (
          <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,background:C.done.bg,border:`1px solid ${C.done.border}`}}>
            <span style={{fontSize:14}}>✓</span>
            <span style={{fontSize:12,fontWeight:600,color:C.done.text}}>Invitation sent to {coEmail}</span>
          </div>
        ) : (
          <div style={{display:"flex",gap:8}}>
            <input value={coEmail} onChange={e=>setCoEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&invite()} placeholder="co-applicant@email.com" style={{flex:1,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",fontSize:12.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
            <button onClick={invite} style={{background:coEmail.trim()?C.primary:C.border,color:coEmail.trim()?"#fff":C.faint,fontSize:12.5,fontWeight:700,padding:"10px 14px",borderRadius:10,border:"none",cursor:coEmail.trim()?"pointer":"default",fontFamily:"inherit",flexShrink:0}}>Invite</button>
          </div>
        )}
      </div>

      {/* Progress tracker */}
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"18px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.faint,marginBottom:14}}>Your progress</div>
        {steps.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:i<steps.length-1?14:0}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:s.done?C.done.bar:s.active?"#0958D9":C.border,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:s.active?"0 0 0 4px #EFF6FF":"none"}}>
                {s.done&&<span style={{fontSize:11,color:"#fff",fontWeight:700}}>✓</span>}
                {s.active&&<div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}} />}
              </div>
              {i<steps.length-1&&<div style={{width:2,height:20,background:s.done?C.done.bar:C.border,marginTop:3}} />}
            </div>
            <div style={{paddingTop:1,flex:1}}>
              <div style={{fontSize:13.5,fontWeight:s.done||s.active?600:400,color:s.done||s.active?C.text:C.faint}}>{s.label}</div>
              <div style={{fontSize:11.5,color:s.active?"#0958D9":C.faint,fontWeight:s.active?600:400}}>{s.date}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Notifications toggle */}
      <div style={{margin:"16px 16px 20px",background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🔔</div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>Notifications on</div>
          <div style={{fontSize:11.5,color:C.faint}}>We'll text you the moment there's a decision</div>
        </div>
        <div style={{width:40,height:24,borderRadius:12,background:C.done.bar,position:"relative",flexShrink:0}}>
          <div style={{position:"absolute",top:2,right:2,width:20,height:20,borderRadius:"50%",background:"#fff"}} />
        </div>
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function PhoneApp({ initial, api, onSignOut, onViewAs, canViewAs = true, onReload }) {
  const me = initial.me;
  const role = me.role;
  const [screen,setScreen]            = useState("home");
  const [selectedOrder,setSelectedOrder] = useState(null);
  const [orders,setOrders]            = useState(initial.orders || []);
  const [assigningOrder,setAssigningOrder] = useState(null);
  const [templates,setTemplates]      = useState(initial.templates || []);
  const [inspections,setInspections]  = useState(initial.inspections || []);

  const handleOrder  = (o) => { setSelectedOrder(o); setScreen("detail"); };
  const handleAssign = (o) => { setAssigningOrder(o); setScreen("assign"); };
  const handleNav    = (s) => { setScreen(s); setSelectedOrder(null); setAssigningOrder(null); };
  // Role switching now re-authenticates as the seeded role account (demo only) and
  // reloads scoped data. In live mode a user has one role, so this is disabled.
  const handleSetRole= (r) => { if (canViewAs && onViewAs) onViewAs(r); };
  const handleCreated= (o) => { setOrders(prev=>[o,...prev]); api?.createOrder(o).catch(()=>{}); };
  const handleInspectionDone = (rec) => { setInspections(prev=>[rec,...prev]); api?.addInspection(rec).catch(()=>{}); };
  const updateOrderLocal = (id, patch) => { setOrders(prev=>prev.map(o=>o.id===id?{...o,...patch}:o)); api?.updateOrder(id, patch).catch(()=>{}); };

  const homeScreen = role==="employee"
    ? <EmployeeHome me={me} orders={orders} onNav={handleNav} onOrder={handleOrder} role={role} setRole={handleSetRole} />
    : role==="resident"
    ? <ResidentHome me={me} api={api} orders={orders} onOrder={handleOrder} onCreated={handleCreated} onNav={handleNav} submissionsReachOffice={initial.submissionsReachOffice!==false} role={role} setRole={handleSetRole} />
    : role==="vendor"
    ? <VendorHome me={me} orders={orders} onOrder={handleOrder} role={role} setRole={handleSetRole} />
    : role==="applicant"
    ? <ApplicantHome me={me} role={role} setRole={handleSetRole} />
    : <OwnerHome inspections={inspections} balances={initial.balances} properties={initial.properties} role={role} setRole={handleSetRole} />;

  const sharedProps = {role, setRole:handleSetRole, canViewAs, me, properties:initial.properties};
  const navActive = ["detail","assign","inspection","neworder","templates"].includes(screen) ? "orders" : screen;

  // One place that knows what is real: the live vendor roster, and whether
  // writes/notifications actually reach anywhere (they don't while Buildium is
  // read-only, so the UI must not claim otherwise).
  const live = {
    vendors: initial.vendors?.length ? initial.vendors : VENDORS,
    properties: initial.properties || [],
    syncs: initial.submissionsReachOffice !== false,
    notificationsEnabled: initial.messagingEnabled !== false,
  };

  return (
    <LiveCtx.Provider value={live}>
    <div style={{background:"#0D0D0D",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"0"}}>
      {/* Fills the screen on a real phone; keeps the demo frame on desktop. */}
      <div className="fl-app" style={{width:"min(390px,100vw)",height:"min(844px,100dvh)",background:C.bg,overflow:"hidden",display:"flex",flexDirection:"column",fontFamily:"'Plus Jakarta Sans',-apple-system,'SF Pro Text','Segoe UI',sans-serif",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale",position:"relative"}}>
        <style>{`
          /* Desktop keeps the phone-frame presentation for demos; a real phone
             gets the full screen instead of a 390px letterbox. */
          .fl-app{border-radius:44px;box-shadow:0 0 0 10px #1C1C1E,0 0 0 12px #3A3A3C,0 40px 100px rgba(0,0,0,.8)}
          @media (max-width:460px){.fl-app{border-radius:0;box-shadow:none}}
          /* Comfortable tap targets for the small back/action links. */
          .fl-tap{display:inline-flex;align-items:center;min-height:34px;padding:4px 8px 4px 0}
          .fl-app *{-webkit-tap-highlight-color:transparent;scrollbar-width:none}
          .fl-app ::-webkit-scrollbar{display:none}
          .fl-app button,.fl-app [style*="cursor: pointer"],.fl-app [style*="cursor:pointer"]{transition:transform .14s ease,opacity .14s ease,box-shadow .14s ease,background-color .14s ease,border-color .14s ease,color .14s ease}
          .fl-app button:active,.fl-app [style*="cursor: pointer"]:active,.fl-app [style*="cursor:pointer"]:active{transform:scale(.97)}
          .fl-app input:focus:not([style*="transparent"]),.fl-app textarea:focus,.fl-app select:focus{border-color:${C.primary} !important;box-shadow:0 0 0 3px rgba(31,46,173,.12)}
        `}</style>
        {screen==="home"       && homeScreen}
        {screen==="orders"     && <OrdersScreen      orders={orders} onOrder={handleOrder} onNav={handleNav} onNewOrder={()=>setScreen("neworder")} onInspection={()=>setScreen("inspection")} {...sharedProps} />}
        {screen==="detail"     && selectedOrder   && <DetailScreen   order={selectedOrder}  orders={orders} setOrders={setOrders} onUpdateOrder={updateOrderLocal} onBack={()=>setScreen("orders")} onAssign={handleAssign} {...sharedProps} />}
        {screen==="assign"     && assigningOrder  && <AssignScreen   order={assigningOrder} orders={orders} setOrders={setOrders} onUpdateOrder={updateOrderLocal} onBack={()=>setScreen("detail")} {...sharedProps} />}
        {screen==="messages"   && <MessagesScreen    messages={initial.messages} messagingEnabled={initial.messagingEnabled!==false} onNav={handleNav} {...sharedProps} />}
        {screen==="profile"    && <ProfileScreen     me={me} role={role} setRole={handleSetRole} onNav={handleNav} onSignOut={onSignOut} canViewAs={canViewAs} />}
        {screen==="inspection" && <InspectionScreen  onBack={()=>setScreen("orders")} templates={templates} onManageTemplates={()=>setScreen("templates")} onInspectionDone={handleInspectionDone} {...sharedProps} />}
        {screen==="templates"  && <TemplatesScreen   onBack={()=>setScreen("inspection")} templates={templates} setTemplates={setTemplates} api={api} {...sharedProps} />}
        {screen==="neworder"   && <NewWorkOrderScreen onBack={()=>setScreen("orders")} onCreated={handleCreated} {...sharedProps} />}
        <NavBar active={navActive} onNav={handleNav} role={role} />
      </div>
    </div>
    </LiveCtx.Provider>
  );
}
