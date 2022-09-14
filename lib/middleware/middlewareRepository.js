const middlewareInfos = {
	compression: {path: "compression"},
	cors: {path: "cors"},
	csp: {path: "./csp.js"},
	serveResources: {path: "./serveResources.js"},
	serveIndex: {path: "./serveIndex.js"},
	discovery: {path: "./discovery.js"},
	versionInfo: {path: "./versionInfo.js"},
	connectUi5Proxy: {path: "./connectUi5Proxy.js"},
	serveThemes: {path: "./serveThemes.js"},
	testRunner: {path: "./testRunner.js"},
	nonReadRequests: {path: "./nonReadRequests.js"}
};

async function getMiddleware(middlewareName) {
	const middlewareInfo = middlewareInfos[middlewareName];

	if (!middlewareInfo) {
		throw new Error(`middlewareRepository: Unknown Middleware ${middlewareName}`);
	}
	try {
		const {default: middleware} = await import(middlewareInfo.path);
		return {
			middleware
		};
	} catch (err) {
		throw new Error(
			`middlewareRepository: Failed to require middleware module for ${middlewareName}:\n${err.stack}`);
	}
}

export default {
	getMiddleware: getMiddleware
};
