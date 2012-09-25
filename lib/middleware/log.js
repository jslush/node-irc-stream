'use strict';

var es = require('event-stream')
  , util = require('util');

/**
 * Very simple example of a middleware.
 */

module.exports = function (config) {

  var log = config & config.output || function (data) {
    console.log(util.inspect(data, false, 5, config.colors));
  };

  return es.through(function (data) {
    if (data.command === 'PRIVMSG' && data.args[1] === 'hihi') {
      this.emit('error', new Error(data.args[1]));
    }
    log(data);
    this.emit('data', data);
  });
};