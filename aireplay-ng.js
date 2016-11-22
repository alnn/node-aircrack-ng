'use strict';

const spawn = require('child_process').spawn;
const os = require('os');
const EventEmitter = require('events').EventEmitter;

function parse(str) {
  let head = {
    STATUS: '',
      ACKs: '[ 0| 0 ]'
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

    if (item.STATUS && item.ACKs.match(/^\[[\d|\s]+\|[\d|\s]+\]$/g)) {
      result.push(item);
    }
  });

  return result;
}


// aireplay-ng --deauth 0 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0

const self = new EventEmitter();

self.proc = null;

self.run = (iface, ...options) => {

  self.stop();

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

self.stop = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

process.on('exit', self.stop);

module.exports = self;
