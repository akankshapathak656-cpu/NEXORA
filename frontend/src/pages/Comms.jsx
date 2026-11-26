// Candidate outreach. Port of legacy comms(), subm() and sendMail() (app.js lines 1041-1049).
import { useMemo } from 'react';
import { useAppState, setState } from '../store/state.js';
import { candidateStatus } from '../store/candidates.js';
import { displayName } from '../lib/text.js';
import { useToast } from '../components/ui/Toast.jsx';
import { PageHead, CandidateSelect } from '../components/CandParts.jsx';
import { makeCtx, rankedFor } from '../lib/review.js';
import { TEMPLATES, previewText } from '../lib/outreach.js';

const MAIL_STATUS = { draft: 'Draft', hr: 'Awaiting HR approval', ok: 'Approved', sent: 'Sent (simulated)' };

export default function Comms({ candidates, job }) {
  const state = useAppState();
  const toast = useToast();

  const ctx = useMemo(() => makeCtx(job, candidates), [job, candidates]);
  const ranked = useMemo(() => rankedFor(candidates, job, ctx), [candidates, job, ctx]);
  const c = candidates.find(x => x.id == state.sel) || candidates[0];
  if (!c) return null;

  const name = displayName(c, state.set);
  const template = TEMPLATES[state.tpl] || TEMPLATES[0];
  const body = state.body ?? template[1];
  const preview = previewText(body, c, job);

  const submit = () => {
    if (candidateStatus(c, state.status) == 'Rejected' && state.tpl == 0) {
      toast('This candidate is marked Rejected. Reopen them before sending an invitation');
      return;
    }
    setState({ mail: 'hr' });
  };

  const send = () => {
    const line = new Date().toLocaleTimeString() + ' · ' + template[0] + ' → ' + name + ' · simulated';
    setState(s => ({ logs: [line, ...s.logs], mail: 'sent' }));
    toast('Simulated send. No email delivered');
  };

  return (
    <>
      <PageHead title="Candidate outreach" sub="Emails are sent only after HR approval. Sending here is a simulation" />
      <div className="two">
        <div className="card">
          <div className="row" style={{ margin: 0 }}>
            <CandidateSelect list={ranked} value={c.id} set={state.set} />
            <label>Template{' '}
              <select value={state.tpl} onChange={e => setState({ tpl: +e.target.value, body: null, mail: 'draft' })}>
                {TEMPLATES.map((t, i) => <option key={i} value={i}>{t[0]}</option>)}
              </select>
            </label>
          </div>
          <p>Editable template</p>
          <textarea
            id="mb"
            aria-label="Email body"
            value={body}
            onChange={e => setState({ body: e.target.value, mail: 'draft' })}
          />
          <p>Preview</p>
          <div className="card" id="pv" style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{preview}</div>
          <div className="row">
            <span className="chip tr">{MAIL_STATUS[state.mail]}</span>
            {state.mail == 'draft' ? <button className="btn sm" onClick={submit}>Submit for approval</button> : null}
            {state.mail == 'hr' ? <button className="btn p sm" onClick={() => setState({ mail: 'ok' })}>HR: approve</button> : null}
            {state.mail == 'ok' ? <button className="btn p sm" onClick={send}>Send (simulated)</button> : null}
          </div>
        </div>
        <div className="card">
          <h3>Sending log</h3>
          {state.logs.length
            ? state.logs.map((l, i) => <div key={i} className="li">{l}</div>)
            : <p>No emails sent yet.</p>}
          <h3 style={{ marginTop: 14 }}>Communication history</h3>
          <div className="li">Acknowledgment · {name} · Delivered (sample)</div>
        </div>
      </div>
    </>
  );
}
