'use strict';

const spawn = require('child_process').spawn;
const os = require('os');
const EventEmitter = require('events').EventEmitter;
const Parser = require('./parser');

const COMMAND = 'aireplay-ng';

const parser = new Parser('aireplay');

const self = new EventEmitter();

self.proc = null;
self.data = [];
self.timer = null;
self.run = (iface, ...options) => {

  self.stop();

  self.proc = spawn(COMMAND, [...options, iface]);

  //self.timer = setInterval(() => {
  //  self.emit('data', Buffer.concat(self.data).toString());
  //  self.data = [];
  //}, 1000);

  self.proc.stdout.on('data', (data) => {

    //self.data.push(data);

    data = parser.parse(data.toString());

    data.forEach(item => self.emit('data', item));
  });
    //self.proc.on('error', error => error);
    //self.proc.stderr.on('data', data => data);

  return Promise.resolve(self);
};

self.stop = () => {
  self.proc && self.proc.stdin.pause() && self.proc.kill();
};

process.on('exit', self.stop);

module.exports = self;
