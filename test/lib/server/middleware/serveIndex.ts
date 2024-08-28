import test from "ava";
import * as resourceFactory from "@ui5/fs/resourceFactory";
import MiddlewareUtil from "../../../../lib/middleware/MiddlewareUtil.js";
import serveIndexMiddleware from "../../../../lib/middleware/serveIndex.js";

test.serial("serveIndex default", async (t) => {
	t.plan(4);
	const writeResource = function(writer, path, buffer) {
		const statInfo = {
			mtime: 0,
			size: buffer.byteLength,
			isDirectory: function() {
				return false;
			}
		};
		const resource = resourceFactory.createResource({statInfo, path, buffer});
		return writer.write(resource);
	};

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	await Promise.all([
		writeResource(readerWriter, "/myFile1.meh", Buffer.alloc(1024)), // KB
		writeResource(readerWriter, "/myFile2.js", Buffer.alloc(1024 * 1024)), // MB
		writeResource(readerWriter, "/myFile3.properties", Buffer.alloc(1024 * 1024 * 1024)), // GB
		writeResource(readerWriter, "/.myFile4", Buffer.alloc(1024)), // hidden 1 KB
	]);
	const middleware = serveIndexMiddleware({
		middlewareUtil: new MiddlewareUtil({graph: "graph", project: "project"}),
		resources: {
			all: readerWriter
		}
	});

	await new Promise((resolve, reject) => {
		const req = {
			url: "/"
		};
		const res = {
			writeHead: function(status, contentType) {
			},
			end: function(content) {
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile1.meh\" class=\"icon icon icon-meh icon-default\" " +
							"title=\"myFile1.meh\"><span class=\"name\">myFile1.meh</span><span class=\"size\">" +
							"1.00 KB</span>"));
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile2.js\" class=\"icon icon icon-js icon-application-javascript\" " +
							"title=\"myFile2.js\"><span class=\"name\">myFile2.js</span><span class=\"size\">" +
							"1.00 MB</span>"));
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile3.properties\" class=\"icon icon icon-properties icon-default\" " +
							"title=\"myFile3.properties\"><span class=\"name\">myFile3.properties</span>" +
							"<span class=\"size\">1.00 GB</span>"));
				t.regex(content,
					RegExp(
						"<li><a href=\"/.myFile4\" class=\"icon icon icon- icon-default\" title=\".myFile4\">" +
							"<span class=\"name\">.myFile4</span><span class=\"size\">1.00 KB</span>"));
				resolve();
			},
		};
		const next = function(err) {
			reject(new Error(`Next callback called with error: ${err.message}`));
		};
		middleware(req, res, next);
	});
});

test.serial("serveIndex no hidden", async (t) => {
	t.plan(4);
	const writeResource = function(writer, path, buffer) {
		const statInfo = {
			mtime: 0,
			size: buffer.byteLength,
			isDirectory: function() {
				return false;
			}
		};
		const resource = resourceFactory.createResource({statInfo, path, buffer});
		return writer.write(resource);
	};

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	await Promise.all([
		writeResource(readerWriter, "/myFile1.meh", Buffer.alloc(1024)), // KB
		writeResource(readerWriter, "/myFile2.js", Buffer.alloc(1024 * 1024)), // MB
		writeResource(readerWriter, "/myFile3.properties", Buffer.alloc(1024 * 1024 * 1024)), // GB
		writeResource(readerWriter, "/.myFile4", Buffer.alloc(1024)), // hidden 1 KB
	]);
	const middleware = serveIndexMiddleware({
		middlewareUtil: new MiddlewareUtil({graph: "graph", project: "project"}),
		resources: {
			all: readerWriter
		},
		simpleIndex: false,
		showHidden: false
	});

	await new Promise((resolve, reject) => {
		const req = {
			url: "/"
		};
		const res = {
			writeHead: function(status, contentType) {
			},
			end: function(content) {
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile1.meh\" class=\"icon icon icon-meh icon-default\" " +
							"title=\"myFile1.meh\"><span class=\"name\">myFile1.meh</span>" +
							"<span class=\"size\">1.00 KB</span>"));
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile2.js\" class=\"icon icon icon-js icon-application-javascript\" " +
							"title=\"myFile2.js\"><span class=\"name\">myFile2.js</span>" +
							"<span class=\"size\">1.00 MB</span>"));
				t.regex(content,
					RegExp(
						"<li><a href=\"/myFile3.properties\" class=\"icon icon icon-properties icon-default\" " +
							"title=\"myFile3.properties\"><span class=\"name\">myFile3.properties</span>" +
							"<span class=\"size\">1.00 GB</span>"));
				t.notRegex(content,
					RegExp(
						"<li><a href=\"/.myFile4\" class=\"icon icon icon- icon-default\" " +
							"title=\".myFile4\"><span class=\"name\">.myFile4</span>" +
							"<span class=\"size\">1.00 KB</span>"));
				resolve();
			},
		};
		const next = function(err) {
			reject(new Error(`Next callback called with error: ${err.message}`));
		};
		middleware(req, res, next);
	});
});

test.serial("serveIndex no details", async (t) => {
	t.plan(4);
	const writeResource = function(writer, path, buffer) {
		const statInfo = {
			mtime: 0,
			size: buffer.byteLength,
			isDirectory: function() {
				return false;
			}
		};
		const resource = resourceFactory.createResource({statInfo, path, buffer});
		return writer.write(resource);
	};

	const readerWriter = resourceFactory.createAdapter({virBasePath: "/"});

	await Promise.all([
		writeResource(readerWriter, "/myFile1.meh", Buffer.alloc(1024)), // KB
		writeResource(readerWriter, "/myFile2.js", Buffer.alloc(1024 * 1024)), // MB
		writeResource(readerWriter, "/myFile3.properties", Buffer.alloc(1024 * 1024 * 1024)), // GB
		writeResource(readerWriter, "/.myFile4", Buffer.alloc(1024)), // hidden 1 KB
	]);
	const middleware = serveIndexMiddleware({
		middlewareUtil: new MiddlewareUtil({graph: "graph", project: "project"}),
		resources: {
			all: readerWriter
		},
		simpleIndex: true,
		showHidden: true
	});

	await new Promise((resolve, reject) => {
		const req = {
			url: "/"
		};
		const res = {
			writeHead: function(status, contentType) {
			},
			end: function(content) {
				t.regex(content, RegExp(
					"<li><a href=\"/myFile1.meh\" class=\"icon icon icon-meh icon-default\" " +
						"title=\"myFile1.meh\"><span class=\"name\">myFile1.meh</span>" +
						"<span class=\"size\">1.00 KB</span>"));
				t.regex(content, RegExp(
					"<li><a href=\"/myFile2.js\" class=\"icon icon icon-js icon-application-javascript\" " +
						"title=\"myFile2.js\"><span class=\"name\">myFile2.js</span>" +
						"<span class=\"size\">1.00 MB</span>"));
				t.regex(content, RegExp(
					"<li><a href=\"/myFile3.properties\" class=\"icon icon icon-properties icon-default\" " +
						"title=\"myFile3.properties\"><span class=\"name\">myFile3.properties</span>" +
						"<span class=\"size\">1.00 GB</span>"));
				t.regex(content, RegExp(
					"<li><a href=\"/.myFile4\" class=\"icon icon icon- icon-default\" " +
						"title=\".myFile4\"><span class=\"name\">.myFile4</span><span class=\"size\">1.00 KB</span>"));
				resolve();
			},
		};
		const next = function(err) {
			reject(new Error(`Next callback called with error: ${err.message}`));
		};
		middleware(req, res, next);
	});
});

