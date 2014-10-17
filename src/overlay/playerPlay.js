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
