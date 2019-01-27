"use strict";

const debug = require("debug")("mdtk-cli/serve");

exports.command = "serve [input]";

exports.describe = "start a development server with live reload capability";

exports.builder = function(yargs) {

    yargs = require("./render").builder(yargs);

    yargs
        .option("host", {
            group: "Serve",
            default: process.env.IP || "0.0.0.0",
            type: "string",
            description: "listen for HTTP connections on this IP"
        })
        .option("port", {
            group: "Serve",
            default: 1324,
            type: "number",
            description: "listen for HTTP connections on this port"
        });
    return yargs;
};

exports.handler = async function(argv) {
    watch(argv, require("./render").handler);

    require("live-server").start({

        host: argv.host,
        port: argv.port,
        wait: 500,
        root: require("path").dirname(argv.output),
        open: false
    });
};

/**
 * Render on change.
 * 
 * @param {Object} args 
 */
async function watch(argv, render) {
    debug("watch");
    await render(argv);

    const path = require("path");
    const ignored = [
        /(^|[\/\\])\../,
        path.join(path.dirname(argv.output), '**/*'),
        path.join(path.dirname(argv.output), '*'),
        /.*\.pdf$/
    ];
    debug("watch", "ignore", ignored);

    require('chokidar').watch(
        [argv.include, path.resolve(argv.input)], {
            ignored: ignored,
            ignoreInitial: true
        }
    ).on('all', async (event, f) => {
        debug("watch", event, f);
        await render(argv);
    });
}