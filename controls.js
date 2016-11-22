'use strict';

const meow = require('meow');
const logUpdate = require('log-update');
const Table = require('cli-table2');
const keypress = require('keypress');
const os = require('os');
const colors = require('colors');

const airodump = require('./airodump-ng');
const airmon = require('./airmon-ng');
const iwconfig = require('./iwconfig');
const IFace = require('./interface');

const tableOptions = {
  chars: {
    'top': '',
    'top-mid': '',
    'top-left': '',
    'top-right': '',
    'bottom': '',
    'bottom-mid': '',
    'bottom-left': '',
    'bottom-right': '',
    'left': '',
    'left-mid': '',
    'mid': '',
    'mid-mid': '',
    'right': '',
    'right-mid': '',
    'middle': ' '
  },
  style: {
    'padding-left': 0,
    'padding-right': 0
  }
};

const self = meow({
  help: [
    'Usage',
    '  $ sudo node-aircrack',
  ]
});

keypress(process.stdin);

self.render = (message, ctrlInfo) => {

  let output;

  if ('object' === typeof message) {

    const lines = ['', '\u001b\[J'];

    const table = new Table(tableOptions);
    message.forEach((line) => table.push(line));

    lines.push(table.toString());

    ctrlInfo = Array.isArray(ctrlInfo) ? ctrlInfo : [];

    output = [...lines,
      '',
      ...ctrlInfo,
      '\u001b\[1\;1H',
    ];

  } else {
    output = [
      '',
      '\u001b\[J',
      '    ' + message,
      '\u001b\[1\;1H'
    ];
  }

  logUpdate(output.join(os.EOL));

};

self.monitor = () => {

  const processAirodumpData = (data) => {
    const stationMACs = Object.keys(data.items);
    const currIndex = data.getCurrentNum();

    if (!stationMACs.length) {
      return;
    }

    // Prepare for rendering
    const fields = ['#', 'STATION', ...Object.keys(data.items[stationMACs[0]])];
    const lines = stationMACs.map((MAC, index) => [
      (index + 1).toString(),
      MAC,
      ...Object.values(data.items[MAC])
    ].map((item) => index === currIndex ? item.bgRed.white : item));

    ctrls.render([
      fields,
      ...lines,
      [],
      ['',`current #: ${currIndex + 1}`]
    ], [
      `    a = attack    ${String.fromCharCode(8593)}${String.fromCharCode(8595)} = choose   q = quit`
    ]);
  };

  return iwconfig.getInterfaces()
    .then((ifaceString) => new IFace(ifaceString))
    .then((iface) => iface.down())
    .then((iface) => iface.setMode('monitor'))
    .then((iface) => iface.up())
    //.then((iface) => airmon.start(iface))
    //.then((iface) => iwconfig.getInterfaces())
    //.then((ifaceString) => new IFace(ifaceString))
    .then((iface) => {

      //console.log(iface);

      //airodump-ng --bssid 54:04:A6:5B:19:30 -w psk -c 3 mon0

      return airodump.run(iface);
    })
    .then((airodump) => {

      ctrls.setControls(airodump);

      return airodump;
    })
    .then((airodump) => airodump.on('data', processAirodumpData))
    .catch((error) => console.error(error));

};

self.setControls = (airodump) => {

  process.stdin.setRawMode && process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (chunk, key) => {
    if (!key) {
      return;
    }

    switch (key.name) {
      case 'a': // Attack
        airodump.attack();
        break;
      case 'up': // Previous
        airodump.moveUpStation();
        break;
      case 'down': // Next
        airodump.moveDownStation();
        break;
      case 'b': // Back
        self.monitor();
        break;
      case 'q': // Quit
        self.quit();
        break;
      default:
        // what else is there...
        break;
    }
  });
};

self.quit = () => {

  process.stdin.pause();
  process.exit();
};

module.exports = self;
