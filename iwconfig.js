'use strict';
const spawn = require('child_process').spawn;

const command = 'iwconfig';

module.exports = {
  getInterfaces() {

    const proc = spawn(command);

    return new Promise((resolve, reject) => {

      //proc.on('close', (code) => {
      //});

      proc.stdout.on('data', (data) => {

        data = data.toString('UTF-8');

        resolve(data);

      });

      proc.on('error', (err) => reject(err));
      //proc.stderr.on('data', (data) => reject(data.toString('UTF-8')));
    });
  },
  setMode(iface, mode) {
    const proc = spawn(command, [iface, 'mode', mode]);
    return new Promise((resolve, reject) => {
      proc.on('close', (code) => resolve(iface));
      proc.stderr.on('data', (data) => reject(data.toString('UTF-8')));
    });
  }
};
