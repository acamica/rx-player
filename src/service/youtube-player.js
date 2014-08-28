/* global angular, YT, screenfull */
(function(angular) {

    function generateHash() {
        return Math.floor((1 + Math.random()) * 0x10000)
                                   .toString(16)
                                   .substring(1);
    }


    function youtubeReadableTime (t) {
        t = Math.floor(t);
        var seconds = t % 60;
        var minutes = Math.floor(t / 60);
        var hours = Math.floor(minutes / 60);
        minutes = minutes % 60;
        if ( hours > 0 ) {
            return hours + ':' + String('00' + minutes).slice(-2) + ':' + String('00' + seconds).slice(-2);
        } else {
            return minutes + ':' + String('00' + seconds).slice(-2);
        }
    }


    angular.module('hrAngularYoutube')

    .provider('youtube', function youtubeProvider () {

        var defaultOptions = {
            playerVars: {
                origin: location.origin + '/',
                enablejsapi: 1
            }
        };

        var autoload = true;
        this.setAutoLoad = function (auto) {
            autoload = auto;
        };

        this.setOptions = function (options) {
            defaultOptions = options;
        };

        this.getOptions = function () {
            return defaultOptions;
        };

        this.setOption = function (name, value) {
            defaultOptions[name] = value;
        };

        this.setPlayerVarOption = function (name, value) {
            defaultOptions.playerVars[name] = value;
        };


        this.$get = ['$window','$q', '$interval','$rootScope', function ($window, $q, $interval, $rootScope) {
            var apiLoaded = $q.defer();

            var apiLoadedPromise = apiLoaded.promise;

            var YoutubePlayer = function(elmOrId, playerOptions) {
                var options = {};
                // Override main options
                angular.extend(options, angular.copy(defaultOptions), playerOptions);
                // Override player var options
                options.playerVars = {}; // For some reason if I dont reset this angular.extend doesnt work as expected
                angular.extend(options.playerVars, angular.copy(defaultOptions.playerVars), playerOptions.playerVars);


                this.options = options;

                var op = angular.copy(options);
                // Poner un if fit to parent, o algo asi
                op.width = '100%';
                op.height = '100%';

                if (this.fullscreenEnabled()) {
                    var self = this;
                    document.addEventListener(screenfull.raw.fullscreenchange, function() {
                        self.emit('fullscreenchange');
                    });
                }
                this.player = new YT.Player(elmOrId, op);

                this.markersByName = {};
                // TODO: Maybe add a markersByTime for performance
            };

            // TODO: Inherit better than these :S once i know if this is the way I want to access the object
            angular.forEach([
                'loadVideoById', 'loadVideoByUrl', 'cueVideoById', 'cueVideoByUrl', 'cuePlaylist',
                'loadPlaylist', 'playVideo', 'pauseVideo', 'stopVideo', 'seekTo', 'clearVideo',
                'nextVideo', 'previousVideo', 'playVideoAt', 'mute', 'unMute', 'isMuted', 'setVolume',
                'getVolume', 'setSize', 'getPlaybackRate', 'setPlaybackRate', 'getAvailablePlaybackRates',
                'setLoop', 'setShuffle', 'getVideoLoadedFraction', 'getPlayerState', 'getCurrentTime',
                'getPlaybackQuality', 'setPlaybackQuality', 'getAvailableQualityLevels', 'getDuration',
                'getVideoUrl', 'getVideoEmbedCode', 'getPlaylist', 'getPlaylistIndex', 'getIframe', 'destroy'
                // 'addEventListener', 'removeEventListener'
            ], function(name) {
                YoutubePlayer.prototype[name] = function() {
                    return this.player[name].apply(this.player, arguments);
                };
            });

            YoutubePlayer.prototype.setOverlayElement = function (elm) {
                this._element = elm;
            };

            YoutubePlayer.prototype.getOverlayElement = function () {
                return this._element;
            };


            // TODO: See how to add a default, or if to make a full-screen directive
            YoutubePlayer.prototype.setFullScreenElement = function (elm) {
                this._fullScreenElem = elm;
            };

            YoutubePlayer.prototype.getHumanReadableDuration = function () {
                return youtubeReadableTime(this.getDuration());
            };

            YoutubePlayer.prototype.getHumanReadableCurrentTime = function () {
                return youtubeReadableTime(this.getCurrentTime());
            };



            YoutubePlayer.prototype.onProgress = function (fn, resolution) {
                if (typeof resolution === 'undefined') {
                    resolution = 100;
                }
                var promise = null;
                var startInterval = function () {
                    if (promise === null) {
                        promise = $interval(fn, resolution);
                    }
                };
                var stopInterval = function () {

                    $interval.cancel(promise);
                    promise = null;
                };

                var cancel = function() {
                    stopInterval();
                    // TODO: something more to destroy / release stuff.
                };
                this.on('onStateChange', function(event) {
                    if (event.data === YT.PlayerState.PLAYING) {
                        startInterval();
                    } else {
                        stopInterval();
                    }
                });

                if (this.getPlayerState() === YT.PlayerState.PLAYING) {
                    startInterval();
                }
                return cancel;
            };

            YoutubePlayer.prototype.requestFullscreen = function () {
                if (this.fullscreenEnabled()) {
                    screenfull.request(this._fullScreenElem);
                    this.emit('fullscreenEnabled');
                    return true;
                }
                return false;
            };

            YoutubePlayer.prototype.toggleFullscreen = function () {
                if (this.fullscreenEnabled()) {
                    var isFullscreen = screenfull.isFullscreen;
                    screenfull.toggle(this._fullScreenElem);
                    if (isFullscreen) {
                        this.emit('fullscreenDisabled');
                    } else {
                        this.emit('fullscreenEnabled');
                    }
                    return true;
                }
                return false;
            };

            YoutubePlayer.prototype.isFullscreen = function () {
                if (this.fullscreenEnabled()) {
                    return screenfull.isFullscreen;
                }
                return false;
            };


            YoutubePlayer.prototype.fullscreenEnabled = function () {
                if (typeof screenfull !== 'undefined') {
                    return screenfull.enabled;
                }
                return false;
            };


            /**
             * Its like seekTo, but fires an event when the seek is complete
             */
            YoutubePlayer.prototype.eventSeekTo = function (sec, allowSeekAhead) {
                var self = this;
                var initialTime = this.player.getCurrentTime();

                // If there is a blocking marker, don't allow to seek further than it
                angular.forEach(self.markersByName, function(marker) {
                    // If its not blocking, we dont care
                    if (marker.blockFF === false) {
                        return;
                    }

                    // If the marker is in the seek time, force the sec to be at the marker time
                    if (marker.startedIn(initialTime, sec)) {
                        sec = marker.time;
                    }
                });

                // Seek to sec
                this.player.seekTo(sec, allowSeekAhead);

                // Check on a time interval that the seek has been completed
                var promise = $interval(function() {
                    var currentTime = self.player.getCurrentTime();
                    var seekCompleted = false;

                    // This can be made in fewer lines, but its easier to debug this way
                    // if the current time is lower than the initial time, it means you
                    // seek back, and its now complete
                    if (currentTime < initialTime) {
                        seekCompleted = true;
                    }
                    // if not, you pushed forward, and if you are bigger than the sec you tried
                    // to push to, then you also have complete
                    else if ( currentTime >= sec ) {
                        seekCompleted = true;
                    }
                    // There may be a third scenario where the player is paused, you pushed
                    // forward and it complete but just next to sec.

                    // Once its complete, for whatever reason, fire the event and cancel this interval
                    if (seekCompleted) {
                        self.emit('seekToCompleted', {newTime: sec, oldTime: initialTime});
                        $interval.cancel(promise);
                    }
                }, 50);

            };

            YoutubePlayer.prototype.startLoading = function (sec) {
                var self = this;
                var unregister;
                var pauseAfterStart = function (event) {
                    if (event.data === YT.PlayerState.PLAYING) {
                        if (typeof sec === 'number') {
                            self.eventSeekTo(sec, true);
                        }
                        unregister();
                        self.player.pauseVideo();
                    }
                };
                unregister = this.on('onStateChange', pauseAfterStart);
                this.player.playVideo();
            };

            YoutubePlayer.prototype._initializeEventListener = function () {
                if (this._eventsInitialized ) {
                    return;
                }
                var self = this;
                this._eventHash = generateHash();
                var events = ['onStateChange', 'onPlaybackQualityChange', 'onPlaybackRateChange',
                              'onError', 'onApiChange', 'onReady'];
                angular.forEach(events, function(name) {
                    self.player.addEventListener(name, function(data) {
                        self.emit(name,data);
                    });
                });
                this._eventsInitialized = true;
            };


            YoutubePlayer.prototype.on = function (name, handler) {
                this._initializeEventListener();

                return $rootScope.$on(this._eventHash + name, function(e, eventData) {
                    handler(eventData);
                });
            };

            YoutubePlayer.prototype.emit = function(name, data) {
                $rootScope.$emit(this._eventHash + name, data);
            };

            YoutubePlayer.prototype._initializeMarkerListener = function () {
                // Only initialize markers once
                if ( this._markerListener ) {
                    return;
                }
                this._markerListener = true;

                var runMarker = function (marker) {
                    if (marker.start()) {
                        // Emit an event with the marker
                        self.emit('markerRun', marker);
                    }
                };
                var stopMarker = function (marker) {
                    marker.end();
                    // Emit an event with the marker
                    self.emit('markerStop', marker);
                };



                var self = this;
                var lastMarkerTime = 0;
                this.onProgress(function() {
                    var currentTime = self.getCurrentTime();

                    var newLastTime = lastMarkerTime;
                    angular.forEach(self.markersByName, function(marker) {
                        // If the marker time has past and we haven't launched this marker yet
                        if (marker.startedIn(lastMarkerTime, currentTime)) {
                            runMarker(marker);
                            newLastTime = Math.max(newLastTime, marker.time);
                        }
                        // If the marker has ended
                        if (marker.endedIn(lastMarkerTime, currentTime) && marker.isRunning()) {
                            stopMarker(marker);
                            newLastTime = Math.max(newLastTime, marker.endTime);
                        }
                    });
                    lastMarkerTime = newLastTime;
                });

                this.on('seekToCompleted', function(seekTime){

                    angular.forEach(self.markersByName, function(marker) {
                        // If the marker was running and the seek throws it out of range, stop it
                        if (marker.isRunning() && !marker.inRange(seekTime.newTime)) {
                            stopMarker(marker);
                        }

                        if (marker.shouldLaunchOnSeek()) {
                            if (marker.hasEndTime() && marker.inRange(seekTime.newTime) ||
                                !marker.hasEndTime() && marker.startedIn(seekTime.oldTime, seekTime.newTime)) {
                                runMarker(marker);
                            }

                        }
                    });
                    lastMarkerTime = seekTime.newTime;
                });
            };

            YoutubePlayer.prototype.addMarker = function (marker) {
                this._initializeMarkerListener();

                if (!marker.hasOwnProperty('name') || marker.name === null) {
                    marker.name = generateHash();
                }

                this.markersByName[marker.name] = marker;
                this.emit('markerAdd', marker);
            };

            YoutubePlayer.prototype.removeMarker = function (marker) {
                delete this.markersByName[marker.name];
            };
            YoutubePlayer.prototype.getMarkers = function () {
                return this.markersByName;
            };
            YoutubePlayer.prototype.getMarker = function (name) {
                return this.markersByName[name];
            };



            // Youtube callback when API is ready
            $window.onYouTubeIframeAPIReady = function () {
                apiLoaded.resolve();
            };


            return {
                loadPlayer: function (elmOrId, options) {
                    return apiLoadedPromise.then(function(){
                        var videoReady = $q.defer();
                        var player = new YoutubePlayer(elmOrId, options);
                        player.on('onReady', function() {
                            videoReady.resolve(player);
                        });
                        return videoReady.promise;
                    });

                },
                getAutoLoad: function () {
                    return autoload;
                }

            };
        }];

    });


})(angular);