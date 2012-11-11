'use strict';

var IRC = require('..')
  , es = require('event-stream')
  , format = require('util').format
  , print = require('util').print
  , readline = require('readline')
  , async = require('async')
  , colors = require('colors')
  , rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  }), client
  , formatString = '%s%s (%s) <%s> ';

//** Init **//
console.log('');
console.log('Wlcm, ths s', 'µIRC'.bold.green, 'xmpl clnt frm', 'jslush'.green,
  '2012 - Lcns:', 'MIT\n'.green);

async.mapSeries([
  'Ncknm .......',
  'Srvr ddrss ..',
  'Psswrd (o) ..'],
  function (q, cb) { rl.question(q + ': ', cb.bind(null, null)); },
  function (err, res) {
    var options = {};
    options.nick = res[0] || 'strmClnt' + (Math.floor(Math.random() * 1338));
    options.address = res[1].split(':')[0] || 'irc.freenode.org';
    options.port = res[1].split(':')[1] || '6667';
    options.password = res[2] || '';

    print('\nCnnctng... '.grey);
    initShortcuts();
    createClient(options);
  }
);

function createClient(options) {
  client = IRC(options)
  .connect(function () {
    rl.setPrompt('Cnnctd> ');
    rl.prompt();
    rl.on('line', parseInput);
    setInterval(updatePrompt.bind(null, true), 2000);
  });
}

function initShortcuts() {
  process.stdin.on('keypress', function (ch, key) {
    if (!key) { return; }

    // Exit.
    if (key.ctrl && key.name == 'c') {
      process.exit();
    // Changing current channel, irssi style.
    } else if (key.meta) {
      var num = parseInt(key.name, 10) - 1
        , chs = Object.keys(client.channels);
      if (num === -1) { num = 10; }
      if (num in chs && Object.keys(client.channels).indexOf(rl.current) !== num) {
        rl.current = client.channels[chs[num]].name;
        updatePrompt();
      }
    }
  });
}

function updatePrompt(preserveCursor) {
  if (rl.current) {
    var t = new Date();
    rl.setPrompt(format(formatString,
      pad(t.getHours()), pad(t.getMinutes()), rl.current, client.nick));
    rl.prompt(preserveCursor);
  }
}

function parseInput(line) {
  var parts = line.split(' ')
    , cmd = parts[0].substr(1)
    , args = parts.splice(1);

  if (line[0] !== '/') {
    if (rl.current) {
      client.channels[rl.current].write(line);
    }
    rl.prompt();
    return;
  }

  switch (cmd) {
  case 'join':
  case 'j':
    rl.current = '';
    rl.setPrompt('joining...');
    rl.prompt();
    client.join(args[0], handleJoin);
    break;
  case 'part':
  case 'wc':
    if (rl.current in client.channels) {
      client.channels[rl.current].close(args.join(' '));
      rl.current = Object.keys(client.channels)[0];
    }
    break;
  case 'quit':
  case 'q':
    process.exit();
    break;
  }
}

function handleJoin(ch) {
  rl.current = ch.name;
  updatePrompt(true);
  ch.on('data', function (o) {
    var text = format(formatString + '%s\n',
      pad(o.timestamp.getHours()), pad(o.timestamp.getMinutes()), o.to, o.nick, o.text);
    if (text.indexOf(client.nick) !== -1) { text = text.bold.yellow; }

    replacePrompt(text);
  })
  ch.on('names', function (names) {
    names = Object.keys(names);
    names = names.length > 20 ?
      names.splice(0, 19).join(', ') + ', ... + ' + names.length + ' more.':
      names.join(', ');
    replacePrompt('  ppl: '.grey + names + '\n');
  })
}

function pad(i) { return '' + ((i < 10 ? '0' + i : i)); }

function replacePrompt(text) {
  // Do some maggic to update the prompt to not mess up.
  var line = rl.line
  rl.write(null, {ctrl: true, name: 'u'});
  rl.setPrompt('');
  rl.prompt();
  print(text);
  updatePrompt();
  rl.write(line);
}