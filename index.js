'use strict';
//const iwlist = require('./iwlist');
const airodump = require('./airodump-ng');
const airmon = require('./airmon-ng');
const iwconfig = require('./iwconfig');
const IFace = require('./interface');
const ctrls = require('./controls');

//const os = require('os');
//console.log(os.cpus().length); // well, nice to have 8

if (module.parent) {

  module.exports = {
    airodump,
    airmon,
    iwconfig,
    IFace,
    ctrl
  };

} else {

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

  iwconfig.getInterfaces()
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

      //return airodump.run(iface, '--bssid', '54:04:A6:5B:19:30', /*'-w', 'psk',*/ '-c', '3');
      return airodump.run(iface);
    })
    .then((airodump) => {

      ctrls.setControls(airodump);

      return airodump;
    })
    .then((airodump) => airodump.on('data', processAirodumpData))
    .catch((error) => console.error(error));

}
