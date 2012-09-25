'use strict';

var es = require('event-stream')
  , util = require('util');


module.exports = function (config) {
  var irc = this;

  var errorHandler = config && config.errorHandler || function (e) {
    console.error('ERROR ' + e.stack);
  };

  // After connect event we know that input and output streams are compiled.
  irc.net.once('connect', function () {
    irc.input.on('error', errorHandler);
    irc.output.on('error', errorHandler);
  });

  return; // We do not return a stream, so this is not added to middlewares.
};