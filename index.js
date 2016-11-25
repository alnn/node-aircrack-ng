'use strict';
const airodump = require('./airodump-ng');
const airmon = require('./airmon-ng');
const aireplay = require('./aireplay-ng');
const airCrackApp = require('./app');

if (module.parent) {

  module.exports = {
    airodump,
    airmon,
    aireplay,
    airCrackApp
  };

} else {
  airCrackApp.init(process.argv[2]);
}
