declare module "@ui5/server/middleware/MiddlewareUtil" {
	type MimeInfo = {
		type: string
		charset: string
		contentType: string
	};

	type ui5_logger_Logger = object
	type ui5_fs_resourceFactory = object
	type ui5_fs_Resource = object
	type ui5_fs_AbstractReader = object
	type ProjectInterface = object

	type StandardBuildTags = {
		OmitFromBuildResult: string
		IsBundle: string
		IsDebugVariant: string
		HasDebugVariant: string
	}

	type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";

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


	type TaskUtil<specVersion extends availableSpecVersions> = specVersion extends "2.2"
		? TaskUtil_v2_2
		: specVersion extends "3.0"
		? TaskUtil_v3_0
		: specVersion extends "3.2"
		? TaskUtil_v3_2
		: never;

	class TaskUtil_v2_2 {
		STANDARD_TAGS: StandardBuildTags
		resourceFactory: ui5_fs_resourceFactory
		getDependencies(projectName?: string): string[]
		getProject(projectNameOrResource?: ProjectInterface | undefined)
		isRootProject(): boolean
		registerCleanupTask(callback: CallableFunction): never
	}

	class TaskUtil_v3_0 extends TaskUtil_v2_2 {
		clearTag(resource: ui5_fs_Resource, tag: string): never
		getTag(resource: ui5_fs_Resource, tag: string): string | boolean | number | undefined
		setTag(resource: ui5_fs_Resource, tag: string, value: string | boolean | number): never
	}

	class TaskUtil_v3_2 extends TaskUtil_v3_0 {
		someFutureMethod();
	}

	interface MiddlewareParametersBase {
		log: ui5_logger_Logger
		options: {
			configuration?: Record<string, any>
		}
		resources: {
			all: ui5_fs_AbstractReader
			rootProject: ui5_fs_AbstractReader
			dependencies: ui5_fs_AbstractReader
		},
	}

	interface MiddlewareParameters_2_0<specVersion extends availableSpecVersions> extends MiddlewareParametersBase {
		middlewareUtil: MiddlewareUtil<specVersion>;
	}

	interface MiddlewareParameters_2_2<specVersion extends availableSpecVersions> extends MiddlewareParameters_2_0<specVersion> {
		taskUtil: TaskUtil<specVersion>
	}

	type MiddlewareParameters<specVersion extends availableSpecVersions> = specVersion extends "2.0"
		? MiddlewareParameters_2_0<specVersion>
		: specVersion extends availableSpecVersions
		? MiddlewareParameters_2_2<specVersion>
		: MiddlewareParametersBase
}
