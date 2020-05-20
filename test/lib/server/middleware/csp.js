const test = require("ava");
let cspMiddleware = require("../../../../lib/middleware/csp");
const mock = require("mock-require");

const sinon = require("sinon");
const fs = require("graceful-fs");


test.before((t) => {
	// csp-reports file is written async and afterwards a verbose log is done.
	// wait until the file was written initially and until the first entry was made
	// using t.context.logVerboseStubCalled promise being called
	let wasResolved = () => {};
	t.context.logVerboseStubCalled = new Promise((resolve) => {
		wasResolved = resolve;
	});


	t.context.logVerboseStub = sinon.stub();

	let callCount = 0;
	mock("@ui5/logger", {
		getLogger: () => {
			return {
				verbose: (message) => {
					t.context.logVerboseStub(message);
					// 2 calls:
					// * initially creating the file
					// * adding a csp-violation
					if (++callCount === 2) {
						wasResolved();
					}
				}
			};
		}
	});
	mock.reRequire("@ui5/logger");
	t.context.writeFileStub = sinon.stub(fs, "writeFile").callsArg(2);

	// Re-require to ensure that mocked modules are used
	cspMiddleware = mock.reRequire("../../../../lib/middleware/csp");
});

test.after.always(() => {
	sinon.restore();
});

test("Default Settings", (t) => {
	t.plan(3 + 7); // fourth request should end in middleware and not call next!
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {});
	const res = {
		getHeader: function() {
			return undefined;
		},
		setHeader: function(header, value) {
			t.fail(`should not be called with header ${header} and value ${value}`);
		}
	};
	const next = function() {
		t.pass("Next was called.");
	};
	const noNext = function() {
		t.fail("Next should not be called");
	};

	middleware({method: "GET", url: "/test.html", headers: {}}, res, next);
	middleware({
		method: "GET",
		url: "/test.html?sap-ui-xx-csp-policy=sap-target-level-2",
		headers: {}
	}, res, next);
	middleware({method: "POST", url: "somePath", headers: {}}, res, next);
	middleware({
		method: "POST",
		url: "/dummy.csplog",
		headers: {"content-type": "application/csp-report"}
	}, res, noNext);

	// check that unsupported methods result in a call to next()
	["CONNECT", "DELETE", "HEAD", "OPTIONS", "PATCH", "PUT", "TRACE"].forEach(
		(method) => middleware({method, url: "/dummy.csplog", headers: {}}, res, next)
	);
});

test("Default Settings CSP violation", async (t) => {
	t.plan(8);
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {}, "my-report.json");

	const cspReport = {
		"document-uri": "https://otherserver:8080/index.html",
		"referrer": "",
		"violated-directive": "script-src-elem",
		"effective-directive": "script-src-elem",
		"original-policy": "default-src 'self' myserver:443; report-uri /report-csp-violation",
		"disposition": "report",
		"blocked-uri": "inline",
		"line-number": 17,
		"source-file": "https://otherserver:8080/index.html",
		"status-code": 0,
		"script-sample": ""
	};

	middleware({
		method: "POST",
		url: "/dummy.csplog",
		headers: {"content-type": "application/csp-report"},
		body: {
			"csp-report": cspReport
		}
	}, {}, undefined);

	await t.context.logVerboseStubCalled;


	t.is(t.context.logVerboseStub.callCount, 2, "should be called 2 times");
	t.deepEqual(t.context.logVerboseStub.getCall(0).args, ["Wrote csp reports initially to my-report.json"], "first log verbose");
	t.deepEqual(t.context.logVerboseStub.getCall(1).args, ["Wrote csp reports, length: 1"], "second log verbose");
	t.is(t.context.writeFileStub.callCount, 2, "should be called 2 times");
	t.is(t.context.writeFileStub.getCall(0).args[0], "my-report.json", "filename");
	t.is(t.context.writeFileStub.getCall(0).args[1], "{\"csp-reports\":[]}", "initial content");
	t.is(t.context.writeFileStub.getCall(1).args[0], "my-report.json", "filename");
	t.is(t.context.writeFileStub.getCall(1).args[1], "{\"csp-reports\":[" + JSON.stringify(cspReport) + "]}", "content with reports");
});

test("Custom Settings", (t) => {
	const middleware = cspMiddleware("csp", {
		definedPolicies: {
			policy1: "default-src 'self';",
			policy2: "default-src http:;",
			policy3: "default-src https:;"
		},
		defaultPolicy: "policy1",
		defaultPolicyIsReportOnly: false,
		defaultPolicy2: "policy2",
		defaultPolicy2IsReportOnly: false,
		allowDynamicPolicySelection: true,
		allowDynamicPolicyDefinition: true
	});
	let expected;
	const res = {
		getHeader: function() {
			return undefined;
		},
		setHeader: function(header, value) {
			if ( header.toLowerCase() === "content-security-policy" ) {
				t.is(value, expected.shift(), "should have the expected value");
			} else {
				t.fail(`should not be called with header ${header} and value ${value}`);
			}
		}
	};
	const next = function() {
		t.pass("Next was called.");
	};

	expected = ["default-src 'self';", "default-src http:;"];
	middleware({method: "GET", url: "/test.html", headers: {}}, res, next);

	expected = ["default-src https:;", "default-src http:;"];
	middleware({method: "GET", url: "/test.html?csp=policy3", headers: {}}, res, next);

	expected = ["default-src ftp:;", "default-src http:;"];
	middleware({method: "GET", url: "/test.html?csp=default-src%20ftp:;", headers: {}}, res, next);
});

test("No Dynamic Policy Definition", (t) => {
	const middleware = cspMiddleware("csp", {
		definedPolicies: {
			policy1: "default-src 'self';",
			policy2: "default-src http:;"
		},
		defaultPolicy: "policy1",
		defaultPolicyIsReportOnly: false,
		defaultPolicy2: "policy2",
		defaultPolicy2IsReportOnly: false,
		allowDynamicPolicyDefinition: false
	});
	const res = {
		getHeader: function() {
			return undefined;
		},
		setHeader: function(header, value) {
			if ( header.toLowerCase() === "content-security-policy" ) {
				t.is(value, expected.shift(), "should have the expected value");
			} else {
				t.fail(`should not be called with header ${header} and value ${value}`);
			}
		}
	};
	const next = function() {
		t.pass("Next was called.");
	};

	const expected = ["default-src 'self';", "default-src http:;"];
	middleware({method: "GET", url: "/test.html?csp=default-src%20ftp:;", headers: {}}, res, next);
});

test("Header Manipulation", (t) => {
	const middleware = cspMiddleware("csp", {
		definedPolicies: {
			policy1: "default-src 'self';",
			policy2: "default-src http:;"
		},
		defaultPolicy: "policy1",
		defaultPolicyIsReportOnly: false,
		defaultPolicy2: "policy2",
		defaultPolicy2IsReportOnly: false
	});
	let cspHeader = "default-src: spdy:";
	const res = {
		getHeader: function() {
			return cspHeader;
		},
		setHeader: function(header, value) {
			if ( header.toLowerCase() === "content-security-policy" ) {
				cspHeader = value;
			} else {
				t.fail(`should not be called with header ${header} and value ${value}`);
			}
		}
	};
	const next = function() {};

	middleware({method: "GET", url: "/test.html", headers: {}}, res, next);
	t.deepEqual(cspHeader, ["default-src: spdy:", "default-src 'self';", "default-src http:;"]);
});
