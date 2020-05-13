const log = require("@ui5/logger").getLogger("server:middleware:proxy");
const bootstrapHtmlTransformer = require("@ui5/builder").processors.bootstrapHtmlTransformer;
const {Resource} = require("@ui5/fs");
const httpProxy = require("http-proxy");
const zlib = require("zlib");
const {promisify} = require("util");

function interceptResponse(res, handler) {
	const buffers = [];
	const resWrite = res.write;
	const resEnd = res.end;
	res.write = (chunk, encoding, callback) => {
		buffers.push(chunk);
	};
	res.end = function(chunk, encoding, callback) {
		if (chunk) {
			buffers.push(chunk);
		}
		const buffer = Buffer.concat(buffers);
		if (res.finished) {
			console.log("Response already finished");
		}
		if (res.headersSent) {
			console.log("Response headers already set");
		}

		const contentEncoding = res.getHeader("content-encoding") || "";
		let decodeContent;
		let encodeContent;
		switch (contentEncoding.toLowerCase()) {
		case "gzip":
			decodeContent = promisify(zlib.gunzip);
			encodeContent = promisify(zlib.gzip);
			break;
		case "deflate":
			decodeContent = promisify(zlib.inflate);
			encodeContent = promisify(zlib.deflate);
			break;
		case "br":
			decodeContent = promisify(zlib.brotliDecompress);
			encodeContent = promisify(zlib.brotliCompress);
			break;
		default:
			decodeContent = ($) => Promise.resolve($);
			encodeContent = ($) => Promise.resolve($);
		}
		decodeContent(buffer).then(async (content) => {
			let newContent = await handler(content.toString(encoding || "utf8"));
			newContent = await encodeContent(newContent);
			resWrite.call(res, newContent, undefined, callback);
			resEnd.call(res);
		});
	};
}


function createMiddleware({configuration, middlewareUtil}) {
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
		if (proxyRes.headers["content-type"].indexOf("text/html") !== -1) {
			if (proxyRes.headers["content-length"]) {
				delete proxyRes.headers["content-length"];
			}
			const pathname = middlewareUtil.getPathname(req);
			log.info(`Intercepting text/html server response for ${pathname}`);
			interceptResponse(res, async (content) => {
				if (!content) {
					return content;
				}
				const htmlResource = new Resource({
					path: pathname,
					string: content
				});
				try {
					await bootstrapHtmlTransformer({
						resources: [htmlResource],
						options: {
							rewriteSrc: async (src) => {
								let url;
								try {
									url = new URL(src);
								} catch (err) {
									log.verbose(`Could not parse bootstrap src attribute as URL. ` +
										`This might not be an issue. For example in cases where it ` +
										`contains a relative path.`);
									log.verbose(`    src attribute value: ${src}`);
									log.verbose(`          Error message: ${err.message}`);
								}

								if (url) {
									const newSrc = `/proxy/${url.protocol.replace(":", "")}/${url.host}` +
														`${url.pathname}${url.search}${url.hash}`;
									log.info(
										`Rewriting bootstrap src attribute to force all traffic through the proxy:`);
									log.info(`      Original: ${src}`);
									log.info(`    Rewrote to: ${newSrc}`);
									return newSrc;
								}
								return src;
							}
						}
					});
					return await htmlResource.getBuffer();
				} catch (err) {
					log.warn(err);
				}
				return content;
			});
		}
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
