'use strict';
const spawn = require('child_process').spawn;
const Parser = require('./parser');

const parser = new Parser('airmon');
const command = 'airmon-ng';

const self = {

  data: [],
  proc: null,

  run() {
    this.data = [];
    this.proc = spawn(command);
    this.proc.stdout.on('data', (data) => this.data.push(data));
    //this.proc.stderr.on('data', (data) => this.data.push(data));

    return new Promise((resolve, reject) => {

      this.proc.stdout.once('end', () => {
        const str = Buffer.concat(self.data).toString('UTF-8');
        resolve(parser.parse(str));
      });

      this.proc.once('error', (error) => reject(error));
    });
  },
  _do(iface, action='start') {
    this.data = [];

    this.proc = spawn(command, [action, iface]);

    this.proc.stdout.on('data', (data) => this.data.push(data));
    this.proc.stderr.on('data', (data) => this.data.push(data));

    return new Promise((resolve, reject) => {

      this.proc.stdout.once('end', () => {
        const str = Buffer.concat(self.data).toString('UTF-8');
        resolve(str);
      });

      this.proc.once('error', (error) => reject(error));
    });
  },
  start(iface) {
    return this._do(iface, 'start');
  },
  stop(iface) {
    return this._do(iface, 'stop');
  }
};

module.exports = self;
