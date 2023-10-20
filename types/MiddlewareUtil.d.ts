// This one should be (eventually) provided globally or as a part of @ui5/project/Specification 
declare type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";

// Mock some of the types, so it would be easier to follow
declare type ui5_fs_resourceFactory = object
declare type ui5_fs_Resource = object

declare type MimeInfo = {
	type: string
	charset: string
	contentType: string
};

declare class MiddlewareUtil_v2_0 {
	resourceFactory: ui5_fs_resourceFactory
	getPathname(req: object): string
	getMimeInfo(resourcePath: object): MimeInfo
}

declare class MiddlewareUtil_v3_0 extends MiddlewareUtil_v2_0 {
	getDependencies(projectName?: string): string[]
	getProject(projectNameOrResource?: string | ui5_fs_Resource)
}

declare class MiddlewareUtil_v3_2 extends MiddlewareUtil_v3_0 {
	someFutureMethod();
}

export declare type MiddlewareUtil<specVersion extends availableSpecVersions> = specVersion extends "2.0"
	? MiddlewareUtil_v2_0
	: specVersion extends "3.0" | "2.2"
	? MiddlewareUtil_v3_0
	: specVersion extends "3.2"
	? MiddlewareUtil_v3_2
	: never;
