import {Directive} from '../ng-helper/facade';
import * as angular from 'angular';

@Directive({
    selector: 'ytSlider',
})
export class YoutubeSliderDirective {

    static $inject = ['$element', '$attrs', '$scope', '$parse', '$document'];
    constructor (
        private elm: ng.IAugmentedJQuery,
        private attrs: ng.IAttributes,
        private scope: ng.IScope,
        private $parse: ng.IParseService,
        private $document: ng.IDocumentService) {
        this.ngOnInit(); // TODO: Remove after upgrade to ng 1.6
    }

    ngOnInit () {
        const slideDown  = this.$parse(this.attrs['ytSliderDown']);
        const sliderMove = this.$parse(this.attrs['ytSliderMove']);
        const sliderUp   = this.$parse(this.attrs['ytSlider']);

        const getPercentageFromPageX = (pagex: number) => {
            // Get the player bar x from the page x
            const left =  this.elm[0].getBoundingClientRect().left;
            const x = Math.min(Math.max(0, pagex - left), this.elm[0].clientWidth);

            // Get the percentage of the bar
            const xpercent = x / this.elm[0].clientWidth;
            return xpercent;
        };


        this.elm.on('mousedown', (e) => {
            // If it wasn't a left click, end
            if (e.button !== 0) {
                return;
            }

            const p = getPercentageFromPageX(e.pageX);
            slideDown(this.scope, {$percentage: p});

            // Create a blocker div, so that the iframe doesn't eat the mouse up events
            const $blocker = angular.element('<div></div>');
            $blocker.css('position', 'absolute');
            $blocker.css('width', '100%');
            $blocker.css('height', '100%');
            $blocker.css('pointer-events', 'false');
            $blocker.css('top', '0');
            document.body.appendChild($blocker[0]);

            const documentMouseMove = (event: any) => {
                this.scope.$apply(() => {
                    const p = getPercentageFromPageX(event.pageX);
                    sliderMove(this.scope, {$percentage: p});
                });
            };

            const documentMouseUp = (event: any) => {
                this.scope.$apply(() => {
                    const p = getPercentageFromPageX(event.pageX);

                    // Remove the event listeners for the drag and drop
                    this.$document.off('mousemove', documentMouseMove );
                    this.$document.off('mouseup', documentMouseUp);
                    // remove the div that was blocking the events of the iframe
                    $blocker.remove();

                    sliderUp(this.scope, {$percentage: p});
                });

            };

            this.$document.on('mousemove', documentMouseMove );
            this.$document.on('mouseup', documentMouseUp);
        });
    }
}
