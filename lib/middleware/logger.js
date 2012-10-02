'use strict';

var es = require('event-stream')
  , util = require('util');

module.exports = function (config) {
  config = config || { input: { prefix: '<< ' }, output: { prefix: '>> ' } };

  function createLogger(c) {
    if (c === false) { return; }
    c = c || { prefix: '' };
    return function (data) {
      if (c.logger) {
        c.logger(data);
      } else {
        console.log(c.prefix + util.inspect(data, false, 5, c.colors || true));
      }
      return data;
    };
  }

  return [es.mapSync(createLogger(config.input)), es.mapSync(createLogger(config.output))];
};