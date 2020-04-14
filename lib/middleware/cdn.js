const log = require("@ui5/logger").getLogger("server:middleware:cdn");
const http = require("http");
const https = require("https");

function createMiddleware({cdnUrl}) {
	if (!cdnUrl) {
		throw new Error(`Missing parameter "cdnUrl"`);
	}
	if (cdnUrl.endsWith("/")) {
		throw new Error(`Parameter "cdnUrl" must not end with a slash`);
	}

	return function proxy(req, res, next) {
		if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
			// Cannot be fulfilled by CDN
			next();
			return;
		}

		log.verbose(`Requesting ${req.url} from CDN ${cdnUrl}...`);
		log.verbose(`Orig. URL: ${req.originalUrl}`);

		getResource({
			cdnUrl,
			resourcePath: req.url,
			resolveOnOddStatusCode: true,
			headers: req.headers
		}).then(({data, headers, statusCode}) => {
			if (statusCode !== 200) {
				// odd status code
				log.verbose(`CDN replied with status code ${statusCode} for request ${req.url}`);
				next();
				return;
			}
			if (headers) {
				for (const headerKey in headers) {
					if (headers.hasOwnProperty(headerKey)) {
						res.setHeader(headerKey, headers[headerKey]);
					}
				}
			}

			res.setHeader("x-ui5-tooling-proxied-from-cdn", cdnUrl);
			res.setHeader("x-ui5-tooling-proxied-as", req.url);

			res.send(data);
		}).catch((err) => {
			log.error(`CDN request error: ${err.message}`);
			next(err);
		});
	};
}

const cache = {};

function getResource({cdnUrl, resourcePath, resolveOnOddStatusCode, headers}) {
	return new Promise((resolve, reject) => {
		const reqUrl = cdnUrl + resourcePath;
		if (cache[reqUrl]) {
			resolve(cache[reqUrl]);
		}
		if (!cdnUrl.startsWith("http")) {
			throw new Error(`CDN URL must start with protocol "http" or "https": ${cdnUrl}`);
		}
		let client = http;
		if (cdnUrl.startsWith("https")) {
			client = https;
		}
		client.get(reqUrl, (cdnResponse) => {
			const {statusCode} = cdnResponse;

			const data = [];
			cdnResponse.on("data", (chunk) => {
				data.push(chunk);
			});
			cdnResponse.on("end", () => {
				try {
					const result = {
						data: Buffer.concat(data),
						statusCode,
						headers: cdnResponse.headers
					};
					cache[reqUrl] = result;
					if (Object.keys(cache).length % 10 === 0) {
						log.verbose(`Cache size: ${Object.keys(cache).length} entries`);
					}
					resolve(result);
				} catch (err) {
					reject(err);
				}
			});
		}).on("error", (err) => {
			reject(err);
		});
	});
}

module.exports = createMiddleware;
module.exports.getResource = getResource;
