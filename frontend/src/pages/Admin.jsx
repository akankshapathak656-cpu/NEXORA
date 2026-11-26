// Port of legacy admin() (app.js line 1288): profile, preferences and privacy, users and roles.
// Settings are written through setState so they persist under the legacy key.
import { useState } from 'react';
import { useAppState, setState } from '../store/state.js';
import { go } from '../routes.js';
import { useToast } from '../components/ui/Toast.jsx';
import { PageHead } from './work/PageHead.jsx';

// Legacy T: toggles in the Preferences card.
const TOGGLES = [
  ['mfa', 'Two-factor authentication'],
  ['mail', 'Email notifications'],
  ['blind', 'Blind review (hide names)'],
];
const RETENTION = ['6 months', '12 months', '24 months'];
const USERS = [
  ['HR Admin', 'Admin'],
  ['Recruiter', 'Recruiter'],
  ['Hiring Manager', 'Viewer'],
];
const ROLES = ['Admin', 'Recruiter', 'Viewer'];

export default function Admin() {
  const set = useAppState(s => s.set);
  const toast = useToast();
  const [name, setName] = useState(set.name);
  const [org, setOrg] = useState(set.org);

  const saveProfile = () => {
    const nextName = name.trim() || set.name;
    setState(s => ({ set: { ...s.set, name: nextName, org } }));
    setName(nextName);
    toast('Profile saved');
  };

  const toggle = (key, label, on) => {
    setState(s => ({ set: { ...s.set, [key]: on } }));
    toast(`${label}: ${on ? 'on' : 'off'}`);
  };

  const setRetention = value => {
    setState(s => ({ set: { ...s.set, ret: value } }));
    toast('Retention: ' + value);
  };

  const signOut = () => {
    setState({ auth: 0 });
    go('login');
  };

  return (
    <>
      <PageHead title="Admin & settings" sub="Profile, organization, users and privacy" />
      <div className="two">
        <div className="card">
          <h3>Recruiter profile</h3>
          <p>
            <label htmlFor="pn2">Name</label>
          </p>
          <input id="pn2" value={name} onChange={e => setName(e.target.value)} />
          <p>
            <label htmlFor="po">Organization</label>
          </p>
          <input id="po" value={org} onChange={e => setOrg(e.target.value)} />
          <div className="row">
            <button className="btn p sm" onClick={saveProfile}>Save</button>
          </div>
          <h3 style={{ marginTop: 18 }}>Authentication</h3>
          <p>Password reset is simulated in this prototype.</p>
          <div className="row">
            <button className="btn sm" onClick={() => toast('Password reset link: simulated')}>Reset password</button>
            <button className="btn sm" onClick={signOut}>Sign out</button>
          </div>
        </div>
        <div className="card">
          <h3>Preferences & privacy</h3>
          {TOGGLES.map(([key, label]) => (
            <label className="li" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={!!set[key]}
                onChange={e => toggle(key, label, e.target.checked)}
              />
            </label>
          ))}
          <div className="li">
            <label htmlFor="rt">Data retention</label>
            <select id="rt" value={set.ret} onChange={e => setRetention(e.target.value)}>
              {RETENTION.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <h3 style={{ marginTop: 18 }}>Users & roles</h3>
          {USERS.map(([user, role]) => (
            <div className="li" key={user}>
              <span>{user}</span>
              <select
                aria-label={`Role for ${user}`}
                defaultValue={role}
                onChange={e => toast(`${user}: ${e.target.value}`)}
              >
                {ROLES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
