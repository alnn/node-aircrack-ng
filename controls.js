'use strict';

const meow = require('meow');
const logUpdate = require('log-update');
const Table = require('cli-table2');
const keypress = require('keypress');
const os = require('os');
const colors = require('colors');

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

self.render = (message) => {

  let output;

  if ('object' === typeof message) {

    let lines = ['', '\u001b\[J'];
    let i = 1;
    let fields;
    let stationLines = [];

    for (let station in message.items) {

      fields = ['#', 'STATION'];
      for (let field in message.items[station]) {
        fields.push(field);
      }

      let line = [i.toString() , station, ...Object.values(message.items[station])];

      if (message.getCurrentNum() === i - 1) {
        line = line.map((item) => item.bgRed.white);
      }

      stationLines.push(line);
      i++;
    }


    const table = new Table(tableOptions);
    table.push(fields);
    stationLines.forEach((line) => table.push(line));

    lines.push(table.toString());

    output = [...lines,
      '',
      `STATION <---> BSSID #: ${message.getCurrentNum() + 1}`,
      `    a = attack    ${String.fromCharCode(8593)}${String.fromCharCode(8595)} = choose   q = quit`,
      '\u001b\[1\;1H',
    ];

  } else {
    output = [
      '',
      '    ' + message,
      ''
    ];
  }

  logUpdate(output.join(os.EOL));

};

self.setControls = (airodump) => {

  process.stdin.setRawMode && process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('keypress', (chunk, key) => {
    if (!key) {
      return;
    }

    switch (key.name) {
      case 'a':
        airodump.attack();
        break;
      case 'up':
        airodump.moveUpStation();
        break;
      case 'down':
        airodump.moveDownStation();
        break;
      case 'q':
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
