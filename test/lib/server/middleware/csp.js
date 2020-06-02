const test = require("ava");
const cspMiddleware = require("../../../../lib/middleware/csp");


test("Default Settings", (t) => {
	t.plan(3 + 8); // fourth request should end in middleware and not call next!
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {});
	const res = {
		getHeader: function() {
			return undefined;
		},
		end: function() {
			t.true(true, "end is called");
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
		url: "/.ui5/csp/report.csplog",
		headers: {"content-type": "application/csp-report"}
	}, res, noNext);

	// check that unsupported methods result in a call to next()
	["CONNECT", "DELETE", "HEAD", "OPTIONS", "PATCH", "PUT", "TRACE"].forEach(
		(method) => middleware({method, url: "/.ui5/csp/report.csplog", headers: {}}, res, next)
	);
});

test("Default Settings CSP violation", async (t) => {
	t.plan(1);
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {
		serveCSPReports: true
	});

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

	const res = {
		writeHead: function(status, contentType) {
		},
		end: function(content) {
			t.is(content, JSON.stringify({"csp-reports": [cspReport]}, null, "\t"), "content matches");
		},
	};

	middleware({
		method: "POST",
		url: "/.ui5/csp/report.csplog",
		headers: {"content-type": "application/csp-report"},
		body: {
			"csp-report": cspReport
		}
	}, {
		end: () => {
			middleware({
				method: "GET",
				url: "/.ui5/csp/csp-reports.json",
				headers: {"content-type": "application/json"}
			}, res, undefined);
		}
	}, undefined);
});


test("Default Settings CSP violation without body parser, invalid body content", async (t) => {
	t.plan(2);
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {
		serveCSPReports: true
	});


	const nextFunction = function(error) {
		t.true(error instanceof Error);
		t.is(error.message, "No body content available: /.ui5/csp/report.csplog", "error message matches");
	};

	middleware({
		method: "POST",
		url: "/.ui5/csp/report.csplog",
		headers: {"content-type": "application/csp-report"},
		body: "test"
	}, {
		end: function() {
			t.fail("res.end should not be called");
		}}, nextFunction);
});


test("Default Settings two CSP violations", async (t) => {
	t.plan(3);
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {
		serveCSPReports: true
	});

	const cspReport1 = {
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

	const cspReport2 = {
		"document-uri": "https://otherserver:8080/imprint.html",
		"referrer": "",
		"violated-directive": "script-src-elem",
		"effective-directive": "script-src-elem",
		"original-policy": "default-src 'self' myserver:443; report-uri /report-csp-violation",
		"disposition": "report",
		"blocked-uri": "inline",
		"line-number": 15,
		"source-file": "https://otherserver:8080/imprint.html",
		"status-code": 0,
		"script-sample": ""
	};

	const res = {
		writeHead: function(status, contentType) {
		},
		end: function(content) {
			t.is(content, JSON.stringify({"csp-reports": [cspReport1, cspReport2]}, null, "\t"), "content matches");
		},
	};

	middleware({
		method: "POST",
		url: "/.ui5/csp/report.csplog",
		headers: {"content-type": "application/csp-report"},
		body: {
			"csp-report": cspReport1
		}
	}, {
		end: function() {
			t.true(true, "end is called");
		}
	}, undefined);

	middleware({
		method: "POST",
		url: "/.ui5/csp/report.csplog",
		headers: {"content-type": "application/csp-report"},
		body: {
			"csp-report": cspReport2
		}
	}, {
		end: function() {
			t.true(true, "end is called");
		}
	}, undefined);

	middleware({
		method: "GET",
		url: "/.ui5/csp/csp-reports.json",
		headers: {"content-type": "application/json"}
	}, res, undefined);
});

test("Default Settings no CSP violations", async (t) => {
	t.plan(1);
	const middleware = cspMiddleware("sap-ui-xx-csp-policy", {
		serveCSPReports: true
	});

	const res = {
		writeHead: function(status, contentType) {
		},
		end: function(content) {
			t.is(content, JSON.stringify({"csp-reports": []}, null, "\t"), "content matches");
		},
	};

	middleware({
		method: "GET",
		url: "/.ui5/csp/csp-reports.json",
		headers: {"content-type": "application/json"}
	}, res, undefined);
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
