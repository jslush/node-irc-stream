'use strict';

var es = require('event-stream')
  , util = require('util');

module.exports = function (config) {
  config = config || {};
  var irc = this
    , moduleVersion = require(__dirname + '/../../package.json').version
    , version = config.version || 'node-irc-stream v' +
      moduleVersion + ' - Node ' + process.version + ' running on ' + process.platform;

  // Augment client with ctcp function.
  irc.ctcp = function (to, type, text) {
    this[type === 'privmsg' ? 'say' : 'notice'](to, '\u0001' + text + '\u0001');
    return this;
  };

  function handleCTCP(from, to, text, type) {
    text = text.slice(1, text.lastIndexOf('\u0001'));
    var parts = text.split(' ');

    // Tell user that we got a CTCP.
    irc.emit('ctcp', from, to, text, type);

    // Handle some common CTCP requests.
    if (text === 'VERSION' && type === 'privmsg') {
      irc.ctcp(from, 'notice', 'VERSION ' + version);
    } else if (parts[0] === 'ACTION' && parts.length > 1) {
      irc.emit('action', from, to, parts.slice(1).join(' '));
    } else if (parts[0] === 'PING' && type === 'privmsg' && parts.length > 1) {
      irc.ctcp(from, 'notice', text);
    }
  }

  function handleInput(msg) {
    var from, to, text;

    if (msg.command === 'PRIVMSG') {
      from = msg.nick;
      to   = msg.args[0] || '';
      text = msg.args[1] || '';

      if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
        handleCTCP(from, to, text, 'privmsg');
      } else {
        return msg;
      }
    } else if (msg.command === 'NOTICE') {
      from = msg.nick;
      to   = msg.args[0] || '';
      text = msg.args[1] || '';

      if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
        handleCTCP(from, to, text, 'notice');
      } else {
        return msg;
      }
    } else {
      return msg;
    }
  }

  return [null, es.mapSync(handleInput)];
};