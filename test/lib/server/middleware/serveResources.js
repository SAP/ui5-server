const test = require("ava");
const sinon = require("sinon");
const resourceFactory = require("@ui5/fs").resourceFactory;

test.serial("Check if properties file is served properly", (t) => {
	t.plan(4);
	const serveResourcesMiddleware = require("../../../../lib/middleware/serveResources");
	const writeResource = function(writer, path, size = 0, stringContent = "abc") {
		const resource = resourceFactory.createResource({path, string: stringContent});
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

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	return writeResource(readerWriter, "/myFile3.properties", 1024 * 1024, "key=titel\nfame=straße").then((resource) => {
		const setStringSpy = sinon.spy(resource, "setString");
		const middleware = serveResourcesMiddleware({
			resources: {
				all: readerWriter
			}
		});

		const response = {
			writeHead: function(status, contentType) {
			},
			getHeader: function(string) {

			},
			setHeader: function(string, header) {

			}
		};
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

