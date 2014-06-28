/* global angular, YT, screenfull */
(function(angular) {

    // Add a default handler to avoid missing the event. This can happen if you add the script manually,
    // which can be useful for performance
    if (typeof window.onYouTubeIframeAPIReady === 'undefined') {
        window.onYouTubeIframeAPIReady = function () {
            setTimeout(function(){
                window.onYouTubeIframeAPIReady();
            }, 100);
        };
    }

    function convertToUnits(u) {
        // If its numbers, interpret pixels
        if (typeof u === 'number' || /^\d+$/.test(u)) {
            return u + 'px';
        }
        return u;
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

    angular.module('hrAngularYoutube', [])

    .run(['youtube', function (youtube) {
        if (youtube.getAutoLoad()) {
            // Add the iframe api to the dom
            var tag = document.createElement('script');
            tag.src = '//www.youtube.com/iframe_api';
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }
    }])
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

                this.player = new YT.Player(elmOrId, op);
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
                    return true;
                }
                return false;
            };

            YoutubePlayer.prototype.fullscreenEnabled = function () {
                if (typeof screenfull !== 'undefined') {
                    return screenfull.enabled;
                }
                return false;
            };

            // YoutubePlayer.prototype.on = function (name, scope, handler) {
            //     var self = this;
            //     var newHandler = function() {
            //         var args = arguments;
            //         scope.$apply(function() {
            //             handler.apply(self.player, args);
            //         });
            //     };
            //     this.player.addEventListener(name, newHandler);
            // };

            YoutubePlayer.prototype.startLoading = function (sec) {
                var self = this;
                var unregister;
                var pauseAfterStart = function (event) {
                    if (event.data === YT.PlayerState.PLAYING) {
                        if (typeof sec === 'number') {
                            self.player.seekTo(sec, true);
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
                this._eventHash = Math.floor((1 + Math.random()) * 0x10000)
                                   .toString(16)
                                   .substring(1);
                var events = ['onStateChange', 'onPlaybackQualityChange', 'onPlaybackRateChange',
                              'onError', 'onApiChange', 'onReady'];
                angular.forEach(events, function(name) {
                    self.player.addEventListener(name, function(data) {
                        $rootScope.$emit(self._eventHash + name, data);
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

    })
    .directive('youtubePlayer', ['youtube', function (youtube) {
        var playerAttrs = ['id', 'height', 'width'],
            playerVarAttrs = ['autohide', 'autoplay', 'cc_load_policy', 'color', 'controls',
                              'disablekb', 'enablejsapi', 'end', 'fs', 'iv_load_policy',
                              'list', 'listType', 'loop', 'modestbranding', 'origin', 'playerapiid',
                              'playlist', 'playsinline', 'rel', 'showinfo', 'start', 'theme'];
        return {
            restrict: 'EA',
            require: ['youtubePlayer', '?ngModel'],
            template: '<div class="youtubeOuterDiv"><div class="youtubeInnerDiv"></div><div class="youtubeOverlay" ng-transclude=""></div></div>',
            scope: {
                videoId: '=',
            },
            transclude: true,
            controller: ['$scope','$q', function($scope, $q) {
                var player = $q.defer();

                this.setPlayer = function (p) {
                    player.resolve(p);
                };
                this.getPlayer = function () {
                    return player.promise;
                };

                var $overlayElm;
                this.setOverlayElement = function (elm) {
                    $overlayElm = elm;
                };

                this.getOverlayElement = function () {
                    return $overlayElm;
                };

                var $videoElm = null;


                this.getVideoElement = function () {
                    if ($videoElm === null) {
                        $videoElm = angular.element(this.getOverlayElement()[0].querySelector('.youtubeInnerDiv'));
                    }
                    return $videoElm;
                };
            }],
            link: function (scope, elm, attrs, controllers) {
                var youtubePlayerCtrl = controllers[0],
                    ngModelCtrl = controllers[1];

                var player = null;
                elm.css('position','relative');
                elm.css('display','block');

                // Save the overlay element in the controller so child directives can use it
                youtubePlayerCtrl.setOverlayElement(elm);

                var $videoDiv = elm[0].querySelector('.youtubeInnerDiv');
                var $outerDiv = angular.element(elm[0].querySelector('.youtubeOuterDiv'));

                $outerDiv.css('width', '100%');
                $outerDiv.css('height', '100%');

                var options = {
                    playerVars: {}
                };

                playerAttrs.forEach(function(a) {
                    if (typeof attrs[a] !== 'undefined') {
                        options[a] = attrs[a];
                    }
                });
                playerVarAttrs.forEach(function(a) {
                    if (typeof attrs[a] !== 'undefined') {
                        options.playerVars[a] = attrs[a];
                    }

                });
                var createVideo = function() {
                    options.videoId = scope.videoId;
                    if (!options.hasOwnProperty('width') && !options.hasOwnProperty('height') ) {
                        options.height = '390';
                        options.width = '640';
                    }
                    elm.css('height',convertToUnits(options.height));
                    elm.css('width',convertToUnits(options.width));

                    player = youtube.loadPlayer($videoDiv, options).then(function(p) {
                        player = p;
                        youtubePlayerCtrl.setPlayer(player);

                        player.setFullScreenElement($outerDiv[0]);

                        if (typeof ngModelCtrl !== 'undefined') {
                            ngModelCtrl.$setViewValue(player);
                        }
                    });

                };

                scope.$watch('videoId',function sourceChangeEvent(id) {
                    if (typeof id === 'undefined') {
                        return;
                    }
                    if (player === null) {
                        createVideo();
                    } else {
                        player.then(function(p){
                            p.loadVideoById(id);
                        });
                    }

                });


                var aspectRatio = 16 / 9;

                // Maybe add some sort of debounce, but without adding a dependency
                var resizeWithAspectRatio = function () {
                    if (options.height) {
                        var w = Math.round(elm[0].clientHeight * aspectRatio);
                        elm.css('width',convertToUnits(w));

                    } else if (options.width) {
                        var h = Math.round(elm[0].clientWidth / aspectRatio);
                        elm.css('height',convertToUnits(h));
                    }
                };

                if (attrs.hasOwnProperty('keepAspectRatio')) {

                    // If aspect ratio is a string like '16:9', set the proper variable.
                    var aspectMatch = attrs.keepAspectRatio.match(/^(\d+):(\d+)$/);
                    if (aspectMatch) {
                        aspectRatio = aspectMatch[1] / aspectMatch[2];
                    }

                    angular.element(window).bind('resize', resizeWithAspectRatio);
                    // If the window or the element size changes, resize the element
                    scope.$watch(function(){
                        return [elm[0].clientWidth, elm[0].clientHeight].join('x');
                    }, resizeWithAspectRatio);

                }

                scope.$on('$destroy', function() {
                    youtubePlayerCtrl.setPlayer(null);
                    player.destroy();
                    player = null;

                    angular.element(window).unbind('resize', resizeWithAspectRatio);
                });

            }
        };
    }]);


})(angular);

/* global angular, YT */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerBar',  function() {
        return {
            restrict: 'E',
            require: '^youtubePlayer',
            template: '<div class="played"></div><div class="loaded"></div><div class="handle"></div>',
            link: function(scope, elm, attrs, youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    player.mute();

                    var duration = player.getDuration();
                    var $played = angular.element(elm.children()[0]);
                    var $loaded = angular.element(elm.children()[1]);
                    var $handle = angular.element(elm.children()[2]);

                    var updateProgress = function(sec) {
                        var played, loaded;
                        if (player.getPlayerState() === YT.PlayerState.ENDED ) {
                            played = 100;
                            loaded = 100;
                        } else if ( typeof sec === 'number') {
                            // debugger;
                            played = 100 * sec / duration;
                            loaded = player.getVideoLoadedFraction() * 100;
                        } else {
                            played = 100 * player.getCurrentTime() / duration;
                            loaded = player.getVideoLoadedFraction() * 100;
                        }
                        // This was calculated manually, but cant have
                        // outerwidth without adding jquery
                        var handleOuterWidth = 15;
                        var handleX = played * elm[0].clientWidth / 100 - handleOuterWidth / 2  ;
                        handleX = Math.min(Math.max(0, handleX),elm[0].clientWidth - handleOuterWidth);
                        $loaded.css('width', loaded + '%');
                        $played.css('width', played + '%');
                        $handle.css('left', handleX + 'px');
                    };
                    // Update the progress on an interval when playing
                    player.onProgress(function(){
                        // The interval calls updateProgress with a number, so we need to add this inner fn
                        updateProgress();
                    });
                    // Update the progress every time there state changes
                    player.on('onStateChange', updateProgress);


                    var $videoElm = youtubePlayerCtrl.getVideoElement();
                    var $document = angular.element(document);

                    elm.on('mousedown', function(e) {
                        // If it wasn't a left click, end
                        if (e.button !== 0) {
                            return;
                        }
                        // Save the status of the player at the begining of the dragndrop
                        var playStatus = player.getPlayerState();
                        player.pauseVideo();

                        // Create a blocker div, so that the iframe doesn't eat the mouse up events
                        var $blocker = angular.element('<div></div>');
                        $blocker.css('position', 'absolute');
                        $blocker.css('width', $videoElm[0].clientWidth + 'px');
                        $blocker.css('height', $videoElm[0].clientHeight + 'px');
                        $blocker.css('pointer-events', 'false');
                        $blocker.css('top', '0');
                        $videoElm.parent().append($blocker);

                        var getSecondFromPageX = function (pagex) {
                            // Get the player bar x from the page x
                            var left =  elm[0].getBoundingClientRect().left;
                            var x = Math.min(Math.max(0,pagex - left),elm[0].clientWidth);

                            // Get which percent of the video, the user clicked in
                            var xpercent = x / elm[0].clientWidth;
                            // See what second it corresponds to
                            return Math.round(duration * xpercent);

                        };

                        var documentMouseMove = function(event) {
                            var sec = getSecondFromPageX(event.x);
                            // player.seekTo(sec, false);
                            updateProgress(sec);
                        };

                        var documentMouseUp = function(event) {
                            var sec = getSecondFromPageX(event.x);


                            // Remove the event listeners for the drag and drop
                            $document.off('mousemove', documentMouseMove );
                            $document.off('mouseup', documentMouseUp);
                            // remove the div that was blocking the events of the iframe
                            $blocker.remove();

                            if (playStatus === YT.PlayerState.PLAYING || playStatus === YT.PlayerState.PAUSED) {
                                // Load it in the player
                                player.seekTo(sec, true);
                                // Force update progress because seekTo takes its time
                                updateProgress(sec);
                            } else {
                                player.startLoading(sec);
                            }

                            // If it was playinf before, play now as well
                            if (playStatus === YT.PlayerState.PLAYING) {
                                player.playVideo();
                            }
                        };

                        $document.on('mousemove', documentMouseMove );
                        $document.on('mouseup', documentMouseUp);
                    });

                });
            }
        };
    });
})(angular);


/* global angular */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerCurrentTime',  function() {
        return {
            restrict: 'EA',
            require: '^youtubePlayer',
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    player.onProgress(function(){
                        elm.html(player.getHumanReadableCurrentTime());
                        console.log(elm.html());
                    },500);
                });
            }
        };
    });
})(angular);


/* global angular, YT */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerPanel', ['$animate', '$timeout', function($animate, $timeout) {
        return {
            restrict: 'E',
            require: '^youtubePlayer',
            template: '<div ng-transclude=""></div>',
            transclude: true,
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    var $overlay = youtubePlayerCtrl.getOverlayElement();
                    var whoWantsToShow = {};

                    var show = function(cause) {
                        whoWantsToShow[cause] = true;
                        $animate.addClass(elm, 'ng-show');
                    };

                    var hide = function(cause) {
                        delete whoWantsToShow[cause];
                        if (Object.keys(whoWantsToShow).length === 0 ) {
                            $animate.removeClass(elm, 'ng-show');

                        }
                    };

                    if ('showOnHover' in attrs && attrs.showOnHover !== false) {
                        var showOnHover = parseInt(attrs.showOnHover);
                        var cancelTimerFn = null;
                        var cancelTimer = function() {
                            if (cancelTimerFn !== null) {
                                $timeout.cancel(cancelTimerFn);
                            }
                            cancelTimerFn = null;
                        };
                        $overlay.on('mouseenter', function() {
                            cancelTimer();
                            show('showOnHover');
                            if (!isNaN(showOnHover)) {
                                cancelTimerFn = $timeout(function(){
                                    hide('showOnHover');
                                }, showOnHover);

                            }
                        });
                        $overlay.on('mouseleave', function() {
                            cancelTimer();
                            hide('showOnHover');
                        });
                    }

                    var showOnPause = function(event) {
                        if (event.data === YT.PlayerState.PLAYING) {
                            hide('showOnPause');
                        } else {
                            show('showOnPause');
                        }
                    };
                    if ('showOnPause' in attrs && attrs.showOnPause !== false) {
                        player.on('onStateChange', showOnPause);
                        showOnPause({data:player.getPlayerState()});

                    }
                });

            }
        };
    }]);
})(angular);


/* global angular */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerPause',  function() {
        return {
            restrict: 'E',
            require: '^youtubePlayer',
            template: '<div style="display: inherit" ng-transclude=""></div>',
            transclude: true,
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    elm.on('click', function() {
                        player.pauseVideo();
                    });
                });
            }
        };
    });
})(angular);


/* global angular */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerPlay',  function() {
        return {
            restrict: 'E',
            require: '^youtubePlayer',
            template: '<div style="display: inherit" ng-transclude=""></div>',
            transclude: true,
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    elm.on('click', function() {
                        player.playVideo();
                    });
                });
            }
        };
    });
})(angular);


/* global angular */
(function(angular) {
    angular.module('hrAngularYoutube')
    .directive('playerTotalTime',  function() {
        return {
            restrict: 'EA',
            require: '^youtubePlayer',
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                youtubePlayerCtrl.getPlayer().then(function(player){
                    elm.html(player.getHumanReadableDuration());
                });
            }
        };
    });
})(angular);


/* global angular, YT */


(function(angular) {
    angular.module('hrAngularYoutube')

    .directive('showIfPlayerIs', ['$animate', function($animate) {
        return {
            restrict: 'AE',
            require: '^youtubePlayer',
            link: function(scope, elm, attrs,youtubePlayerCtrl) {
                // By default hide
                $animate.addClass(elm, 'ng-hide');
                youtubePlayerCtrl.getPlayer().then(function(player){
                    // Convert the status list into an array of state numbers
                    var status = [];
                    // Convert it first into the array of string
                    var stringStatus = attrs.showIfPlayerIs.toUpperCase().split(',');
                    // For each state name, get its state number
                    angular.forEach(stringStatus,function(s){
                        if (YT.PlayerState.hasOwnProperty(s)) {
                            status.push(YT.PlayerState[s]);
                        }
                    });

                    var hideOrShow = function (event) {
                        if (status.indexOf(event.data) !== -1) {
                            $animate.removeClass(elm, 'ng-hide');
                        } else {
                            $animate.addClass(elm, 'ng-hide');
                        }
                    };
                    // Subscribe to the state change event
                    player.on('onStateChange', hideOrShow);
                    // Show or hide based on initial status
                    hideOrShow({data: player.getPlayerState()});
                });
            }
        };
    }]);

})(angular);


