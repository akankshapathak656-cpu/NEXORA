// Legacy: hd(t, s). Page title block with the demo-data chip.
// Shared by Work and Admin. API.live is false in legacy, so the chip always reads "Simulated demo data".
import { Chip } from '../../components/ui/Chip.jsx';

export function PageHead({ title, sub }) {
  return (
    <div className="top">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <Chip kind="tr" title="No backend is connected. Scores come from a simple demo formula.">
        Simulated demo data
      </Chip>
    </div>
  );
}
