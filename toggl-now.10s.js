#!/usr/bin/env /usr/local/bin/node

/**
 * <bitbar.title>toggl-now</bitbar.title>
 * <bitbar.version>v0.1.0</bitbar.version>
 * <bitbar.author>Masahiko Okada</bitbar.author>
 * <bitbar.author.github>moqada</bitbar.author.github>
 * <bitbar.desc>Toggl current time entry viewer</bitbar.desc>
 * <bitbar.image>https://i.gyazo.com/7c8f77df26291e76e2a66ed75876f08e.png</bitbar.image>
 * <bitbar.dependencies>node</bitbar.dependencies>
 * <bitbar.abouturl>https://github.com/moqada/bitbar-toggl-now</bitbar.abouturl>
 */
var fs = require('fs');
var https = require('https');

var CONFIG_FILE_PATH = `${process.env.HOME}/.config/bitbar-toggl-now/api_token`;
var scriptPath = process.argv[1];

/**
 * @param {number} num - number
 * @return {string}
 */
function pad(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * @param {Object} [data] - data
 * @param {number} data.duration - duration
 * @param {string} data.description - description
 * @return {string}
 */
function format(data) {
  return [
    head(data),
    '---',
    menu(data)
  ].join('\n');
}

/**
 * @param {Object} [data] - data
 * @param {number} data.duration - duration
 * @param {string} data.description - description
 * @return {string}
 */
function head(data) {
  var h, icon, m;
  if (data === null) {
    return '-:--';
  }
  icon = String.fromCodePoint(0x23F1);  // STOPWATCH
  m = Number.parseInt(data.duration / 1000 / 60, 10);
  h = Number.parseInt(m / 60, 10);
  return `${icon}${h}:${pad(m % 60)}`;
}

/**
 * @param {Object} [data] - data
 * @param {number} data.duration - duration
 * @param {string} data.description - description
 * @return {string}
 */
function menu(data) {
  var outputs = [];
  var icons = {
    start: String.fromCodePoint(0x25b6),
    stop: String.fromCodePoint(0x25fc)
  };
  if (data === null) {
    outputs.push('Timer is not Tracking');
  } else {
    outputs.push(`${data.description || '(No description)'}`);
  }
  outputs.push('---');
  outputs.push(`${icons.start} Start Timer | terminal=false bash=${scriptPath} param1=start`);
  outputs.push(`${icons.stop} Stop Timer | terminal=false bash=${scriptPath} param1=stop`);
  return outputs.join('\n');
}

/**
 * @return {string}
 */
function loadApiToken() {
  return fs.readFileSync(CONFIG_FILE_PATH, {encoding: 'utf8'}).trim();
}

/**
 * @param {string} method - method
 * @param {string} path - path
 * @param {Object} postData - post data
 * @return {Promise<Object, Error>}
 */
function request(method, path, postData) {
  return new Promise((resolve, reject) => {
    var apiToken = loadApiToken();
    var req = https.request({
      headers: {Authorization: `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`},
      hostname: 'www.toggl.com',
      method,
      path
    }, res => {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(res);
        }
        return resolve({
          json: JSON.parse(data),
          response: res
        });
      });
    });
    req.on('error', err => reject(err));
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

/**
 * @return {Promise<Object, Error>}
 */
function userMe() {
  return request('GET', '/api/v8/me').then(res => {
    return res.json.data;
  });
}

/**
 * @return {Promise<Object|null, Error>}
 */
function stop() {
  return current().then(entry => {
    if (!entry) {
      return null;
    }
    return request('PUT', `/api/v8/time_entries/${entry.id}/stop`);
  });
}

/**
 * @return {Promise<Object, Error>}
 */
function start() {
  return userMe().then(user => {
    return user.default_wid;
  }).then(wid => {
    return request('POST', '/api/v8/time_entries/start', {
      time_entry: {
        created_with: 'bitbar-toggl-now',
        wid
      }
    });
  });
}

/**
 * @return {Promise<null|Object, Error>}
 */
function current() {
  return request('GET', '/api/v8/time_entries/current').then(res => {
    var entry = res.json.data;
    if (!entry) {
      return null;
    }
    return entry;
  });
}

/**
 * @return {Promise<string, Error>}
 */
function exec() {
  var args = process.argv.slice(2);
  var cmd = args.length > 0 ? args[0] : null;
  var promise = Promise.resolve();
  if (cmd === 'stop') {
    promise = stop();
  } else if (cmd === 'start') {
    promise = start();
  }
  return promise.then(current).then(entry => {
    if (!entry) {
      return format(null);
    }
    if (entry.duration > 0) {
      return format(null);
    }
    return format({
      description: entry.description,
      duration: Date.now() + entry.duration * 1000
    });
  });
}

exec().then(console.log).catch(console.error);
