const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

const ThemeBuilder = require("@ui5/builder").processors.themeBuilder.ThemeBuilder;

const failOnNext= function(t) {
	return function(err) {
		if (err) {
			t.fail("Unexpected error passed to next function: " + err);
		} else {
			t.fail("Unexpected call of next function");
		}
		t.end();
	};
};

const createResources = function() {
	return {
		// Input
		"library.source.less": {},

		// Default result
		"library.css": {
			getBuffer: sinon.stub().resolves("/* library.css */")
		},
		"library-RTL.css": {
			getBuffer: sinon.stub().resolves("/* library-RTL.css */")
		},
		"library-parameters.json": {
			getBuffer: sinon.stub().resolves(`{ "parameters":"json" }`)
		},

		// CSS Variables result
		"library-skeleton.css": {
			getBuffer: sinon.stub().resolves(`/* library-skeleton.css */`)
		},
		"library-skeleton-RTL.css": {
			getBuffer: sinon.stub().resolves(`/* library-skeleton-RTL.css */`)
		},
		"css-variables.css": {
			getBuffer: sinon.stub().resolves(`/* css-variables.css */`)
		}
	};
};

const stubThemeBuild = function(resources) {
	const build = sinon.stub(ThemeBuilder.prototype, "build");
	build.rejects(new Error("File not found!"));
	build.withArgs([resources["library.source.less"]]).resolves([
		resources["library.css"],
		resources["library-RTL.css"],
		resources["library-parameters.json"]
	]);
};

const createMiddleware = function() {
	const resources = {
		all: {
			byPath: sinon.stub()
		}
	};
	return {
		middleware: require("../../../../lib/middleware/serveThemes")({
			resources
		}),
		byPath: resources.all.byPath
	};
};

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
	mock.reRequire("../../../../lib/middleware/serveThemes");
});

test.serial.cb("Serving library.css", (t) => {
	const resources = createResources();

	stubThemeBuild(resources);

	const {middleware, byPath} = createMiddleware();
	byPath.withArgs("/resources/sap/ui/test/themes/base/library.source.less")
		.resolves(resources["library.source.less"]);

	const req = {
		url: "/resources/sap/ui/test/themes/base/library.css",
		headers: {}
	};

	const res = {
		setHeader: sinon.stub(),
		getHeader: sinon.stub(),
		end: function(responseText) {
			t.is(responseText, "/* library.css */");
			t.true(res.setHeader.calledWith("Content-Type", "text/css"));
			t.end();
		}
	};

	middleware(req, res, failOnNext(t));
});

test.serial.cb("Serving library-RTL.css", (t) => {
	const resources = createResources();

	stubThemeBuild(resources);

	const {middleware, byPath} = createMiddleware();
	byPath.withArgs("/resources/sap/ui/test/themes/base/library.source.less")
		.resolves(resources["library.source.less"]);

	const req = {
		url: "/resources/sap/ui/test/themes/base/library-RTL.css",
		headers: {}
	};

	const res = {
		setHeader: sinon.stub(),
		getHeader: sinon.stub(),
		end: function(responseText) {
			t.is(responseText, "/* library-RTL.css */");
			t.true(res.setHeader.calledWith("Content-Type", "text/css"));
			t.end();
		}
	};

	middleware(req, res, failOnNext(t));
});

test.serial.cb("Serving library-parameters.json", (t) => {
	const resources = createResources();

	stubThemeBuild(resources);

	const {middleware, byPath} = createMiddleware();
	byPath.withArgs("/resources/sap/ui/test/themes/base/library.source.less")
		.resolves(resources["library.source.less"]);

	const req = {
		url: "/resources/sap/ui/test/themes/base/library-parameters.json",
		headers: {}
	};

	const res = {
		setHeader: sinon.stub(),
		getHeader: sinon.stub(),
		end: function(responseText) {
			t.is(responseText, `{ "parameters":"json" }`);
			t.true(res.setHeader.calledWith("Content-Type", "application/json"));
			t.end();
		}
	};

	middleware(req, res, failOnNext(t));
});

test.serial.cb("Do not handle non-theme requests", (t) => {
	const {middleware} = createMiddleware();

	const req = {
		url: "/resources/sap/ui/test/test.js"
	};

	const res = {};

	middleware(req, res, function() {
		t.pass("Next middleware is called for non-theme requests");
		t.end();
	});
});

test.serial.cb("Do not handle requests without an existing library.source.less file", (t) => {
	const resources = createResources();

	stubThemeBuild(resources);

	const {middleware, byPath} = createMiddleware();
	byPath.withArgs("/resources/sap/ui/test/themes/base/library.source.less").resolves(null);

	const req = {
		url: "/resources/sap/ui/test/themes/base/library.css",
		headers: {}
	};

	const res = {};

	middleware(req, res, function() {
		t.pass("Next middleware is called when no library.source.less file is found");
		t.end();
	});
});

test.serial.cb("Only send 304 response in case the client has cached the response already", (t) => {
	const ETag = `"fake-etag"`;

	mock("etag", function() {
		return ETag;
	});
	mock("fresh", function(reqHeaders, resHeaders) {
		t.deepEqual(reqHeaders, {
			"If-None-Match": ETag
		});
		t.deepEqual(resHeaders, {
			"etag": ETag
		});
		return true;
	});
	mock.reRequire("../../../../lib/middleware/serveThemes");

	const resources = createResources();

	stubThemeBuild(resources);

	const {middleware, byPath} = createMiddleware();
	byPath.withArgs("/resources/sap/ui/test/themes/base/library.source.less")
		.resolves(resources["library.source.less"]);

	const req = {
		url: "/resources/sap/ui/test/themes/base/library.css",
		headers: {
			"If-None-Match": ETag
		}
	};

	const res = {
		setHeader: sinon.stub(),
		getHeader: sinon.stub().withArgs("ETag").returns(ETag),
		end: function(responseText) {
			t.is(responseText, undefined);
			t.is(res.statusCode, 304);
			t.deepEqual(res.setHeader.getCall(1).args, ["ETag", ETag]);
			t.end();
		}
	};

	middleware(req, res, failOnNext(t));
});
