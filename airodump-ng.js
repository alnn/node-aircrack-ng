'use strict';

const os = require('os');
const spawn = require('child_process').spawn;
const EventEmitter = require('events').EventEmitter;

const IFace = require('./interface');
const aireplay = require('./aireplay-ng');

function parse(str) {

  const headers = [
    'BSSID PWR Beacons #Data, #/s CH MB ENC CIPHER AUTH ESSID',
    'BSSID STATION PWR Rate Lost Frames Probe'
  ];

  let result = {},
    headLine = '',
    headChunks = [],
    headPrefix;

  let lines = str.trim().split(new RegExp(os.EOL, 'g'));

  for (let i = 0; i < lines.length; i++) {

    lines[i] = lines[i].replace(/(\u001b\[J)|(\u001b\[1\;1H)/g, '').trim();

    if (lines[i].match(/Elapsed/)) {
      let chunks = lines[i].split('][');
      const lastIndex = chunks.length - 1;
      const handshakeIndex = chunks[lastIndex].indexOf('handshake');
      if (~handshakeIndex) {
        result.handshake = chunks[lastIndex].substr(handshakeIndex + 10).trim();
      }
      continue;
    }
    if (!lines[i].trim()) {
      continue;
    }

    // Detect header
    let headerIndex = headers.indexOf(lines[i].replace(/\s+/g, ' ').trim());

    if (~headerIndex) {
      headLine = lines[i];
      headChunks = headLine.split(/\s+/g);
      headPrefix = headerIndex ? 'stations' : 'aps';
      continue;
    }

    if (!headPrefix) {
      continue;
    }

    result[headPrefix] = result[headPrefix] || [];

    let item = {};
    for (let j = 0; j < headChunks.length; j++) {
      let start = headLine.indexOf(headChunks[j]);

      let nextJ = j + 1;

      let end = headChunks[nextJ] ? headLine.indexOf(headChunks[nextJ]) : lines[i].length;

      let len  = end - start;

      item[headChunks[j]] = lines[i].substr(start, len).trim();
    }

    result[headPrefix].push(item);
  }

  return result;
}

class Data {
  constructor({handshake = '', aps = [], stations = []} = {}) {
    this.handshake = handshake;
    this.aps = aps;
    this.stations = stations;

    this.items = this.getAttackApplicable();
  }
  getAttackApplicable() {
    let applicable = {};

    this.stations.forEach((station) => {
      applicable[station.STATION] = {
        BSSID: station.BSSID,
        'STATION-PWR': station.PWR,
        Frames: station.Frames
      };
    });

    for (let station in applicable) {
      this.aps.forEach((ap) => {
        if (applicable[station].BSSID === ap.BSSID) {
          applicable[station]['AP-PWR'] = ap['PWR'];
          applicable[station]['#Data'] = ap['#Data,'];
          applicable[station]['Beacons'] = ap['Beacons'];
          applicable[station]['CH'] = ap['CH'];
          applicable[station]['ENC'] = ap['ENC'];
          applicable[station]['CIPHER'] = ap['CIPHER'];
          applicable[station]['AUTH'] = ap['AUTH'];
          applicable[station]['ESSID'] = ap['ESSID'];
        }
      });

      // Have no AP, so remove it
      if (!applicable[station].CH) {
        delete applicable[station];
      }

    }

    return applicable;
  }

  getCurrentStation() {
    const num = this.getCurrentNum();
    let station = {};

    Object.keys(this.items).forEach((mac, index) => {
      if (index === num) {
        station = Object.assign({}, this.items[mac]);
        station['MAC'] = mac;
      }
    });
    return station;
  }
}

const self = new EventEmitter();

self.data = new Data();
self.iface = new IFace();

self.run = (iface, ...options) => {

  self.iface = iface || self.iface;

  self.stop();

  let params = [...options, self.iface.toString()];

  const proc = self.proc = spawn('airodump-ng', params);

  return new Promise((resolve, reject) => {

    proc.on('error', (err) => reject(err));

    //proc.on('close', (code) => console.log(`Child process exited with code ${code}`));
    //proc.stdout.on('data', (data) => console.log(data.toString('UTF-8'))); // ???

    // airodump-ng dumps data into stderr, not stdout
    proc.stderr.on('data', (data) => {

      data = parse(data.toString('UTF-8'));

      self.emit('data', self.data = new Data(data));
    });

    resolve(self);
  });

};

self.stop = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

self.moveUpStation = () => self.data.moveUpCurrent();
self.moveDownStation = () => self.data.moveDownCurrent();

process.on('exit', () => self.stop());

module.exports = self;
