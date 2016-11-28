#!/usr/bin/env node

'use strict';

const airodump = require('./libs/airodump-ng');
const airmon = require('./libs/airmon-ng');
const aireplay = require('./libs/aireplay-ng');
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
