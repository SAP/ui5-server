declare module "@ui5/server" {
	import { ProjectGraph } from "@ui5/project/graph";

	function serve(graph: ProjectGraph, configuration: Record<string, string | number | boolean>): Function;

	type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";
}
