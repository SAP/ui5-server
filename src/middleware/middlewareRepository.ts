import type * as Express from "express";
import type Logger from "@ui5/logger/Logger";
import type AbstractReader from "@ui5/fs/AbstractReader";
import type MiddlewareUtil from "./MiddlewareUtil.js";

const middlewareInfos = {
	compression: {path: "compression"},
	cors: {path: "cors"},
	csp: {path: "./csp.ts"},
	serveResources: {path: "./serveResources.ts"},
	serveIndex: {path: "./serveIndex.ts"},
	discovery: {path: "./discovery.ts"},
	versionInfo: {path: "./versionInfo.ts"},
	serveThemes: {path: "./serveThemes.ts"},
	testRunner: {path: "./testRunner.ts"},
	nonReadRequests: {path: "./nonReadRequests.ts"},
};

export type ExpressMiddleware =
	(req: Express.Request, res: Express.Response, next: Express.NextFunction) => Promise<void> | void;

export type Middleware =
	(params: MiddlewareParams) => Promise<ExpressMiddleware>;

export interface ResourcesParam {
	all: AbstractReader;
	dependencies: AbstractReader;
	workspace?: AbstractReader;
	rootProject: AbstractReader;
}

export interface MiddlewareParams {
	log?: Logger;
	middlewareUtil: MiddlewareUtil;
	options?: Record<string, unknown>;
	resources: ResourcesParam;
	simpleIndex?: boolean;
	showHidden?: boolean;
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
		const {default: middleware} = await import(middlewareInfo.path) as {default: Middleware};
		return {
			middleware,
		};
	} catch (err) {
		throw new Error(
			`middlewareRepository: Failed to require middleware module for ` +
			`${middlewareName}:\n${(err as Error).stack}`);
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
