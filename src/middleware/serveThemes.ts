import {ThemeBuilder} from "@ui5/builder/processors/themeBuilder";
import fsInterface from "@ui5/fs/fsInterface";
import {basename, dirname} from "node:path/posix";
import etag from "etag";
import fresh from "fresh";
import parseurl from "parseurl";
import type {NextFunction, Request, Response} from "express";
import type {ResourceInterface} from "@ui5/fs/Resource";
import type {MiddlewareParams, ExpressMiddleware} from "./middlewareRepository.js";

/**
 *
 * @param req Request
 * @param res Response
 */
function isFresh(req: Request, res: Response) {
	return fresh(req.headers, {
		etag: res.getHeader("ETag"),
	});
}

// List of experimental css variables resources that should activate the "cssVariables" build
const cssVariablesThemeResources = [
	"css_variables.source.less",
	"css_variables.css",
	"library_skeleton.css",
	"library_skeleton-RTL.css",
];

// List of resources that should be handled by the middleware
const themeResources = [
	"library.css",
	"library-RTL.css",
	"library-parameters.json",
	...cssVariablesThemeResources,
];

/**
 * Creates and returns the middleware to build themes.
 *
 * The theme is built in realtime. If a less file was modified, the theme build is triggered to rebuild the theme.
 *
 * @param parameters Parameters
 * @param parameters.resources Parameters
 * @param parameters.middlewareUtil Specification version dependent interface to a
 *                                        [MiddlewareUtil]{@link @ui5/server/middleware/MiddlewareUtil} instance
 * @returns Returns a server middleware closure.
 */
function createMiddleware({resources, middlewareUtil}: MiddlewareParams): ExpressMiddleware {
	// TODO: Use @ui5/builder type when ready
	const builder = new ThemeBuilder({
		fs: fsInterface(resources.all),
	}) as {
		build: (resources: ResourceInterface[],
			buildOptions: {compress: boolean; cssVariables: boolean}) => Promise<ResourceInterface[]>;
		clearCache: () => void;
	};
	const buildOptions = Object.create(null) as {compress: boolean; cssVariables: boolean};

	const currentRequests = Object.create(null) as Record<string, Promise<ResourceInterface | undefined> | undefined>;

	/**
	 *
	 * @param pathname Resource pathname
	 */
	async function buildTheme(pathname: string): Promise<ResourceInterface | undefined> {
		const filename = basename(pathname);

		if (cssVariablesThemeResources.includes(filename) && !buildOptions.cssVariables) {
			// Activate CSS Variables build the first time a relevant resource is requested
			buildOptions.cssVariables = true;
			// Clear the cache to ensure that the build is executed again with "cssVariables: true"
			builder.clearCache();
		}

		const sourceLessPath = dirname(pathname) + "/library.source.less";
		const sourceLessResource = await resources.all.byPath(sourceLessPath);
		if (!sourceLessResource) { // Not found
			return;
		}

		const createdResources = await builder.build([sourceLessResource], buildOptions);

		// Pick requested file resource
		const resource = createdResources.find((res) => basename(res.getPath()) === filename);
		if (!resource) {
			throw new Error(`Theme Build did not return requested file "${pathname}"`);
		}

		return resource;
	}

	/**
	 *
	 * @param req Request
	 * @param res Response
	 * @param resource fs.Resource
	 */
	async function sendResponse(req: Request, res: Response, resource: ResourceInterface) {
		const resourcePath = resource.getPath();
		const {contentType} = middlewareUtil.getMimeInfo(resourcePath);
		res.setHeader("Content-Type", contentType);

		const content = await resource.getBuffer();

		res.setHeader("ETag", etag(content));

		if (isFresh(req, res)) {
			// client has a fresh copy of the resource
			res.statusCode = 304;
			res.end();
			return;
		}

		res.end(content);
	}

	return async function theme(req: Request, res: Response, next: NextFunction) {
		try {
			const pathname = parseurl(req)!.pathname ?? "";
			const filename = basename(pathname);
			if (!themeResources.includes(filename)) {
				next();
				return;
			}

			if (!currentRequests[pathname]) {
				currentRequests[pathname] = buildTheme(pathname);
			}

			const resource = await currentRequests[pathname];
			if (!resource) {
				next();
			} else {
				await sendResponse(req, res, resource);
			}

			delete currentRequests[pathname];
		} catch (err) {
			next(err);
		}
	};
}

export default createMiddleware;
