// Public support page.
//
// The App Store listing needs a Support URL that a reviewer can open without
// signing in and that reaches a real person. The home page redirects straight
// to login, so it cannot serve that purpose. This page answers the questions
// people actually get stuck on (which email to use, where the password is) and
// gives the office's real contact details. Same look as /privacy on purpose.

export const metadata = {
  title: "Help & Support · Stephen Fleming Realty",
  description: "How to sign in to the Stephen Fleming Realty app, and how to reach the office.",
};

const OFFICE_PHONE = "717-774-7791";
const CONTACT = "inspections@dangelore.com";
const ADDRESS = "19 N Railroad Ave, Suite 204, Mechanicsburg, PA 17055";

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

const Q = ({ q, children }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>{q}</div>
    <div>{children}</div>
  </div>
);

export default function Support() {
  return (
    <main style={{ background: C.bg, minHeight: "100vh", padding: "0 0 60px", fontFamily: "var(--font-body), -apple-system, sans-serif" }}>
      <div style={{ background: C.navy, padding: "28px 22px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 13, fontWeight: 600, letterSpacing: ".14em", color: C.gold, marginBottom: 10 }}>
            STEPHEN FLEMING REALTY
          </div>
          <h1 style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 30, fontWeight: 600, color: "#fff", margin: 0, lineHeight: 1.15 }}>
            Help &amp; Support
          </h1>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.7)", marginTop: 8 }}>For residents, owners, contractors and staff</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "26px 22px 0" }}>
        <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: "26px 24px", boxShadow: "0 1px 2px rgba(13,27,51,.05), 0 4px 16px rgba(13,27,51,.06)" }}>

          <Section title="Reach the office">
            <p style={{ margin: "0 0 8px" }}>
              Phone: <a href={`tel:${OFFICE_PHONE.replace(/-/g, "")}`} style={{ color: C.navy, fontWeight: 600 }}>{OFFICE_PHONE}</a>
            </p>
            <p style={{ margin: "0 0 8px" }}>
              Email: <a href={`mailto:${CONTACT}`} style={{ color: C.navy, fontWeight: 600 }}>{CONTACT}</a>
            </p>
            <p style={{ margin: 0, color: C.muted }}>{ADDRESS}</p>
          </Section>

          <Section title="Signing in">
            <Q q="Where do I get a password?">
              There isn't one. Enter your email address and we send you a link. Tap the link and you're in.
              The link works on whichever device you open it on, and it expires after about an hour.
            </Q>
            <Q q="It says my email isn't recognised.">
              Use the email address the office has on file for you, which may not be the one you use day to day.
              If you're not sure which that is, call the office and they can tell you.
            </Q>
            <Q q="I signed in but the app is empty.">
              That means your email address hasn't been matched to your unit yet. Call the office and they'll link it.
              Once they do, sign out and back in.
            </Q>
            <Q q="The link didn't arrive.">
              Check your spam or junk folder. If it's not there after a couple of minutes, go back and request another one.
            </Q>
          </Section>

          <Section title="Using the app">
            <Q q="How do I report a maintenance problem?">
              Tap <strong>Report an issue</strong>, describe the problem, and add a photo if you can. It goes straight to the office
              and you'll see its status update as it's scheduled and completed.
            </Q>
            <Q q="Is this the same as calling the office?">
              Yes. Requests made in the app land in the same system the office uses, so nothing gets lost between the two.
              For anything urgent, such as a leak or no heat, please also call {OFFICE_PHONE}.
            </Q>
          </Section>

          <Section title="Your account">
            <Q q="How do I delete my account?">
              Open <strong>Profile</strong> in the app and choose <strong>Delete my account</strong>. Your login is removed straight away.
              Your tenancy records stay with the office, as they're required to keep them; see the{" "}
              <a href="/privacy" style={{ color: C.navy, fontWeight: 600 }}>privacy policy</a> for what's kept and why.
            </Q>
          </Section>

          <div style={{ fontSize: 12.5, color: C.muted, borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8 }}>
            Stephen Fleming Realty is a trade name of D'Angelo Realty Group, Inc.
          </div>
        </div>
      </div>
    </main>
  );
}
