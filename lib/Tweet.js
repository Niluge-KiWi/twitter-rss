module.exports.convert2ExtendedTweet = function (tweet) {
  // compatibility: construct always extended to avoid become crazy
  // see https://developer.twitter.com/en/docs/tweets/tweet-updates
  if (tweet.extended_tweet) {
    // this is a tweet in mode "Compatibility with additional extended_tweet in payload"
    // construct "Extended" mode
    delete tweet.text;
    tweet.full_text = tweet.extended_tweet.full_text;
    tweet.display_text_range = tweet.extended_tweet.display_text_range;
    tweet.entities = tweet.extended_tweet.entities;
    tweet.extended_entities = tweet.extended_tweet.extended_entities;
    delete tweet.extended_tweet;
    tweet.truncated = false;
  } else if (tweet.text) {
    // this is a tweet in compatibility mode that may not have needed more than 140 characters, so is missing "extended_tweet"
    // construct "Extended" mode by faking an extended tweet
    tweet.full_text = tweet.text;
    delete tweet.text;
    tweet.truncated = false;
  }
};
