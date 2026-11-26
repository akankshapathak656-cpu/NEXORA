import { Plate } from './Plate.jsx';

// Legacy: foot(). The compact app footer.
export function Footer() {
  return (
    <footer className="foot" style={{ border: 0, padding: 0 }}>
      <span>
        © 2026 NEXORA · Frontend demo with sample data ·{' '}
        <a href="/terms" style={{ textDecoration: 'underline' }}>
          Terms
        </a>{' '}
        ·{' '}
        <a href="/privacy" style={{ textDecoration: 'underline' }}>
          Privacy
        </a>
      </span>
    </footer>
  );
}

// Legacy: pubFoot(). The landing and legal footer.
export function PublicFooter() {
  return (
    <footer className="foot">
      <div>
        <Plate height={48} />
        <p className="fine">© 2026 NEXORA · Frontend demo with sample data</p>
      </div>
      <nav aria-label="Footer">
        <a href="/dashboard">Dashboard</a>
        <a href="/upload">Resume upload</a>
        <a href="/match">Candidate analysis</a>
        <a href="/terms">Terms of Service</a>
        <a href="/privacy">Privacy Policy</a>
      </nav>
    </footer>
  );
}
