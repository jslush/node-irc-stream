'use strict';

var es = require('event-stream');

function compose(o, config) {
  var args = [].slice.call(o.args), msg;
  if (!args) { return; }

  // If the last parameter contains spaces, prepend with ':'.
  if (args[args.length - 1].match(/\s/)) {
    args[args.length - 1] = ":" + args[args.length - 1];
  }

  // Compose the IRC command.
  msg = o.command + ' ' + args.join(' ') + '\r\n';

  if (config.stripColors) {
    msg = msg.replace(/[\x02\x1f\x16\x0f]|\x03\d{0,2}(?:,\d{0,2})?/g, '');
  }

  return msg;
}

module.exports = function Composer(c) {
  c = c || {};
  var config = {
    stripColors: c.stripColors || false
  };

  return es.through(function (data) {
    try {
      var msg = compose(data, config);
      if (msg) {
        this.emit('data', msg);
      }
    } catch (e) {
      this.emit('error', e);
    }
  });
};