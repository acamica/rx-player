import {Directive, bindToCtrlCallOnInit} from '../../ng-helper/facade';
import {readableTime} from '../../util/readable-time.util';
import {PleierComponent} from '../../players/pleier.component';

// TODO: This had restrict A so its a directive, but it also has an html template soooo its a
// component? Refactor :D
@Directive({
    selector: 'hoverIndicator',
    // templateUrl: '/template/overlay/player-progress-bar-hover-indicator.html',
    link: bindToCtrlCallOnInit(['pleier']),
    require: ['^pleier']
})
export class HoverIndicatorComponent {
    private pleier: PleierComponent;

    static $inject = ['$element', '$document', '$compile', '$templateCache', '$http', '$scope'];
    constructor (
            private elm: ng.IAugmentedJQuery,
            private $document: ng.IDocumentService,
            private $compile: ng.ICompileService,
            private $templateCache: ng.ITemplateCacheService,
            private $http: ng.IHttpService,
            private scope: ng.IScope) {
    }

    ngOnInit () {

        // TODO: This is copy pasted from ytSlider, refactor!!!
        const getPercentageFromPageX = (pagex: number) => {
            // Get the player bar x from the page x
            const left =  this.elm[0].getBoundingClientRect().left;
            const x = Math.min(Math.max(0, pagex - left), this.elm[0].clientWidth);

            // Get the percentage of the bar
            const xpercent = x / this.elm[0].clientWidth;
            return xpercent;
        };

        const templateUrl = '/template/overlay/progress-bar/player-progress-bar-hover-indicator.component.html';
        const template = this.$http.get<string>(templateUrl, {cache: this.$templateCache})
                                   .then(response => response.data);

        let indicatorElm: JQuery = null;
        const indicatorScope = this.scope.$new(true);
        template.then(template => {
            indicatorElm = this.$compile(template)(indicatorScope);
            // Hide it
            indicatorElm.addClass('ng-hide');

            // Add it to the parent
            this.elm.parent().append(indicatorElm);
        });

        // TODO: Refactor to rxjs
        this.pleier
            .player$
            .subscribe(player => {
                const duration = player.getDuration();

                const barMove = (event: any) => {
                    const p = getPercentageFromPageX(event.pageX);
                    indicatorScope.$apply(scope => {
                        (scope as any).time = readableTime(p * duration);
                    });
                    indicatorElm.css('left', (p * 100) + '%');
                };

                this.elm.on('mouseenter', () => {
                    this.$document.on('mousemove', barMove);
                    indicatorElm.removeClass('ng-hide');

                });
                this.elm.on('mouseleave', () => {
                    this.$document.off('mousemove', barMove);
                    indicatorElm.addClass('ng-hide');
                });
            });
    }
}
