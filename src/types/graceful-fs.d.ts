// "graceful-fs" definitions just inherit the ones from node:fs, but are quite
// inconvenient. So, proxying the ones from node:fs would be better.
declare module "graceful-fs" {
	import * as fs from "node:fs";
	export default fs;
}
