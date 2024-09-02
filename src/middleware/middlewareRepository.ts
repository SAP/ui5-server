import type * as Express from "express";
import type Logger from "@ui5/logger/Logger";
import type AbstractReader from "@ui5/fs/AbstractReader";
import type MiddlewareUtil from "./MiddlewareUtil.js";

const middlewareInfos = {
	compression: {path: "compression"},
	cors: {path: "cors"},
	csp: {path: "./csp.js"},
	serveResources: {path: "./serveResources.js"},
	serveIndex: {path: "./serveIndex.js"},
	discovery: {path: "./discovery.js"},
	versionInfo: {path: "./versionInfo.js"},
	serveThemes: {path: "./serveThemes.js"},
	testRunner: {path: "./testRunner.js"},
	nonReadRequests: {path: "./nonReadRequests.js"},
};

export type ExpressMiddleware =
	(req: Express.Request, res: Express.Response, next: Express.NextFunction) => Promise<void> | void;

export type Middleware =
	(params: MiddlewareParams) => Promise<ExpressMiddleware>;

export interface MiddlewareParams {
	log: Logger;
	middlewareUtil: MiddlewareUtil;
	options: Record<string, unknown>;
	resources: {
		all: AbstractReader;
		dependencies: AbstractReader;
		workspace: AbstractReader;
	};
};

// see  @ui5/server/internal/middlewareRepository#getMiddleware
/**
 *
 * @param middlewareName Middleware's name
 */
async function getMiddleware(middlewareName: string) {
	if (!(middlewareName in middlewareInfos)) {
		throw new Error(`middlewareRepository: Unknown Middleware ${middlewareName}`);
	}

	const middlewareInfo = middlewareInfos[middlewareName as keyof typeof middlewareInfos];

	try {
		const {default: middleware} = await import(middlewareInfo.path);
		return {
			middleware,
		};
	} catch (err) {
		throw new Error(
			`middlewareRepository: Failed to require middleware module for ${middlewareName}:\n${err.stack}`);
	}
}
/**
 * middleware The middleware
 */

/**
 * @borrows getMiddleware as getMiddleware
 */
export default {

	/**
	 * Determines the desired middleware
	 *
	 * @param {string} middlewareName The name of the middleware
	 * @returns {module:@ui5/server/internal/middlewareRepository~Middleware} The middleware
	 */
	getMiddleware: getMiddleware,
};
