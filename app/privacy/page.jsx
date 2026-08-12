// Public privacy policy.
//
// Required twice over: the App Store listing needs a URL that is reachable
// without signing in, and Apple's privacy questionnaire has to match what this
// page says. It is deliberately specific about the data this app actually
// touches — home addresses, account balances, photographs of the inside of
// people's homes — rather than being a generic template, because a policy that
// does not describe the real app is worse than none.
//
// NOT legal advice, and it says so: a solicitor should read this before launch,
// since it covers financial data and residential addresses for real people.

export const metadata = {
  title: "Privacy Policy · Stephen Fleming Realty",
  description: "What the Stephen Fleming Realty app collects, why, and how to have it deleted.",
};

const UPDATED = "12 August 2026";
const OFFICE_PHONE = "717-774-7791";
const CONTACT = "inspections@dangelore.com";

const C = {
  navy: "#0D1B33", body: "#333", muted: "#4A6A80", border: "#E5E1D8",
  bg: "#F2F0EB", card: "#fff", gold: "#C8A15A",
};

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.navy, margin: "0 0 10px", letterSpacing: "-.01em" }}>{title}</h2>
      <div style={{ fontSize: 14.5, lineHeight: 1.7, color: C.body }}>{children}</div>
    </section>
  );
}

const Item = ({ what, why }) => (
  <li style={{ marginBottom: 9 }}>
    <strong style={{ color: C.navy }}>{what}</strong> — {why}
  </li>
);

export default function Privacy() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", padding: "0 0 60px", fontFamily: "var(--font-body), -apple-system, sans-serif" }}>
      <div style={{ background: C.navy, padding: "28px 22px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 13, fontWeight: 600, letterSpacing: ".14em", color: C.gold, marginBottom: 10 }}>
            STEPHEN FLEMING REALTY
          </div>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 30, fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.15 }}>
            Privacy Policy
          </h1>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 8 }}>Last updated {UPDATED}</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 22px 0" }}>
        <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: "26px 24px", boxShadow: "0 1px 2px rgba(13,27,51,.05), 0 4px 16px rgba(13,27,51,.06)" }}>

          <Section title="Who this is about">
            This app is provided by Stephen Fleming Realty for its residents, property
            owners, contractors and staff. It is a companion to the records the office
            already keeps — it does not replace them, and it is not a separate
            business relationship.
          </Section>

          <Section title="What the app stores about you">
            The app itself keeps very little. It holds:
            <ul style={{ paddingLeft: 20, margin: "10px 0 0" }}>
              <Item what="Your email address and name" why="so you can sign in, and so the office can match you to the record it already has for you." />
              <Item what="Your role" why="whether you are a resident, owner, contractor or member of staff. This decides what you are shown." />
              <Item what="A profile picture, if you add one" why="stored privately and shown only to people signed in to the app. You can remove it at any time." />
              <Item what="Photographs you take in the app" why="inspection and job-completion photos. These are evidence of work on a property and belong to the office." />
              <Item what="Which conversations you have opened" why="kept on your own device, not on our servers, so unread badges are accurate." />
              <Item what="A record of changes you make" why="if you create or change a maintenance request, we log who did it and what changed, so the office can answer questions about its own records later." />
            </ul>
          </Section>

          <Section title="What the app shows but does not own">
            Your tenancy, lease, unit, account balance, maintenance history and the
            property records are held in <strong>Buildium</strong>, the property
            management system Stephen Fleming Realty uses. The app reads that
            information and shows it to you. It is not a separate copy, and deleting
            your app account does not change it.
          </Section>

          <Section title="Who can see what">
            Access is decided on our servers, not in your browser, and is narrow by
            design:
            <ul style={{ paddingLeft: 20, margin: "10px 0 0" }}>
              <Item what="Residents" why="see only their own requests and their own balance. Never another resident's." />
              <Item what="Contractors" why="see only the jobs assigned to them, and cannot change anyone else's." />
              <Item what="Owners" why="see their own properties and their own balance." />
              <Item what="Staff" why="see the portfolio, because that is their job." />
            </ul>
          </Section>

          <Section title="Who we share it with">
            Nobody, other than the services needed to run the app: Buildium (the
            office&apos;s property system), Supabase (sign-in and storage), Vercel
            (hosting), Resend (email), and Google Maps (turning property addresses
            into map positions). We do not sell anything about you, we do not
            advertise, and there is no analytics or tracking in this app.
          </Section>

          <Section title="Email we send">
            Sign-in links, and — for staff — inspection reports, owner reports and
            notices when a contractor is assigned. There is no marketing email.
          </Section>

          <Section title="Deleting your account">
            Open <strong>Profile</strong> and choose <strong>Delete my account</strong>.
            It removes your sign-in and your profile picture immediately. You can sign
            up again afterwards with the same address.
            <p style={{ margin: "10px 0 0" }}>
              It does not end your tenancy, cancel a maintenance request, or remove you
              from Stephen Fleming Realty&apos;s records — those are the office&apos;s,
              and you would need to speak to the office to change them. Records of
              changes made through the app are kept as part of the office&apos;s own
              audit trail.
            </p>
          </Section>

          <Section title="Children">
            The app is for adults dealing with a tenancy or a property. It is not
            directed at children and we do not knowingly collect anything about them.
          </Section>

          <Section title="Asking us anything">
            Call the office on <a href={`tel:+1${OFFICE_PHONE.replace(/-/g, "")}`} style={{ color: C.navy, fontWeight: 700 }}>{OFFICE_PHONE}</a>,
            or email <a href={`mailto:${CONTACT}`} style={{ color: C.navy, fontWeight: 700 }}>{CONTACT}</a>.
            If you want a copy of what the app holds about you, or want it corrected,
            ask and we will sort it out.
          </Section>

          <Section title="Changes">
            If this policy changes materially we will update the date at the top and
            tell you in the app before the change takes effect.
          </Section>

        </div>

        <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, textAlign: "center", margin: "18px 6px 0" }}>
          Stephen Fleming Realty · Camp Hill, Pennsylvania
        </div>
      </div>
    </main>
  );
}
