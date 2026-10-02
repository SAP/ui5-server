import express from "express";
import net from "node:net";
import MiddlewareManager from "./middleware/MiddlewareManager.js";
import {createReaderCollection} from "@ui5/fs/resourceFactory";
import ReaderCollectionPrioritized from "@ui5/fs/ReaderCollectionPrioritized";
import {getLogger} from "@ui5/logger";

const log = getLogger("server");
/**
 * @public
 * @module @ui5/server
 */

// Timeout (ms) for a single port probe. On localhost a port either accepts or refuses the
// connection immediately, so this only guards against a probe that hangs indefinitely.
const PORT_PROBE_TIMEOUT = 400;

/**
 * Probes whether something is accepting TCP connections on the given host/port.
 *
 * Mirrors the connect-probe semantics of the previously used <code>portscanner</code> dependency:
 * a successful connection means the port is in use; a refused connection or a timeout means it is
 * free. Any other socket error (e.g. an unreachable host) is treated as a scan failure and rejects,
 * so unexpected problems surface to the caller instead of being silently reported as "free".
 *
 * @param {string} host Host to probe
 * @param {number} port Port to probe
 * @returns {Promise<boolean>} Resolves <code>true</code> if the port is in use, <code>false</code> if free
 * @private
 */
function isPortInUse(host, port) {
	return new Promise(function(resolve, reject) {
		const socket = new net.Socket();
		const finish = function(settle, value) {
			socket.removeAllListeners();
			socket.destroy();
			settle(value);
		};
		socket.setTimeout(PORT_PROBE_TIMEOUT);
		socket.once("connect", () => finish(resolve, true));
		socket.once("timeout", () => finish(resolve, false));
		socket.once("error", function(err) {
			if (err.code === "ECONNREFUSED") {
				finish(resolve, false);
			} else {
				finish(reject, err);
			}
		});
		socket.connect(port, host);
	});
}

/**
 * Scans the inclusive port range <code>[port, portMax]</code> on the given host and returns the
 * first port not in use, or <code>null</code> if every port in the range is taken.
 *
 * @param {number} port First port of the range
 * @param {number} portMax Last port of the range (inclusive)
 * @param {string} host Host to scan
 * @returns {Promise<number|null>} The first free port, or <code>null</code> if none is available
 * @private
 */
async function findAPortNotInUse(port, portMax, host) {
	for (let candidate = port; candidate <= portMax; candidate++) {
		if (!await isPortInUse(host, candidate)) {
			return candidate;
		}
	}
	return null;
}

/**
 * Returns a promise resolving by starting the server.
 *
 * @param {object} app The express application object
 * @param {number} port Desired port to listen to
 * @param {boolean} changePortIfInUse If true and the port is already in use, an unused port is searched
 * @param {boolean} acceptRemoteConnections If true, listens to remote connections and not only to localhost connections
 * @returns {Promise<object>} Returns an object containing server related information like (selected port, protocol)
 * @private
 */
function _listen(app, port, changePortIfInUse, acceptRemoteConnections) {
	return new Promise(function(resolve, reject) {
		const options = {};

		if (!acceptRemoteConnections) {
			// Unless remote connections are allowed, bind to the IPv4 loopback address
			options.host = "127.0.0.1";
		} // If remote connections are allowed, do not set host so the server listens on all supported interfaces

		const portScanHost = options.host || "127.0.0.1";
		let portMax;
		if (changePortIfInUse) {
			portMax = port + 30;
		} else {
			portMax = port;
		}

		findAPortNotInUse(port, portMax, portScanHost).then(function(foundPort) {
			if (!foundPort) {
				if (changePortIfInUse) {
					const error = new Error(
						`EADDRINUSE: Could not find available ports between ${port} and ${portMax}.`);
					error.code = "EADDRINUSE";
					error.errno = "EADDRINUSE";
					error.address = portScanHost;
					error.port = portMax;
					reject(error);
					return;
				} else {
					const error = new Error(`EADDRINUSE: Port ${port} is already in use.`);
					error.code = "EADDRINUSE";
					error.errno = "EADDRINUSE";
					error.address = portScanHost;
					error.port = portMax;
					reject(error);
					return;
				}
			}

			options.port = foundPort;
			const server = app.listen(options, function() {
				resolve({port: options.port, server});
			});

			server.on("error", function(err) {
				reject(err);
			});
		}, reject);
	});
}

/**
 * Adds SSL support to an express application.
 *
 * @param {object} parameters
 * @param {object} parameters.app The original express application
 * @param {string} parameters.key Path to private key to be used for https
 * @param {string} parameters.cert Path to certificate to be used for for https
 * @returns {Promise<object>} The express application with SSL support
 * @private
 */
async function _addSsl({app, key, cert}) {
	// Using spdy as http2 server as the native http2 implementation
	// from Node v8.4.0 doesn't seem to work with express
	const {default: spdy} = await import("spdy");
	return spdy.createServer({cert, key}, app);
}


/**
 * SAP target CSP middleware options
 *
 * @public
 * @typedef {object} module:@ui5/server.SAPTargetCSPOptions
 * @property {string} [defaultPolicy="sap-target-level-1"]
 * @property {string} [defaultPolicyIsReportOnly=true]
 * @property {string} [defaultPolicy2="sap-target-level-3"]
 * @property {string} [defaultPolicy2IsReportOnly=true]
 * @property {string[]} [ignorePaths=["test-resources/sap/ui/qunit/testrunner.html"]]
 */


/**
 * Start a server for the given project (sub-)tree.
 *
 * @public
 * @param {@ui5/project/graph/ProjectGraph} graph Project graph
 * @param {object} options Options
 * @param {number} options.port Port to listen to
 * @param {boolean} [options.changePortIfInUse=false] If true, change the port if it is already in use
 * @param {boolean} [options.h2=false] Whether HTTP/2 should be used - defaults to <code>http</code>
 * @param {string} [options.key] Path to private key to be used for https
 * @param {string} [options.cert] Path to certificate to be used for for https
 * @param {boolean} [options.simpleIndex=false] Use a simplified view for the server directory listing
 * @param {boolean} [options.acceptRemoteConnections=false] If true, listens to remote connections and
 * 															not only to localhost connections
 * @param {boolean|module:@ui5/server.SAPTargetCSPOptions} [options.sendSAPTargetCSP=false]
 * 										If set to <code>true</code> or an object, then the default (or configured)
 * 										set of security policies that SAP and UI5 aim for (AKA 'target policies'),
 * 										are send for any requested <code>*.html</code> file
 * @param {boolean} [options.serveCSPReports=false] Enable CSP reports serving for request url
 * 										'/.ui5/csp/csp-reports.json'
 * @returns {Promise<object>} Promise resolving once the server is listening.
 * 							It resolves with an object containing the <code>port</code>,
 * 							<code>h2</code>-flag and a <code>close</code> function,
 * 							which can be used to stop the server.
 */
export async function serve(graph, {
	port: requestedPort, changePortIfInUse = false, h2 = false, key, cert,
	acceptRemoteConnections = false, sendSAPTargetCSP = false, simpleIndex = false, serveCSPReports = false
}) {
	const rootProject = graph.getRoot();

	const readers = [];
	await graph.traverseBreadthFirst(async function({project: dep}) {
		if (dep.getName() === rootProject.getName()) {
			// Ignore root project
			return;
		}
		readers.push(dep.getReader({style: "runtime"}));
	});

	const dependencies = createReaderCollection({
		name: `Dependency reader collection for project ${rootProject.getName()}`,
		readers
	});

	const rootReader = rootProject.getReader({style: "runtime"});

	// TODO change to ReaderCollection once duplicates are sorted out
	const combo = new ReaderCollectionPrioritized({
		name: "server - prioritize workspace over dependencies",
		readers: [rootReader, dependencies]
	});
	const resources = {
		rootProject: rootReader,
		dependencies: dependencies,
		all: combo
	};

	const middlewareManager = new MiddlewareManager({
		graph,
		rootProject,
		resources,
		options: {
			sendSAPTargetCSP,
			serveCSPReports,
			simpleIndex
		}
	});

	let app = express();
	await middlewareManager.applyMiddleware(app);

	if (h2) {
		const nodeVersion = parseInt(process.versions.node.split(".")[0], 10);
		if (nodeVersion >= 24) {
			log.error("ERROR: With Node v24, usage of HTTP/2 is no longer supported. Please check https://github.com/UI5/cli/issues/327 for updates.");
			process.exit(1);
		}

		app = await _addSsl({app, key, cert});
	}

	const {port, server} = await _listen(app, requestedPort, changePortIfInUse, acceptRemoteConnections);

	return {
		h2,
		port,
		close: function(callback) {
			server.close(callback);
		}
	};
}
