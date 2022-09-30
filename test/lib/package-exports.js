import test from "ava";
import {createRequire} from "node:module";

// Using CommonsJS require as importing json files causes an ExperimentalWarning
const require = createRequire(import.meta.url);

// package.json should be exported to allow reading version (e.g. from @ui5/cli)
test("export of package.json", (t) => {
	t.truthy(require("@ui5/server/package.json").version);
});

// Public API contract (exported modules)
test("@ui5/project", async (t) => {
	const actual = await import("@ui5/server");
	const expected = await import("../../lib/server.js");
	t.is(actual, expected, "Correct module exported");
});

[
	"sslUtil",
	{exportedSpecifier: "middlewareRepository", mappedModule: "../../lib/middleware/middlewareRepository.js"},
].forEach((v) => {
	let exportedSpecifier; let mappedModule;
	if (typeof v === "string") {
		exportedSpecifier = v;
	} else {
		exportedSpecifier = v.exportedSpecifier;
		mappedModule = v.mappedModule;
	}
	if (!mappedModule) {
		mappedModule = `../../lib/${exportedSpecifier}.js`;
	}
	const spec = `@ui5/server/${exportedSpecifier}`;
	test(`${spec}`, async (t) => {
		const actual = await import(spec);
		const expected = await import(mappedModule);
		t.is(actual, expected, "Correct module exported");
	});
});
