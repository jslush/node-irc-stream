'use strict';

var spawn = require('child_process').spawn
  , net = require('net')
  , colors = require('colors')
  , split = require('split');

// Allow options alá client.use(irc.proxy({...}));
module.exports = function (options) {
  // Factory function for the middleware.
  return function (client) {

    function send(message) {
      client.net.write(message + '\n');
    }

    // Save client settings or use user's.
    options.remoteAddress = options.remoteAddress || client.config.address;
    options.remotePort = options.remotePort || client.config.port;
    options.executable = options.executable || process.execPath;

    // Tell the client to connect to our proxy.
    client.set('address', options.address);
    client.set('port', options.port);

    // Override client connect method.
    var oldConnect = client.connect;

    client.connect = function () {
      var self = this;

      console.log('Client connecting...');

      self.net.on('data', function (data) {
        self.middleware.handleOutput(data);
      });

      self.net.on('error', function (err) {
        self.debug('Failed to connect to proxy, trying to start it.');
        setTimeout(function () {        
          runProxy(options);
          self.debug('Proxy is started, trying to connect again.');
          self.net.connect(self.config.port, self.config.address);
        }, 1000);
      });

      self.net.connect(self.config.port, self.config.address);
    };

    return {
      name: 'Proxy',
      command:'PROXY',
      output: function (message, next) {
        switch (message.args[0]) {
        case 'PASS':
          console.log('Authenticating with proxy...');
          send('LOGIN ' + options.password);
          break;
        case 'SUCCESS':
          console.log('Successfully authenticated with proxy.'.green);

          // Tell proxy to connect.
          send(['SET', 'remoteAddress', options.remoteAddress].join(' '));
          send(['SET', 'remotePort', options.remotePort].join(' '));
          send('CONNECT');

          break;
        case 'LOGINFAILED':
          console.log('Failed to authenticate with proxy!'.red);
          break;
        case 'UNAUTHENTICATED':
          throw Error('Something went wrong!'.red);
        }
      }
    };
  };
};

function runProxy(options) {
  console.log('Starting proxy'.yellow);

  // Run the proxy.
  log('Running child', options);
  var cp = spawn('cmd',
    ['/C', options.executable, __filename, options.address, options.port, options.password], {
    detached: true,
    stdio: 'ignore'
  });
  //cp.unref();
}

function log() {
  var a = [].slice.call(arguments);
  a.unshift('PROXY:'.blue);
  console.log.apply(null, a);
}


process.on('uncaughtException', function (err) {
  console.log('Proxy crashed');
  console.log(err.stack);
});

function IRCProxy(address, port, pass) {
  var self = this;

  self.irc = new net.Socket();
  self.irc.setEncoding('utf8');

  this.irc.on('data', function (data) {
    log('INCOMING', data);
  });

  this.irc.on('error', function (err) {
    log('ERROR', err);
  });


  self.config = {
    address: address,
    port: port,
    password: pass
  };

  log('Starting', self.config);

  self.listen();
}

IRCProxy.prototype.listen = function () {
  var self = this;

  self.server = net.createServer(function (client) {
    // We already have a client that has a connection.
    if (self.client) { client.end(':NONE PROXY BUSY'); }

    self.client = client;

    client.setEncoding('utf8');

    client.authenticated = false;

    client.pipe(split()).on('data', self.handleMessage.bind(self, client));

    client.on('error', function (err) {
      log('Client disconnected.');
      self.client = undefined;
      self.irc.destroy();
    });

    // Ask for authentication.
    self.reply(':NONE PROXY PASS');
  });
  self.server.listen(self.config.port, self.config.address);
  log('Proxy listening');
};

IRCProxy.prototype.handleMessage = function (client, data) {
  var self = this, message = data.split(' ');

  log('<<', message);

  if (!client.authenticated && message[0] === 'LOGIN') {
    // Check if password is good.
    if (message[1].trim() === self.config.password) {
      client.authenticated = true;
      self.reply(':NONE PROXY SUCCESS');
      // Connect proxy.
      self.irc.pipe(client);
    } else {
      self.reply(':NONE PROXY LOGINFAILED');
    }
  } else if (client.authenticated) {
    switch (message[0]) {
    // Receive settings
    case 'SET':
      self.config[message[1]] = message[2];
      break;
    // Client is asking us to connect.
    case 'CONNECT':
      self.irc.connect(self.config.remotePort, self.config.remoteAddress);
      break;
    }
  } else {
    self.reply(':NONE PROXY UNAUTHENTICATED');
  }
};

IRCProxy.prototype.reply = function (msg) {
  log('>>', msg);
  this.client.write(msg);
};


// This is a forked process.
var args = process.argv;
log(args);
if (args.length > 3) {
  process.title = 'PROXY';
  var proxy = new IRCProxy(args[2], args[3], args[4]);
}
