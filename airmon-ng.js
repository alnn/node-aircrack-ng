'use strict';
const os = require('os');
const spawn = require('child_process').spawn;
const command = 'airmon-ng';


const self = {
  start(iface) {

    const proc = spawn(command, [iface]);

    return new Promise((resolve, reject) => {

      proc.on('error', (err) => reject(err));

      proc.on('close', (code) => console.log(`Child process exited with code ${code}`));

      proc.stdout.on('data', (data) => resolve(iface)); // ???

      proc.stderr.on('data', (data) => reject(data.toString('UTF-8')));

    });

  }
};

module.exports = self;
