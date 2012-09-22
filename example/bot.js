'use strict';

var irc = require('..');

var client = new irc()
  .set('nick', 'streamBot1337')
  .set('address', 'irc.freenode.org')
  .output('logger', {colors: true})
  .input('floodprotection', {interval: 2000, maxFlood: 3})
  .connect(function () {
    client.join('#jslush', function (ch) {
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.pipe(ch)
        .pipe(process.stdout);
    });
  });