'use strict';

var irc = require('..')
  , es = require('event-stream')
  , format = require('util').format;

function f(i) {
  return '' + ((i < 10 ? ' ' + i : i));
}

var formatter = es.mapSync(function (o) {
  return format('%s%s (%s) <%s> %s\n',
    f(o.timestamp.getHours()), f(o.timestamp.getMinutes()), o.to, o.nick, o.text);
});

var client = new irc()
  .set('nick', 'streamBot')
  .set('address', 'irc.freenode.org')
  .use('logger')
  .use('ctcp')
  .connect(function () {
    client.join('#jslush', function (ch) {
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.pipe(ch)
        .pipe(formatter)
        .pipe(process.stdout);

      ch.on('names', function () {
        console.log('Users ' + ch.name);
        console.log(Object.keys(ch.names).map(function (name) {
          return ch.names[name] + name;
        }).join('\n'));
      });
    });
  });
