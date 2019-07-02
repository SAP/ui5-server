const test = require("ava");
const sinon = require("sinon");
const MiddlewareManager = require("../../../../lib/middleware/MiddlewareManager");
const middlewareRepository = require("../../../../lib/middleware/middlewareRepository");

test("Missing parameters", async (t) => {
	const err = t.throws(() => {
		new MiddlewareManager({
			tree: {},
			resources: {}
		});
	});
	t.deepEqual(err.message, "[MiddlewareManager]: One or more mandatory parameters not provided",
		"Threw error with correct message");
});

test("Correct parameters", async (t) => {
	t.notThrows(() => {
		new MiddlewareManager({
			tree: {},
			resources: {
				all: "I",
				rootProject: "like",
				dependencies: "ponies"
			}
		});
	}, "No error thrown");
});

test("applyMiddleware", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "love",
			dependencies: "ponies"
		}
	});

	const addStandardMiddlewareStub = sinon.stub(middlewareManager, "addStandardMiddleware").resolves();
	const addCustomMiddlewareStub = sinon.stub(middlewareManager, "addCustomMiddleware").resolves();
	middlewareManager.middlewareExecutionOrder.push(["ponyware"]);
	middlewareManager.middleware["ponyware"] = {
		mountPath: "/myMountPath",
		middleware: "myMiddleware"
	};

	const appUseStub = sinon.stub();
	const app = {
		use: appUseStub
	};

	await middlewareManager.applyMiddleware(app);
	t.deepEqual(addStandardMiddlewareStub.callCount, 1, "addStandardMiddleware got called once");
	t.deepEqual(addCustomMiddlewareStub.callCount, 1, "addCustomMiddleware got called once");
	t.deepEqual(appUseStub.callCount, 1, "app.use got called once");
	t.deepEqual(appUseStub.getCall(0).args[0], "/myMountPath", "app.use got called with correct mount path parameter");
	t.deepEqual(appUseStub.getCall(0).args[1], "myMiddleware", "app.use got called with correct middleware parameter");
});

test("addMiddleware: Add already added middleware", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});

	await middlewareManager.addMiddleware("serveIndex");
	const err = await t.throwsAsync(() => {
		return middlewareManager.addMiddleware("serveIndex");
	});
	t.deepEqual(err.message, "Failed to add duplicate middleware serveIndex", "Rejected with correct error message");
});

test("addMiddleware: Add middleware", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});

	await middlewareManager.addMiddleware("compression"); // Add some middleware

	await middlewareManager.addMiddleware("serveIndex"); // Add middleware to test for
	t.truthy(middlewareManager.middleware["serveIndex"], "Middleware got added to internal map");
	t.truthy(middlewareManager.middleware["serveIndex"].middleware, "Middleware module is given");
	t.deepEqual(middlewareManager.middleware["serveIndex"].mountPath, "/", "Correct default mount path set");

	t.deepEqual(middlewareManager.middlewareExecutionOrder.length, 2,
		"Two middleware got added to middleware execution order");
	t.deepEqual(middlewareManager.middlewareExecutionOrder[1], "serveIndex",
		"Last added middleware was added to the end of middleware execution order array");
});

test("addMiddleware: Add middleware with beforeMiddleware and mountPath parameter", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});

	await middlewareManager.addMiddleware("compression"); // Add some middleware

	await middlewareManager.addMiddleware("serveIndex", { // Add middleware to test for
		beforeMiddleware: "compression",
		mountPath: "/pony"
	});
	t.truthy(middlewareManager.middleware["serveIndex"], "Middleware got added to internal map");
	t.truthy(middlewareManager.middleware["serveIndex"].middleware, "Middleware module is given");
	t.deepEqual(middlewareManager.middleware["serveIndex"].mountPath, "/pony", "Correct mount path set");

	t.deepEqual(middlewareManager.middlewareExecutionOrder.length, 2,
		"Two middleware got added to middleware execution order");
	t.deepEqual(middlewareManager.middlewareExecutionOrder[0], "serveIndex",
		"Middleware was inserted at correct position of middleware execution order array");
});

test("addMiddleware: Add middleware with afterMiddleware parameter", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});

	await middlewareManager.addMiddleware("compression"); // Add some middleware
	await middlewareManager.addMiddleware("cors"); // Add some middleware

	await middlewareManager.addMiddleware("serveIndex", { // Add middleware to test for
		afterMiddleware: "compression"
	});
	t.truthy(middlewareManager.middleware["serveIndex"], "Middleware got added to internal map");
	t.truthy(middlewareManager.middleware["serveIndex"].middleware, "Middleware module is given");
	t.deepEqual(middlewareManager.middleware["serveIndex"].mountPath, "/", "Correct default mount path set");

	t.deepEqual(middlewareManager.middlewareExecutionOrder.length, 3,
		"Three middleware got added to middleware execution order");
	t.deepEqual(middlewareManager.middlewareExecutionOrder[1], "serveIndex",
		"Middleware was inserted at correct position of middleware execution order array");
});

test("addMiddleware: Add middleware with invalid afterMiddleware parameter", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});

	await middlewareManager.addMiddleware("compression"); // Add some middleware

	const err = await t.throwsAsync(() => {
		return middlewareManager.addMiddleware("serveIndex", { // Add middleware to test for
			afterMiddleware: "🦆"
		});
	});
	t.deepEqual(err.message, "Could not find middleware 🦆, referenced by custom middleware serveIndex");

	t.falsy(middlewareManager.middleware["serveIndex"], "Middleware did not get added to internal map");
	t.deepEqual(middlewareManager.middlewareExecutionOrder.length, 1,
		"No new middleware got added to middleware execution order array");
});

test("addMiddleware: Add middleware with rapperCallback parameter", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const serveIndexModule = middlewareRepository.getMiddleware("serveIndex");

	const moduleStub = sinon.stub().returns("🍅");
	const wrapperCallbackStub = sinon.stub().returns(moduleStub);
	await middlewareManager.addMiddleware("serveIndex", { // Add middleware to test for
		wrapperCallback: wrapperCallbackStub
	});
	t.deepEqual(wrapperCallbackStub.callCount, 1, "Wrapper callback got called once");
	t.is(wrapperCallbackStub.getCall(0).args[0], serveIndexModule, "Wrapper callback got called with correct module");
	t.deepEqual(moduleStub.callCount, 1, "Wrapper callback got called once");
	t.deepEqual(moduleStub.getCall(0).args[0].resources, {
		all: "I",
		rootProject: "like",
		dependencies: "ponies"
	}, "Wrapper callback got called with correct arguments");

	t.truthy(middlewareManager.middleware["serveIndex"], "Middleware got added to internal map");
	t.deepEqual(middlewareManager.middleware["serveIndex"].middleware, "🍅",
		"Middleware module is given");
	t.deepEqual(middlewareManager.middleware["serveIndex"].mountPath, "/", "Correct default mount path set");

	t.deepEqual(middlewareManager.middlewareExecutionOrder.length, 1,
		"One middleware got added to middleware execution order");
	t.deepEqual(middlewareManager.middlewareExecutionOrder[0], "serveIndex",
		"Middleware was inserted at correct position of middleware execution order array");
});

test("addMiddleware: Add middleware with async wrapperCallback", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const moduleStub = sinon.stub().resolves("🍅");
	const wrapperCallbackStub = sinon.stub().returns(moduleStub);
	await middlewareManager.addMiddleware("serveIndex", { // Add middleware to test for
		wrapperCallback: wrapperCallbackStub
	});

	t.truthy(middlewareManager.middleware["serveIndex"], "Middleware got added to internal map");
	t.deepEqual(middlewareManager.middleware["serveIndex"].middleware, "🍅",
		"Middleware module is given");
});
