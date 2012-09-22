'use strict';

var codes = require('./codes')
  , es = require('event-stream');

function parse(line, config) {
  var message = {}, match, middle, trailing;
  line = line.toString();

  if (config.stripColors) {
    line = line.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, "");
  }

  // Parse prefix
  if (match = line.match(/^:([^ ]+) +/)) {
    message.prefix = match[1];
    line = line.replace(/^:[^ ]+ +/, '');
    if ( match = message.prefix.match(/^([_a-zA-Z0-9\[\]\\`\^{}|-]*)(!([^@]+)@(.*))?$/) ) {
      message.nick = match[1];
      message.user = match[3];
      message.host = match[4];
    } else {
      message.server = message.prefix;
    }
  }

  // Parse command
  match = line.match(/^([^ ]+) */);
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
  if ( line.indexOf(':') != -1 ) {
    match = line.match(/(.*)(?:^:|\s+:)(.*)/);
    middle = match[1].trimRight();
    trailing = match[2];
  } else {
    middle = line;
  }

  if (middle.length) {
    message.args = middle.split(/ +/);
  }
  if (trailing && trailing.length) {
    message.args.push(trailing);
  }

  return message;
}

function Parser(c) {
  c = c || {};
  var config = {
    stripColors: c.stripColors || false
  };

  return es.pipeline(
    es.split('\r\n'),
    es.through(function (data) {
      this.emit('data', parse(data, config));
    })
  );
}


module.exports = Parser;