"use client";
import { useState, useEffect, useRef, createContext, useContext } from "react";
import Icon from "@/components/ui/Icon";
import PhotoCapture, { StoredPhoto } from "@/components/ui/PhotoCapture";

// Live Buildium data that deep children need without threading props through
// every screen: the real vendor roster (100+, vs the 5-company demo list) and
// whether writes/notifications actually reach anything yet.
const LiveCtx = createContext(null);
const useLive = () => useContext(LiveCtx) || {};

// Design tokens — Fleming Realty brand guide. Mirrors globals.css for the
// inline-styled components ported from the demo.
//
// Gold (#C8A15A) is measured at 2.12:1 on sand and 2.41:1 on white, so it never
// carries small text on a light surface. It appears on navy (7.12:1), as rules
// and borders, and as icon accents.
const C = {
  primary:"#0D1B33", primaryHover:"#071223", primaryLight:"#E7E9ED",
  gold:"#C8A15A", goldSoft:"#F5EEE1", goldDeep:"#8A6828",
  slate:"#4A6A80",
  bg:"#F2F0EB", card:"#fff", sunken:"#FAF8F4",
  border:"#E5E1D8", borderStrong:"#D3CEC2",
  text:"#0D1B33", body:"#333333", muted:"#4A6A80", faint:"#4A6A80",
  urgent:   {bg:"#FDF2F0",text:"#B91C1C",border:"#F3D3CD",bar:"#B91C1C"},
  pending:  {bg:"#FBF3E8",text:"#B45309",border:"#EDDBBF",bar:"#B45309"},
  scheduled:{bg:"#EEF2FB",text:"#1D4ED8",border:"#CBD8F0",bar:"#1D4ED8"},
  review:   {bg:"#F3F0FA",text:"#6D28D9",border:"#DCD3F0",bar:"#6D28D9"},
  done:     {bg:"#EFF6F0",text:"#15803D",border:"#C8E0CD",bar:"#15803D"},
  // Warm-tinted depth so cards sit on sand instead of floating on cool grey.
  shadowSm:"0 1px 2px rgba(13,27,51,.05), 0 1px 3px rgba(13,27,51,.03)",
  shadow:"0 1px 2px rgba(13,27,51,.05), 0 4px 12px rgba(13,27,51,.07)",
  shadowLg:"0 2px 4px rgba(13,27,51,.05), 0 12px 28px rgba(13,27,51,.11)",
  shadowBrand:"0 2px 6px rgba(13,27,51,.22), 0 10px 24px rgba(13,27,51,.26)",
  r:{sm:8, md:12, lg:16, xl:20},
  display:"var(--font-display), Georgia, serif",
};

// Role colours drawn from the brand palette rather than arbitrary hues. Every
// pairing below was contrast-checked: white initials on the avatar colour and
// the label text on its own soft background both clear 4.5:1.
const ROLES = {
  employee:{key:"employee",name:"Marcus J.",sub:"Leasing & Inspections",init:"M",color:"#0D1B33",label:"Employee", labelBg:"#E7E9ED",labelText:"#0D1B33",homeIcon:"grid"},
  vendor:  {key:"vendor",  name:"Daflure HVAC",sub:"HVAC · Plumbing Vendor",init:"Z",color:"#333333",label:"Vendor",  labelBg:"#EDEBE7",labelText:"#333333",homeIcon:"wrench"},
  resident:{key:"resident",name:"Sarah M.", sub:"Unit 4B · 214 Walnut St",init:"S",color:"#7C5D24",label:"Resident",labelBg:"#F5EEE1",labelText:"#7C5D24",homeIcon:"house"},
  owner:   {key:"owner",   name:"Robert H.",sub:"Portfolio · 3 Properties",init:"R",color:"#4A6A80",label:"Owner",   labelBg:"#EAF0F3",labelText:"#4A6A80",homeIcon:"building"},
  applicant:{key:"applicant",name:"Jordan K.",sub:"Prospective Resident",init:"J",color:"#2C4A5E",label:"Applicant",labelBg:"#E8EFF3",labelText:"#2C4A5E",homeIcon:"clipboard"},
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
    return <img src={v.logo} alt={v.name} onError={()=>setImgErr(true)} style={{width:size,height:size,borderRadius:"50%",objectFit:"contain",background:"#fff",border:"1px solid #E5E1D8",flexShrink:0,padding:2}} />;
  }
  return <div style={{width:size,height:size,borderRadius:"50%",background:v?v.color:"#B0B5C3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size<=18?7:size<=24?9:11,fontWeight:700,color:"#fff",flexShrink:0,letterSpacing:"-.5px"}}>{v?v.initials:"?"}</div>;
};

// The broker's own photo of a building, fetched only once the card scrolls into
// view — each one costs two Buildium requests against a 10/s limit, so loading
// 25 at once would starve the rest of the app.
//
// Where no photo exists (~40% of the portfolio) this stays a typographic tile
// carrying the property's own initials. It deliberately does NOT fall back to
// stock architecture: a handsome building that isn't theirs is a lie a resident
// or owner would spot immediately.
function PropertyPhoto({propertyId,name,height=104}) {
  // The endpoint serves the bytes and 404s when there is no photo, so the <img>
  // can point straight at it: onError keeps the tile. Handing the browser
  // Buildium's own signed link does not work — those expire after 302 seconds.
  const [src,setSrc]       = useState(null);
  const [loaded,setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    if (propertyId==null||!ref.current) return;
    const show=()=>setSrc(`/api/buildium/property-image?propertyId=${encodeURIComponent(propertyId)}`);
    if (typeof IntersectionObserver==="undefined") { show(); return; }
    const io=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting)){ io.disconnect(); show(); } },{rootMargin:"250px"});
    io.observe(ref.current);
    return ()=>io.disconnect();
  },[propertyId]);

  // Strip a leading street number so the initials read as the street, not "12".
  const initials=(String(name||"").replace(/^[\d\s\-–—]+/,"").trim().slice(0,2).toUpperCase())||"FR";

  return (
    <div ref={ref} style={{height,background:`linear-gradient(135deg,${C.primary},#2C4A5E)`,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {!loaded&&(
        <span style={{fontFamily:C.display,fontSize:32,fontWeight:600,letterSpacing:".1em",color:"rgba(255,255,255,.26)",userSelect:"none"}}>{initials}</span>
      )}
      {src&&(
        // eslint-disable-next-line @next/next/no-img-element -- proxied, auth-gated, not a static asset
        <img src={src} alt="" onLoad={()=>setLoaded(true)} onError={()=>setSrc(null)}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:loaded?1:0,transition:"opacity .4s ease"}} />
      )}
      {/* Real photographs vary wildly; a scrim keeps anything laid over them readable. */}
      {loaded&&<div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(13,27,51,0) 50%,rgba(13,27,51,.5) 100%)"}} />}
    </div>
  );
}

const VendorChip = ({vendorId,small}) => {
  const {vendors=VENDORS} = useLive();
  const v = vendors.find(v=>v.id===vendorId);
  return (
    <div style={{display:"flex",alignItems:"center",gap:5,background:"#FAF8F4",padding:small?"3px 8px 3px 4px":"4px 10px 4px 5px",borderRadius:20,border:"1px solid #E5E1D8"}}>
      <VendorAvatar v={v} size={small?16:20} />
      <span style={{fontSize:small?10:11,color:"#5A5F72",fontWeight:500}}>{v?v.name:"Unassigned"}</span>
    </div>
  );
};

// ── ROLE SWITCHER SHEET ───────────────────────────────────────────────────────
const RoleSwitcherSheet = ({role,setRole,onClose}) => (
  <>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(10,15,30,0.5)",backdropFilter:"blur(3px)",WebkitBackdropFilter:"blur(3px)",zIndex:50,borderRadius:36}} />
    <div className="fl-sheet" style={{position:"absolute",bottom:0,left:0,right:0,background:"#fff",borderRadius:"24px 24px 0 0",zIndex:51,paddingBottom:28,boxShadow:"0 -12px 48px rgba(10,15,30,0.25)"}}>
      <div style={{display:"flex",justifyContent:"center",padding:"12px 0 4px"}}>
        <div style={{width:40,height:5,borderRadius:3,background:"#D6DAE1"}} />
      </div>
      <div style={{padding:"6px 20px 14px",borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint}}>Switch view</div>
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
      <div className="fl-safe-top" style={{background:"#fff",padding:"12px 20px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"relative",zIndex:10,flexShrink:0}}>
        <span className="fl-faux-status" style={{fontSize:13,fontWeight:600,color:C.text}}>9:41</span>
        <div onClick={()=>CAN_SWITCH_ROLES&&setOpen(true)} style={{display:"flex",alignItems:"center",gap:7,background:p.labelBg,border:`1px solid ${p.labelText}30`,padding:"5px 12px 5px 7px",borderRadius:20,cursor:CAN_SWITCH_ROLES?"pointer":"default",userSelect:"none",boxShadow:"0 1px 3px rgba(16,24,40,0.08)"}}>
          <div style={{width:20,height:20,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{p.init}</div>
          <span style={{fontSize:12,fontWeight:700,color:p.labelText,letterSpacing:".01em"}}>{p.label}</span>
          {CAN_SWITCH_ROLES && <span style={{fontSize:9,color:p.labelText,opacity:.65}}>▾</span>}
        </div>
        <span className="fl-faux-status" style={{fontSize:11,color:C.text}}>●●●● ⬛</span>
      </div>
      {open && CAN_SWITCH_ROLES && <RoleSwitcherSheet role={role} setRole={setRole} onClose={()=>setOpen(false)} />}
    </>
  );
};

// ── NAV BAR ───────────────────────────────────────────────────────────────────
const NavBar = ({active,onNav,role}) => {
  const p = ROLES[role];
  const items = [{id:"home",icon:p.homeIcon,label:"Home"},{id:"orders",icon:"wrench",label:"Orders"},{id:"messages",icon:"chat",label:"Messages"},{id:"profile",icon:"user",label:"Profile"}];
  return (
    <div className="fl-safe-bottom" style={{background:"#fff",borderTop:`1px solid ${C.border}`,boxShadow:"0 -4px 16px rgba(16,24,40,0.05)",display:"grid",gridTemplateColumns:"repeat(4,1fr)",padding:"8px 0 18px",flexShrink:0}}>
      {items.map(it=>{
        const on = active===it.id;
        return (
        // 44px minimum target height per the mobile touch guideline.
        <div key={it.id} onClick={()=>onNav(it.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer",minHeight:44,justifyContent:"center",paddingTop:2}}>
          {/* Active tab reads through weight + colour, not a second colour system. */}
          <Icon name={it.icon} size={21} strokeWidth={on?2.1:1.75} style={{color:on?C.primary:C.faint}} />
          <span style={{fontSize:10,fontWeight:on?700:600,letterSpacing:".01em",color:on?C.primary:C.faint}}>{it.label}</span>
          {on && <div style={{width:4,height:4,borderRadius:"50%",background:C.gold}} />}
        </div>
        );
      })}
    </div>
  );
};

// ── EMPLOYEE HOME ─────────────────────────────────────────────────────────────
function EmployeeHome({me,orders,onNav,onOrder,role,setRole}) {
  const {vendors=[]}=useLive();
  const vendorCount=vendors.length;
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
        <div style={{fontSize:25,fontWeight:600,color:C.text,letterSpacing:"-.005em",fontFamily:C.display,lineHeight:1.15}}>{me?.entity?.name||me?.email||"Employee"}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>{[today,me?.entity?.sub].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Today's pulse</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{n:urgent.length,label:"Urgent",...C.urgent},{n:open.length,label:"Open",...C.pending},{n:done.length,label:"Done",...C.done}].map(s=>(
            <div key={s.label} style={{textAlign:"center",padding:"8px 6px",borderRadius:10,background:s.bg,border:`1px solid ${s.border}`}}>
              <div style={{fontSize:26,fontWeight:600,color:s.text,lineHeight:1,fontFamily:C.display}}>{s.n}</div>
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
          <div key={o.id} className="fl-rise fl-card" onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
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
          {icon:"wrench",label:"New work order",sub:"Log maintenance",cb:()=>onNav("orders")},
          {icon:"clipboard",label:"Inspections",sub:"Reports & photos",cb:()=>onNav("inspections")},
          // Named the demo vendor regardless of the real roster (100+ live).
          {icon:"chat",label:"Message vendor",sub:vendorCount?`${vendorCount} on file`:"Vendor directory",cb:()=>onNav("messages")},
          {icon:"chart",label:"Owner report",sub:"Send update",cb:()=>onNav("profile")},
        ].map(q=>(
          <div key={q.label} className="fl-rise fl-card" onClick={q.cb} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:"14px 15px",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{width:38,height:38,borderRadius:12,background:C.goldSoft,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:11}}><Icon name={q.icon} size={19} style={{color:C.primary}} /></div>
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
  // Fell back to the demo resident's name, so a real resident whose Buildium
  // record has no name was greeted as "Sarah M."
  const myName = me?.entity?.name || me?.email || "Resident";
  const firstName = myName.split(" ")[0];
  // Server already scopes to this resident (by Buildium tenant id when available);
  // re-filtering by name here would drop their own orders when the requestor name
  // on the ticket differs from the tenant record (e.g. a middle initial).
  const myOrders = orders;
  const openCount = myOrders.filter(o=>o.status!=="done").length;
  // "Pending assignment" means their signup email isn't linked to a Buildium unit.
  const isLinked = me?.matched !== false && me?.entity?.unit && me.entity.unit !== "Pending assignment";

  const categoryColor = {
    HVAC:"#0D1B33", Plumbing:"#0958D9", Electrical:"#B45309",
    Security:"#B91C1C", General:"#15803D", Appliance:"#6D28D9", Other:"#4A6A80"
  };
  const urgencyMeta = {
    urgent:   {label:"Urgent",    ...C.urgent},
    pending:  {label:"Standard",  ...C.pending},
    scheduled:{label:"Low",       ...C.scheduled},
  };



  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Hi {firstName} 👋</div>
        <div style={{fontSize:25,fontWeight:600,color:C.text,letterSpacing:"-.005em",fontFamily:C.display,lineHeight:1.15}}>{myName}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>{isLinked?[me.entity.unit,me.entity.address].filter(x=>x&&x!=="—"&&x!=="-").join(" · "):"Unit not linked yet"}</div>
      </div>

      {/* Pending-assignment guidance: their email isn't linked to a unit yet. */}
      {!isLinked && (
        <div style={{margin:"16px 16px 0",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:16,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
          <Icon name="info" size={18} style={{color:C.pending.text,marginTop:1}} />
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
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>My lease</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[
            {label:"Lease ends", val:fmtDate(me?.entity?.leaseEnd)},
            {label:"Monthly rent", val:me?.entity?.rent?`$${Number(me.entity.rent).toLocaleString("en-US")}`:"—"},
            {label:"Status", val:me?.entity?.leaseStatus||"—"},
            {label:"Unit", val:isLinked?(me?.entity?.unit||"—"):"—"},
          ].map(s=>{
            const known=s.val&&s.val!=="—";
            return (
              <div key={s.label} style={{padding:"10px 12px",borderRadius:10,background:known?"#FAF8F4":"#FBFBFC",border:`1px solid ${C.border}`}}>
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
          <div key={o.id} className="fl-rise fl-card" onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
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

      {/* Report an issue — goes straight to the request form. The broker runs
          his own AI receptionist, so this app does not add a second one. */}
      <div style={{padding:"16px 16px 20px"}}>
        <div onClick={()=>onNav && onNav("neworder")} className="fl-press" style={{background:"linear-gradient(135deg,#0D1B33,#2C4A5E)",borderRadius:18,padding:"18px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:C.shadowBrand}}>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(200,161,90,0.18)",border:"1px solid rgba(200,161,90,0.45)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="wrench" size={21} style={{color:C.gold}} /></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14.5,fontWeight:700,color:"#fff",marginBottom:2}}>Report an issue</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.75)"}}>
              {submissionsReachOffice ? "Send a maintenance request to your property manager" : "Log a request here — for anything urgent, call the office"}
            </div>
          </div>
          <Icon name="caretRight" size={18} style={{color:"rgba(255,255,255,0.6)"}} />
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  );
}

// ── OWNER HOME ────────────────────────────────────────────────────────────────
function OwnerHome({me,inspections=[],balances=[],properties=[],balancesEnabled=true,role,setRole}) {
  // Previously these defaulted to the seeded demo portfolio and fell back to it
  // whenever the real list was empty, so an owner with nothing yet was shown
  // three invented buildings and their invented revenue as if they owned them.
  const props=Array.isArray(properties)?properties:[];
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
        {/* Was hardcoded to the demo owner, so every real owner was greeted by
            somebody else's name. */}
        <div style={{fontSize:25,fontWeight:600,color:C.text,letterSpacing:"-.005em",fontFamily:C.display,lineHeight:1.15}}>{me?.entity?.name||me?.email||"Owner"}</div>
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Portfolio Owner · {props.length} {props.length===1?"Property":"Properties"}</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>Portfolio overview</div>
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
      {/* Resident balances. Buildium's lease ledger isn't mapped, so live mode
          has nothing truthful to put here. Rendering an empty table instead
          would read as "every resident is paid up", which is worse than saying
          nothing — an owner could act on it. */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Resident balances</span>
        {balancesEnabled&&<span style={{fontSize:11,color:C.faint}}>{owingCount} of {balances.length} owing</span>}
      </div>
      {!balancesEnabled ? (
        <div style={{margin:"0 16px",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:16,padding:"13px 15px",display:"flex",gap:10,alignItems:"flex-start"}}>
          <Icon name="info" size={17} style={{color:C.pending.text,marginTop:1,flexShrink:0}} />
          <div style={{fontSize:11.5,color:C.pending.text,lineHeight:1.5}}>
            Rent balances aren&apos;t connected to the accounting system yet, so none are shown here. Contact the office for a current rent roll.
          </div>
        </div>
      ) : (
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
      )}

      {/* Completed inspections — read-only for owner */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 16px 10px"}}>
        <span style={{fontSize:15,fontWeight:700,color:C.text,letterSpacing:"-.01em"}}>Inspections</span>
        <span style={{fontSize:11,color:C.faint}}>View only</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"0 16px"}}>
        {inspections.length===0&&(
          <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:3}}>No inspections yet</div>
            <div style={{fontSize:11.5,color:C.faint,lineHeight:1.5}}>Completed reports will appear here once Fleming Realty files one.</div>
          </div>
        )}
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
              <div style={{flex:1,padding:"7px 10px",borderRadius:8,background:"#FAF8F4",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:9,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>Completed</div>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>{ins.date}</div>
                <div style={{fontSize:10,color:C.done.text,fontWeight:600,marginTop:1}}>{ins.passed} passed · {ins.failed} flagged</div>
              </div>
              <div style={{flex:1,padding:"7px 10px",borderRadius:8,background:"#FAF8F4",border:`1px solid ${C.border}`}}>
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
        {listed.length===0&&(
          <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:3}}>No properties linked yet</div>
            <div style={{fontSize:11.5,color:C.faint,lineHeight:1.5}}>Your account isn&apos;t linked to a property in the office system yet. Fleming Realty can connect it.</div>
          </div>
        )}
        {listed.map(p=>(
          <div key={p.id} className="fl-rise" style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <PropertyPhoto propertyId={p.id} name={p.name} height={104} />
            <div style={{padding:"13px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{p.name}</div>
                  <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{p.occupied}/{p.units} units · {p.monthlyRev}/mo</div>
                </div>
                {p.urgentOrders>0&&<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,background:C.urgent.bg,color:C.urgent.text,border:`1px solid ${C.urgent.border}`}}>{p.urgentOrders} urgent</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div style={{padding:"7px 10px",borderRadius:8,background:"#FAF8F4",border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:9.5,color:C.faint,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>Open orders</div>
                  <div style={{fontSize:13,fontWeight:700,color:p.openOrders>0?C.pending.text:C.done.text}}>{p.openOrders}</div>
                </div>
                <div style={{padding:"7px 10px",borderRadius:8,background:"#FAF8F4",border:`1px solid ${C.border}`}}>
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
          <span style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Work Orders</span>
          {role!=="owner"&&<button onClick={onNewOrder} style={{background:C.primary,color:"#fff",fontSize:12,fontWeight:700,padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>+ New</button>}
          {role==="owner"&&<span style={{fontSize:12,color:C.faint}}>View only</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#FAF8F4",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 13px"}}>
          <Icon name="search" size={16} style={{color:C.faint}} />
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
          <div key={k} onClick={()=>setFilter(k)} style={{fontSize:11.5,fontWeight:700,padding:"6px 12px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4,border:filter===k?`1px solid ${C.primary}`:`1px solid ${C.border}`,background:filter===k?C.primary:"#fff",color:filter===k?"#fff":C.muted,boxShadow:filter===k?"0 2px 8px rgba(13,27,51,0.25)":"none"}}>
            {l} <span style={{fontSize:10,padding:"1px 5px",borderRadius:8,background:filter===k?"rgba(255,255,255,0.25)":"#EDEBE7",color:filter===k?"#fff":C.primary}}>{counts[k]}</span>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 16px 20px"}}>
        {(filter==="all"?sections:[{key:filter,label:SM[filter]?.label||filter}]).map(sec=>{
          const items=filtered.filter(o=>o.status===sec.key);
          if(!items.length) return null;
          return (
            <div key={sec.key}>
              <div style={{padding:"8px 0 4px"}}><span style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint}}>{sec.label}</span></div>
              {items.map(o=>(
                <div key={o.id} className="fl-rise fl-card" onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)",marginBottom:10}}>
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
            <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:C.faint}}><Icon name={needle?"search":"tray"} size={30} strokeWidth={1.6} /></div>
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
        <span style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint}}>Thread with {vendor.name}</span>
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
            <div style={{maxWidth:"82%",padding:"8px 11px",borderRadius:m.from==="employee"?"12px 12px 2px 12px":"12px 12px 12px 2px",background:m.from==="employee"?C.primary:"#F2F0EB",color:m.from==="employee"?"#fff":C.text,fontSize:12.5,lineHeight:1.45}}>
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
            style={{flex:1,border:`1px solid ${C.border}`,borderRadius:20,padding:"8px 14px",fontSize:12.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#FAF8F4"}}
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
  const [photoAdded,setPhotoAdded]=useState(null); // storage path once uploaded
  const [completionNote,setCompletionNote]=useState("");
  const vendorComplete=()=>{
    apply({status:"review",vendorCompleted:true,completionNote,photoAdded});
    setShowComplete(false);
  };
  const employeeClose=()=>{apply({status:"done"});setOwnerNotified(true);setCompletionNotified(true);};
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      {/* The building this is about. Staff and owners only: other roles can't
          read the photo endpoint, and a resident already knows their own home. */}
      {order.propertyId!=null&&["employee","owner"].includes(role)&&(
        <PropertyPhoto propertyId={order.propertyId} name={order.address} height={92} />
      )}
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Orders</span>
          <Badge status={cur?.status||order.status} />
        </div>
        <div style={{fontSize:10,fontWeight:600,color:C.faint,letterSpacing:".04em",marginBottom:4}}>{order.id} · {order.category}</div>
        <div style={{fontSize:21,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display,lineHeight:1.3,marginBottom:4}}>{order.title}</div>
        <div style={{fontSize:12.5,color:C.muted}}>{[order.address,order.unit].filter(Boolean).join(" · ")||"Property not linked"}</div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {/* Buildium writes aren't implemented, so anything changed here lives on
            this device only. Saying so beats letting an employee believe the
            office record was updated. */}
        {!syncs&&role!=="resident"&&(
          <div style={{display:"flex",gap:10,alignItems:"flex-start",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:14,padding:"11px 13px"}}>
            <Icon name="warning" size={17} style={{color:C.pending.text,marginTop:1}} />
            <div style={{fontSize:11.5,color:C.pending.text,lineHeight:1.5}}>
              <b>Viewing live Buildium data.</b> Changes you make here (assigning, closing, notes) stay on this device — they don't write back to Buildium yet.
            </div>
          </div>
        )}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Issue notes</div>
          {/* Real Buildium descriptions are long free text with newlines. */}
          <div style={{fontSize:13,color:C.text,lineHeight:1.5,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{cur?.notes||order.notes||"No description provided."}</div>
        </div>
        {order.residentName&&(
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8}}>Resident</div>
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
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8}}>Vendor</div>
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
              ?<button onClick={()=>onAssign(order)} style={{width:"100%",background:C.primary,color:"#fff",fontSize:13,fontWeight:700,padding:"12px",borderRadius:12,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(13,27,51,0.28)"}}>+ Assign a vendor</button>
              :<div style={{fontSize:13,color:C.muted}}>Not yet assigned</div>
          )}
        </div>
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:10}}>Timeline</div>
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
            <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:10}}>Completion proof from vendor</div>
            {/* The real uploaded photo, fetched through a signed URL. */}
            {cur.photoAdded&&<div style={{marginBottom:10}}><StoredPhoto path={cur.photoAdded} /></div>}
            {cur.completionNote&&<div style={{fontSize:12.5,color:C.text,lineHeight:1.5,background:"#FAF8F4",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`}}>{cur.completionNote}</div>}
          </div>
        )}

        {/* VENDOR view: contact office about scheduling */}
        {role==="vendor"&&cur?.status!=="done"&&(
          schedulingRequested?(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:C.scheduled.bg,borderRadius:14,border:`1px solid ${C.scheduled.border}`}}>
              <Icon name="calendar" size={18} style={{color:C.scheduled.text}} />
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.scheduled.text}}>Scheduling request sent</div>
                <div style={{fontSize:11.5,color:C.scheduled.text,opacity:.85,marginTop:2}}>Fleming Realty will reach out to coordinate a time.</div>
              </div>
            </div>
          ):(
            <button onClick={()=>setSchedulingRequested(true)} style={{width:"100%",background:"#fff",color:C.primary,fontSize:13.5,fontWeight:700,padding:"13px",borderRadius:14,border:`1.5px solid ${C.primary}`,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="calendar" size={17} />Contact Fleming about scheduling</button>
          )
        )}

        {/* VENDOR view: complete the job */}
        {role==="vendor"&&cur?.status!=="done"&&cur?.status!=="review"&&(
          !showComplete?(
            <button onClick={()=>setShowComplete(true)} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(13,27,51,0.28)"}}>✓ Mark work complete</button>
          ):(
            <div style={{background:"#fff",borderRadius:14,border:`2px solid ${C.primary}`,padding:"14px"}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:10}}>Complete this work order</div>
              <div style={{fontSize:11,fontWeight:600,color:C.faint,marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Photo of completed work <span style={{color:C.urgent.text}}>*</span></div>
              <div style={{marginBottom:12}}>
                <PhotoCapture
                  kind="completion"
                  label="Photograph the completed work"
                  value={photoAdded||null}
                  onChange={(path)=>setPhotoAdded(path)}
                />
              </div>
              <div style={{fontSize:11,fontWeight:600,color:C.faint,marginBottom:6,textTransform:"uppercase",letterSpacing:".05em"}}>Work details <span style={{color:C.urgent.text}}>*</span></div>
              <textarea value={completionNote} onChange={e=>setCompletionNote(e.target.value)} placeholder="Describe what was done..." rows={2} style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",resize:"none",boxSizing:"border-box",marginBottom:12}} />
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>setShowComplete(false)} style={{flex:1,background:"#FAF8F4",color:C.muted,fontSize:13,fontWeight:600,padding:"11px",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                <button onClick={vendorComplete} disabled={!photoAdded||!completionNote.trim()} style={{flex:2,background:(photoAdded&&completionNote.trim())?C.primary:"#E5E1D8",color:(photoAdded&&completionNote.trim())?"#fff":C.faint,fontSize:13,fontWeight:700,padding:"11px",borderRadius:10,border:"none",cursor:(photoAdded&&completionNote.trim())?"pointer":"default",fontFamily:"inherit"}}>Submit completion</button>
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
          <button onClick={markDone} style={{width:"100%",background:"#FAF8F4",color:C.muted,fontSize:13,fontWeight:600,padding:"12px",borderRadius:14,border:`1px solid ${C.border}`,cursor:"pointer",fontFamily:"inherit"}}>Close without vendor completion</button>
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
        <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Assign vendor</div>
        <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>{order.title} · {order.unit}</div>
      </div>
      {/* Real rosters run to 100+ vendors, so this needs a filter to be usable. */}
      <div style={{padding:"12px 16px 0"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,background:"#FAF8F4",border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 13px"}}>
          <Icon name="search" size={16} style={{color:C.faint}} />
          <input value={vq} onChange={e=>setVq(e.target.value)} placeholder={`Search ${vendors.length} vendors…`} style={{border:"none",background:"transparent",fontSize:13,color:C.text,width:"100%",outline:"none",fontFamily:"inherit"}} />
          {vq&&<span onClick={()=>setVq("")} style={{fontSize:14,color:C.faint,cursor:"pointer",lineHeight:1}}>✕</span>}
        </div>
      </div>
      <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
        {shownVendors.map(v=>(
          <div key={v.id} className="fl-rise" onClick={()=>setSelected(v.id)} style={{background:"#fff",borderRadius:16,border:selected===v.id?`2px solid ${C.primary}`:`1px solid ${C.border}`,padding:"14px 15px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"border-color .15s ease, box-shadow .15s ease",boxShadow:selected===v.id?"0 0 0 4px rgba(13,27,51,0.10)":"0 1px 2px rgba(16,24,40,0.04)"}}>
            <VendorAvatar v={v} size={44} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13.5,fontWeight:700,color:C.text,marginBottom:2}}>{v.name}</div>
              {v.specialty&&<div style={{fontSize:11,color:C.muted,marginBottom:2}}>{v.specialty}</div>}
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                {v.location&&<span style={{fontSize:10,color:C.faint,display:"inline-flex",alignItems:"center",gap:3}}><Icon name="pin" size={11} />{v.location}</span>}
                {v.phone&&<span style={{fontSize:10,color:C.faint}}>{v.phone}</span>}
              </div>
            </div>
            {selected===v.id&&<div style={{width:22,height:22,borderRadius:"50%",background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700,flexShrink:0}}>✓</div>}
          </div>
        ))}
        {shownVendors.length===0&&<div style={{textAlign:"center",padding:"26px 16px",fontSize:12.5,color:C.muted}}>No vendors match “{vq.trim()}”.</div>}
        {!vq&&vendors.length>shownVendors.length&&<div style={{textAlign:"center",fontSize:11,color:C.faint,padding:"2px 0 4px"}}>Showing {shownVendors.length} of {vendors.length} — search to narrow</div>}
        {selected&&!confirmed&&<button onClick={confirm} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(13,27,51,0.28)",marginTop:6}}>Assign {vendors.find(v=>v.id===selected)?.name}</button>}
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
    const tc=typeColors[c.type]||{bg:"#EDEBE7",text:C.muted};
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
          <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder={`Message ${c.name}...`} style={{flex:1,border:`1px solid ${C.border}`,borderRadius:20,padding:"9px 14px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#FAF8F4"}} />
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
          <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Messages</div>
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
          <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:C.faint}}><Icon name="chat" size={32} strokeWidth={1.6} /></div>
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
              <div style={{marginBottom:3}}><span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:8,background:typeColors[c.type]?.bg||"#EDEBE7",color:typeColors[c.type]?.text||C.muted}}>{c.role}</span></div>
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
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8,paddingLeft:2}}>Demo · view as another role</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {Object.values(ROLES).map(r=>{
              const active=r.key===role;
              return (
                <div key={r.key} onClick={()=>{setRole(r.key);onNav("home");}} style={{background:"#fff",borderRadius:16,border:active?`2px solid ${C.primary}`:`1px solid ${C.border}`,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:14,boxShadow:active?"0 0 0 4px rgba(13,27,51,0.10)":"0 1px 2px rgba(16,24,40,0.04)"}}>
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
        <div style={{width:36,height:36,borderRadius:10,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="building" size={18} style={{color:C.primary}} /></div>
        <div><div style={{fontSize:13,fontWeight:700,color:C.text}}>Fleming Realty Group</div><div style={{fontSize:11.5,color:C.faint}}>325 units · Camp Hill, PA</div></div>
      </div>
      <div style={{margin:"12px 16px 20px"}}>
        <button onClick={onSignOut} style={{width:"100%",background:"#fff",color:C.urgent.text,fontSize:13.5,fontWeight:700,padding:"13px",borderRadius:14,border:`1px solid ${C.urgent.border}`,cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
      </div>
    </div>
  );
}

// ── INSPECTION RECORDS ───────────────────────────────────────────────────────
// Employees manage inspections here; owners get the same list read-only. Opening
// one loads the full checklist with notes and photo evidence.
function InspectionsScreen({onBack,onNewInspection,role,setRole}) {
  const [list,setList]=useState(null);
  const [error,setError]=useState("");
  const [open,setOpen]=useState(null);      // selected inspection id
  const [detail,setDetail]=useState(null);
  const canManage = role==="employee";

  useEffect(()=>{
    let alive=true;
    fetch("/api/inspections").then(r=>r.json()).then(j=>{
      if(!alive) return;
      if(j.error) setError(j.error); else setList(j.inspections||[]);
    }).catch(()=>alive&&setError("Couldn't load inspections."));
    return ()=>{alive=false;};
  },[]);

  useEffect(()=>{
    let alive=true;
    if(!open){setDetail(null);return;}
    setDetail("loading");
    fetch(`/api/inspections/${open}`).then(r=>r.json()).then(j=>{
      if(alive) setDetail(j.inspection||null);
    }).catch(()=>alive&&setDetail(null));
    return ()=>{alive=false;};
  },[open]);

  // ── Detail view ──
  if(open){
    const d = detail==="loading"?null:detail;
    const failed=(d?.items||[]).filter(i=>i.result==="fail");
    const passed=(d?.items||[]).filter(i=>i.result==="pass");
    return (
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
        <AppHeader role={role} setRole={setRole} />
        <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
          <span className="fl-tap" onClick={()=>setOpen(null)} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Inspections</span>
          <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>{d?.property||"Inspection"}</div>
          <div style={{fontSize:12.5,color:C.muted,marginTop:2}}>{[d?.scope,d?.date,d?.by].filter(Boolean).join(" · ")}</div>
        </div>

        {detail==="loading"&&<div style={{padding:"28px",textAlign:"center",fontSize:12.5,color:C.muted}}>Loading report…</div>}
        {detail!=="loading"&&!d&&<div style={{padding:"28px",textAlign:"center",fontSize:12.5,color:C.muted}}>That report couldn't be loaded.</div>}

        {d&&(
          <div style={{padding:"14px 16px 20px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div style={{padding:"12px",borderRadius:12,background:C.done.bg,border:`1px solid ${C.done.border}`,textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:600,color:C.done.text,fontFamily:C.display,lineHeight:1}}>{d.passed}</div>
                <div style={{fontSize:10.5,fontWeight:600,color:C.done.text,marginTop:3}}>Passed</div>
              </div>
              <div style={{padding:"12px",borderRadius:12,background:d.failed>0?C.urgent.bg:C.sunken,border:`1px solid ${d.failed>0?C.urgent.border:C.border}`,textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:600,color:d.failed>0?C.urgent.text:C.muted,fontFamily:C.display,lineHeight:1}}>{d.failed}</div>
                <div style={{fontSize:10.5,fontWeight:600,color:d.failed>0?C.urgent.text:C.muted,marginTop:3}}>Flagged</div>
              </div>
            </div>
            {d.nextDate&&(
              <div style={{padding:"11px 13px",borderRadius:12,background:C.scheduled.bg,border:`1px solid ${C.scheduled.border}`,display:"flex",alignItems:"center",gap:9}}>
                <Icon name="calendar" size={16} style={{color:C.scheduled.text}} />
                <span style={{fontSize:12,color:C.scheduled.text,fontWeight:600}}>Next inspection {d.nextDate}</span>
              </div>
            )}

            {failed.length>0&&(
              <div>
                <div className="fl-eyebrow" style={{marginBottom:8}}>Items needing attention</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {failed.map((it,i)=>(
                    <div key={i} className="fl-rise" style={{background:"#fff",borderRadius:14,border:`1px solid ${C.urgent.border}`,padding:"13px 14px",boxShadow:C.shadowSm}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                        <div style={{fontSize:13,fontWeight:600,color:C.text,lineHeight:1.35}}>{it.label}</div>
                        {it.critical&&<span style={{fontSize:9,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:C.urgent.text,whiteSpace:"nowrap"}}>Critical</span>}
                      </div>
                      {it.note&&<div style={{fontSize:12,color:C.body,lineHeight:1.5,marginBottom:it.photoPath?10:0}}>{it.note}</div>}
                      {it.photoPath&&<StoredPhoto path={it.photoPath} height={200} />}
                      {!it.photoPath&&<div style={{fontSize:11,color:C.faint,fontStyle:"italic"}}>No photo attached</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {passed.length>0&&(
              <div>
                <div className="fl-eyebrow" style={{marginBottom:8}}>Passed ({passed.length})</div>
                <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                  {passed.map((it,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 13px",borderBottom:i<passed.length-1?`1px solid ${C.border}`:"none"}}>
                      <Icon name="check" size={14} style={{color:C.done.text}} />
                      <span style={{fontSize:12.5,color:C.body}}>{it.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(d.items||[]).length===0&&(
              <div style={{textAlign:"center",padding:"24px 16px",fontSize:12.5,color:C.muted,lineHeight:1.5}}>
                This report was recorded before item-level detail was captured, so only the totals are available.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 12px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
          <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer"}}>← Home</span>
          <span style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Inspections</span>
          {canManage
            ? <button onClick={onNewInspection} style={{background:C.primary,color:"#fff",fontSize:12,fontWeight:700,padding:"7px 13px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"inherit"}}>+ New</button>
            : <span style={{fontSize:12,color:C.faint}}>View only</span>}
        </div>
        <div style={{fontSize:11.5,color:C.muted}}>Completed reports with photo evidence</div>
      </div>

      <div style={{padding:"14px 16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {error&&<div style={{fontSize:12.5,color:C.urgent.text,padding:"12px",background:C.urgent.bg,borderRadius:12,border:`1px solid ${C.urgent.border}`}}>{error}</div>}
        {list===null&&!error&&<div style={{textAlign:"center",padding:"28px",fontSize:12.5,color:C.muted}}>Loading…</div>}

        {list&&list.length===0&&(
          <div style={{textAlign:"center",padding:"40px 24px"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:C.faint}}><Icon name="clipboard" size={30} strokeWidth={1.6} /></div>
            <div style={{fontSize:14.5,fontWeight:700,color:C.text,marginBottom:6}}>No inspections yet</div>
            <div style={{fontSize:12.5,color:C.muted,lineHeight:1.55}}>
              {canManage?"Start one and it'll be saved here with its photos.":"Completed inspections will appear here."}
            </div>
          </div>
        )}

        {(list||[]).map(ins=>(
          <div key={ins.id} className="fl-rise fl-card" onClick={()=>setOpen(ins.id)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",cursor:"pointer",boxShadow:C.shadow}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text}}>{ins.property}</div>
                <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{[ins.scope,ins.by].filter(Boolean).join(" · ")}</div>
              </div>
              <Icon name="caretRight" size={16} style={{color:C.faint,marginTop:2}} />
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:20,background:C.done.bg,color:C.done.text,border:`1px solid ${C.done.border}`}}>{ins.passed} passed</span>
              {ins.failed>0&&<span style={{fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:20,background:C.urgent.bg,color:C.urgent.text,border:`1px solid ${C.urgent.border}`}}>{ins.failed} flagged</span>}
              <span style={{fontSize:11,color:C.faint,marginLeft:"auto"}}>{fmtDate(ins.date)}</span>
            </div>
          </div>
        ))}
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
    // Send the whole checklist, not just a tally — which item failed, the
    // inspector's note and its photo are the substance of the report.
    onInspectionDone && onInspectionDone({
      property: PROPERTY,
      scope: template?.name || "Inspection",
      passed: done - fails,
      failed: fails,
      nextDate,
      items: items
        .filter(it => checks[it.id])
        .map(it => ({
          label: it.label,
          category: it.category,
          critical: it.critical,
          result: checks[it.id],
          note: notes[it.id] || null,
          photoPath: photos[it.id] || null,
        })),
    });
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:16}}>
        <div style={{color:C.done.text}}><Icon name="checkCircle" size={52} strokeWidth={1.5} /></div>
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
        <button onClick={onBack} style={{width:"100%",background:C.primary,color:"#fff",fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(13,27,51,0.28)",marginTop:8}}>Back to orders</button>
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
            <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Unit Inspection</div>
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
          <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint}}>Checklist template</span>
          <span onClick={onManageTemplates} style={{fontSize:11.5,fontWeight:700,color:C.primary,cursor:"pointer"}}>Manage templates →</span>
        </div>
        <div style={{display:"flex",gap:8}}>
          {templates.map(t=>(
            <div key={t.id} onClick={()=>{setTemplateId(t.id);setChecks({});setNotes({});setPhotos({});}} style={{flex:1,padding:"10px 12px",borderRadius:12,cursor:"pointer",border:templateId===t.id?`2px solid ${C.primary}`:`1px solid ${C.border}`,background:templateId===t.id?C.primaryLight:"#fff",boxShadow:templateId===t.id?"0 0 0 3px rgba(13,27,51,0.08)":"none"}}>
              <div style={{fontSize:12.5,fontWeight:700,color:templateId===t.id?C.primary:C.text}}>{t.name}</div>
              <div style={{fontSize:10.5,color:C.faint,marginTop:2}}>{t.items.length} items</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"14px 16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8,paddingLeft:2}}>{cat}</div>
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
                        <div onClick={()=>toggle(item.id,"pass")} style={{width:32,height:32,borderRadius:8,background:val==="pass"?C.done.bg:"#FAF8F4",border:`1.5px solid ${val==="pass"?C.done.bar:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>✓</div>
                        <div onClick={()=>toggle(item.id,"fail")} style={{width:32,height:32,borderRadius:8,background:val==="fail"?C.urgent.bg:"#FAF8F4",border:`1.5px solid ${val==="fail"?C.urgent.bar:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}}>✗</div>
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
                        {/* Real capture: opens the phone camera and uploads. */}
                        <PhotoCapture
                          kind="inspection"
                          tone="urgent"
                          label="Photograph the issue"
                          value={photos[item.id] || null}
                          onChange={(path)=>setPhotos(prev=>{
                            const n={...prev};
                            if(path) n[item.id]=path; else delete n[item.id];
                            return n;
                          })}
                        />
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
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:4}}>Schedule next inspection <span style={{color:C.urgent.text}}>*</span></div>
          <div style={{fontSize:11.5,color:C.muted,marginBottom:8,lineHeight:1.4}}>Required before completing. The owner is notified of this date automatically.</div>
          <select value={nextDate} onChange={e=>setNextDate(e.target.value)} style={{width:"100%",border:`1px solid ${nextDate?C.primary:C.border}`,borderRadius:10,padding:"11px 12px",fontSize:13,fontFamily:"inherit",color:nextDate?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}>
            <option value="">Select next inspection date…</option>
            {nextOptions.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <button
          onClick={submit}
          style={{width:"100%",background:canSubmit?C.primary:"#E5E1D8",color:canSubmit?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:canSubmit?"pointer":"default",fontFamily:"inherit",marginTop:4,boxShadow:canSubmit?"0 2px 10px rgba(13,27,51,0.28)":"none"}}
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
        <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>{editing.isNew?"New template":"Edit template"}</div>
      </div>
      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Template name <span style={{color:C.urgent.text}}>*</span></div>
          <input value={editing.name} onChange={e=>setEditing(prev=>({...prev,name:e.target.value}))} placeholder="e.g. Annual Safety Check" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",fontSize:13.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint}}>Checklist items</span>
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
        <button onClick={save} style={{width:"100%",background:editorValid?C.primary:"#E5E1D8",color:editorValid?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:editorValid?"pointer":"default",fontFamily:"inherit"}}>
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
          <span style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>Templates</span>
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
                <span key={c} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#EDEBE7",color:C.muted}}>{c}</span>
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
  // Whether a submitted request genuinely reaches the office. This screen makes
  // the app's strongest promise to a resident, so it must not overstate it.
  const {syncs=true} = useLive();
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
  const [saving,setSaving]       = useState(false);
  const [failed,setFailed]       = useState("");
  // Staff file on someone's behalf, so they must name the unit and its current
  // tenant — Buildium refuses a request without both. Residents supply them
  // from their own session and never see this.
  const [propertyId,setPropertyId] = useState("");
  const [tenancy,setTenancy]       = useState(null);
  const [units,setUnits]           = useState([]);
  const [unitsState,setUnitsState] = useState("idle"); // idle | loading | ready | error
  const [unitsError,setUnitsError] = useState("");

  const categories = ["HVAC","Plumbing","Electrical","Security","General","Inspection","Move-out","Landscaping"];
  const urgencies  = [{key:"urgent",label:"Urgent — same day",color:C.urgent},{key:"pending",label:"Standard — within 3 days",color:C.pending},{key:"scheduled",label:"Scheduled — pick a date",color:C.scheduled}];
  // Real portfolios have hundreds of properties; a 3-item hardcoded list made it
  // impossible to file a work order against any actual address.
  const addresses = (properties?.length
    ? [...new Set(properties.map(p=>p.name).filter(Boolean))].sort((a,b)=>a.localeCompare(b))
    : ["214 Walnut St","330 Pine Ave","812 Market St"]);
  // Staff pick by id, because the occupancy lookup is keyed on it.
  const propertyOptions = (properties||[])
    .filter(p=>p&&p.name!=null&&p.id!=null)
    .slice()
    .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const selectedProperty = propertyOptions.find(p=>String(p.id)===String(propertyId)) || null;

  useEffect(()=>{
    if (isResident || !propertyId) { setUnits([]); setUnitsState("idle"); setUnitsError(""); return; }
    let alive = true;
    setUnitsState("loading"); setUnitsError(""); setUnits([]); setTenancy(null);
    fetch(`/api/buildium/occupancy?propertyId=${encodeURIComponent(propertyId)}`,{cache:"no-store"})
      .then(async r=>{ const j=await r.json().catch(()=>({})); if(!r.ok) throw new Error(j.error||`Couldn't load units (${r.status})`); return j; })
      .then(j=>{ if(!alive) return; setUnits(j.units||[]); setUnitsState("ready"); })
      .catch(e=>{ if(!alive) return; setUnitsError(e.message); setUnitsState("error"); });
    return ()=>{ alive=false; };
  },[propertyId,isResident]);

  const canSubmit = isResident
    ? Boolean(title.trim() && unit.trim() && address && category && urgency)
    : Boolean(title.trim() && selectedProperty && tenancy && category && urgency);

  const submit = async () => {
    if (!canSubmit || saving) return;
    setFailed("");
    setSaving(true);
    const newOrder = {
      id: `WO-${String(Math.floor(Math.random()*9000)+1000)}`,
      title: title.trim(),
      unit: isResident ? unit.trim() : (tenancy?.unitNumber ? `Unit ${tenancy.unitNumber}` : ""),
      address: isResident ? address : (selectedProperty?.name || ""),
      status: urgency,
      vendorId: null,
      reported: "Just now",
      category,
      residentName: isResident ? (me?.entity?.name || me?.email || null) : (tenancy?.tenantName || null),
      notes: notes.trim() || "New work order submitted via app.",
      // Buildium files a maintenance request against a lease and the tenant
      // raising it. A resident's pair is taken from their session server-side;
      // staff send the pair they selected, which the route re-validates.
      ...(isResident ? {} : { leaseId: tenancy?.leaseId ?? null, residentId: tenancy?.tenantId ?? null }),
    };
    // Wait for the server before claiming anything. Confirming first and checking
    // later is how a resident ends up believing the office has a request it never
    // received.
    const res = await onCreated(newOrder);
    setSaving(false);
    if (res && res.ok === false) {
      setFailed(res.error || "We couldn't send that request. Please try again.");
      return;
    }
    setSubmitted(true);
    setTimeout(()=>onBack(), 1600);
  };

  if (submitted) return (
    <div style={{flex:1,display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,gap:12}}>
        <div style={{color:C.primary}}><Icon name="wrench" size={46} strokeWidth={1.5} /></div>
        <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>
          {isResident ? (syncs?"Request sent":"Request saved") : (syncs?"Work order created":"Work order saved")}
        </div>
        <div style={{fontSize:13,color:C.muted,textAlign:"center",lineHeight:1.6}}>
          {isResident
            ? (syncs
                ? `"${title}" has gone to Fleming Realty. You'll be notified when a vendor is assigned.`
                : `"${title}" is saved in your list, but requests don't reach the office through the app yet — please call Fleming Realty if this is urgent.`)
            : (syncs
                ? `${title} has been logged in Buildium and is visible in the orders list.`
                : `${title} is visible in the orders list on this device only — it has not been logged in Buildium.`)}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"14px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <span className="fl-tap" onClick={onBack} style={{fontSize:13,color:C.primary,fontWeight:600,cursor:"pointer",display:"block",marginBottom:8}}>← Cancel</span>
        <div style={{fontSize:20,fontWeight:600,letterSpacing:"-.005em",color:C.text,fontFamily:C.display}}>{isResident?"Submit a request":"New work order"}</div>
        {isResident&&syncs&&<div style={{fontSize:11.5,color:C.faint,marginTop:2}}>Goes directly to your property manager</div>}
      </div>

      <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>

        {/* The staff name here used to be hardcoded demo fiction, and the promise
            was made whether or not requests actually reach anyone. */}
        {isResident&&syncs&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 13px",borderRadius:12,background:C.primaryLight,border:`1px solid ${C.primary}22`}}>
            <Icon name="building" size={17} style={{color:C.primary}} />
            <span style={{fontSize:11.5,color:C.primary,fontWeight:600,lineHeight:1.4}}>Fleming Realty will receive this request and assign a vendor.</span>
          </div>
        )}
        {isResident&&!syncs&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"11px 13px",borderRadius:12,background:C.pending.bg,border:`1px solid ${C.pending.border}`}}>
            <Icon name="warning" size={17} style={{color:C.pending.text,marginTop:1,flexShrink:0}} />
            <span style={{fontSize:11.5,color:C.pending.text,fontWeight:600,lineHeight:1.4}}>Requests don't reach the office through the app yet. This will be saved to your list — please call Fleming Realty for anything urgent.</span>
          </div>
        )}

        {/* Title */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Issue title <span style={{color:C.urgent.text}}>*</span></div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. HVAC not cooling, Leaking faucet..." style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",fontSize:13.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
        </div>

        {/* Property + Unit. A resident's are prefilled from their own lease, so
            they keep the simple pair. Staff are filing on someone else's behalf,
            and Buildium refuses a maintenance request that doesn't name a lease
            and the tenant raising it — so they pick a real occupied unit rather
            than typing free text that would be rejected. */}
        {isResident ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Property <span style={{color:C.urgent.text}}>*</span></div>
            <select value={address} onChange={e=>setAddress(e.target.value)} style={{width:"100%",border:`1px solid ${address?C.primary:C.border}`,borderRadius:12,padding:"12px 10px",fontSize:13,fontFamily:"inherit",color:address?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}>
              <option value="">Select...</option>
              {addresses.map(a=><option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Unit <span style={{color:C.urgent.text}}>*</span></div>
            <input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="e.g. Unit 4B" style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 10px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
          </div>
        </div>
        ) : (
        <>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Property <span style={{color:C.urgent.text}}>*</span></div>
            <select value={propertyId} onChange={e=>setPropertyId(e.target.value)} style={{width:"100%",border:`1px solid ${propertyId?C.primary:C.border}`,borderRadius:12,padding:"12px 12px",fontSize:13,fontFamily:"inherit",color:propertyId?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}>
              <option value="">Select a property…</option>
              {propertyOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Unit &amp; resident <span style={{color:C.urgent.text}}>*</span></div>
            {!propertyId ? (
              <div style={{fontSize:12,color:C.faint,padding:"11px 13px",borderRadius:12,background:"#FAF8F4",border:`1px solid ${C.border}`}}>Choose a property first.</div>
            ) : unitsState==="loading" ? (
              <div style={{fontSize:12,color:C.faint,padding:"11px 13px",borderRadius:12,background:"#FAF8F4",border:`1px solid ${C.border}`}}>Loading units…</div>
            ) : unitsState==="error" ? (
              <div style={{display:"flex",gap:9,alignItems:"flex-start",padding:"11px 13px",borderRadius:12,background:"#FEF2F2",border:"1px solid #FECACA"}}>
                <Icon name="warning" size={16} style={{color:"#B91C1C",marginTop:1,flexShrink:0}} />
                <span style={{fontSize:11.5,color:"#B91C1C",lineHeight:1.45,overflowWrap:"anywhere"}}>{unitsError}</span>
              </div>
            ) : units.length===0 ? (
              <div style={{display:"flex",gap:9,alignItems:"flex-start",padding:"11px 13px",borderRadius:12,background:C.pending.bg,border:`1px solid ${C.pending.border}`}}>
                <Icon name="warning" size={16} style={{color:C.pending.text,marginTop:1,flexShrink:0}} />
                <span style={{fontSize:11.5,color:C.pending.text,lineHeight:1.45}}>
                  No active tenancy at {selectedProperty?.name||"this property"}. Buildium files maintenance against a resident&apos;s lease, so a vacant unit has to be logged in Buildium directly for now.
                </span>
              </div>
            ) : (
              <select
                value={tenancy?`${tenancy.leaseId}:${tenancy.tenantId}`:""}
                onChange={e=>setTenancy(units.find(u=>`${u.leaseId}:${u.tenantId}`===e.target.value)||null)}
                style={{width:"100%",border:`1px solid ${tenancy?C.primary:C.border}`,borderRadius:12,padding:"12px 12px",fontSize:13,fontFamily:"inherit",color:tenancy?C.text:C.faint,outline:"none",background:"#fff",appearance:"none"}}
              >
                <option value="">Select a unit… ({units.length} occupied)</option>
                {units.map(u=>(
                  <option key={`${u.leaseId}:${u.tenantId}`} value={`${u.leaseId}:${u.tenantId}`}>
                    {u.unitNumber?`Unit ${u.unitNumber}`:"Unit —"} · {u.tenantName}
                  </option>
                ))}
              </select>
            )}
            {tenancy&&(
              <div style={{fontSize:11,color:C.faint,marginTop:6,lineHeight:1.45}}>
                Filed for <b style={{color:C.text}}>{tenancy.tenantName}</b>{tenancy.unitNumber?` in Unit ${tenancy.unitNumber}`:""}.
              </div>
            )}
          </div>
        </>
        )}

        {/* Category */}
        <div>
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8}}>Category <span style={{color:C.urgent.text}}>*</span></div>
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
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:8}}>Priority <span style={{color:C.urgent.text}}>*</span></div>
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
          <div style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".14em",color:C.faint,marginBottom:6}}>Additional notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any extra context for the vendor..." rows={3} style={{width:"100%",border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 14px",fontSize:13,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",resize:"none",boxSizing:"border-box"}} />
        </div>

        {failed && (
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"11px 13px",display:"flex",gap:10,alignItems:"flex-start"}}>
            <Icon name="warning" size={17} style={{color:"#B91C1C",marginTop:1,flexShrink:0}} />
            <div style={{minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:700,color:"#B91C1C",marginBottom:2}}>{isResident?"Not sent":"Not saved"}</div>
              <div style={{fontSize:11.5,color:"#B91C1C",opacity:.9,lineHeight:1.45,wordBreak:"break-word"}}>{failed}</div>
            </div>
          </div>
        )}

        <button onClick={submit} disabled={!canSubmit||saving} style={{width:"100%",background:canSubmit&&!saving?C.primary:"#E5E1D8",color:canSubmit&&!saving?"#fff":C.faint,fontSize:14,fontWeight:700,padding:"14px",borderRadius:14,border:"none",cursor:canSubmit&&!saving?"pointer":"default",fontFamily:"inherit"}}>
          {saving ? "Sending…" : canSubmit ? (isResident?"Send request →":"Create work order →") : "Fill in required fields"}
        </button>
      </div>
    </div>
  );
}

// ── VENDOR HOME ───────────────────────────────────────────────────────────────
function VendorHome({me,orders,onOrder,role,setRole}) {
  // No default: this used to fall back to vendor id 1, so any vendor account
  // without a linked Buildium vendor record would have been shown that vendor's
  // jobs. The server already scopes by the same id, which contained it — but the
  // fallback should never have been there.
  const myVendorId = me?.entity?.vendorId ?? null;
  // vendor sees orders assigned to their own vendor id (identity-driven)
  const myJobs = myVendorId==null ? [] : orders.filter(o=>o.vendorId===myVendorId);
  const active = myJobs.filter(o=>["urgent","pending","scheduled"].includes(o.status));
  const review = myJobs.filter(o=>o.status==="review");
  const done = myJobs.filter(o=>o.status==="done");
  return (
    <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
      <AppHeader role={role} setRole={setRole} />
      <div style={{background:"#fff",padding:"18px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Good morning 👋</div>
        <div style={{fontSize:25,fontWeight:600,color:C.text,letterSpacing:"-.005em",fontFamily:C.display,lineHeight:1.15}}>{me?.entity?.name || me?.email || "Vendor"}</div>
        {/* Was hardcoded to "5 active jobs" regardless of the real number. */}
        <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>{active.length} active {active.length===1?"job":"jobs"} from Fleming Realty</div>
      </div>
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,marginBottom:10}}>My jobs</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{n:active.length,label:"Active",...C.pending},{n:review.length,label:"In review",...C.review},{n:done.length,label:"Done",...C.done}].map(s=>(
            <div key={s.label} style={{textAlign:"center",padding:"8px 6px",borderRadius:10,background:s.bg,border:`1px solid ${s.border}`}}>
              <div style={{fontSize:26,fontWeight:600,color:s.text,lineHeight:1,fontFamily:C.display}}>{s.n}</div>
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
        {myJobs.length===0&&(
          <div style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
            <div style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:3}}>No jobs assigned</div>
            <div style={{fontSize:11.5,color:C.faint,lineHeight:1.5}}>
              {myVendorId==null
                ? "Your account isn't linked to a vendor record yet. Fleming Realty can connect it."
                : "Nothing is assigned to you right now. New jobs will appear here."}
            </div>
          </div>
        )}
        {myJobs.map(o=>(
          <div key={o.id} className="fl-rise fl-card" onClick={()=>onOrder(o)} style={{background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",cursor:"pointer",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
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
function ApplicantHome({me,applicationsEnabled=true,role,setRole}) {
  const [coEmail,setCoEmail]=useState("");
  const [invited,setInvited]=useState(false);
  const invite=()=>{ if(coEmail.trim()) setInvited(true); };
  const applicantName = me?.entity?.name || me?.email || "Applicant";
  const firstName = String(applicantName).split(" ")[0];
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
        {/* Name and reference were hardcoded to the demo applicant. */}
        <div style={{fontSize:12,color:C.faint,fontWeight:500,marginBottom:2}}>Hi {firstName} 👋</div>
        <div style={{fontSize:25,fontWeight:600,color:C.text,letterSpacing:"-.005em",fontFamily:C.display,lineHeight:1.15}}>{applicantName}</div>
        {applicationsEnabled&&<div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Application #APP-2026-0142</div>}
      </div>

      {/* There is no application backend. Everything below — the reference
          number, the property, the rent, the progress timeline — is seeded
          example content, so a real applicant must be told that rather than
          being shown someone else's application as their own. */}
      {!applicationsEnabled&&(
        <div style={{margin:"16px 16px 0",background:C.pending.bg,border:`1px solid ${C.pending.border}`,borderRadius:16,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
          <Icon name="info" size={18} style={{color:C.pending.text,marginTop:1,flexShrink:0}} />
          <div>
            <div style={{fontSize:13,fontWeight:700,color:C.pending.text,marginBottom:3}}>Application tracking isn&apos;t live yet</div>
            <div style={{fontSize:12,color:C.pending.text,opacity:.9,lineHeight:1.5}}>
              The progress below is an example of how this will look — it is not your application. Please contact Fleming Realty for the status of yours.
            </div>
          </div>
        </div>
      )}

      {/* Status banner */}
      <div style={{margin:"16px 16px 0",background:"linear-gradient(135deg,#0958D9,#3B82F6)",borderRadius:18,padding:"18px",color:"#fff",boxShadow:"0 6px 20px rgba(9,88,217,0.28)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",opacity:.8,marginBottom:4}}>Application status</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:2}}>Under Review</div>
        <div style={{fontSize:12,opacity:.85}}>330 Pine Ave, Unit 2C · $1,200/mo</div>
      </div>

      {/* Verification email confirmation */}
      <div style={{margin:"12px 16px 0",background:"#fff",borderRadius:16,border:`1px solid ${C.done.border}`,padding:"13px 14px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 1px 2px rgba(16,24,40,0.04)"}}>
        <div style={{width:36,height:36,borderRadius:10,background:C.done.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="envelope" size={18} style={{color:C.done.text}} /></div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>Email verified ✓</div>
          {/* Was hardcoded to the demo applicant's address. */}
          <div style={{fontSize:11.5,color:C.faint,marginTop:1,overflowWrap:"anywhere"}}>Verification sent to {me?.email||"your email"} on submission</div>
        </div>
      </div>

      {/* Invite an additional applicant */}
      <div style={{margin:"12px 16px 0",background:"#fff",borderRadius:16,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:invited?0:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:C.primaryLight,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="users" size={18} style={{color:C.primary}} /></div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>Add a co-applicant</div>
            <div style={{fontSize:11.5,color:C.faint,marginTop:1}}>Applying with a roommate or partner? Invite them.</div>
          </div>
        </div>
        {invited ? (
          // Nothing is actually sent — there is no invitation backend. Claiming
          // "Invitation sent" left someone waiting on an email that was never
          // going to arrive.
          applicationsEnabled ? (
            <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,background:C.done.bg,border:`1px solid ${C.done.border}`}}>
              <span style={{fontSize:14}}>✓</span>
              <span style={{fontSize:12,fontWeight:600,color:C.done.text}}>Invitation sent to {coEmail}</span>
            </div>
          ) : (
            <div style={{marginTop:10,display:"flex",alignItems:"flex-start",gap:8,padding:"10px 12px",borderRadius:10,background:C.pending.bg,border:`1px solid ${C.pending.border}`}}>
              <Icon name="warning" size={15} style={{color:C.pending.text,marginTop:1,flexShrink:0}} />
              <span style={{fontSize:11.5,fontWeight:600,color:C.pending.text,lineHeight:1.45,overflowWrap:"anywhere"}}>
                Co-applicant invitations aren&apos;t connected yet, so nothing was sent to {coEmail}. Please give their details to Fleming Realty directly.
              </span>
            </div>
          )
        ) : (
          <div style={{display:"flex",gap:8}}>
            <input value={coEmail} onChange={e=>setCoEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&invite()} placeholder="co-applicant@email.com" style={{flex:1,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 12px",fontSize:12.5,fontFamily:"inherit",color:C.text,outline:"none",background:"#fff",boxSizing:"border-box"}} />
            <button onClick={invite} style={{background:coEmail.trim()?C.primary:C.border,color:coEmail.trim()?"#fff":C.faint,fontSize:12.5,fontWeight:700,padding:"10px 14px",borderRadius:10,border:"none",cursor:coEmail.trim()?"pointer":"default",fontFamily:"inherit",flexShrink:0}}>Invite</button>
          </div>
        )}
      </div>

      {/* Progress tracker */}
      <div style={{margin:"16px 16px 0",background:"#fff",borderRadius:18,padding:"18px",border:`1px solid ${C.border}`,boxShadow:"0 1px 2px rgba(16,24,40,0.04), 0 2px 8px rgba(16,24,40,0.04)"}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:C.faint,marginBottom:14}}>Your progress</div>
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
        <div style={{width:36,height:36,borderRadius:10,background:"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="bell" size={18} style={{color:"#0958D9"}} /></div>
        {/* The toggle is decorative and no texts are sent. Promising an SMS on a
            decision is the kind of thing someone waits on. */}
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>{applicationsEnabled?"Notifications on":"Notifications not set up"}</div>
          <div style={{fontSize:11.5,color:C.faint}}>{applicationsEnabled?"We'll text you the moment there's a decision":"Fleming Realty will contact you directly with a decision"}</div>
        </div>
        <div style={{width:40,height:24,borderRadius:12,background:applicationsEnabled?C.done.bar:C.border,position:"relative",flexShrink:0}}>
          <div style={{position:"absolute",top:2,[applicationsEnabled?"right":"left"]:2,width:20,height:20,borderRadius:"50%",background:"#fff"}} />
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
  // Surfaced when a write is rejected after the UI has already moved on.
  const [notice,setNotice]            = useState("");
  useEffect(()=>{ if(!notice) return; const t=setTimeout(()=>setNotice(""),7000); return ()=>clearTimeout(t); },[notice]);

  const handleOrder  = (o) => { setSelectedOrder(o); setScreen("detail"); };
  const handleAssign = (o) => { setAssigningOrder(o); setScreen("assign"); };
  const handleNav    = (s) => { setScreen(s); setSelectedOrder(null); setAssigningOrder(null); };
  // Role switching now re-authenticates as the seeded role account (demo only) and
  // reloads scoped data. In live mode a user has one role, so this is disabled.
  const handleSetRole= (r) => { if (canViewAs && onViewAs) onViewAs(r); };

  // Writes were fire-and-forget: the optimistic change stayed on screen and any
  // server error was swallowed, so a resident could be shown "request submitted"
  // for a request the office never received. Each write now awaits the server,
  // restores the previous state if it failed, and returns the outcome so the
  // caller can say something true.
  const handleCreated = async (o) => {
    const previous = orders;
    setOrders([o, ...previous]);
    if (!api?.createOrder) return {ok:true};
    try {
      const saved = await api.createOrder(o);
      // Keep what the server actually stored — its id is the real one.
      setOrders([saved || o, ...previous]);
      return {ok:true};
    } catch (e) {
      setOrders(previous);
      return {ok:false, error:e.message};
    }
  };

  const handleInspectionDone = async (rec) => {
    const previous = inspections;
    setInspections([rec, ...previous]);
    setScreen("inspections");
    if (!api?.addInspection) return {ok:true};
    try {
      const saved = await api.addInspection(rec);
      setInspections([saved || rec, ...previous]);
      return {ok:true};
    } catch (e) {
      setInspections(previous);
      setNotice(`That inspection wasn't saved. ${e.message}`);
      return {ok:false, error:e.message};
    }
  };

  const updateOrderLocal = async (id, patch) => {
    const previous = orders;
    setOrders(previous.map(o=>o.id===id?{...o,...patch}:o));
    if (!api?.updateOrder) return {ok:true};
    try { await api.updateOrder(id, patch); return {ok:true}; }
    catch (e) {
      setOrders(previous);
      setNotice(`That change wasn't saved. ${e.message}`);
      return {ok:false, error:e.message};
    }
  };

  const homeScreen = role==="employee"
    ? <EmployeeHome me={me} orders={orders} onNav={handleNav} onOrder={handleOrder} role={role} setRole={handleSetRole} />
    : role==="resident"
    ? <ResidentHome me={me} api={api} orders={orders} onOrder={handleOrder} onCreated={handleCreated} onNav={handleNav} submissionsReachOffice={initial.submissionsReachOffice!==false} role={role} setRole={handleSetRole} />
    : role==="vendor"
    ? <VendorHome me={me} orders={orders} onOrder={handleOrder} role={role} setRole={handleSetRole} />
    : role==="applicant"
    ? <ApplicantHome me={me} applicationsEnabled={initial.applicationsEnabled!==false} role={role} setRole={handleSetRole} />
    : <OwnerHome me={me} inspections={inspections} balances={initial.balances} properties={initial.properties} balancesEnabled={initial.balancesEnabled!==false} role={role} setRole={handleSetRole} />;

  const sharedProps = {role, setRole:handleSetRole, canViewAs, me, properties:initial.properties};
  const navActive = ["detail","assign","inspection","inspections","neworder","templates"].includes(screen) ? "orders" : screen;

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
    <div style={{background:"#071223",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"0"}}>
      {/* Fills the screen on a real phone; keeps the demo frame on desktop. */}
      <div className="fl-app" style={{width:"min(390px,100vw)",height:"min(844px,100dvh)",background:C.bg,overflow:"hidden",display:"flex",flexDirection:"column",fontFamily:"var(--font-body), -apple-system, sans-serif",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale",position:"relative"}}>
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
          .fl-app input:focus:not([style*="transparent"]),.fl-app textarea:focus,.fl-app select:focus{border-color:${C.primary} !important;box-shadow:0 0 0 3px rgba(13,27,51,.14)}
        `}</style>
        {/* A write that failed after the screen already moved on. Tapping dismisses. */}
        {notice && (
          <div onClick={()=>setNotice("")} className="fl-fade" style={{position:"absolute",top:12,left:12,right:12,zIndex:60,background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:13,padding:"11px 13px",display:"flex",gap:10,alignItems:"flex-start",boxShadow:"0 10px 30px rgba(0,0,0,.22)",cursor:"pointer"}}>
            <Icon name="warning" size={17} style={{color:"#B91C1C",marginTop:1,flexShrink:0}} />
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12.5,fontWeight:700,color:"#B91C1C",marginBottom:2}}>Not saved</div>
              <div style={{fontSize:11.5,color:"#B91C1C",opacity:.9,lineHeight:1.45,wordBreak:"break-word"}}>{notice}</div>
            </div>
          </div>
        )}
        {screen==="home"       && homeScreen}
        {screen==="orders"     && <OrdersScreen      orders={orders} onOrder={handleOrder} onNav={handleNav} onNewOrder={()=>setScreen("neworder")} onInspection={()=>setScreen("inspection")} {...sharedProps} />}
        {screen==="detail"     && selectedOrder   && <DetailScreen   order={selectedOrder}  orders={orders} setOrders={setOrders} onUpdateOrder={updateOrderLocal} onBack={()=>setScreen("orders")} onAssign={handleAssign} {...sharedProps} />}
        {screen==="assign"     && assigningOrder  && <AssignScreen   order={assigningOrder} orders={orders} setOrders={setOrders} onUpdateOrder={updateOrderLocal} onBack={()=>setScreen("detail")} {...sharedProps} />}
        {screen==="messages"   && <MessagesScreen    messages={initial.messages} messagingEnabled={initial.messagingEnabled!==false} onNav={handleNav} {...sharedProps} />}
        {screen==="profile"    && <ProfileScreen     me={me} role={role} setRole={handleSetRole} onNav={handleNav} onSignOut={onSignOut} canViewAs={canViewAs} />}
        {screen==="inspections"&& <InspectionsScreen onBack={()=>handleNav("home")} onNewInspection={()=>setScreen("inspection")} {...sharedProps} />}
        {screen==="inspection" && <InspectionScreen  onBack={()=>setScreen("orders")} templates={templates} onManageTemplates={()=>setScreen("templates")} onInspectionDone={handleInspectionDone} {...sharedProps} />}
        {screen==="templates"  && <TemplatesScreen   onBack={()=>setScreen("inspection")} templates={templates} setTemplates={setTemplates} api={api} {...sharedProps} />}
        {screen==="neworder"   && <NewWorkOrderScreen onBack={()=>setScreen("orders")} onCreated={handleCreated} {...sharedProps} />}
        <NavBar active={navActive} onNav={handleNav} role={role} />
      </div>
    </div>
    </LiveCtx.Provider>
  );
}
