'use strict';

var es = require('event-stream')
  , util = require('util');


module.exports = function (config) {
  var irc = this, i, s;

  var errorHandler = config && config.errorHandler || function (e) {
    console.error('ERROR ' + e.stack);
  };

  irc.net.on('connect', function () {
    irc.input.on('error', errorHandler);
    irc.output.on('error', errorHandler);
  });

  return; // We do not return a stream, so this is not added to middlewares.
};