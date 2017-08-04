(function() {
    class ETHZVideoQualityStrategy extends paella.VideoQualityStrategy {
        getQualityIndex(source) {
            var index = source.length - 1;
            var params = this.getParams();

            if (parent!=self) { // Embedded: maximum resolution
                index = source.length-1;
            }
            else if (source.length>0) {
                //var selected = source[0];
                var selected = null;
                var win_h = $(window).height();
                var maxRes = (paella.utils.userAgent.browser.IsMobileVersion ? params.maxMobileQualityRes : params.maxDesktopQualityRes) || 720;
                maxRes = maxRes>win_h ? win_h : maxRes;
                var diff = Number.MAX_VALUE;

                source.forEach(function(item,i) { 
                    if (item.res && item.res.h<=maxRes ) {
                        var itemDiff = Math.abs(win_h - item.res.h);
                        if (itemDiff<diff) {
                            selected = item;
                            index = i;
                        }
                    }
                });
            }
            return index;
        }
    }

    paella.ETHZVideoQualityStrategy = ETHZVideoQualityStrategy;
})();