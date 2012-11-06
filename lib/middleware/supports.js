'use strict';

var es = require('event-stream')
  , util = require('util');

module.exports = function (config) {
  var irc = this;

  // Features supported by the server
  // (initial values are RFC 1459 defaults. Zeros signify
  // no default or unlimited value)
  irc.supported = {
    channel: {
      idlength: [],
      length: 200,
      limit: {},
      modes: { a: '', b: '', c: '', d: ''},
      types: '#'
    },
    kicklength: 0,
    maxlist: [],
    maxtargets: [],
    modes: 3,
    nicklength: 9,
    topiclength: 0,
    usermodes: ''
  };

  function handleInput(msg) {
    if (msg.command === 'rpl_myinfo') {
      irc.supported.usermodes = msg.args[3];
    } else if (msg.command === 'rpl_isupport') {
      // http://www.irc.org/tech_docs/005.html
      msg.args.forEach(function (arg) {
        var match = arg.match(/([A-Z]+)=(.*)/);
        if (!match) { return; }
        var param = match[1]
          , value = match[2];
        switch (param) {
        case 'CHANLIMIT':
          value.split(',').forEach(function (val) {
            val = val.split(':');
            irc.supported.channel.limit[val[0]] = parseInt(val[1], 10);
          });
          break;
        case 'CHANMODES':
          value = value.split(',');
          var type = 'abcd'; //['a', 'b', 'c', 'd'];
          for (var i = type.length - 1; i >= 0; i--) {
            irc.supported.channel.modes[type[i]] += value[i];
          }
          break;
        case 'CHANTYPES':
          irc.supported.channel.types = value;
          break;
        case 'CHANNELLEN':
          irc.supported.channel.length = parseInt(value, 10);
          break;
        case 'IDCHAN':
          value.split(',').forEach(function (val) {
            val = val.split(':');
            irc.supported.channel.idlength[val[0]] = val[1];
          });
          break;
        case 'KICKLEN':
          irc.supported.kicklength = value;
          break;
        case 'MAXLIST':
          value.split(',').forEach(function (val) {
            val = val.split(':');
            irc.supported.maxlist[val[0]] = parseInt(val[1], 10);
          });
          break;
        case 'NICKLEN':
          irc.supported.nicklength = parseInt(value, 10);
          break;
        case 'PREFIX':
          if (match = value.match(/\((.*?)\)(.*)/)) {
            match[1] = match[1].split('');
            match[2] = match[2].split('');
            while (match[1].length) {
              irc.prefixToMode[match[2][0]] = match[1][0];
              irc.supported.channel.modes.b += match[1][0];
              irc.modeToPrefix[match[1].shift()] = match[2].shift();
            }
          }
          break;
        case 'TARGMAX':
          value.split(',').forEach(function (val) {
            val = val.split(':');
            val[1] = (!val[1]) ? 0 : parseInt(val[1], 10);
            irc.supported.maxtargets[val[0]] = val[1];
          });
          break;
        case 'TOPICLEN':
          irc.supported.topiclength = parseInt(value, 10);
          break;
        }
      });
    } else {
      return msg;
    }
  }

  return [null, es.mapSync(handleInput)];
};