// heavily inspired by https://github.com/SAP/connect-openui5/blob/master/lib/proxy.js
const url = require("url");
const httpProxy = require("http-proxy");

const env = {
	noProxy: process.env.NO_PROXY || process.env.no_proxy,
	httpProxy: process.env.HTTP_PROXY || process.env.http_proxy,
	httpsProxy: process.env.HTTPS_PROXY || process.env.https_proxy
};

function getProxyUri(uri) {
	if (uri.protocol === "https:" && env.httpsProxy || uri.protocol === "http:" && env.httpProxy) {
		if (env.noProxy) {
			const canonicalHost = uri.host.replace(/^\.*/, ".");
			const port = uri.port || (uri.protocol === "https:" ? "443" : "80");

			const patterns = env.noProxy.split(",");
			for (let i = patterns.length - 1; i >= 0; i--) {
				let pattern = patterns[i].trim().toLowerCase();

				// don"t use a proxy at all
				if (pattern === "*") {
					return null;
				}

				// Remove leading * and make sure to have exact one leading dot (.)
				pattern = pattern.replace(/^[*]+/, "").replace(/^\.*/, ".");

				// if host ends with pattern, no proxy should be used
				if (canonicalHost.indexOf(pattern) === canonicalHost.length - pattern.length) {
					return null;
				}
			}
		}

		if (uri.protocol === "https:" && env.httpsProxy) {
			return env.httpsProxy;
		} else if (uri.protocol === "http:" && env.httpProxy) {
			return env.httpProxy;
		}
	}

	return null;
}

function buildRequestUrl(uri) {
	let ret = uri.pathname;
	if (uri.query) {
		ret += "?" + uri.query;
	}
	return ret;
}

function createUri(uriParam, proxyDefinitions) {
	for (let path in proxyDefinitions) {
		if (uriParam.startsWith(path)) {
			return url.parse(proxyDefinitions[path] + uriParam.substring(path.length));
		}
	}
	return null;
}

/**
 * Creates and returns the middleware to serve proxied servers.
 *
 * @module server/middleware/serveProxies
 * @param {Object} proxyDefinitions Contains proxy definitions
 * @returns {function} Returns a server middleware closure.
 */
function createMiddleware(proxyDefinitions) {
	let proxyServerParameters = {};
	if (proxyDefinitions.auth)
	{
		proxyServerParameters.auth = proxyDefinitions.auth;
	}
	let proxy = httpProxy.createProxyServer(proxyServerParameters);

	return function serveResources(req, res, next) {
		if (proxyDefinitions == undefined) {
			return next();
		}
		let uri = createUri(req.url, proxyDefinitions);
		if (!uri || !uri.host) {
			next();
			return;
		}

		// change original request url to target url
		req.url = buildRequestUrl(uri);

		// change original host to target host
		req.headers.host = uri.host;

		// overwrite response headers
		res.orgWriteHead = res.writeHead;
		res.writeHead = function(...args) {
			// We always filter the secure header to avoid the cookie from
			//	"not" beeing included in follow up requests in case of the
			//	proxy is running on HTTP and not HTTPS
			let cookies = res.getHeader("set-cookie");
			// array == multiple cookies
			if (Array.isArray(cookies)) {
				for (let i = 0; i < cookies.length; i++) {
					cookies[i] = cookies[i].replace("secure;", "");
				}
			} else if (typeof cookies === "string" || cookies instanceof String) {
				// single cookie
				cookies = cookies.replace("secure;", "");
			}

			if (cookies) {
				res.setHeader("set-cookie", cookies);
			}

			// call original writeHead function
			res.orgWriteHead(args);
		};

		// get proxy for uri (if defined in env vars)
		let targetUri = getProxyUri(uri) || uri.protocol + "//" + uri.host;

		// proxy the request
		proxy.proxyRequest(req, res, {
			target: targetUri
		}, function(err) {
			if (err) {
				next(err);
			}
		});
	};
}

module.exports = createMiddleware;
