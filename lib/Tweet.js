class Tweet {
  constructor(data) {
    Tweet.toExtendedTweet(data);
    Object.assign(this, data);
  }

  static toExtendedTweet(tweet) {
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

    // recurse
    [ tweet.retweeted_status, tweet.quoted_status ].map( x => x !== undefined && Tweet.toExtendedTweet(x));
  }

  toFeedItem() {
    // improve feed content
    var full_text = this.full_text;

    // clickable urls
    var urlPattern = /(\b(https?):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
    var rich_text = full_text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');

    // newlines
    rich_text = rich_text.replace(/(\r\n|\r|\n)/g,'<br/>');

    if (this.retweeted_status) {
      // full text on RT
      const rt = new Tweet(this.retweeted_status);
      const rtItem = rt.toFeedItem();
      full_text = 'RT @' + rtItem.title;
      rich_text = 'RT @' + rtItem.description;
    }

    if (this.quoted_status) {
      const qt = new Tweet(this.quoted_status);
      const qtItem = qt.toFeedItem();
      rich_text += '\n<div style="margin: 12px; padding: 12px; border: 1px solid grey; border-radius: 4px;">Quote @' + qtItem.description + '</div>';
    }

    // media
    if (this.extended_entities && this.extended_entities.media) {
      this.extended_entities.media.forEach(function (media) {
        rich_text += '\n<div style="margin: 12px; padding: 12px;"><a href="' + media.url + '"><img src="' + media.media_url_https + '"/></a></div>';
      });
    }

    return {
      title: this.user.screen_name + ': ' + full_text,
      description: this.user.screen_name + ': ' + rich_text,
      url: 'https://nitter.42l.fr/' + this.user.screen_name + '/status/' + this.id_str,
      guid: this.id_str,
      date: this.created_at
    };
  }
}

module.exports = Tweet;
