'use strict';
const ifconfig = require('./ifconfig');
const iwconfig = require('./iwconfig');

module.exports = class {

  constructor(stringData = '') {

    this.info = [];

    const chunks = stringData.split(/\s/g);

    this.name = chunks[0];

    //chunks.forEach((substring, index) => {
    //  console.log(index + ': ', substring);
    //});

    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i]) {
        continue;
      }

      let tmp = [];
      tmp.push(chunks[i]);
      while (chunks[++i]) tmp.push(chunks[i]);

      const propertyValue = tmp.join(' ').split(/:|=/g);

      const prop = propertyValue[0];

      if (propertyValue.length > 2) {
        this[prop] = propertyValue.slice(1).join(':').trim();
      } else if (!propertyValue[1]) {
        this.info.push(prop);
      } else {
        this[prop] = propertyValue[1].trim();
      }

    }

    /*
    chunks.reduce((prev, curr) => {

    });
    */

  }

  down() {
    return ifconfig.down(this);
  }

  up() {
    return ifconfig.up(this);
  }

  setMode(mode) {

    //console.log(iwconfig);

    return iwconfig.setMode(this, mode || 'Managed');
  }

  toString() {
    return this.name;
  }

};
