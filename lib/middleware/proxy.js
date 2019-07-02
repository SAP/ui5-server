const log = require("@ui5/logger").getLogger("server:middleware:proxy");
const httpProxy = require("http-proxy");

function createMiddleware({configuration}) {
	let agent;

	if (configuration.forwardProxy) {
		let username = configuration.forwardProxy.username;
		let password = configuration.forwardProxy.password;
		if (!username) {
			// TODO prompt user for credentials
			username = "";
		}
		if (!password) {
			// TODO prompt user for credentials
			password = "";
		}
		const HttpsProxyAgent = require("https-proxy-agent");
		agent = new HttpsProxyAgent({
			host: configuration.forwardProxy.hostname,
			port: configuration.forwardProxy.port,
			secureProxy: configuration.forwardProxy.useSsl,
			auth: username + ":" + password
		});
	}

	const proxyServer = httpProxy.createProxyServer({
		agent: agent,
		secure: !configuration.insecure,
		prependPath: false,
		xfwd: true,
		target: configuration.destination.origin,
		changeOrigin: true
	});

	proxyServer.on("proxyRes", function(proxyRes, req, res) {
		res.setHeader("x-ui5-tooling-proxied-from", configuration.destination.origin);
	});

	return function proxy(req, res, next) {
		if (req.url !== req.originalUrl) {
			log.verbose(`Proxying "${req.url}"`); // normalized URL - used for local resolution
			log.verbose(`      as "${req.originalUrl}"`); // original URL - used for reverse proxy requests
		} else {
			log.verbose(`Proxying "${req.url}"`);
		}
		req.url = req.originalUrl; // Always use the original (non-rewritten) URL
		proxyServer.web(req, res, (err) => {
			log.error(`Proxy error: ${err.message}`);
			next(err);
		});
	};
}

module.exports = createMiddleware;
