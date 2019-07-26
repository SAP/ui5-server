const test = require("ava");
const sinon = require("sinon");
const resourceFactory = require("@ui5/fs").resourceFactory;
const serveResourcesMiddleware = require("../../../../lib/middleware/serveResources");
const writeResource = function(writer, path, size, stringContent) {
	const resource = resourceFactory.createResource({path, buffer: Buffer.from(stringContent, "latin1")});
	resource.getStatInfo = function() {
		return {
			ino: 0,
			ctime: new Date(),
			mtime: new Date(),
			size: size,
			isDirectory: function() {
				return false;
			}
		};
	};
	resource.getStream = function() {
		return {
			pipe: function(res) {
				res.end(resource.getString());
			}
		};
	};
	return writer.write(resource).then(() => {
		return resource;
	});
};
const fakeResponse = {
	writeHead: function(status, contentType) {},
	getHeader: function(string) {},
	setHeader: function(string, header) {}
};

test.serial("Check if properties file is served properly", (t) => {
	t.plan(4);

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	return writeResource(readerWriter, "/myFile3.properties", 1024 * 1024, "key=titel\nfame=straße").then((resource) => {
		const setStringSpy = sinon.spy(resource, "setString");
		const middleware = serveResourcesMiddleware({
			resources: {
				all: readerWriter
			},
			tree: {
				resources: {
					configuration: {
						propertiesFileSourceEncoding : "ISO-8859-1"
					}
				}
			}
		});

		const response = Object.assign({}, fakeResponse);

		const setHeaderSpy = sinon.spy(response, "setHeader");
		return new Promise((resolve, reject) => {
			const req = {
				url: "/myFile3.properties",
				headers: {}
			};
			response.end = function(content) {
				content.then(resolve);
			};
			const next = function(err) {
				reject(new Error(`Next callback called with error: ${err.message}`));
			};
			middleware(req, response, next);
		}).then((content) => {
			t.is(content, `key=titel
fame=stra\\u00dfe`);
			t.is(setHeaderSpy.callCount, 2);
			t.is(setStringSpy.callCount, 1);
			t.is(setHeaderSpy.getCall(0).lastArg, "text/plain; charset=UTF-8");
		});
	});
});

test.serial("Check if properties file is served properly with UTF-8", (t) => {
	t.plan(4);

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	return writeResource(readerWriter, "/myFile3.properties", 1024 * 1024, "key=titel\nfame=straße").then((resource) => {
		const setStringSpy = sinon.spy(resource, "setString");
		const middleware = serveResourcesMiddleware({
			resources: {
				all: readerWriter
			},
			tree: {
				resources: {
					configuration: {
						propertiesFileSourceEncoding : "UTF-8"
					}
				}
			}
		});

		const response = Object.assign({}, fakeResponse);

		const setHeaderSpy = sinon.spy(response, "setHeader");
		return new Promise((resolve, reject) => {
			const req = {
				url: "/myFile3.properties",
				headers: {}
			};
			response.end = function(content) {
				content.then(resolve);
			};
			const next = function(err) {
				reject(new Error(`Next callback called with error: ${err.message}`));
			};
			middleware(req, response, next);
		}).then((content) => {
			t.is(content, `key=titel
fame=stra\\ufffde`);
			t.is(setHeaderSpy.callCount, 2);
			t.is(setStringSpy.callCount, 1);
			t.is(setHeaderSpy.getCall(0).lastArg, "text/plain; charset=UTF-8");
		});
	});
});

test.serial("Check if properties file is served properly without property setting", (t) => {
	t.plan(4);

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	return writeResource(readerWriter, "/myFile3.properties", 1024 * 1024, "key=titel\nfame=straße").then((resource) => {
		const setStringSpy = sinon.spy(resource, "setString");
		const middleware = serveResourcesMiddleware({
			resources: {
				all: readerWriter
			}
		});

		const response = Object.assign({}, fakeResponse);

		const setHeaderSpy = sinon.spy(response, "setHeader");
		return new Promise((resolve, reject) => {
			const req = {
				url: "/myFile3.properties",
				headers: {}
			};
			response.end = function(content) {
				content.then(resolve);
			};
			const next = function(err) {
				reject(new Error(`Next callback called with error: ${err.message}`));
			};
			middleware(req, response, next);
		}).then((content) => {
			t.is(content, `key=titel
fame=stra\\u00dfe`);
			t.is(setHeaderSpy.callCount, 2);
			t.is(setStringSpy.callCount, 1);
			t.is(setHeaderSpy.getCall(0).lastArg, "text/plain; charset=UTF-8");
		});
	});
});
