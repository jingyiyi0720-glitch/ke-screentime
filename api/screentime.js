const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || '/data';
const DATA_FILE = path.join(DATA_DIR, 'screentime.json');
const TIMEOUT_MINUTES = 30;

function getNowCST() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function getTodayStr() {
  return getNowCST().toISOString().slice(0, 10);
}

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function readData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) return { apps: {} };
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { apps: {} };
  }
}

function writeData(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = async (req, res) => {
  const url = req.url || '';
  const parts = url.split('/').filter(Boolean);

  if (parts.includes('toggle')) {
    const raw = decodeURIComponent(parts[parts.length - 1]);
    const appName = raw.split('?')[0];
    if (!appName || appName === 'toggle') return jsonResponse(res, 400, { error: 'Missing app name' });

    const now = getNowCST();
    const today = getTodayStr();
    const timeStr = now.toTimeString().slice(0, 5);
    const data = readData();
    if (!data.apps) data.apps = {};
    if (!data.apps[appName]) data.apps[appName] = { date: today, sessions: [], total_minutes: 0, last_state: 'closed' };
    if (data.apps[appName].date !== today) {
      data.apps[appName] = { date: today, sessions: [], total_minutes: 0, last_state: 'closed' };
    }
    const app = data.apps[appName];

    if (app.last_state === 'open' && app.open_time) {
      const mins = Math.round((now - new Date(app.open_time)) / 60000);
      if (mins >= TIMEOUT_MINUTES) {
        app.last_state = 'closed';
        app.total_minutes += TIMEOUT_MINUTES;
        if (app.sessions.length > 0) {
          app.sessions[app.sessions.length - 1].close = timeStr;
          app.sessions[app.sessions.length - 1].minutes = TIMEOUT_MINUTES;
        }
        delete app.open_time;
      }
    }

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
    writeData(data);
    return jsonResponse(res, 200, { app: appName, state: app.last_state, total_minutes: app.total_minutes, time: timeStr });
  }

  if (parts.includes('query')) {
    const data = readData();
    const today = getTodayStr();
    const now = getNowCST();

    if (data.apps) {
      for (const [, app] of Object.entries(data.apps)) {
        if (app.date === today && app.last_state === 'open' && app.open_time) {
          const mins = Math.round((now - new Date(app.open_time)) / 60000);
          if (mins >= TIMEOUT_MINUTES) {
            app.last_state = 'closed';
            app.total_minutes += TIMEOUT_MINUTES;
            const timeStr = now.toTimeString().slice(0, 5);
            if (app.sessions.length > 0) {
              app.sessions[app.sessions.length - 1].close = timeStr;
              app.sessions[app.sessions.length - 1].minutes = TIMEOUT_MINUTES;
            }
            delete app.open_time;
          }
        }
      }
    }

    const summary = Object.entries(data.apps || {})
      .filter(([, info]) => info.date === today)
      .map(([app, info]) => {
        let total = info.total_minutes;
        if (info.last_state === 'open' && info.open_time) {
          total += Math.round((now - new Date(info.open_time)) / 60000);
        }
        return { app, total_minutes: total, sessions: info.sessions, state: info.last_state };
      })
      .sort((a, b) => b.total_minutes - a.total_minutes);

    return jsonResponse(res, 200, { date: today, apps: summary, time: now.toTimeString().slice(0, 5) });
  }

  return jsonResponse(res, 404, { error: 'Not found' });
};
