// TODO: This file is meant only for temp resolve of the UI5 tooling
// dependencies, until they got migrated and we can have the real TS definitions

declare module "@ui5/builder/processors/versionInfoGenerator" {
	import type {ResourceInterface} from "@ui5/fs/Resource";

	export default function versionInfoGenerator(options: {
		options: {
			rootProjectName?: string;
			rootProjectVersion?: string;
			libraryInfos?: {
				name?: string;
				rootProjectName?: string;
				version?: string;
				libraryManifest?: ResourceInterface;
				embeddedManifests?: ResourceInterface[];
			}[];
		};
	}): Promise<ResourceInterface[]>;
}

declare module "@ui5/builder/processors/manifestCreator" {
	import type {ResourceInterface} from "@ui5/fs/Resource";

	export default function (params: {
		namespace?: string;
		libraryResource?: ResourceInterface;
		resources?: ResourceInterface[];
		getProjectVersion?: (name: string) => string;
		options?: {
			descriptorVersion: string;
			include3rdParty: boolean;
			prettyPrint: boolean;
			omitMinVersions: boolean;
		};
	}): Promise<ResourceInterface>;
}

declare module "@ui5/project/specifications/Project" {
	import type AbstractReader from "@ui5/fs/AbstractReader";

	export interface Project {
		getName: () => string;
		getVersion: () => string;
		getType: () => "project" | "application" | "library";
		getNamespace: () => string;
		getReader: (options?: {style: string}) => AbstractReader;
	}
}

declare module "@ui5/project/graph/ProjectGraph" {
	import type {Project} from "@ui5/project/specifications/Project";

	export interface ProjectGraph {
		getProject: (name: string) => Project;
		getDependencies: (name: string) => string[];
	}
}

declare module "@ui5/project/specifications/Specification" {
	export interface Specification {
		lt: (specVersion: string) => boolean;
		gte: (specVersion: string) => boolean;
	}
}

declare module "@ui5/logger" {
	interface logger {
		silly(x: string): void;
		verbose(x: string): void;
		error(x: Error): void;
		isLevelEnabled(x: string): boolean;
	}

	export function getLogger(x: string): logger;
}
