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
    // note: these actions don't make sense until we have queued
    // tracks, but we don't want to error out if playlist buttons
    // are pressed at that point.
    play:  Em.K,
    pause: Em.K,
    prev:  Em.K,
    next:  Em.K,

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
        var appController = router.get('applicationController');
        appController.connectOutlet('library', 'library');
        appController.connectOutlet('playlist', 'playlist', []);

        router.get('playlistController').connectOutlet({
          outletName: 'navbar',
          viewClass: Tunes.NavbarView,
          controller: router.get('audioController')
        });
      }
    }),

    ready: Em.State.extend({
      initialState: 'emptyQueue',

      emptyQueue: Em.State.extend(),

      tracksQueued: Em.State.extend({
        initialState: 'paused',

        dequeueAlbum: function(router, event) {
          var album = event.context;
          router.get('playlistController').dequeueAlbum(album);
        },

        lastAlbumDequeued: function(router) {
          router.transitionTo('emptyQueue');
        },

        playing: Em.State.extend({
          enter: function(sm) {
            sm.get('audioController').play();
            sm.set('audioController.isPlaying', true);
          },

          pause: function(sm) {
            sm.transitionTo('paused');
          },

          prev:  function(sm) {
            sm.get('playlistController').prev();
            sm.get('audioController').play();
          },

          next:  function(sm) {
            sm.get('playlistController').next();
            sm.get('audioController').play();
          }
        }),

        paused: Em.State.extend({
          enter: function(sm) {
            sm.get('audioController').pause();
            sm.set('audioController.isPlaying', false);
          },

          play:  function(sm) {
            sm.transitionTo('playing');
          },

          prev:  function(sm) {
            sm.get('playlistController').prev();
          },

          next:  function(sm) {
            sm.get('playlistController').next();
          }
        })
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

Tunes.AudioController = Em.Controller.extend({
  init: function(){
    var audio = new Audio();

    audio.addEventListener('ended', function() {
      var router = this.get('controllers');
      router.send('pause');
      router.send('next');
      router.send('play');
    }.bind(this));

    this.set('audio', audio);

    this._super();
  },

  play: function() {
    Em.run.next(this, function() {this.get('audio').play();});
  },

  pause: function() {
    this.get('audio').pause();
  },

  currentTrackChanged: function() {
    var newUrl = this.get('currentTrack.url');
    var audio  = this.get('audio');

    // note: we have to do this because observer fires whenever
    // dependent properties of currentTrack change, not when
    // the track itself changes.
    // it might be possible to do this more simply in the future
    // if/when observers are passed previous/new value arguments
    if (audio && this.get('_currentTrackSource') !== newUrl) {
      this.set('_currentTrackSource', newUrl);
      audio.src = newUrl;
    }
  }.observes('currentTrack'),

  currentTrackBinding: 'controllers.playlistController.currentTrack',

  // kind of stupid, but when audio.src is set it automatically prepends
  // the hostname, and we need to be able to compare the track source later
  _currentTrackSource: null
});

Tunes.PlaylistController = Em.ArrayController.extend({
  // the following four functions comprise this controller's public interface
  // and encapsulate changes to internal state so that consistency can be
  // maintained.

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
      this.get('controllers').send('pause');
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
      this.get('controllers').send("lastAlbumDequeued");
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


  // internal properties

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