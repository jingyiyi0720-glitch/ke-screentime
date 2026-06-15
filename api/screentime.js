const BIN_ID = '6a3007aeda38895dfec4024e';
const API_KEY = '$2a$10$TNOdj2mIgssxf2Qm9jyRMeS426aeHTrXT4J5KGdNDKhhXNnUbo7ZK';
const BASE_URL = 'https://api.jsonbin.io/v3/b/' + BIN_ID;

function getNowCST() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function getTodayStr() {
  return getNowCST().toISOString().slice(0, 10);
}

async function readData() {
  const r = await fetch(BASE_URL + '/latest', {
    headers: { 'X-Master-Key': API_KEY }
  });
  const j = await r.json();
  return j.record || { apps: {} };
}

async function writeData(data) {
  await fetch(BASE_URL, {
    method: 'PUT',
    headers: { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url || '';
  const parts = url.split('/').filter(Boolean);

  if (parts.includes('toggle')) {
    const appName = decodeURIComponent(parts[parts.length - 1]);
    if (!appName || appName === 'toggle') return res.status(400).json({ error: 'Missing app name' });
    const now = getNowCST();
    const today = getTodayStr();
    const timeStr = now.toTimeString().slice(0, 5);
    const data = await readData();
    if (!data.apps) data.apps = {};
    if (!data.apps[appName]) data.apps[appName] = { date: today, sessions: [], total_minutes: 0, last_state: 'closed' };
    if (data.apps[appName].date !== today) {
      data.apps[appName] = { date: today, sessions: [], total_minutes: 0, last_state: 'closed' };
    }
    const app = data.apps[appName];
    if (app.last_state === 'closed') {
      app.last_state = 'open';
      app.open_time = now.toISOString();
      app.sessions.push({ open: timeStr });
    } else {
      app.last_state = 'closed';
      if (app.open_time) {
        const mins = Math.round((now - new Date(app.open_time)) / 60000);
        app.total_minutes += mins;
        if (app.sessions.length > 0) {
          app.sessions[app.sessions.length - 1].close = timeStr;
          app.sessions[app.sessions.length - 1].minutes = mins;
        }
      }
      delete app.open_time;
    }
    await writeData(data);
    return res.status(200).json({ app: appName, state: app.last_state, total_minutes: app.total_minutes, time: timeStr });
  }

  if (parts.includes('query')) {
    const data = await readData();
    const today = getTodayStr();
    const now = getNowCST();
    const summary = Object.entries(data.apps || {})
      .filter(([, info]) => info.date === today)
      .map(([app, info]) => ({ app, total_minutes: info.total_minutes, sessions: info.sessions.length, state: info.last_state }))
      .sort((a, b) => b.total_minutes - a.total_minutes);
    return res.status(200).json({ date: today, apps: summary, time: now.toTimeString().slice(0, 5) });
  }

  return res.status(404).json({ error: 'Not found' });
};
