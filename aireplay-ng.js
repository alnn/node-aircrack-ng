'use strict';

const spawn = require('child_process').spawn;
const os = require('os');

function parse(str) {
  let item = {
    BSSID: '',
    STATION: '',
    STATUS: ''
  },
  result = [];

  const lines = str.split(new RegExp(os.EOL, 'g'));

  lines.forEach((line) => {

    result.push(line);
  });

  return result;
}

/*
 20:00:23  Waiting for beacon frame (BSSID: 54:04:A6:5B:19:30) on channel 3ons CH ENC  CIPHER AUTH ESSID
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [23|27 ACKs] 3  WPA2 TKIP   PSK  North
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [46|56 ACKs] 3  WPA2 TKIP   PSK  North
 20:00:23  Sending 64 directed DeAuth. STMAC: [74:2F:68:B6:85:88] [55|66 ACKs]

*/


// aireplay-ng --deauth 10 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0
const self = {
  proc: null,
  run(iface, ...options) {

    this.proc = spawn('aireplay-ng', [...options, iface]);

    return new Promise((resolve, reject) => {

      this.proc.stdout.on('data', (data) => {

        data = parse(data.toString('UTF-8'));

        console.log(data);
      });

      this.proc.on('error', error => reject(error));
      this.proc.stderr.on('data', data => reject(data));

      resolve(self);
    });
  }
};

self.quit = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

process.on('exit', self.quit);

module.exports = self;
