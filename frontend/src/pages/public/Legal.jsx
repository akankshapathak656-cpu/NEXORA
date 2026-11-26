import { useEffect } from 'react';
import { PublicNav } from '../../components/ui/PublicNav.jsx';
import { PublicFooter } from '../../components/ui/Footer.jsx';
import { useAppState, resetState } from '../../store/state.js';
import { go } from '../../routes.js';

// Legacy: legal(k) (app.js lines 133-150) and clearData() (line 151).
// Draft text and [TBD] markers are copied from the legacy page and must stay as they are until counsel signs off.

function TBD({ children }) {
  return <mark className="tbd">[{children}]</mark>;
}

function ClearDataButton() {
  const onClear = () => {
    if (!window.confirm('Remove all data this demo has stored in this browser? This cannot be undone.')) return;
    resetState();
    go('');
  };
  return <button className="btn" onClick={onClear}>Clear data stored by this demo</button>;
}

function TermsBody() {
  return (
    <>
      <p className="fine">Draft prepared 25 November 2026</p>
      <div className="draft"><b>Draft for review.</b> This page describes the prototype as it works today. It has not been reviewed by a lawyer. Items in <TBD>brackets</TBD> must be completed by NEXORA before anyone relies on this page.</div>
      <h2>1. The service</h2>
      <p>NEXORA is a front-end prototype that demonstrates resume screening with sample data. It is operated by <TBD>operator legal name and registered address</TBD>.</p>
      <h2>2. What it does and does not do</h2>
      <ul>
        <li>It runs in your browser. No server receives your inputs in this version.</li>
        <li>Sign-in is a demonstration. No real authentication is performed.</li>
        <li>Scores come from a fixed weighted formula based on skills, experience, education, projects and job wording. They are advisory and are not hiring decisions.</li>
        <li>Emails are simulated. None are delivered.</li>
      </ul>
      <h2>3. Your responsibilities</h2>
      <ul>
        <li>You make every hiring decision. Do not rely on a score alone, and check the evidence and the "verify" list for each candidate.</li>
        <li>You are responsible for following the employment, anti-discrimination and data protection laws that apply to you. <TBD>counsel to confirm wording and jurisdictions</TBD></li>
        <li>Do not enter information you have no right to use.</li>
      </ul>
      <h2>4. Sample data</h2>
      <p>The candidates, organization and figures shown are sample data. <TBD>confirm that all sample candidates are fictional</TBD></p>
      <h2>5. Warranty and liability</h2>
      <p><TBD>warranty disclaimer and limitation of liability to be written by counsel</TBD></p>
      <h2>6. Changes, governing law and contact</h2>
      <p>Changes to these terms: <TBD>how and when users are notified</TBD>. Governing law and courts: <TBD>jurisdiction</TBD>. Contact: <TBD>contact email</TBD>.</p>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <p className="fine">Draft prepared 25 November 2026</p>
      <div className="draft"><b>Draft for review.</b> This page describes what the prototype does today. It has not been reviewed by a lawyer. Items in <TBD>brackets</TBD> must be completed by NEXORA. If a server, accounts or real resume processing are added, this policy must be rewritten first.</div>
      <h2>1. Who is responsible</h2>
      <p><TBD>operator legal name, address and contact email</TBD></p>
      <h2>2. Where your data goes</h2>
      <p>This version runs entirely in your browser. The app itself sends nothing to a server and loads no third-party fonts, scripts, analytics or ads. It sets no cookies. <TBD>confirm what the hosting provider logs, such as IP addresses in server logs</TBD></p>
      <h2>3. What is stored in your browser</h2>
      <p>The app saves the following under one key, <code>nexora.v2</code>, in your browser's local storage:</p>
      <ul>
        <li>Sign-in state, theme, and the selected job, including any custom jobs and pasted job descriptions you add.</li>
        <li>Settings, such as the profile name, organization name and the blind review switch.</li>
        <li>Candidate status changes, edits you make to candidate fields, and checklist ticks.</li>
        <li>Candidates you add from uploaded files: a name guessed from the file name, plus the skills, experience, education and project text you enter.</li>
        <li>The simulated email log.</li>
      </ul>
      <h2>4. Uploaded files</h2>
      <p>When you choose a resume file, your browser checks its extension, size and the first bytes of the file. Your browser then reads the text of the file on your device to fill in the candidate’s details. The first time you add a PDF or DOCX it loads two open-source libraries (PDF.js and Mammoth.js) from a public CDN, so that CDN can see your IP address and the request. The file itself is not uploaded. Only the file name and the details you confirm (including skills, education, projects, certifications, work-history lines and the short resume lines quoted as skill evidence) are kept in this browser.</p>
      <h2>5. Deleting your data</h2>
      <p>You can remove everything this prototype has stored in this browser.</p>
      <div className="row" style={{ marginTop: 8 }}>
        <ClearDataButton />
      </div>
      <h2>6. Future processing and your rights</h2>
      <p>Resumes contain personal data. If a server is added, this section must state <TBD>what data is collected, why, the legal basis, retention period, processors, international transfers and how people can exercise their rights in each jurisdiction</TBD>.</p>
    </>
  );
}

export default function Legal({ route }) {
  const auth = useAppState((s) => s.auth);
  const isTerms = route === 'terms';
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy';

  useEffect(() => {
    document.title = `NEXORA | ${title} (draft)`;
  }, [title]);

  return (
    <>
      <PublicNav signedIn={!!auth} />
      <main id="m" tabIndex={-1} className="legal">
        <h1>{title}</h1>
        {isTerms ? <TermsBody /> : <PrivacyBody />}
        <p style={{ marginTop: 36 }}><a className="link" href="/">Back to home</a></p>
      </main>
      <PublicFooter />
    </>
  );
}
