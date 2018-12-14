const path = require("path");
const {test} = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const serveIndexMiddleware = require("../../../../lib/middleware/serveIndex");
const mime = require("mime-types");
const resourceFactory = require("@ui5/fs").resourceFactory;

test.serial("Create new certificate not succeeded", (t) => {
	//t.plan(5);
/*

	const promptStartStub = sinon.stub(prompt, "start").callsFake(function() {});
	const promptGetStub = sinon.stub(prompt, "get").callsFake(function(property, callback) {
		return callback(null, {yesno: "yes"});
	});
	const consoleSpyLog = sinon.spy(console, "log");
	const consoleSpyError = sinon.spy(console, "error");
*/

/*
	mock("mime-types", function(name) {
		t.is(name, "ui5-tooling", "Create certificate for ui5-tooling.");
		return Promise.resolve({
			key: "aaa",
			cert: "bbb"
		});
	});
*/

	//mock.reRequire("mime-types");
	//mock.reRequire("../../../../lib/middleware/serveIndex");

	const mimeLookupStub = sinon.stub(mime, "lookup").callsFake(function(path) {
		return "application/javascript";
	});

	const filePath = path.join(process.cwd(), "./test/tmp/");
	const reader = resourceFactory.createAdapter({fsBasePath: filePath, virBasePath: "/"});
	const writer = resourceFactory.createAdapter({virBasePath: "/"});
	const resource1 = resourceFactory.createResource({path: "/foo", string: "abc"});
	const workspace = resourceFactory.createWorkspace({
		reader: reader,
		writer: writer
	});

	const writeDummyFiles = writer.write(resource1);
	return writeDummyFiles.then(() => {
		const middleware = serveIndexMiddleware(workspace);
		const res = middleware();
		console.log(res);


		mimeLookupStub.restore();
		return workspace.byGlob("/foo");
	}).then((res) => {
		console.log(res);
		t.pass("yup");
	});


});

