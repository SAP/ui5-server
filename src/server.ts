import express from "express";
import portscanner from "portscanner";
import MiddlewareManager from "./middleware/MiddlewareManager.js";
import {createReaderCollection} from "@ui5/fs/resourceFactory";
import ReaderCollectionPrioritized from "@ui5/fs/ReaderCollectionPrioritized";

/**
 * @module @ui5/server
 */

/**
 * Returns a promise resolving by starting the server.
 *
 * @param app The express application object
 * @param port Desired port to listen to
 * @param changePortIfInUse If true and the port is already in use, an unused port is searched
 * @param acceptRemoteConnections If true, listens to remote connections and not only to localhost connections
 * @returns Returns an object containing server related information like (selected port, protocol)
 */
function _listen(app: object, port: number, changePortIfInUse: boolean, acceptRemoteConnections: boolean) {
	return new Promise(function (resolve, reject) {
		const options = {};

		if (!acceptRemoteConnections) {
			options.host = "localhost";
		}

		const host = options.host || "127.0.0.1";
		let portMax;
		if (changePortIfInUse) {
			portMax = port + 30;
		} else {
			portMax = port;
		}

		portscanner.findAPortNotInUse(port, portMax, host, function (error, foundPort) {
			if (error) {
				reject(error);
				return;
			}

			if (!foundPort) {
				if (changePortIfInUse) {
					const error = new Error(
						`EADDRINUSE: Could not find available ports between ${port} and ${portMax}.`);
					error.code = "EADDRINUSE";
					error.errno = "EADDRINUSE";
					error.address = host;
					error.port = portMax;
					reject(error);
					return;
				} else {
					const error = new Error(`EADDRINUSE: Port ${port} is already in use.`);
					error.code = "EADDRINUSE";
					error.errno = "EADDRINUSE";
					error.address = host;
					error.port = portMax;
					reject(error);
					return;
				}
			}

			options.port = foundPort;
			const server = app.listen(options, function () {
				resolve({port: options.port, server});
			});

			server.on("error", function (err) {
				reject(err);
			});
		});
	});
}

/**
 * Adds SSL support to an express application.
 *
 * @param parameters
 * @param parameters.app The original express application
 * @param parameters.key Path to private key to be used for https
 * @param parameters.cert Path to certificate to be used for for https
 * @returns The express application with SSL support
 */
async function _addSsl({app, key, cert}: {
	app: object;
	key: string;
	cert: string;
}) {
	// Using spdy as http2 server as the native http2 implementation
	// from Node v8.4.0 doesn't seem to work with express
	const {default: spdy} = await import("spdy");
	return spdy.createServer({cert, key}, app);
}

/**
 * SAP target CSP middleware options
 *
 */

/**
 * Start a server for the given project (sub-)tree.
 *
 * @param graph Project graph
 * @param options Options
 * @param options.port Port to listen to
 * @param [options.changePortIfInUse] If true, change the port if it is already in use
 * @param [options.h2] Whether HTTP/2 should be used - defaults to <code>http</code>
 * @param [options.key] Path to private key to be used for https
 * @param [options.cert] Path to certificate to be used for for https
 * @param [options.simpleIndex] Use a simplified view for the server directory listing
 * @param [options.acceptRemoteConnections] If true, listens to remote connections and
 * 															not only to localhost connections
 * @param [options.sendSAPTargetCSP]
 * 										If set to <code>true</code> or an object, then the default (or configured)
 * 										set of security policies that SAP and UI5 aim for (AKA 'target policies'),
 * 										are send for any requested <code>*.html</code> file
 * @param [options.serveCSPReports] Enable CSP reports serving for request url
 * 										'/.ui5/csp/csp-reports.json'
 * @returns Promise resolving once the server is listening.
 * 							It resolves with an object containing the <code>port</code>,
 * 							<code>h2</code>-flag and a <code>close</code> function,
 * 							which can be used to stop the server.
 */
export async function serve(graph, {port: requestedPort, changePortIfInUse = false, h2 = false, key, cert, acceptRemoteConnections = false, sendSAPTargetCSP = false, simpleIndex = false, serveCSPReports = false}: {
	port: number;
	changePortIfInUse?: boolean;
	h2?: boolean;
	key?: string;
	cert?: string;
	simpleIndex?: boolean;
	acceptRemoteConnections?: boolean;
}) {
	const rootProject = graph.getRoot();

	const readers = [];
	await graph.traverseBreadthFirst(async function ({project: dep}) {
		if (dep.getName() === rootProject.getName()) {
			// Ignore root project
			return;
		}
		readers.push(dep.getReader({style: "runtime"}));
	});

	const dependencies = createReaderCollection({
		name: `Dependency reader collection for project ${rootProject.getName()}`,
		readers,
	});

	const rootReader = rootProject.getReader({style: "runtime"});

	// TODO change to ReaderCollection once duplicates are sorted out
	const combo = new ReaderCollectionPrioritized({
		name: "server - prioritize workspace over dependencies",
		readers: [rootReader, dependencies],
	});
	const resources = {
		rootProject: rootReader,
		dependencies: dependencies,
		all: combo,
	};

	const middlewareManager = new MiddlewareManager({
		graph,
		rootProject,
		resources,
		options: {
			sendSAPTargetCSP,
			serveCSPReports,
			simpleIndex,
		},
	});

	let app = express();
	await middlewareManager.applyMiddleware(app);

	if (h2) {
		app = await _addSsl({app, key, cert});
	}

	const {port, server} = await _listen(app, requestedPort, changePortIfInUse, acceptRemoteConnections);

	return {
		h2,
		port,
		close: function (callback) {
			server.close(callback);
		},
	};
}