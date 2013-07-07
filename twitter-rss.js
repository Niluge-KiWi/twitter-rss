var config = require('config').twitterRss;

var client = require('twitter-api').createClient();
var async = require('async');

var express = require('express');
var app = express();


client.setAuth(
  config.twitterApi.consumer.key,
  config.twitterApi.consumer.secret,
  config.twitterApi.access.key,
  config.twitterApi.access.secret
);

var users = {}; // indexed by screen_name

var getUserId = function (screen_name, cb) {
  client.get( 'users/show', { screen_name: screen_name }, function (user, error, status) {
    cb(error ? status : null, user.id);
  });
};

async.map(config.follow, function (screen_name, cb) {
  var user = users[screen_name] = {};
  async.series([ function (cb) { // get user infos (for user_id)
    client.get('users/show', { screen_name: screen_name }, function (userInfos, error, status) {
      user.infos = userInfos;
      cb(error ? status : null);
    });
  }, function (cb) { // get user last tweets
    client.get('statuses/user_timeline', { user_id: user.infos.id, count: config.tweetsLimit },function (tweets, error, status) {
      user.tweets = tweets;
      cb(error ? status : null);
    });
  }], function (err) {
    cb(err, user.infos.id);
  });
}, function(err, users_id) {
  if (err) {
    console.error('Error bootstrapping', err);
    return;
  }

  console.log('users_id', users_id);
  console.log('users', users);

  client.stream( 'statuses/filter', { follow: users_id.join(',') }, function( json ) {
    var tweet = JSON.parse( json );
    var user = users[tweet.user.screen_name]
    if (! user)
      return;

    user.tweets.push(tweet);
    //TODO splice the first elements of user.tweets if too old

    console.log('tweet', tweet);
    if (tweet.text && tweet.user) {
      console.log( tweet.user.screen_name+': "'+tweet.text+'"');
    }
  });
});


app.get('/statuses/user_timeline/:screen_name', function(req, res){
  var user = users[req.params.screen_name];
  if (! user) {
    res.status(404).send('User ' + req.params.screen_name + ' not registered');
    return;
  }

  res.send(user);
});

app.listen(config.port);
console.log('Listening on port', config.port);
