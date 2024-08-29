import createVersionInfoProcessor from "@ui5/builder/processors/versionInfoGenerator";
import generateLibraryManifest from "./helper/generateLibraryManifest.js";
import type {Request, Response, NextFunction} from "express";
import type {Middleware_Args} from "./MiddlewareManager.js";

const MANIFEST_JSON = "manifest.json";

/**
 * Creates and returns the middleware to create the version info as json object.
 *
 * @param parameters Parameters
 * @param parameters.resources Parameters
 * @param parameters.resources.dependencies Dependencies reader
 * @param parameters.middlewareUtil [MiddlewareUtil]{@link @ui5/server/middleware/MiddlewareUtil} instance
 * @returns Returns a server middleware closure.
 */
function createMiddleware({resources, middlewareUtil}: Middleware_Args) {
	return async function versionInfo(_req: Request, res: Response, next: NextFunction) {
		try {
			const dependencies = resources.dependencies;
			let dotLibResources = await dependencies.byGlob("/resources/**/.library");

			dotLibResources = dotLibResources.filter((res) => res.getProject()?.getType() === "library");

			dotLibResources.sort((a, b) => {
				return a.getProject().getName().localeCompare(b.getProject().getName());
			});

			const libraryInfosPromises = dotLibResources.map(async (dotLibResource) => {
				const namespace = dotLibResource.getProject()?.getNamespace();
				const manifestResources = await dependencies.byGlob(`/resources/${namespace}/**/${MANIFEST_JSON}`);
				let libraryManifest = manifestResources.find((manifestResource) => {
					return manifestResource.getPath() === `/resources/${namespace}/${MANIFEST_JSON}`;
				});
				const embeddedManifests =
					manifestResources.filter((manifestResource) => manifestResource !== libraryManifest);
				if (!libraryManifest) {
					libraryManifest = await generateLibraryManifest(middlewareUtil, dotLibResource);
				}
				return {
					libraryManifest,
					embeddedManifests,
					name: dotLibResource.getProject()?.getName(),
					version: dotLibResource.getProject()?.getVersion(),
				};
			});
			const rootProject = middlewareUtil.getProject();
			const libraryInfos = await Promise.all(libraryInfosPromises);
			const [versionInfoResource] = await createVersionInfoProcessor({
				options: {
					rootProjectName: rootProject.getName(),
					rootProjectVersion: rootProject.getVersion(),
					libraryInfos,
				},
			});
			const versionInfoContent = await versionInfoResource.getBuffer();

			res.writeHead(200, {
				"Content-Type": "application/json",
			});
			res.end(versionInfoContent.toString());
		} catch (err) {
			next(err);
		}
	};
}

export default createMiddleware;
