const middlewares = {
	compression: "compression",
	cors: "cors",
	csp: "./csp",
	serveResources: "./serveResources",
	serveIndex: "./serveIndex",
	discovery: "./discovery",
	versionInfo: "./versionInfo",
	connectUi5Proxy: "./connectUi5Proxy",
	serveThemes: "./serveThemes",
	nonReadRequests: "./nonReadRequests"
};

function getMiddleware(middlewareName) {
	const middlewarePath = middlewares[middlewareName];

	if (!middlewarePath) {
		throw new Error(`middlewareRepository: Unknown Middleware ${middlewareName}`);
	}
	return require(middlewarePath);
}

function addMiddleware(name, middlewarePath) {
	if (middlewares[name]) {
		throw new Error(`middlewareRepository: Middleware ${name} already registered`);
	}
	middlewares[name] = middlewarePath;
}

function getAllMiddleware() {
	const modules = {};
	for (const middlewareName in middlewares) {
		if (middlewares.hasOwnProperty(middlewareName)) {
			modules[middlewareName] = require(middlewares[middlewareName]);
		}
	}
	return middlewares;
}

module.exports = {
	getMiddleware: getMiddleware,
	addMiddleware: addMiddleware,
	getAllMiddleware: getAllMiddleware
};
