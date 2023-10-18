declare module "@ui5/server/middleware/MiddlewareParameters" {
	import "@ui5/server/types";
	import "@ui5/project/types";

	import { MiddlewareUtil } from "@ui5/server/middleware/MiddlewareUtil";
	import { TaskUtil } from "@ui5/project/build/helpers/TaskUtil";
	
	// Mock some of the types, so it would be easier to follow
	type ui5_logger_Logger = object
	type ui5_fs_AbstractReader = object
	
	// This one should be (eventually) provided globally or as a part of @ui5/project/Specification 
	type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";

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
