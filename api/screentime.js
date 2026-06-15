const { kv } = require('@vercel/kv');

function getTodayKey() {
  const now = new Date();
  const cst = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return 'screentime:' + cst.toISOString().slice(0, 10);
}

function getNowCST() {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url || '';
  const parts = url.split('/').filter(Boolean);

  if (parts.includes('toggle')) {
    const appName = decodeURIComponent(parts[parts.length - 1]);
    if (!appName || appName === 'toggle') {
      return res.status(400).json({ error: 'Missing app name' });
    }
    const todayKey = getTodayKey();
    const nowCST = getNowCST();
    const timeStr = nowCST.toTimeString().slice(0, 5);
    let data = await kv.get(todayKey) || {};
    if (!data[appName]) {
      data[appName] = { sessions: [], total_minutes: 0, last_state: 'closed' };
    }
    const app = data[appName];
    if (app.last_state === 'closed') {
      app.last_state = 'open';
      app.open_time = nowCST.toISOString();
      app.sessions.push({ open: timeStr });
    } else {
      app.last_state = 'closed';
      if (app.open_time) {
        const minutes = Math.round((nowCST.getTime() - new Date(app.open_time).getTime()) / 60000);
        app.total_minutes += minutes;
        if (app.sessions.length > 0) {
          app.sessions[app.sessions.length - 1].close = timeStr;
          app.sessions[app.sessions.length - 1].minutes = minutes;
        }
      }
      delete app.open_time;
    }
    await kv.set(todayKey, data, { ex: 86400 });
    return res.status(200).json({ app: appName, state: app.last_state, total_minutes: app.total_minutes, time: timeStr });
  }

  if (parts.includes('query')) {
    const todayKey = getTodayKey();
    const data = await kv.get(todayKey) || {};
    const nowCST = getNowCST();
    const summary = Object.entries(data).map(([app, info]) => ({
      app, total_minutes: info.total_minutes, sessions: info.sessions.length, current_state: info.last_state
    })).sort((a, b) => b.total_minutes - a.total_minutes);
    return res.status(200).json({ date: nowCST.toISOString().slice(0, 10), apps: summary, generated_at: nowCST.toTimeString().slice(0, 5) });
  }

  return res.status(404).json({ error: 'Not found' });
};
