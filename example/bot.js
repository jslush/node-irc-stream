'use strict';

var irc = require('../lib/irc-stream')
  , es = require('event-stream');

var c = new irc()
  .set('nick', 'streamBot1337')
  .set('address', 'irc.freenode.org')
  .output('logger', {colors: true})
  .input('floodprotection', {interval: 2000, maxFlood: 3})
  .connect(function () {
    c.join('#jslush', function (ch) {
      process.stdin.pipe(ch);
      ch.pipe(process.stdout);
      ch.write('hi!');
    });
  });
