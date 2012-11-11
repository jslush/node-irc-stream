'use strict';

var irc = require('..')
  , es = require('event-stream')
  , format = require('util').format;

function f(i) {
  return '' + ((i < 10 ? '0' + i : i));
}

var output = es.mapSync(function (o) {
  return format('%s%s (%s) <%s> %s\n',
    f(o.timestamp.getHours()), f(o.timestamp.getMinutes()), o.to, o.nick, o.text);
});

output.pipe(process.stdout, { end: false });

var input = function (ch, msg) {
  var parts = msg.split(' ');

  switch (parts[0]) {
  case 'exit':
    ch.close(parts.splice(1).join(' '), function () {
      console.log('End of Transmission!');
    });
    return;
  case 'query':
    var who = parts[1];

    if (who in client.queries) {
      client.queries[who].write(parts.splice(2).join(' '));
      return;
    }

    client.query(who, function  (q) {
      console.log('Started a new query with', q.name);
      q.pipe(output, { end: false });
      q.write(parts.splice(2).join(' '));
    });
    return;
  }

  return msg;
};

var client = irc()
  .set('nick', 'streamBot')
  .set('address', 'irc.freenode.org')
  .use('logger')
  .set('debug', true)
  .connect(function () {
    client.join('#jslush', function (ch) {
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.setEncoding('utf8');
      process.stdin
        .pipe(es.mapSync(input.bind(this, ch)))
        .pipe(ch)
        .pipe(output);

      ch.on('names', function () {
        console.log('Users', ch.name, Object.keys(ch.names));
      });

      ch.on('join', function (who) {
        console.log(who, 'joined', ch.name);
      })
    });

    client.on('query', function (q) {
      console.log(q.name, 'started a new query with you.');
      q.pipe(output, { end: false });

      setTimeout(function () {
        q.write('Sorry, gtg!');
        q.close();
      }, 5000);
    })

  });
