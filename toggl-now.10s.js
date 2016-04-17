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
  if (data === null) {
    return 'Timer is not Tracking';
  }
  return `${data.description || '(No description)'}`;
}

/**
 * @return {string}
 */
function loadApiToken() {
  return fs.readFileSync(CONFIG_FILE_PATH, {encoding: 'utf8'});
}

/**
 * @return {Promise<string, Error>}
 */
function exec() {
  return new Promise((resolve, reject) => {
    var apiToken = loadApiToken();
    var req = https.request({
      hostname: 'www.toggl.com',
      path: '/api/v8/time_entries/current',
      method: 'GET',
      headers: {
        Authorization: `Basic ${new Buffer(`${apiToken}:api_token`).toString('base64')}`
      }
    }, res => {
      var data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        var entry;
        if (res.statusCode !== 200) {
          return reject(res.statusMessage);
        }
        entry = JSON.parse(data).data;
        if (!entry) {
          return resolve(format(null));
        }
        if (entry.duration > 0) {
          return resolve(format(null));
        }
        return resolve(format({
          description: entry.description,
          duration: Date.now() + entry.duration * 1000
        }));
      });
    });
    req.on('error', err => reject(err));
    req.end();
  });
}

exec().then(console.log).catch(console.error);
