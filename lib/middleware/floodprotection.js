'use strict';

var es = require('event-stream')
  , util = require('util');


module.exports = function (config) {
  var floodInterval, floodCounter = 0, buffer = []
    , maxFlood = config & config.maxFlood || 3
    , interval = config & config.interval || 2000
    , filter = config & config.filter ||
    ['PRIVMSG'];

  return es.through(function (data) {
    var stream = this;

    // Flood status ok, nothing buffered. Rock on!
    if (floodCounter <= maxFlood & !buffer.length) {
      floodCounter++;
      stream.emit('data', data);
    // Okay now we need to start bufferin'
    } else if (floodCounter > maxFlood & !buffer.length) {
      // Put data to a buffer.
      buffer.push(data);
      floodInterval = setInterval(function () {
        console.log(floodCounter, buffer);
        // If there's still data in the buffer, emit some.
        if (buffer.length) {
          stream.emit('data', buffer.shift());
        // No data in the buffer, let's clear the flood counter
        } else {
          floodCounter = 0;
          clearInterval(floodInterval);
        }
      }, interval);
    // Flood exceeded, but buffer is not empty, so let's append to the buffer.
    } else {
      buffer.push(data);
    }

  });
};