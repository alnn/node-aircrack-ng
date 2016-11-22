'use strict';

const spawn = require('child_process').spawn;
const os = require('os');
const EventEmitter = require('events').EventEmitter;

function parse(str) {
  let head = {
    STATUS: '',
    DATA: '[ 0| 0 ACKs]'
  },
  result = [];

  const lines = str.split(new RegExp(`${os.EOL}|\r`, 'g'));

  lines.forEach((line) => {

    line = line.trim().substr(10);

    let item = Object.assign({}, head);

    if (line.match(/Waiting for beacon frame \(BSSID: .+\) on channel \d/g)) {
      item.STATUS = line.substr(0, 24);
    }

    if (line.match(/Sending 64 directed DeAuth/g)) {
      item.STATUS = line.substr(0, 27);
      item.ACKs = line.substr(55).replace(/[A-Za-z]+/g, '');
    }

    if (item.STATUS && item.DATA.match(/^\[[\d|\s]+\|[\d|\s]+ACKs\]$/g)) {
      result.push(item);
    }
  });

  return result;
}

/*
 20:00:23  Waiting for beacon frame (BSSID: 54:04:A6:5B:19:30) on channel 3ons CH ENC  CIPHER AUTH ESSID
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [23|27 ACKs] 3  WPA2 TKIP   PSK  North
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [46|56 ACKs] 3  WPA2 TKIP   PSK  North
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [55|66 ACKs]

*/


// aireplay-ng --deauth 0 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0



const self = new EventEmitter();

self.proc = null;

self.run = (iface, ...options) => {

  self.proc = spawn('aireplay-ng', [...options, iface]);

  return new Promise((resolve, reject) => {

    self.proc.stdout.on('data', (data) => {

      data = parse(data.toString('UTF-8'));

      data.forEach(item => self.emit('data', item))
    });

    self.proc.on('error', error => reject(error));
    self.proc.stderr.on('data', data => reject(data));

    resolve(self);
  });

};

self.quit = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

process.on('exit', self.quit);

module.exports = self;
