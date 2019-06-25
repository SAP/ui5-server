const test = require("ava");
const sinon = require("sinon");
const MiddlewareManager = require("../../../../lib/middleware/MiddlewareManager");

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
			rootProject: "like",
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
