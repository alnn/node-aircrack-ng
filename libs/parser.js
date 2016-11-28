'use strict';
const os = require('os');

class Parser {

  constructor(type) {
    this.type = type;
  }

  parse(str = '') {
    return this['_' + this.type](str);
  }

  _airodump(str) {
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

  _airmon(str) {
    const result = [];

    //console.log(str);

    const lines = str.split(os.EOL).filter(line => line.trim().length > 0);
    const cols = lines[0].split('\t').filter(col => col.trim().length > 0);

    lines.slice(1).forEach(line => {
      const vals = line.split('\t');
      const item = cols.reduce((prev, curr, index) => {
        prev[curr] = vals[index];
        return prev;
      }, {});

      item.toString = () => {
        return item.Interface;
      };

      result.push(item);
    });

    return result;
  }

  _aireplay(str) {
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

}

module.exports = Parser;

//let data = new Parser('airodump').parse(` CH 14 ][ Elapsed: 6 s ][ 2016-11-27 23:07
//
// BSSID              PWR  Beacons    #Data, #/s  CH  MB   ENC  CIPHER AUTH ESSID
//
// 54:04:A6:5B:19:30  -48       26        0    0   3  54e  WPA2 TKIP   PSK  North Gargoyle
// A0:F3:C1:EF:CE:30  -56       17        0    0   1  54e. OPN              South Gargoyle
//
// BSSID              STATION            PWR   Rate    Lost    Frames  Probe
//
// A0:F3:C1:EF:CE:30  74:2F:68:B6:85:88  -69    0 - 1      0        1
//
//`);
//
//console.log(data);
