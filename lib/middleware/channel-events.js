'use strict';

var es = require('event-stream')
  , util = require('util');


function handleJoin(irc, msg) {
  var ch = msg.args[0];

  // If it's us joining.
  if (irc.nick === msg.nick) {
    irc.emit('joined' + ch);
  } else {
    irc.emit('join', ch, msg.args[1]);
  }

  return msg;
}

function handleMessage(irc, msg) {
  var from = msg.nick
    , to = msg.to = msg.args[0]
    , text = msg.text = msg.args[1];
  msg.timestamp = new Date();

  irc.emit('message', from, to, text, msg);


  // Only channel messages.
  if (to[0].indexOf(irc.supported.channel.types) !== -1) {
    irc.emit('message#', from, to, text, msg);
  }

  // Only queries.
  if (to === irc.nick) {
    irc.emit('query', from, text, msg);
  }

  return msg;
}

function handleNames(irc, msg, names) {
  var channel = msg.args[2];
  names[channel] = names[channel] || {};

  if (msg.command === 'rpl_namreply') {
    // Save names to channel stream object.
    msg.args[3].trim().split(/ +/).forEach(function (name) {
      // There can be a prefix that dictates a user mode (voice, operator)
      var match = name.match(/^(.)(.*)$/);
      if (!match) { return; }
      // If there is a known prefix, save it as the value.
      if (match[1] in irc.prefixToMode) {
        names[channel][match[2]] = match[1];
      } else {
        names[channel][match[1] + match[2]] = '';
      }
    });
  } else if (msg.command === 'rpl_endofnames') {
    irc.emit('names', names[channel]);
    delete names[channel];
  }

  return msg;
}


module.exports = function (config) {
  var irc = this
    , names = {};

  var output = es.mapSync(function (msg) {
    switch (msg.command) {
    case 'JOIN':
      return handleJoin(irc, msg);
    case 'PRIVMSG':
      return handleMessage(irc, msg);
    case 'rpl_namreply':
    case 'rpl_endofnames':
      return handleNames(irc, msg, names);
    }
    return msg;
  });

  return [null, output];
};