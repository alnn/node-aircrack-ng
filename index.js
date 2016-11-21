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
    if (!Object.keys(data.items).length) {
      return;
    }

    // can be attacked
    ctrls.render(data);
  };

  //airodump.run('wlp0s20f0u4');
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
