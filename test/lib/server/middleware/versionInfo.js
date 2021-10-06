const test = require("ava");
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;
const versionInfoMiddleware = require("../../../../lib/middleware/versionInfo");

function createWorkspace() {
	return resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "test.lib"
			},
			version: "2.0.0",
			dependencies: [
				{
					metadata: {
						name: "sap.ui.core"
					},
					version: "1.0.0"
				}
			]
		}
	});
}

/**
 *
 * @param {string[]} names e.g. ["lib", "a"]
 * @returns {{metadata: {name, namespace}}}
 */
const createProjectMetadata = (names) => {
	return {
		metadata: {
			name: names.join("."),
			namespace: names.join("/")
		}
	};
};

/**
 * @param {module:@ui5/fs.DuplexCollection} dependencies
 * @param {module:@ui5/fs.resourceFactory} resourceFactory
 * @param {string[]} names e.g. ["lib", "a"]
 * @returns {Promise<void>}
 */
async function createDotLibrary(dependencies, resourceFactory, names) {
	await dependencies.write(resourceFactory.createResource({
		path: `/resources/${names.join("/")}/.library`,
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>${names.join(".")}</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library ${names.slice(1).join(".").toUpperCase()}</documentation>
			</library>
		`,
		project: createProjectMetadata(names)
	}));
}

/**
 *
 * @param {module:@ui5/fs.DuplexCollection} dependencies
 * @param {module:@ui5/fs.resourceFactory} resourceFactory
 * @param {string[]} names e.g. ["lib", "a"]
 * @param {object[]} deps
 * @param {string[]} [embeds]
 * @param {string} [embeddedBy]
 * @returns {Promise<void>}
 */
const createManifestResource = async (dependencies, resourceFactory, names, deps, embeds, embeddedBy) => {
	const content = {
		"sap.app": {
			"id": names.join("."),
			"embeds": []
		},
		"sap.ui5": {
			"dependencies": {
				"minUI5Version": "1.84",
				"libs": {}
			}
		}
	};

	const libs = {};
	deps.forEach((dep) => {
		libs[dep.name] = {
			"minVersion": "1.84.0"
		};
		if (dep.lazy) {
			libs[dep.name].lazy = true;
		}
	});
	content["sap.ui5"]["dependencies"]["libs"] = libs;
	if (embeds !== undefined) {
		content["sap.app"]["embeds"] = embeds;
	}
	if (embeddedBy !== undefined) {
		content["sap.app"]["embeddedBy"] = embeddedBy;
	}
	await dependencies.write(resourceFactory.createResource({
		path: `/resources/${names.join("/")}/manifest.json`,
		string: JSON.stringify(content, null, 2),
		project: createProjectMetadata(names)
	}));
};

/**
 *
 * @param {module:@ui5/fs.DuplexCollection} dependencies
 * @param {module:@ui5/fs.resourceFactory} resourceFactory
 * @param {string[]} names e.g. ["lib", "a"]
 * @param {object[]} deps
 * @param {string[]} [embeds]
 */
const createResources = async (dependencies, resourceFactory, names, deps, embeds) => {
	await createDotLibrary(dependencies, resourceFactory, names);
	await createManifestResource(dependencies, resourceFactory, names, deps, embeds);
};

function createDependencies(oOptions = {
	virBasePath: "/resources"
}) {
	oOptions = Object.assign(oOptions, {
		project: {
			metadata: {
				name: "test.lib3"
			},
			version: "3.0.0"}
	});
	return resourceFactory.createAdapter(oOptions);
}

async function assertCreatedVersionInfo(t, expectedVersionInfo, versionInfoContent) {
	const currentVersionInfo = JSON.parse(versionInfoContent);

	t.is(currentVersionInfo.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");

	delete currentVersionInfo.buildTimestamp; // removing to allow deep comparison
	currentVersionInfo.libraries.forEach((lib) => {
		t.is(lib.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");
		delete lib.buildTimestamp; // removing to allow deep comparison
	});

	currentVersionInfo.libraries.sort((libraryA, libraryB) => {
		return libraryA.name.localeCompare(libraryB.name);
	});

	t.deepEqual(currentVersionInfo, expectedVersionInfo, "Correct content");
}

// test case taken from: ui5-builder/test/lib/tasks/generateVersionInfo.js
test.serial("integration: Library with dependencies and subcomponent complex scenario", async (t) => {
	const workspace = createWorkspace();
	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);

	// input
	// lib.a => lib.b, lib.c
	// lib.b => lib.c (true)
	// lib.c => lib.d, lib.e (true)
	// lib.d => lib.e
	// lib.e =>
	// lib.a.sub.fold => lib.c

	// expected outcome
	// lib.a => lib.b, lib.c, lib.d, lib.e
	// lib.b => lib.c (true), lib.d (true), lib.e (true)
	// lib.c => lib.d, lib.e
	// lib.d => lib.e
	// lib.e =>
	// lib.a.sub.fold => lib.c, lib.d, lib.e

	// dependencies
	const dependencies = createDependencies({virBasePath: "/"});

	// lib.a
	const embeds = ["sub/fold"];
	await createResources(dependencies, resourceFactory, ["lib", "a"], [{name: "lib.b"}, {name: "lib.c"}], embeds);
	// sub
	await createManifestResource(dependencies, resourceFactory, ["lib", "a", "sub", "fold"], [{name: "lib.c"}]);

	// lib.b
	await createResources(dependencies, resourceFactory, ["lib", "b"], [{name: "lib.c", lazy: true}]);

	// lib.c
	await createResources(dependencies, resourceFactory, ["lib", "c"], [{name: "lib.d"}, {name: "lib.e", lazy: true}]);

	// lib.d
	await createResources(dependencies, resourceFactory, ["lib", "d"], [{name: "lib.e"}]);

	// lib.e
	await createResources(dependencies, resourceFactory, ["lib", "e"], []);

	// create middleware
	const resources = {dependencies};
	const tree = {
		metadata: {
			name: "myname"
		},
		version: "1.33.7"
	};
	const middleware = versionInfoMiddleware({resources, tree});

	const expectedVersionInfo = {
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
		"libraries": [{
			"name": "lib.a",
			"scmRevision": "",
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.c": {},
						"lib.d": {},
						"lib.e": {}
					}
				}
			},
		},
		{
			"name": "lib.b",
			"scmRevision": "",
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.c": {
							"lazy": true
						},
						"lib.d": {
							"lazy": true
						},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
		},
		{
			"name": "lib.c",
			"scmRevision": "",
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.d": {},
						"lib.e": {}
					}
				}
			},
		},
		{
			"name": "lib.d",
			"scmRevision": "",
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.e": {}
					}
				}
			},
		},
		{
			"name": "lib.e",
			"scmRevision": "",
		}],
		"components": {
			"lib.a.sub.fold": {
				"hasOwnPreload": true,
				"library": "lib.a",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.c": {},
							"lib.d": {},
							"lib.e": {}
						}
					}
				}
			}
		},
	};

	const res = {
		writeHead: function() {},
		end: async function(versionInfoContent) {
			await assertCreatedVersionInfo(t, expectedVersionInfo, versionInfoContent);
		}
	};
	const next = function() {
		t.fail("should not be called.");
	};

	await middleware(undefined, res, next);
});
