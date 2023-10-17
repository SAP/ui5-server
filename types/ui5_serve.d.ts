declare module "@ui5/server" {
	import { ProjectGraph } from "@ui5/project/graph";

	function serve(graph: ProjectGraph, configuration: Record<string, string | number | boolean>): Function;

	// This one should be (eventually) provided globally or as a part of @ui5/server/Specification 
	type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";
}
