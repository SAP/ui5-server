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

test("addStandardMiddleware: Adds standard middleware in correct order", async (t) => {
	const middlewareManager = new MiddlewareManager({
		tree: {},
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const addMiddlewareStub = sinon.stub(middlewareManager, "addMiddleware").resolves();
	await middlewareManager.addStandardMiddleware();

	t.deepEqual(addMiddlewareStub.callCount, 10, "Expected count of middleware got added");
	const addedMiddlewareNames = [];
	for (let i = 0; i < addMiddlewareStub.callCount; i++) {
		addedMiddlewareNames.push(addMiddlewareStub.getCall(i).args[0]);
	}
	t.deepEqual(addedMiddlewareNames, [
		"csp",
		"compression",
		"cors",
		"discovery",
		"serveResources",
		"serveThemes",
		"versionInfo",
		"connectUi5Proxy",
		"nonReadRequests",
		"serveIndex"
	], "Correct order of standard middlewares");
});

test("addCustomMiddleware: No custom middleware defined", async (t) => {
	const project = {
		server: {
			customMiddleware: []
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const addMiddlewareStub = sinon.stub(middlewareManager, "addMiddleware").resolves();
	await middlewareManager.addCustomMiddleware();

	t.deepEqual(addMiddlewareStub.callCount, 0, "addMiddleware was not called");
});

test("addCustomMiddleware: Custom middleware got added", async (t) => {
	const project = {
		metadata: {
			name: "my project"
		},
		server: {
			customMiddleware: [{
				name: "my custom middleware A",
				beforeMiddleware: "cors",
				mountPath: "/pony"
			}, {
				name: "my custom middleware B",
				afterMiddleware: "my custom middleware A"
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const addMiddlewareStub = sinon.stub(middlewareManager, "addMiddleware").resolves();
	await middlewareManager.addCustomMiddleware();

	t.deepEqual(addMiddlewareStub.callCount, 2, "addMiddleware was called twice");
	t.deepEqual(addMiddlewareStub.getCall(0).args[0], "my custom middleware A",
		"addMiddleware was called with correct middleware name");
	const middlewareOptionsA = addMiddlewareStub.getCall(0).args[1];
	t.deepEqual(middlewareOptionsA.mountPath, "/pony",
		"addMiddleware was called with correct mountPath option");
	t.deepEqual(middlewareOptionsA.beforeMiddleware, "cors",
		"addMiddleware was called with correct beforeMiddleware option");
	t.deepEqual(middlewareOptionsA.afterMiddleware, undefined,
		"addMiddleware was called with correct afterMiddleware option");

	t.deepEqual(addMiddlewareStub.getCall(1).args[0], "my custom middleware B",
		"addMiddleware was called with correct middleware name");
	const middlewareOptionsB = addMiddlewareStub.getCall(1).args[1];
	t.deepEqual(middlewareOptionsB.mountPath, undefined,
		"addMiddleware was called with correct mountPath option");
	t.deepEqual(middlewareOptionsB.beforeMiddleware, undefined,
		"addMiddleware was called with correct beforeMiddleware option");
	t.deepEqual(middlewareOptionsB.afterMiddleware, "my custom middleware A",
		"addMiddleware was called with correct afterMiddleware option");
});

test("addCustomMiddleware: Custom middleware with duplicate name", async (t) => {
	const project = {
		metadata: {
			name: "my project"
		},
		server: {
			customMiddleware: [{
				name: "my custom middleware A",
				afterMiddleware: "my custom middleware A"
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	middlewareManager.middleware["my custom middleware A"] = true;
	const addMiddlewareStub = sinon.stub(middlewareManager, "addMiddleware").resolves();
	const err = await t.throwsAsync(() => {
		return middlewareManager.addCustomMiddleware();
	});

	t.deepEqual(err.message, "Failed to add custom middleware my custom middleware A. " +
		"A middleware with the same name is already known.",
	"Rejected with correct error message");
	t.deepEqual(addMiddlewareStub.callCount, 0, "Add middleware did not get called");
});

test("addCustomMiddleware: Missing name configuration", async (t) => {
	const project = {
		metadata: {
			name: "my project"
		},
		server: {
			customMiddleware: [{
				afterMiddleware: "my custom middleware A"
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const err = await t.throwsAsync(() => {
		return middlewareManager.addCustomMiddleware();
	});

	t.deepEqual(err.message, "Missing name for custom middleware definition of project my project at index 0",
		"Rejected with correct error message");
});

test("addCustomMiddleware: Both before- and afterMiddleware configuration", async (t) => {
	const project = {
		metadata: {
			name: "🐧"
		},
		server: {
			customMiddleware: [{
				name: "🦆",
				beforeMiddleware: "🐝",
				afterMiddleware: "🐒"
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const err = await t.throwsAsync(() => {
		return middlewareManager.addCustomMiddleware();
	});

	t.deepEqual(err.message, `Custom middleware definition 🦆 of project 🐧 ` +
		`defines both "beforeMiddleware" and "afterMiddleware" parameters. Only one must be defined.`,
	"Rejected with correct error message");
});

test("addCustomMiddleware: Missing before- or afterMiddleware configuration", async (t) => {
	const project = {
		metadata: {
			name: "🐧"
		},
		server: {
			customMiddleware: [{
				name: "🦆"
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const err = await t.throwsAsync(() => {
		return middlewareManager.addCustomMiddleware();
	});

	t.deepEqual(err.message, `Custom middleware definition 🦆 of project 🐧 ` +
		`defines neither a "beforeMiddleware" nor an "afterMiddleware" parameter. One must be defined.`,
	"Rejected with correct error message");
});

test("addCustomMiddleware: wrapperCallback", async (t) => {
	const project = {
		metadata: {
			name: "my project"
		},
		server: {
			customMiddleware: [{
				name: "my custom middleware A",
				beforeMiddleware: "cors",
				configuration: {
					"🦊": "🐰"
				}
			}]
		}
	};
	const middlewareManager = new MiddlewareManager({
		tree: project,
		resources: {
			all: "I",
			rootProject: "like",
			dependencies: "ponies"
		}
	});
	const addMiddlewareStub = sinon.stub(middlewareManager, "addMiddleware").resolves();
	await middlewareManager.addCustomMiddleware();

	t.deepEqual(addMiddlewareStub.callCount, 1, "addMiddleware was called once");

	const wrapperCallback = addMiddlewareStub.getCall(0).args[1].wrapperCallback;
	const middlewareModuleStub = sinon.stub().returns("ok");
	const middlewareWrapper = wrapperCallback(middlewareModuleStub);
	const res = middlewareWrapper({
		resources: "resources"
	});
	t.deepEqual(res, "ok", "Wrapper callback returned expected value");
	t.deepEqual(middlewareModuleStub.callCount, 1, "Middleware module got called once");
	t.deepEqual(middlewareModuleStub.getCall(0).args[0], {
		resources: "resources",
		options: {
			configuration: {
				"🦊": "🐰"
			}
		}
	}, "Middleware module got called with correct arguments");
});
