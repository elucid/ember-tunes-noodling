// this app is something I am going to interactively develop during a live
// coding demo at a local user group. it starts off with the final markup
// from the simple music application developed in the PeepCode Backbone
// screncasts. from there I will extract views, controllers, and wire
// everything together. this is the finished product.

// the goal is to demonstrate how to use Ember to interactively
// develop an application and showcase how it helps you to develop
// applications the way that you think about them. in particular,
// as you continue to add features you don't get bogged down in housekeeping
// and low-level details. watching the Backbone screencasts where this app
// is developed, it is striking how things start off very simply but
// end up incorporating a lot of accidental complexity by the time the
// second screencast is finished.

// anyhow, there have been a lot of API changes to Ember of late. if there is
// anything that is no longer recommended, or anything just eggregiously stupid,
// please let me know before I inflict my poor designs on unsuspecting newbs.

Tunes = Ember.Application.create();

// there is not a lot of actual routing work here--just a fixed URL.
// the main value is introducing the idea of organizing the application
// into states that respond to actions. I suppose StateManager could have
// been used instead of Router but it's worth introducing connectOutlets
Tunes.Router = Em.Router.extend({
  enableLogging: true,
  root: Em.Route.extend({
    index: Em.Route.extend({
      route: '/',

      enter: function(router) {
        // in a real app the application controller would probably bootstrap
        // data on init and then call into the router on various lifecycle
        // events related to that
        $.get('albums.json', function(data){
          router.get('libraryController').set('content', data);
          router.transitionTo('ready');
        });
      },

      connectOutlets: function(router) {
        var controller = router.get('applicationController');
        controller.connectOutlet('library', 'library');
        controller.connectOutlet('playlist', 'playlist', []);
      }

    }),

    ready: Em.State.extend({
      initialState: 'emptyPlaylist',

      emptyPlaylist: Em.State.extend({
        // note: these actions don't make sense until we have queued
        // tracks, but we don't want to error out if playlist buttons
        // are pressed at that point.
        play:  Em.K,
        pause: Em.K,
        prev:  Em.K,
        next:  Em.K
      }),

      tracksQueued: Em.State.extend({
        dequeueAlbum: function(router, event) {
          var album = event.context;
          router.get('playlistController').dequeueAlbum(album);
        },

        lastAlbumDequeued: function(router) {
          router.transitionTo('emptyPlaylist');
        },

        // delegate actual work to the playlistController. views could
        // of course be setup to target that controller directly but
        // I much prefer having the router manage application-level events
        play:  function(sm) { sm.get('playlistController').play(); },
        pause: function(sm) { sm.get('playlistController').pause(); },
        prev:  function(sm) { sm.get('playlistController').prev(); },
        next:  function(sm) { sm.get('playlistController').next(); }
      }),

      queueAlbum: function(router, event) {
        var album = event.context;
        router.get('playlistController').queueAlbum(album);
        router.transitionTo('tracksQueued');
      }
    })
  })
});

Tunes.ApplicationView = Em.View.extend({
  templateName: 'application',

  elementId: 'container'
});

Tunes.NavbarView = Em.View.extend({
  templateName: 'navbar'
});

Tunes.PlaylistView = Em.View.extend({
  templateName: 'playlist'
});

Tunes.LibraryView = Em.View.extend({
  templateName: 'library'
});

Tunes.AlbumView = Em.View.extend({
  templateName: 'album',

  classNames: ["album"],

  classNameBindings: ["isCurrent:current"],

  isCurrent: function() {
    return this.get('album') === this.get('controller.currentAlbum');
  }.property('album', 'controller.currentAlbum')
});

Tunes.TracksView = Em.View.extend({
  templateName: 'tracks'
});

Tunes.TrackView = Em.View.extend({
  templateName: "track",

  tagName: 'li',

  classNameBindings: ['isCurrent:current'],

  isCurrent: function() {
    return this.get('track') === this.get('controller.currentTrack');
  }.property('track', 'controller.currentTrack')

});

Tunes.ApplicationController = Em.Controller.extend();

Tunes.LibraryController = Em.ArrayController.extend();

Tunes.PlaylistController = Em.ArrayController.extend({
  init: function(){
    var audio = new Audio();

    audio.addEventListener('ended', function() {
      this.next();
    }.bind(this));

    this.set('audio', audio);

    this._super();
  },


  // the following six functions comprise this controller's public interface
  // and encapsulate changes to internal state so that consistency can be
  // maintained.

  play: function() {
    this.set('state', 'play');
    this.get('audio').play();
  },

  pause: function() {
    this.set('state', 'pause');
    this.get('audio').pause();
  },

  prev: function() {
    var length = this.get('tracklist.length');
    var _currentTrackIndex = this.get('_currentTrackIndex');
    if (_currentTrackIndex === 0) {
      this.set('_currentTrackIndex', length - 1);
    } else {
      this.set('_currentTrackIndex', _currentTrackIndex - 1);
    }
  },

  next: function() {
    var length = this.get('tracklist.length');
    var _currentTrackIndex = this.get('_currentTrackIndex');
    if (_currentTrackIndex === length - 1) {
      this.set('_currentTrackIndex', 0);
    } else {
      this.set('_currentTrackIndex', _currentTrackIndex + 1);
    }
  },

  queueAlbum: function(album) {
    this.get('content').pushObject(album);
  },

  // this is a bit more complicated than I would like. however,
  // it's not terrible and I can't think of a simpler way to prevent
  // the playing track from skipping due to currentTrack temporarily
  // being set to undefined
  dequeueAlbum: function(album) {
    if (album === this.get('currentAlbum')) {
      this.pause();
    }

    // grab current track before the tracklist gets rearranged
    var currentTrack = this.get('currentTrack');

    var albums = this.get('content');

    // so that currentTrack is only updated once to the outside world
    Em.beginPropertyChanges();

    albums.removeObject(album);

    // new position for current track after album was removed
    var currentTrackIndex =
      this.get('tracklist').indexOf(currentTrack);

    // reset currentTrack to first track if the currentTrack was just removed
    if (currentTrackIndex === -1) {
      currentTrackIndex = 0;
    }

    this.set('_currentTrackIndex', currentTrackIndex);

    Em.endPropertyChanges();

    if (Em.empty(albums)) {
      Tunes.router.send("lastAlbumDequeued");
    }
  },


  // the following four properties are also part of this controller's public
  // interface. they can be bound to e.g. to properly reflect playlist state
  // in the UI

  currentTrack: function() {
    return this.get('tracklist').objectAt(this.get('_currentTrackIndex'));
  }.property('_currentTrackIndex', 'tracklist'),

  currentAlbum: function() {
    return this.get('currentTrack.album');
  }.property('currentTrack'),

  isPlaying: function() {
    return this.get('state') === 'play';
  }.property('state'),

  state: 'pause',


  // internal properties

  currentTrackChanged: function() {
    var pathname = function(href) {
      var l = document.createElement("a");
      l.href = href;
      return l.pathname;
    };

    // note: we have to do this because observer fires whenever
    // dependent properties of currentTrack change, not when
    // the track itself changes.
    // it might be possible to do this more simply in the future
    // if/when observers are passed previous/new value arguments
    if (this.get('audio') && pathname(this.get('audio').src) !== this.get('currentTrack.url')) {
      this.get('audio').src = this.get('currentTrack.url');
      if (this.get('isPlaying')) {
        this.play();
      }
    }
  }.observes('currentTrack'),

  tracklist: function() {
    return this.get('content').reduce(function(res, album) {
      var tracks = album.tracks.map(function(track){
        return $.extend(track, {album: album});
      });

      return res.concat(tracks);
    }, []);
  }.property('content.@each'),

  _currentTrackIndex: 0
});

Tunes.initialize();

// the gist: https://gist.github.com/3c95d4ea14066264288f
