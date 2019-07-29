const log = require("@ui5/logger").getLogger("server:middleware:serveIndex");
const mime = require("mime-types");
const parseurl = require("parseurl");

const KB = 1024;
const MB = KB * KB;
const GB = KB * KB * KB;

/**
 * Returns the mime type of the given resource
 *
 * @param {module:@ui5/fs.Resource} resource the resource
 * @returns {string} mime type
 */
function getMimeType(resource) {
	return mime.lookup(resource.getPath()) || "application/octet-stream";
}

/**
 * Converts the given bytes into a proper human readable size
 *
 * @param {number} bytes bytes
 * @returns {string} human readable size
 */
function formatSize(bytes) {
	let result;
	if (bytes < KB) {
		result = bytes + " Bytes";
	} else if (bytes < MB) {
		result = Number.parseFloat(bytes / KB).toFixed(2) + " KB";
	} else if (bytes < GB) {
		result = Number.parseFloat(bytes / MB).toFixed(2) + " MB";
	} else {
		result = Number.parseFloat(bytes / GB).toFixed(2) + " GB";
	}
	return result;
}

/**
 * Creates a resource info object which is used to create the HTML
 * content for the resource listing
 *
 * @param {module:@ui5/fs.Resource} resource the resource to convert
 * @returns {Object} resource info object
 */
function createResourceInfo(resource) {
	const stat = resource.getStatInfo();
	const isDir = stat.isDirectory();
	const resInfo = {
		path: resource.getPath() + (isDir ? "/" : ""),
		name: resource._name + (isDir ? "/" : ""),
		isDir: isDir,
		mimetype: isDir ? "" : getMimeType(resource),
		lastModified: new Date(stat.mtime).toLocaleString(),
		size: formatSize(stat.size),
		sizeInBytes: stat.size,
		// TODO: project as public API of FS?
		project: resource._project ? resource._project.id : "<unknown>",
		projectPath: resource._project ? resource._project.path : "<unknown>"
	};
	return resInfo;
}

/**
 * Creates a resource info array from the given resource array
 *
 * @param {module:@ui5/fs.Resource[]} resources an array of resources
 * @returns {Object[]} sorted array of resource infos
 */
function createResourceInfos(resources) {
	return resources.map((item, i) => {
		return createResourceInfo(item);
	}).sort((a, b) => {
		if (a.isDir && !b.isDir) {
			return -1;
		} else if (!a.isDir && b.isDir) {
			return 1;
		} else {
			// numbers will be sorted by name as string like the FS does!
			return a.name.localeCompare(b.name);
		}
	});
}

/**
 * Creates the HTML content for the resource listing
 *
 * @param {string} path the path
 * @param {Object[]} resourceInfos an array of resource infos
 * @returns {string} HTML content for the resource listing
 */
function createContent(path, resourceInfos) {
	return `<!DOCTYPE html>
	<html>
		<head>
			<title>Index of ${path}</title>
			<style>
				body, table { font-family: Courier New; font-size: 9pt; margin: 3px; padding: 0; background-color: white; color: black; }
				h1 { padding: 1px 10px; font-size: 16pt; }
				table, tr, th, td { border: none; border-collapse: collapse; }
				th, td {padding: 1px 10px; text-align: left; }
			</style>
		</head>
		<body>
		<h1>Index of ${path}</h1>
		<table>
			<thead><tr><th></th><th>&lt;DIR&gt;</th><th></th><th><a href="..">..</a></th><th></th></tr></thead>
			<tbody>
			${resourceInfos.map((info, i) => `
			<tr${i % 2 == 1 ? " class=\"alternate\"" : ""}>
				<td>${info.lastModified}</td>
				<td>${info.isDir ? "&lt;DIR&gt;" : ""}</td>
				<td${info.isDir ? ">" : " title=\"" + info.sizeInBytes + " Bytes\">" + info.size}</td>
				<td><a href="${info.path}">${info.name}</a></td>
				<td>${info.mimetype}</td>
				<td><a href="file:////${info.projectPath}" title="${info.projectPath}">${info.project}</a></td>
			</tr>
			`).join("")}
			</tbody>
		</table>
		</body>
	</html>
	`;
}

/**
 * Creates and returns the middleware to serve a resource index.
 *
 * @module @ui5/server/middleware/serveIndex
 * @param {Object} resources Contains the resource reader or collection to access project related files
 * @param {module:@ui5/fs.AbstractReader} resources.all Resource collection which contains the workspace and the project dependencies
 * @returns {Function} Returns a server middleware closure.
 */
function createMiddleware({resources}) {
	return function serveIndex(req, res, next) {
		const pathname = parseurl(req).pathname;
		log.verbose("\n Listing index of " + pathname);
		const glob = pathname + (pathname.endsWith("/") ? "*" : "/*");
		resources.all.byGlob(glob, {nodir: false}).then((resources) => {
			if (!resources || resources.length == 0) { // Not found
				next();
				return;
			}

			res.writeHead(200, {
				"Content-Type": "text/html"
			});

			const resourceInfos = createResourceInfos(resources);
			res.end(createContent(pathname, resourceInfos));
		}).catch((err) => {
			next(err);
		});
	};
}

module.exports = createMiddleware;
