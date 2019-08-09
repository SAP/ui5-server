const log = require("@ui5/logger").getLogger("server:middleware:proxyRewrite");

function createMiddleware({resources, configuration, cdnUrl}) {
	const rewriteRootPaths = configuration.rewriteRootPaths;

	const cacheBusterRegex = /~.*~[A-Z0-9]?\/?/;
	const preloadRegex = /^.*(?:Component-preload\.js|library-preload\.js|library-preload\.json)$/i;

	return function proxyRewrite(req, res, next) {
		const rewriteApplicable = Object.keys(rewriteRootPaths).some((resourceRootPath) => {
			return req.path.indexOf(resourceRootPath) !== -1;
		});

		if (!rewriteApplicable) {
			// No normalization applicable
			next();
			return;
		}

		log.verbose(`Normalizing ${req.path}...`);
		// Normalize URL
		normalizeRequestPath(req.path)
			.catch((err) => {
				log.error(`Failed to normalize ${req.path}. Error ${err.message}`);
				return "";
			})
			.then((normalizedUrl) => {
				req.url = req.url.replace(req.path, normalizedUrl);
				log.verbose(`Normalized ${req.originalUrl}`);
				log.verbose(`        to ${req.url}`); // will be used for internal resolution
				handleSpecialRequests(req, res, next);
			});
	};

	function handleSpecialRequests(req, res, next) {
		switch (req.url) {
		case "special:404":
			res.setHeader("x-ui5-tooling-special-request-handling", req.url);
			res.status(404).end("UI5 Tooling - Proxy Rewrite Middleware: Special request handling " +
					`blocked this request by returning status code 404 - Not Found`);
			break;
		case "special:empty":
			res.setHeader("x-ui5-tooling-special-request-handling", req.url);
			res.end("// UI5 Tooling - Proxy Rewrite Middleware: " +
				"Special request handling blocked this request by returning no file content");
			break;
		case "special:sap-ui-core-bootstrap":
			getResources(["/resources/ui5loader-autoconfig.js"]).then(async ([autoconfigLoaderResource]) => {
				let bootstrap;
				if (autoconfigLoaderResource) {
					bootstrap = await getBootstrapFile("evo-core");
				} else {
					bootstrap = await getBootstrapFile("classic-core");
				}
				res.setHeader("Content-Type", "application/javascript");
				res.setHeader("x-ui5-tooling-special-request-handling", req.url);
				res.end(bootstrap);
			}).catch((err) => {
				const errMsg = `Failed to generate bootstrap file for request ${req.originalUrl} (${req.url}). ` +
					`Error: ${err.message}`;
				log.error(errMsg);
				log.error(err.stack);
				next(errMsg);
			});
			break;
		case "special:flp-abap-bootstrap":
			getBootstrapFile("flp-abap").then((bootstrap) => {
				res.setHeader("Content-Type", "application/javascript");
				res.setHeader("x-ui5-tooling-special-request-handling", req.url);
				res.end(bootstrap);
			}).catch((err) => {
				const errMsg = `Failed to generate bootstrap file for request ${req.originalUrl} (${req.url}). ` +
					`Error: ${err.message}`;
				log.error(errMsg);
				log.error(err.stack);
				next(errMsg);
			});
			break;
		default:
			next();
			break;
		}
	}

	async function normalizeRequestPath(reqPath) {
		let normalizedPath = reqPath;

		// Strip off first matching rewrite root path
		for (const rootPath in rewriteRootPaths) {
			if (rewriteRootPaths.hasOwnProperty(rootPath)) {
				if (normalizedPath.indexOf(rootPath) !== -1) {
					normalizedPath = normalizedPath.substr(rootPath.length);
					if (rewriteRootPaths[rootPath].rewriteTo) {
						normalizedPath = rewriteRootPaths[rootPath].rewriteTo + normalizedPath;
					}
					break;
				}
			}
		}
		normalizedPath = normalizedPath.replace(cacheBusterRegex, "");
		return rewriteSpecials(normalizedPath);
	}

	async function rewriteSpecials(normalizedPath) {
		switch (normalizedPath) {
		/* === FLP bootstrap === */
		case "/resources/sap/fiori/core-min-0.js":
			// Try to serve sap-ui-core.js instead
			return "/resources/sap-ui-core.js";
		case "/resources/sap/fiori/core-min-1.js":
		case "/resources/sap/fiori/core-min-2.js":
		case "/resources/sap/fiori/core-min-3.js":
			// Send an empty file
			return "special:empty";

		/* === FLP evo bootstrap === */
		case "/resources/sap/ushell_abap/bootstrap/evo/abap.js":
			return "special:flp-abap-bootstrap";
		case "/resources/sap/ushell_abap/bootstrap/evo/core-min-0.js":
			// Try to serve sap-ui-core.js instead
			return "/resources/sap-ui-core.js";
		case "/resources/sap/ushell_abap/bootstrap/evo/core-min-1.js":
		case "/resources/sap/ushell_abap/bootstrap/evo/core-min-2.js":
		case "/resources/sap/ushell_abap/bootstrap/evo/core-min-3.js":
			// Send an empty file
			return "special:empty";

		case "/resources/sap/fiori/core-ext-light-0.js":
			// Try to serve sap-ui-core.js instead
			// return "special:flp-abap-bootstrap";
			return "special:empty";
		case "/resources/sap/fiori/core-ext-light-1.js":
		case "/resources/sap/fiori/core-ext-light-2.js":
		case "/resources/sap/fiori/core-ext-light-3.js":
			// Send an empty file
			return "special:empty";

		/* === C4C (and others?) bootstrap === */
		case "/resources/sap/client/lib-0.js":
			// Try to serve compiled sap-ui-core.js instead
			return "special:sap-ui-core-bootstrap";
		case "/resources/sap/client/lib-1.js":
		case "/resources/sap/client/lib-2.js":
		case "/resources/sap/client/lib-3.js":
		case "/resources/sap/client/lib-thirdparty.js":
		case "/resources/sap/client/lib-deprecated.js":
			// Send an empty file
			return "special:empty";
		}

		/* === Preloads === */
		if (preloadRegex.test(normalizedPath)) {
			// return "special:404";
			return "special:empty";
		}

		return normalizedPath;
	}

	function getBootstrapFile(style) {
		let resourceList;
		let post;

		switch (style) {
		case "evo-core":
			resourceList = [
				"/resources/sap/ui/thirdparty/es6-promise.js",
				"/resources/sap/ui/thirdparty/es6-string-methods.js",
				"/resources/ui5loader.js",
				"/resources/ui5loader-autoconfig.js"
			];

			post = "\n\nsap.ui.requireSync(\"sap/ui/core/Core\"); sap.ui.getCore().boot();";
			break;
		case "classic-core":
			resourceList = [
				"/resources/sap/ui/thirdparty/jquery.js",
				"/resources/sap/ui/thirdparty/jqueryui/jquery-ui-position.js",
				"/resources/sap/ui/Device.js",
				"/resources/sap/ui/thirdparty/URI.js",
				"/resources/sap/ui/thirdparty/es6-promise.js",
				"/resources/jquery.sap.global.js",
				"/resources/sap/ui/core/Core.js"
			];

			post = "\n\njQuery.sap.require(\"sap/ui/core/Core\"); " +
					"sap.ui.getCore().boot && sap.ui.getCore().boot();";
			break;
		case "flp-abap":
			resourceList = [
				"/resources/sap/ui/thirdparty/baseuri.js",
				"/resources/sap/ui/thirdparty/es6-promise.js",
				"/resources/sap/ui/thirdparty/es6-string-methods.js",
				"/resources/sap/ui/thirdparty/es6-object-assign.js",
				"/resources/sap/ui/thirdparty/es6-shim-nopromise.js",
				"/resources/ui5loader.js",
				"/resources/sap/ushell/bootstrap/ui5loader-config.js",
				"/resources/ui5loader-autoconfig.js"
			];

			post = `sap.ui.requireSync("sap/ushell_abap/bootstrap/evo/abap-def-dev");
sap.ui.requireSync("sap/ui/core/Core"); sap.ui.getCore().boot();

// ComponentContainer Required in case of deep links.
// Possibly because of missing require in ushell/services/Container.js?
sap.ui.requireSync("sap/ui/core/ComponentContainer");`;
			break;
		default:
			throw new Error(`Unkown bootstrap file style ${style}`);
		}

		return getResources(resourceList).then((strings) => {
			const pre = `/* ==== Generated file ui5-evo server ${new Date().toString()}==== */\n\n`;
			const joinedFiles = strings.join("\n\n");
			return pre + joinedFiles + post;
		});
	}

	function getResources(resourceList) {
		if (cdnUrl) {
			const cdn = require("./cdn");
			return Promise.all(resourceList.map(async (resourcePath) => {
				const {data, statusCode} = await cdn.getResource({cdnUrl, resourcePath});
				if (statusCode !== 200) {
					throw new Error(`CDN replied with status code ${statusCode} for request ${resourcePath}`);
				}
				return data;
			}));
		} else {
			return Promise.all(resourceList.map((resourcePath) => {
				return resources.all.byPath(resourcePath).then((resource) => {
					if (!resource) {
						throw new Error(`Could not find resource ${resourcePath} on local host`);
					}
					return resource.getBuffer().then((buffer) => {
						return `/* Begin of ${resource.virtualPath} */\n\n` + buffer.toString();
					});
				});
			}));
		}
	}
}

module.exports = createMiddleware;
