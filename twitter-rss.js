var config = require('config').twitterRss;
var util = require('util');

var Twitter = require('twitter-lite');
var async = require('async');

var express = require('express');
var app = express();
var auth = express.basicAuth(config.admin.username, config.admin.password);

var OPML = require('./lib/opml');
var Tweet = require('./lib/Tweet');

var RSS = require('rss');

// patch RSS
RSS_item = function (options, prepend) {
  options = options || {};
  var item = {
    title:          options.title || 'No title',
    description:    options.description || '',
    url:            options.url,
    guid:           options.guid,
    categories:     options.categories || [],
    author:         options.author,
    date:           options.date,
    enclosure:      options.enclosure || false
  };

  if (prepend)
    this.items.unshift(item);
  else
    this.items.push(item);
  return this;
};


const client = new Twitter({
  subdomain: "api",
  consumer_key: config.twitterApi.consumer.key,
  consumer_secret: config.twitterApi.consumer.secret,
  access_token_key: config.twitterApi.access.key,
  access_token_secret: config.twitterApi.access.secret
});

var users = {}; // indexed by screen_name

var addTweet = function (data, prepend) {
  //TODO configure
  // console.log('tweet_full_original', util.inspect(data, {depth: 100}));

  var tweet = new Tweet(data);

  //TODO configure
  // console.log('tweet_full_extended', util.inspect(tweet, {depth: 100}));

  if (tweet.delete) {
    //console.log('Ignored special tweet: delete', util.inspect(tweet, {depth: 100}));
    return;
  }

  if (! tweet.user) {
    console.error('Invalid tweet, missing user', util.inspect(tweet, {depth: 100}));
    return;
  }

  var user = users[tweet.user.screen_name];
  if (! user)
    return;


  // update rss
  user.feed.item(tweet.toFeedItem(), prepend);

  // limit tweets
  if (user.feed.items.length > config.tweetsLimit) { //TODO limit by time
    user.feed.items.splice(config.tweetsLimit, user.feed.items.length - config.tweetsLimit);
  }

  // invalidate xml cache
  user.xmlFeed = null;

  //TODO configure
  // console.log('tweet', prepend, tweet.created_at, tweet.user.screen_name, tweet.full_text);
  // if (tweet.full_text && tweet.user) {
  //   console.log( user.infos.screen_name+': "'+tweet.full_text+'"');
  // }
};

var getUrl = function(screen_name) {
  return config.baseUrl + '/statuses/user_timeline/' + screen_name + '.rss';
};

console.log('Bootstrapping...');
async.map(config.follow, function (screen_name, cb) {
  var user = users[screen_name] = {
    infos: {},
    feed: {},
    feedXml: null
  };
  async.series([ function (cb) { // get user infos
    console.log('users/show', screen_name);
    client.get('users/show', { screen_name: screen_name })
      .then(userInfos => {
        user.infos = userInfos;
        cb();
      })
      .catch(cb);
  }, function (cb) { // create rss feed
    user.feed = new RSS({
      title: user.infos.name + ' (@' + user.infos.screen_name + ') Twitter Timeline',
      description: user.infos.description,
      feed_url: getUrl(user.infos.screen_name),
      site_url: 'http://twitter.com/' + user.infos.screen_name,
      image_url: user.infos.profile_image_url,
      author: user.infos.name + ' (@' + user.infos.screen_name + ')',
      language: user.infos.lang
    });
    user.feed.item = RSS_item; // patch RSS
    cb();
  }, function (cb) { // get user last tweets
    console.log('statuses/user_timeline', user.infos.screen_name);
    client.get('statuses/user_timeline', { screen_name: screen_name, count: config.tweetsLimit, tweet_mode: 'extended' })
      .then(tweets => {
        for (var i = 0; i < tweets.length; i++) {
          addTweet(tweets[i], false);
        }
        cb();
      })
      .catch(cb);
  }], function (err) {
    console.log('finished bootstrapping user', screen_name, err);
    cb(err, err ? null : user.infos.id);
  });
}, function(err, users_id) {
  if (err) {
    console.error('Error bootstrapping', err);
    // auto reconnect: use systemd!
    process.exit(1);
  }

  console.log('users_id', users_id);
  console.log('users', users);

  // ready to start listening
  var server = app.listen(config.port);
  console.log('Listening on port', config.port);

  server.on('close', function() {
    console.error('Server closed, exit with return code', process.exitCode);
  });

  // and get new tweets in stream
  client.stream( 'statuses/filter', { follow: users_id.join(',') })
    .on("error", error => {
      console.error('stream error', error);
      // auto reconnect: use systemd!
      process.exitCode = 1;
      server.close();
    })
    .on("end", response => {
      console.error('stream end', response);
      // auto reconnect: use systemd!
      process.exitCode = 2;
      server.close();
    })
    .on("data", tweet => {
      if (!tweet || tweet.disconnect) {
        console.error('stream disconnected', tweet);
        // auto reconnect: use systemd!
        process.exitCode = 3;
        server.close();
        return;
      }
      addTweet(tweet, true);
    });
});


app.get('/statuses/user_timeline/:screen_name.rss', function(req, res){
  var user = users[req.params.screen_name];
  if (! user) {
    res.status(404).send('User ' + req.params.screen_name + ' not registered');
    return;
  }

  if (! user.xmlFeed) {
    var now = new Date();
    user.feed.pubDate = now.toString();
    user.xmlFeed = user.feed.xml(true);
  }

  res.setHeader('Content-Type', 'application/rss+xml');
  res.send(user.xmlFeed);
});

app.get('/admin/list', auth, function(req, res){
  var body = '';
  config.follow.forEach(function (screen_name) {
    body += getUrl(screen_name) + '<br/>';
  });
  res.send(body);
});

app.get('/admin/opml', auth, function(req, res){
  var opml = new OPML({ title: 'Twitter RSS feeds' });
  var outline = opml.outline({ text: 'Twitter' });
  config.follow.forEach(function (screen_name) {
    var user = users[screen_name];
    outline.outline({
      text: user.feed.title,
      title: user.feed.title,
      type: 'rss',
      htmlUrl: user.feed.site_url,
      xmlUrl: user.feed.feed_url
    });
  });

  res.type('xml');
  res.send(opml.xml(true));
});
