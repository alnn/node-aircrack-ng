'use strict';
const spawn = require('child_process').spawn;

function make(icommand, iface) {

  const proc = spawn('ifconfig', [iface, icommand]);

  return new Promise((resolve, reject) => {

    proc.on('close', (code) => resolve(iface));

    proc.stderr.on('data', (data) => reject(data.toString('UTF-8')));

  });
}

module.exports = {
  down(iface) {
    return make('down', iface);
  },
  up(iface) {
    return make('up', iface);
  }
};
