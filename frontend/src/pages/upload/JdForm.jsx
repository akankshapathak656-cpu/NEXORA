// Custom job description: the paste form, the "From your job description" summary and the quick "New job" form.
// Port of legacy jdPanel() (app.js 332-340), jdSummary() (342-356), jdBd() (341) and the addJob form (line 210, markup in 707).
import { useEffect, useRef, useState } from 'react';
import { setState, useAppState } from '../../store/state.js';
import { allJobs } from '../../store/context.js';
import { addCustomJob, updateCustomJob, setJdField, toggleJdPanel, clearJdPanel, openJdEditor } from '../../store/actions.js';
import { createJob } from '../../lib/api.js';
import { jdSummary, JDMAX, JDDESC } from '../../lib/jd.js';
import { useToast } from '../../components/ui/Toast.jsx';
import { ChipList } from '../../components/ui/Chip.jsx';
import { buildJobDescription, buildQuickJob, JD_FIELDS } from './jdBuild.js';

// Optional fields: [key, label, input kind, placeholder]. Legacy JDF.
const JDF = [
  ['title', 'Job title', 'i', 'e.g. Frontend Developer'],
  ['req', 'Required skills', 'i', 'Comma separated, e.g. React, JavaScript, Git'],
  ['pref', 'Preferred skills', 'i', 'Comma separated'],
  ['exp', 'Required experience', 'i', 'e.g. 2+ years'],
  ['edu', 'Education', 'i', 'e.g. B.Tech, BCA'],
  ['resp', 'Responsibilities', 't', 'One per line'],
  ['oth', 'Other requirements', 't', 'One per line'],
];

// Source badge for an extracted field. Legacy jdBd().
export function JdBadge({ source }) {
  if (source == 'jd') return <span className="chip ok">Extracted from JD</span>;
  if (source == 'user') return <span className="chip tr">Entered by you</span>;
  return <span className="chip no">Not found in the JD</span>;
}

// One labelled row in the summary. Legacy row().
function Row({ label, source, children }) {
  return (
    <>
      <p style={{ margin: '12px 0 2px' }}><b>{label}</b> <JdBadge source={source} /></p>
      {children}
    </>
  );
}

// Summary of the JD behind the selected job. Legacy jdSummary(j). Returns null for a job without a JD.
export function JdSummary({ job, index }) {
  const v = jdSummary(job);
  if (!v) return null;
  const list = items => <ul style={{ margin: '4px 0 0 18px' }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 2 }}>
      <p style={{ margin: '10px 0 0' }}><b>From your job description</b> <span className="chip tr">Saved in this browser</span></p>
      <Row label="Job title" source={v.title.s}>
        {v.title.v
          ? <p style={{ margin: '2px 0' }}>{v.title.v}</p>
          : <p style={{ margin: '2px 0', color: 'var(--mu)' }}>No title was found, so this job is named “{job.t}”. You can enter a title under Edit JD.</p>}
      </Row>
      {v.reqNote ? <p className="fine" style={{ margin: '6px 0 0' }}>{v.reqNote}</p> : null}
      <Row label="Preferred skills" source={v.pref.s}>{v.pref.v.length ? <ChipList items={v.pref.v} /> : null}</Row>
      {v.men ? (
        <Row label="Other skills named in the JD" source="jd">
          <ChipList items={v.men.v} />
          <p className="fine" style={{ margin: '4px 0 0' }}>Not counted as required. Add them under Edit JD if they are required.</p>
        </Row>
      ) : null}
      <Row label="Required experience" source={v.exp.s}>{v.exp.v ? <p style={{ margin: '2px 0' }}>{v.exp.v}</p> : null}</Row>
      <Row label="Education" source={v.edu.s}>{v.edu.v ? <p style={{ margin: '2px 0' }}>{v.edu.v}</p> : null}</Row>
      <Row label="Responsibilities" source={v.resp.s}>
        {v.resp.v.length ? <details><summary style={{ cursor: 'pointer' }}>{v.resp.v.length} listed</summary>{list(v.resp.v)}</details> : null}
      </Row>
      <Row label="Other requirements" source={v.oth.s}>
        {v.oth.v.length ? <details><summary style={{ cursor: 'pointer' }}>{v.oth.v.length} listed</summary>{list(v.oth.v)}</details> : null}
      </Row>
      <p className="fine" style={{ margin: '12px 0 0' }}>Every resume is scored against this job: required and preferred skills, relevant experience, education and responsibilities, where the JD states them. Other requirements are not scored.</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={() => openJdEditor(index, job)}>Edit JD</button>
      </div>
    </div>
  );
}

// The paste panel. Legacy jdPanel(). ctx and vocab are the resume context and skill names, built by the page.
export function JdPanel({ ctx, vocab }) {
  const d = useAppState(s => s.jdd);
  const jobs = useAppState(s => allJobs(s));
  const toast = useToast();
  const [error, setError] = useState('');
  const [bad, setBad] = useState(null);
  const anyFilled = JDF.some(([k]) => d[k]);
  const [optOpen, setOptOpen] = useState(anyFilled);
  const formRef = useRef(null);
  const rawRef = useRef(null);

  // Focus the paste box after the panel opens from the "Paste job description" button (legacy jdFocus).
  useEffect(() => {
    if (d.open && rawRef.current) {
      rawRef.current.scrollIntoView({ block: 'center' });
      rawRef.current.focus({ preventScroll: true });
    }
  }, [d.open]);

  if (!d.open) return null;
  const editing = d.edit != null && jobs[d.edit] && jobs[d.edit].jd;
  const editName = editing ? jobs[d.edit].t : '';

  const fail = (message, id) => {
    setError(message);
    setBad(id);
    setOptOpen(true);
    if (id) {
      setTimeout(() => {
        const el = formRef.current && formRef.current.querySelector(`[id="${id}"]`);
        if (el) el.focus();
      }, 0);
    }
    return false;
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setBad(null);
    const U = {};
    JD_FIELDS.forEach(k => { U[k] = String(d[k] || '').trim() });
    const r = buildJobDescription(d.raw || '', U, { jobs, editIndex: editing ? d.edit : null, ctx, vocab });
    if (r.error) return fail(r.error, r.field);
    const job = r.job;
    if (editing) {
      updateCustomJob(d.edit, job);
    } else {
      try {
        const saved = await createJob({
          title: job.t,
          description: d.raw || JDDESC,
          required_skills: job.req,
          preferred_skills: job.jd.f.pref.v,
          experience_min: job.jd.f.exp.min ?? null,
          education: job.jd.f.edu.v || '',
          responsibilities: job.jd.f.resp.v || [],
        });
        job.apiId = saved.id;
        if (saved.id) {
          setState(s => ({ jobApiIds: { ...s.jobApiIds, [job.t]: saved.id } }));
        }
      } catch (err) {
        job.apiSyncError = true;
        console.error('NEXORA job description sync failed:', err);
      }
      addCustomJob(job);
    }
    toast('Job description saved and selected.' + r.note);
    return false;
  };

  const onField = (key, value, id) => {
    setJdField(key, value);
    if (bad === id) setBad(null);
  };

  const cls = id => (bad === id ? 's3-bad' : undefined);

  return (
    <form className="card" id="jx" ref={formRef} style={{ marginTop: 16 }} onSubmit={submit} noValidate>
      <h3>Custom job description{editing ? ' · editing ' + editName : ''}</h3>
      <p>Paste the complete job description. NEXORA reads it in your browser with the same skill dictionary and section rules it uses for resumes, saves the result as the job, and screens every candidate against it. No AI model is used, so check what was extracted. Nothing is filled in for you: anything the text does not state is shown as not found.</p>
      <label htmlFor="jx-raw">Full job description</label>
      <textarea
        id="jx-raw"
        ref={rawRef}
        className={cls('jx-raw')}
        maxLength={JDMAX}
        placeholder="Paste the full job description here"
        style={{ minHeight: 240, marginTop: 6 }}
        value={d.raw || ''}
        onChange={e => onField('raw', e.target.value, 'jx-raw')}
      />
      <details id="jx-opt" style={{ marginTop: 12 }} open={optOpen} onToggle={e => setOptOpen(e.currentTarget.open)}>
        <summary style={{ cursor: 'pointer' }}><b>Optional details</b> · leave blank to extract them from the pasted text</summary>
        <p className="fine">A field you fill in replaces what was extracted for that field.</p>
        <div className="two" style={{ marginTop: 8 }}>
          {JDF.map(([key, label, kind, placeholder]) => (
            <div key={key} style={{ minWidth: 0 }}>
              <label htmlFor={`jx-${key}`}>{label}</label>
              <p style={{ margin: '4px 0 0' }}>
                {kind == 'i' ? (
                  <input id={`jx-${key}`} className={cls(`jx-${key}`)} style={{ width: '100%' }} value={d[key] || ''} placeholder={placeholder} maxLength={400} onChange={e => onField(key, e.target.value, `jx-${key}`)} />
                ) : (
                  <textarea id={`jx-${key}`} className={cls(`jx-${key}`)} style={{ width: '100%', minHeight: 90 }} placeholder={placeholder} value={d[key] || ''} onChange={e => onField(key, e.target.value, `jx-${key}`)} />
                )}
              </p>
            </div>
          ))}
        </div>
      </details>
      <p id="jx-err" role="alert" style={{ color: 'var(--rd)', margin: '10px 0 0' }}>{error}</p>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn p sm">{editing ? 'Update and use this JD' : 'Extract and use this JD'}</button>
        <button type="button" className="btn sm" onClick={() => toggleJdPanel()}>Cancel</button>
        <button type="button" className="btn sm" onClick={() => clearJdPanel()}>Clear</button>
      </div>
    </form>
  );
}

// Quick "New job" form: a title and at least three required skills. Legacy addJob().
export function QuickJobForm({ vocab }) {
  const jobs = useAppState(s => allJobs(s));
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    const r = buildQuickJob(title, skills, { jobs, vocab });
    if (r.error) { setError(r.error); return false }
    setError('');
    const job = r.job;
    try {
      const saved = await createJob({ title: job.t, description: job.d, required_skills: job.req, preferred_skills: [] });
      job.apiId = saved.id;
      if (saved.id) {
        setState(s => ({ jobApiIds: { ...s.jobApiIds, [job.t]: saved.id } }));
      }
    } catch (err) {
      job.apiSyncError = true;
      console.error('NEXORA job sync failed:', err);
    }
    addCustomJob(job);
    toast(job.apiId ? 'Job created and synced' : 'Job created locally; backend sync failed');
    return false;
  };

  return (
    <form className="card" style={{ marginTop: 12 }} onSubmit={submit} noValidate>
      <label htmlFor="nt">Job title</label>
      <input id="nt" style={{ width: '100%' }} value={title} onChange={e => setTitle(e.target.value)} />
      <p><label htmlFor="ns">Required skills, comma separated (at least 3)</label></p>
      <input id="ns" style={{ width: '100%' }} placeholder="React, Git, Testing" value={skills} onChange={e => setSkills(e.target.value)} />
      <p id="ne" role="alert" style={{ color: 'var(--rd)', margin: '6px 0' }}>{error}</p>
      <button className="btn p sm">Create job</button>
    </form>
  );
}
