'use strict';
//const iwlist = require('./iwlist');
const airodump = require('./airodump-ng');
const airmon = require('./airmon-ng');
const iwconfig = require('./iwconfig');
const IFace = require('./interface');
const airCrackApp = require('./app');

//const os = require('os');
//console.log(os.cpus().length);

if (module.parent) {

  module.exports = {
    airodump,
    airmon,
    iwconfig,
    IFace,
    airCrackApp
  };

} else {

  airCrackApp.init();
}
