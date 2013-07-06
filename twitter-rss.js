var config = require('config').twitterRss;

var client = require('twitter-api').createClient();
var async = require('async');

client.setAuth(
  config.twitterApi.consumer.key,
  config.twitterApi.consumer.secret,
  config.twitterApi.access.key,
  config.twitterApi.access.secret
);

var users = config.follow;

var getUserId = function (screen_name, cb) {
  client.get( 'users/show', { screen_name: screen_name }, function (user, error, status) {
    cb(error ? status : null, user.id);
  });
};

async.map(users, getUserId, function(err, users_id) {
  if (err) {
    console.error('Error getting users id', err);
    return;
  }

  console.log('users_id', users_id);

  client.stream( 'statuses/filter', { follow: users_id.join(',') }, function( json ) {
    var tweet = JSON.parse( json );
    console.log('tweet', tweet);
    if( tweet.text && tweet.user ){
      console.log( tweet.user.screen_name+': "'+tweet.text+'"');
    }
  });
});

