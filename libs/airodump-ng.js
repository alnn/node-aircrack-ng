'use strict';

const os = require('os');
const spawn = require('child_process').spawn;
const EventEmitter = require('events').EventEmitter;
const Parser = require('./parser');

const COMMAND = 'airodump-ng';

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
      if (!station.STATION.trim()) {
        return;
      }
      applicable[station.STATION] = {
        BSSID: station.BSSID,
        'STATION-PWR': station.PWR,
        Frames: station.Frames
      };
    });

    for (let station in applicable) {
      this.aps.forEach((ap) => {
        if (applicable[station].BSSID === ap.BSSID) {
          applicable[station]['AP-PWR'] = ap.PWR;
          applicable[station]['#Data'] = ap['#Data,'];
          applicable[station].Beacons = ap.Beacons;
          applicable[station].CH = ap.CH;
          applicable[station].ENC = ap.ENC;
          applicable[station].CIPHER = ap.CIPHER;
          applicable[station].AUTH = ap.AUTH;
          applicable[station].ESSID = ap.ESSID;
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
        station.MAC = mac;
      }
    });
    return station;
  }
}

const parser = new Parser('airodump');

const self = new EventEmitter();

self.data = new Data();
self.iface = null;
self.proc = null;

self.run = (iface, ...options) => {

  self.iface = iface || self.iface;

  self.stop();

  self.proc = spawn(COMMAND, [...options, self.iface.toString()]);
  self.proc.stderr._handle.setBlocking(true);

  //self.proc.stderr._readableState.highWaterMark = 320000;

  // airodump-ng dumps data into stderr, not stdout
  self.proc.stderr.on('data', (data) => {

    data = parser.parse(data.toString());

    self.emit('data', self.data = new Data(data));
  });

  return new Promise((resolve, reject) => {

    self.proc.once('error', (err) => reject(err));

    resolve(self);
  });
};

self.stop = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

process.on('exit', () => self.stop());

module.exports = self;
