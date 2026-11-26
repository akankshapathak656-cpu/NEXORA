// Job picker used by the Upload and Match pages. Legacy jobSel(): changing the job runs setJob().
import { useAppState } from '../store/state.js';
import { allJobs } from '../store/context.js';
import { setJob } from '../store/actions.js';

export function JobSelect() {
  const state = useAppState();
  const jobs = allJobs(state);
  return (
    <select aria-label="Job" value={state.job} onChange={e => setJob(+e.target.value)}>
      {jobs.map((x, i) => <option key={i} value={i}>{x.t}</option>)}
    </select>
  );
}
