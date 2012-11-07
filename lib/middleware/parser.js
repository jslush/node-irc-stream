'use strict';

var codes = require('../codes')
  , es = require('event-stream');

function parse(line, config) {
  var message = {}, match, middle, trailing;
  line = line.toString();

  if (config.debug) {
    console.log(line);
  }

  if (config.stripColors) {
    line = line.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, "");
  }

  // Parse prefix
  match = line.match(/^:([^ ]+) +/);
  if (match) {
    message.prefix = match[1];
    line = line.replace(/^:[^ ]+ +/, '');
    match = message.prefix.match(/^([_a-zA-Z0-9\[\]\\`\^{}|\-]*)(!([^@]+)@(.*))?$/);
    if (match) {
      message.nick = match[1];
      message.user = match[3];
      message.host = match[4];
    } else {
      message.server = message.prefix;
    }
  }

  // Parse command
  match = line.match(/^([^ ]+) */);
  if (!match) { throw new TypeError('Invalid data received.'); }
  message.command = match[1];
  message.rawCommand = match[1];
  message.commandType = 'normal';
  line = line.replace(/^[^ ]+ +/, '');

  if (codes[message.rawCommand]) {
    message.command     = codes[message.rawCommand].name;
    message.commandType = codes[message.rawCommand].type;
  }

  message.args = [];

  // Parse parameters
  if (line.indexOf(' :') !== -1) {
    match = line.indexOf(' :');
    middle = line.substr(0, match).replace(/ +$/, '');
    trailing = line.substr(match + 2);
  } else if (line.indexOf(':') === 0) {
    middle = '';
    trailing = line.substr(1);
  } else {
    middle = line;
  }

  if (middle && middle.length) {
    message.args = middle.split(/ +/);
  }
  if (trailing && trailing.length) {
    message.args.push(trailing);
  }

  return message;
}

module.exports = function Parser(c) {
  c = c || {};
  var config = {
    stripColors: c.stripColors || false,
    debug: this && this.config && this.config.debug
  };

  return es.pipe(
    es.split('\r\n'),
    es.through(function (data) {
      try {
        this.emit('data', parse(data, config));
      } catch (e) {
        this.emit('error', e);
      }
    })
  );
};