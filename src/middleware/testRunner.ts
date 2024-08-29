import {promisify} from "node:util";
import fs from "graceful-fs";
const readFile = promisify(fs.readFile);
import {fileURLToPath} from "node:url";
import mime from "mime-types";
import parseurl from "parseurl";
import {getLogger} from "@ui5/logger";
const log = getLogger("server:middleware:testRunner");
import type {Request, Response, NextFunction} from "express";

const testRunnerResourceRegEx = /\/test-resources\/sap\/ui\/qunit\/(testrunner\.(html|css)|TestRunner.js)$/;
const resourceCache = Object.create(null) as Record<string, Promise<string> | undefined>;

/**
 *
 * @param res
 * @param resourcePath
 * @param resourceContent
 */
function serveResource(res: Response, resourcePath: string, resourceContent: string) {
	const type = mime.lookup(resourcePath) ?? "application/octet-stream";
	const charset = mime.charset(type) ?? "";
	const contentType = type + (charset ? "; charset=" + charset : "");

	// resources served by this middleware do not change often
	res.setHeader("Cache-Control", "public, max-age=1800");

	res.setHeader("Content-Type", contentType);
	res.end(resourceContent);
}

/**
 * Creates and returns the middleware to serve a resource index.
 *
 * @returns Returns a server middleware closure.
 */
function createMiddleware() {
	return async function (req: Request, res: Response, next: NextFunction) {
		try {
			const pathname = parseurl(req).pathname;
			const parts = testRunnerResourceRegEx.exec(pathname);
			const resourceName = parts?.[1];

			if (resourceName) { // either "testrunner.html", "testrunner.css" or "TestRunner.js" (case sensitive!)
				log.verbose(`Serving ${pathname}`);
				let pResource;
				if (!resourceCache[pathname]) {
					const filePath = fileURLToPath(new URL(`./testRunner/${resourceName}`, import.meta.url));
					pResource = readFile(filePath, {encoding: "utf8"});
					resourceCache[pathname] = pResource;
				} else {
					pResource = resourceCache[pathname];
				}

				const resourceContent = await pResource;
				serveResource(res, pathname, resourceContent);
			} else {
				next();
			}
		} catch (err) {
			next(err);
		}
	};
}

export default createMiddleware;
