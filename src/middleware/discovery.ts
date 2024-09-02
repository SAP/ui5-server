import type {Request, Response, NextFunction} from "express";
import type {ExpressMiddleware, MiddlewareParams} from "./middlewareRepository.js";

const librariesPattern = /([A-Z0-9._%+-/]+)\/[A-Z0-9._]*\.library$/i;
const testPagesPattern = /(([A-Z0-9._%+-]+\/)+([A-Z_0-9-\\.]+)\.(html|htm))$/i;
const urlPattern = /\/(app_pages|all_libs|all_tests)(?:[?#].*)?$/;

type Discovery_Type = "app_pages" | "all_libs" | "all_tests";
type Response_Type<discType extends Discovery_Type> = discType extends "app_pages"
	? {entry: string}
	: discType extends "all_libs"
		? {entry: string}
		: {lib: string};

/**
 * Creates and returns the middleware to discover project files.
 *
 * List project files with URL (needed exclusively by the OpenUI5 testsuite):
 * <ul>
 * <li>/discovery/app_pages: get application pages</li>
 * <li>/discovery/all_libs: list all libraries</li>
 * <li>/discovery/all_tests: list all tests</li>
 * </ul>
 *
 * @param parameters Parameters
 * @param parameters.resources Parameters
 * @returns Returns a server middleware closure.
 */
function createMiddleware({resources}: MiddlewareParams): ExpressMiddleware {
	return function discoveryMiddleware(req: Request, res: Response, next: NextFunction) {
		const parts = urlPattern.exec(req.url);
		const type = parts?.[1] as Discovery_Type;
		if (!type) {
			next();
			return;
		}

		const response = [] as Response_Type<typeof type>[];

		/**
		 *
		 */
		function sendResponse() {
			const responseData = {} as typeof response;

			response.sort((a: Response_Type<typeof type>, b: Response_Type<typeof type>) => {
				if (type === "app_pages" || type === "all_libs") {
					return a.entry.localeCompare(b.entry);
				} else {
					return a.lib.localeCompare(b.lib);
				}
			});
			responseData[type] = response;
			res.writeHead(200, {
				"Content-Type": "application/json",
			});
			res.end(JSON.stringify(responseData));
		}

		if (type === "app_pages") {
			void resources.rootProject.byGlob("/**/*.{html,htm}").then(function (resources) {
				resources.forEach(function (resource) {
					const relPath = resource.getPath().substr(1); // cut off leading "/"
					response.push({
						entry: relPath,
					});
				});
				sendResponse();
			});
		} else if (type === "all_libs") {
			void resources.all.byGlob([
				"/resources/**/*.library",
			]).then(function (resources) {
				resources.forEach(function (resource) {
					const relPath = resource.getPath().substr(11); // cut off leading "/resources/"
					const match = librariesPattern.exec(relPath);
					if (match) {
						response.push({
							entry: match[1],
						});
					}
				});
				sendResponse();
			});
		} else if (type === "all_tests") {
			void Promise.all([
				resources.all.byGlob("/resources/**/*.library"),
				resources.all.byGlob("/test-resources/**/*.{html,htm}"),
			]).then(function (results) {
				const libraryResources = results[0];
				const testPageResources = results[1];
				const libs = Object.create(null);

				libraryResources.forEach(function (resource) {
					const relPath = resource.getPath().substr(11); // cut off leading "/resources/"
					const match = librariesPattern.exec(relPath);
					if (match) {
						const lib = match[1];
						libs[lib + "/"] = lib.replace(/\//g, ".");
					}
				});

				const libPrefixes = Object.keys(libs).sort().reverse();
				testPageResources.forEach(function (resource) {
					const relPath = resource.getPath().substr(16); // cut off leading "/test-resources/"
					if (testPagesPattern.test(relPath)) {
						libPrefixes.some(function (lib) {
							if (relPath.startsWith(lib)) {
								response.push({
									lib: libs[lib],
									name: relPath.substr(lib.length),
									url: "../" + relPath,
								});
								return true; // abort loop
							}
						});
					}
				});

				sendResponse();
			});
		} else {
			next(new Error(`Unknown discovery type "${type}"`));
		}
	};
}

export default createMiddleware;
