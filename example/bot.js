'use strict';

var irc = require('..');

var client = new irc()
  .set('nick', 'streamBot1337')
  .set('address', 'irc.freenode.org')
  .input('log', {colors: true, prefix: '<< '})
  .output('log', {colors: true, prefix: '>> '})
  .input('floodprotection', {interval: 2000, maxFlood: 3})
  .use('exception-handler')
  .use('message-stream')
  .connect(function () {
    client.join('#jslush', function (ch) {
      console.log('JOINED', ch);
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.pipe(ch)
        .pipe(process.stdout);
    });
  });