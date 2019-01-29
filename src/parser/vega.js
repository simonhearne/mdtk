// Process block-level vega and vega-lite visualizations
// Kudos to markdown-it-startuml that served as the template
//
'use strict';

const debug = require("debug")("mdtk/parser/vega");

module.exports = function vega(md, options) {

    debug("init");

    md.block.ruler.before(
        'fence',
        'vega_lite_vis',
        vegaLikePlugin(
            md,
            {
                openMarker: "@startvegalite",
                closeMarker: "@endvegalite",
                className: "mdtk-vega-lite",
                render: renderVegaLite
            }
        ),
        { alt: ['paragraph', 'reference', 'blockquote', 'list', 'vega_lite_vis', 'vega_vis']}
    );

    md.block.ruler.after(
        'vega_lite_vis',
        'vega_vis',
        vegaLikePlugin(
            md,
            {
                openMarker: "@startvega",
                closeMarker: "@endvega",
                className: "mdtk-vega",
                render: renderVega
            }
        ),
        { alt: ['paragraph', 'reference', 'blockquote', 'list', 'vega_lite_vis', 'vega_vis']}
    );

    // md.renderer.rules.vega_vis = render;
};

async function renderVega(spec) {
    debug("vega spec %O", spec);
    const vega = require("vega");
    const view = new vega.View(vega.parse(spec));
    return view.toSVG();
}

async function renderVegaLite(spec) {
    debug("vega-lite spec %O", spec);
    const vegaLite = require("vega-lite");
    return renderVega(vegaLite.compile(spec).spec);
}

function vegaLikePlugin(md, options) {
    var {
        openMarker,
        closeMarker,
        render,
        className
    } = options;

    var openChar = openMarker.charCodeAt(0);
    var closeChar = closeMarker.charCodeAt(0);

    return function(state, startLine, endLine, silent) {
        var nextLine, markup, params, token, i,
            autoClosed = false,
            start = state.bMarks[startLine] + state.tShift[startLine],
            max = state.eMarks[startLine];

        // Check out the first character quickly,
        // this should filter out most of non-uml blocks
        //
        if (openChar !== state.src.charCodeAt(start)) { return false; }

        // Check out the rest of the marker string
        //
        for (i = 0; i < openMarker.length; ++i) {
            if (openMarker[i] !== state.src[start + i]) { return false; }
        }

        markup = state.src.slice(start, start + i);
        params = state.src.slice(start + i, max);

        // Since start is found, we can report success here in validation mode
        //
        if (silent) { return true; }

        // Search for the end of the block
        //
        nextLine = startLine;

        for (;;) {
            nextLine++;
            if (nextLine >= endLine) {
                // unclosed block should be autoclosed by end of document.
                // also block seems to be autoclosed by end of parent
                break;
            }

            start = state.bMarks[nextLine] + state.tShift[nextLine];
            max = state.eMarks[nextLine];

            if (start < max && state.sCount[nextLine] < state.blkIndent) {
                // non-empty line with negative indent should stop the list:
                // - ```
                //  test
                break;
            }

            if (closeChar !== state.src.charCodeAt(start)) {
                // didn't find the closing fence
                continue;
            }

            if (state.sCount[nextLine] > state.sCount[startLine]) {
                // closing fence should not be indented with respect of opening fence
                continue;
            }

            var closeMarkerMatched = true;
            for (i = 0; i < closeMarker.length; ++i) {
                if (closeMarker[i] !== state.src[start + i]) {
                    closeMarkerMatched = false;
                    break;
                }
            }

            if (!closeMarkerMatched) {
                continue;
            }

            // make sure tail has spaces only
            if (state.skipSpaces(start + i) < max) {
                continue;
            }

            // found!
            autoClosed = true;
            break;
        }

        var contents = state.src
            .split('\n')
            .slice(startLine + 1, nextLine)
            .join('\n');

        token = state.push('html_block', '', 0);
        token.attrSet("class", className);
        token.block = true;
        token.spec = JSON.parse(contents);
        token.info = params;
        token.map = [startLine, nextLine];
        token.markup = markup;

        token.prerender = async function () {
            this.content = await render(this.spec);
        };

        state.line = nextLine + (autoClosed ? 1 : 0);

        return true;
    }
};