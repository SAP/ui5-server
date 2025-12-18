const {promisify} = require("util");
const fs = require("graceful-fs");
const readFile = promisify(fs.readFile);
const path = require("path");
const mime = require("mime-types");
const parseurl = require("parseurl");
const log = require("@ui5/logger").getLogger("server:middleware:testRunner");
const etag = require("etag");
const fresh = require("fresh");

const testRunnerResourceRegEx = /\/test-resources\/sap\/ui\/qunit\/(testrunner\.(html|css)|TestRunner.js)$/;
const resourceCache = {};

function isFresh(req, res) {
	return fresh(req.headers, {
		"etag": res.getHeader("ETag")
	});
}

async function readResourceInfo(resourceName) {
	const content = await readFile(path.join(__dirname, "testRunner", resourceName), {encoding: "utf8"});
	return {
		content,
		etag: etag(content)
	};
}

function serveResource(req, res, resourcePath, resourceInfo) {
	const type = mime.lookup(resourcePath) || "application/octet-stream";
	const charset = mime.charset(type);
	const contentType = type + (charset ? "; charset=" + charset : "");
	res.setHeader("Content-Type", contentType);

	// Enable ETag caching
	res.setHeader("ETag", resourceInfo.etag);

	if (isFresh(req, res)) {
		// client has a fresh copy of the resource
		res.statusCode = 304;
		res.end();
		return;
	}

	res.end(resourceInfo.content);
}

/**
 * Creates and returns the middleware to serve a resource index.
 *
 * @module @ui5/server/middleware/testRunner
 * @param {object} parameters Parameters
 * @param {object} parameters.resources Contains the resource reader or collection to access project related files
 * @returns {Function} Returns a server middleware closure.
 */
function createMiddleware({resources}) {
	return async function(req, res, next) {
		try {
			const pathname = parseurl(req).pathname;
			const parts = testRunnerResourceRegEx.exec(pathname);
			const resourceName = parts && parts[1];

			if (resourceName) { // either "testrunner.html", "testrunner.css" or "TestRunner.js" (case sensitive!)
				log.verbose(`Serving ${pathname}`);
				let pResource;
				if (!resourceCache[pathname]) {
					pResource = readResourceInfo(resourceName);
					resourceCache[pathname] = pResource;
				} else {
					pResource = resourceCache[pathname];
				}

				const resourceInfo = await pResource;
				serveResource(req, res, pathname, resourceInfo);
			} else {
				next();
			}
		} catch (err) {
			next(err);
		}
	};
}

module.exports = createMiddleware;
