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

