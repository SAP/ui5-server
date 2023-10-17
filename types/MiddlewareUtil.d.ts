declare module "@ui5/server/middleware/MiddlewareUtil" {
	import { availableSpecVersions } from "@ui5/server";

	// Mock some of the types, so it would be easier to follow
	type ui5_fs_resourceFactory = object
	type ui5_fs_Resource = object

	type MimeInfo = {
		type: string
		charset: string
		contentType: string
	};

	type MiddlewareUtil<specVersion extends availableSpecVersions> = specVersion extends "2.0"
		? MiddlewareUtil_v2_0
		: specVersion extends "3.0" | "2.2"
		? MiddlewareUtil_v3_0
		: specVersion extends "3.2"
		? MiddlewareUtil_v3_2
		: never;

	class MiddlewareUtil_v2_0 {
		resourceFactory: ui5_fs_resourceFactory
		getPathname(req: object): string
		getMimeInfo(resourcePath: object): MimeInfo
	}

	class MiddlewareUtil_v3_0 extends MiddlewareUtil_v2_0 {
		getDependencies(projectName?: string): string[]
		getProject(projectNameOrResource?: string | ui5_fs_Resource)
	}

	class MiddlewareUtil_v3_2 extends MiddlewareUtil_v3_0 {
		someFutureMethod();
	}
}
