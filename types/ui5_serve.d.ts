declare module "@ui5/server" {
	import "@ui5/project/types"
	import { ProjectGraph } from "@ui5/project/graph";

	function serve(graph: ProjectGraph, configuration: Record<string, string | number | boolean>): Function;
}
