node-irc-stream
===============
[![build status]](http://travis-ci.org/jslush/node-irc-stream)

The module is not ready for production usage, and is missing many crucial features.
We try to follow [Google Javascript Style Guide].

Example
-------
Creates a simple connection to an IRC network and joins channel #test.
As you can see, the join callback returns a channel stream that can be
used to send and receive messages. We also support query streams.

```js
var irc = require('irc-stream');

var client = new irc()
  .set('nick', 'example1337')  
  .set('address', 'irc.example.com')
  // Register a built-in middleware.
  // You can also register any duplex stream.
  .output('logger', {colors: true})
  .connect(function () {
    client.join('#test', function (ch) {
      ch.write('hi!');
      // Pipe ALL THE THINGS!
      process.stdin.pipe(ch)
        .pipe(process.stdout);
    });
  });
```

License
-------
MIT :-)

[build status]: https://secure.travis-ci.org/jslush/node-irc-stream.png "Travis CI - Continuous Integration"
[Google JavaScript Style Guide]: http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml "Learn to code like a pro."