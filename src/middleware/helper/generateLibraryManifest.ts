import createManifestProcessor from "@ui5/builder/processors/manifestCreator";
import type MiddlewareUtil from "../MiddlewareUtil.js";
import type {ResourceInterface} from "@ui5/fs/Resource";

/**
 *
 * @param middlewareUtil [MiddlewareUtil]{@link @ui5/server/middleware/MiddlewareUtil} instance
 * @param dotLibResource dotLibrary resource to process
 */
export default async function generateLibraryManifest(
	middlewareUtil: MiddlewareUtil, dotLibResource: ResourceInterface) {
	const project = dotLibResource.getProject()!;
	const libResources = await project.getReader().byGlob(
		`/resources/**/*.{js,json,library,less,css,theming,theme,properties}`);

	const res = await createManifestProcessor({
		libraryResource: dotLibResource,
		namespace: project.getNamespace(),
		resources: libResources,
		getProjectVersion: (projectName) => {
			return middlewareUtil.getProject(projectName)?.getVersion();
		},
	});
	if (res) {
		res.setProject(project);
		return res;
	} else {
		return null;
	}
}
