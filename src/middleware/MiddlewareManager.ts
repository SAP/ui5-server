import middlewareRepository, {
	type ExpressMiddleware,
	type Middleware,
	type MiddlewareParams,
	type ResourcesParam,
} from "./middlewareRepository.js";
import MiddlewareUtil from "./MiddlewareUtil.js";
import {getLogger} from "@ui5/logger";
import type {Project} from "@ui5/project/specifications/Project";
import type {ProjectGraph} from "@ui5/project/graph/ProjectGraph";
import type {Application} from "express";
import type Extension from "@ui5/project/specifications/Extension";
import {type Specification} from "@ui5/project/specifications/Specification";
// const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

/**
 * all Reader or Collection to read resources of the
 * root project and its dependencies
 *
 * rootProject Reader or Collection to read resources of
 * the project the server is started in
 */

/**
 * The MiddlewareManager
 */
class MiddlewareManager {
	graph: ProjectGraph;
	rootProject: Project;
	resources: ResourcesParam;
	options: {
		sendSAPTargetCSP: boolean;
		serveCSPReports: boolean;
		simpleIndex?: boolean;
	};

	middleware: Record<string, {
		middleware: ExpressMiddleware;
		mountPath: string;
	}>;

	middlewareExecutionOrder: string[];
	middlewareUtil: MiddlewareUtil;

	constructor({graph, rootProject, resources, options = {
		sendSAPTargetCSP: false,
		serveCSPReports: false,
	}}: {
		graph: ProjectGraph;
		rootProject: Project;
		resources: ResourcesParam;
		options: {
			sendSAPTargetCSP: boolean;
			serveCSPReports: boolean;
			simpleIndex?: boolean;
		};
	}) {
		if (!graph || !rootProject || !resources?.all ||
			!resources.rootProject || !resources.dependencies) {
			throw new Error("[MiddlewareManager]: One or more mandatory parameters not provided");
		}
		this.graph = graph;
		this.rootProject = rootProject;
		this.resources = resources;
		this.options = options;

		this.middleware = Object.create(null) as Record<string, {
			middleware: ExpressMiddleware;
			mountPath: string;
		}>;
		this.middlewareExecutionOrder = [];
		this.middlewareUtil = new MiddlewareUtil({graph, project: rootProject});
	}

	private async applyMiddleware(app: Application) {
		await this.addStandardMiddleware();
		await this.addCustomMiddleware();

		return this.middlewareExecutionOrder.map((name) => {
			const m = this.middleware[name];
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			app.use(m.mountPath, m.middleware);
		});
	}

	private async addMiddleware(middlewareName: string,
		{customMiddleware, wrapperCallback, mountPath = "/", beforeMiddleware, afterMiddleware}: {
			customMiddleware?: Middleware;
			wrapperCallback?: (param: {middleware: Middleware}) => Middleware;
			mountPath?: string;
			beforeMiddleware?: string;
			afterMiddleware?: string;
		} = {}) {
		if (this.middleware[middlewareName]) {
			throw new Error(`A middleware with the name ${middlewareName} has already been added`);
		}

		let middlewareCallback: Middleware;
		if (customMiddleware) {
			middlewareCallback = customMiddleware;
		} else {
			const middlewareInfo = await middlewareRepository.getMiddleware(middlewareName);
			if (wrapperCallback) {
				middlewareCallback = wrapperCallback(middlewareInfo);
			} else {
				middlewareCallback = middlewareInfo.middleware;
			}
		}

		if (this.middlewareExecutionOrder.includes(middlewareName)) {
			throw new Error(`Middleware ${middlewareName} already added to execution order. This should not happen.`);
		}

		if (beforeMiddleware || afterMiddleware) {
			const refMiddlewareName = beforeMiddleware ?? afterMiddleware;
			let refMiddlewareIdx = this.middlewareExecutionOrder.indexOf(refMiddlewareName!);

			if (refMiddlewareName === "connectUi5Proxy") {
				throw new Error(
					`Standard middleware "connectUi5Proxy", referenced by middleware "${middlewareName}" ` +
					`in project ${String(this.middlewareUtil.getProject())}, ` +
					`has been removed in this version of UI5 Tooling and can't be referenced anymore. ` +
					`Please see the migration guide at https://sap.github.io/ui5-tooling/updates/migrate-v3/`);
			}
			if (refMiddlewareIdx === -1) {
				throw new Error(`Could not find middleware ${refMiddlewareName}, referenced by custom ` +
					`middleware ${middlewareName}`);
			}
			if (afterMiddleware) {
				// Insert after index of referenced middleware
				refMiddlewareIdx++;
			}
			this.middlewareExecutionOrder.splice(refMiddlewareIdx, 0, middlewareName);
		} else {
			this.middlewareExecutionOrder.push(middlewareName);
		}

		this.middleware[middlewareName] = {
			middleware: await Promise.resolve(middlewareCallback({
				resources: this.resources,
				middlewareUtil: this.middlewareUtil,
			})),
			mountPath,
		};
	}

	private async addStandardMiddleware() {
		await this.addMiddleware("csp", {
			wrapperCallback: ({middleware: cspModule}) => {
				const oCspConfig = {
					allowDynamicPolicySelection: true,
					allowDynamicPolicyDefinition: true,
					definedPolicies: {
						"sap-target-level-1":
							"default-src 'self'; " +
							"script-src  'self' 'unsafe-eval'; " +
							"style-src   'self' 'unsafe-inline'; " +
							"font-src    'self' data:; " +
							"img-src     'self' https: http: data: blob:; " +
							"media-src   'self' https: http: data: blob:; " +
							"object-src  blob:; " +
							"frame-src   'self' https: gap: data: blob: mailto: tel:; " +
							"worker-src  'self' blob:; " +
							"child-src   'self' blob:; " +
							"connect-src 'self' https: wss:; " +
							"base-uri    'self';",
						"sap-target-level-2":
							"default-src 'self'; " +
							"script-src  'self'; " +
							"style-src   'self' 'unsafe-inline'; " +
							"font-src    'self' data:; " +
							"img-src     'self' https: http: data: blob:; " +
							"media-src   'self' https: http: data: blob:; " +
							"object-src  blob:; " +
							"frame-src   'self' https: gap: data: blob: mailto: tel:; " +
							"worker-src  'self' blob:; " +
							"child-src   'self' blob:; " +
							"connect-src 'self' https: wss:; " +
							"base-uri    'self';",
						"sap-target-level-3":
							"default-src 'self'; " +
							"script-src  'self'; " +
							"style-src   'self'; " +
							"font-src    'self'; " +
							"img-src     'self' https:; " +
							"media-src   'self' https:; " +
							"object-src  'self'; " +
							"frame-src   'self' https: gap: mailto: tel:; " +
							"worker-src  'self'; " +
							"child-src   'self'; " +
							"connect-src 'self' https: wss:; " +
							"base-uri    'self';",
					},
				};
				if (this.options.sendSAPTargetCSP) {
					const defaultSAPTargetConfig = {
						defaultPolicy: "sap-target-level-1",
						defaultPolicyIsReportOnly: true,
						defaultPolicy2: "sap-target-level-3",
						defaultPolicy2IsReportOnly: true,
						ignorePaths: ["test-resources/sap/ui/qunit/testrunner.html"],
					};
					Object.assign(oCspConfig, defaultSAPTargetConfig);

					if (typeof this.options.sendSAPTargetCSP === "object") {
						for (const [name, value] of Object.entries(this.options.sendSAPTargetCSP)) {
							if (!Object.hasOwnProperty.call(defaultSAPTargetConfig, name)) {
								throw new TypeError(
									`Unknown SAP Target CSP configuration option '${name}'. Allowed options are ` +
									`${String(Object.keys(defaultSAPTargetConfig))}`);
							}
							oCspConfig[name as keyof typeof oCspConfig] = value as typeof this.options.sendSAPTargetCSP;
						}
					}
				}
				if (this.options.serveCSPReports) {
					Object.assign(oCspConfig, {
						serveCSPReports: true,
					});
				}
				return () => {
					// @ts-expect-error maybe incorrect type
					return cspModule("sap-ui-xx-csp-policy", oCspConfig);
				};
			},
		});
		await this.addMiddleware("compression");
		await this.addMiddleware("cors");
		await this.addMiddleware("discovery", {
			mountPath: "/discovery",
		});
		await this.addMiddleware("serveResources");
		await this.addMiddleware("testRunner");
		await this.addMiddleware("serveThemes");
		await this.addMiddleware("versionInfo", {
			mountPath: "/resources/sap-ui-version.json",
		});
		// Handle anything but read operations *before* the serveIndex middleware
		//	as it will reject them with a 405 (Method not allowed) instead of 404 like our old tooling
		await this.addMiddleware("nonReadRequests");
		await this.addMiddleware("serveIndex", {
			wrapperCallback: ({middleware}) => {
				return ({resources, middlewareUtil}: MiddlewareParams) => middleware({
					resources,
					middlewareUtil,
					simpleIndex: this.options.simpleIndex,
				});
			},
		});
	}

	private async addCustomMiddleware() {
		const project = this.graph.getRoot();
		const projectCustomMiddleware = project.getCustomMiddleware() as {
			name: string;
			beforeMiddleware: string;
			afterMiddleware: string;
			configuration: unknown;
			mountPath: string;
		}[];

		if (projectCustomMiddleware.length !== 0) {
			return; // No custom middleware defined
		}

		for (let i = 0; i < projectCustomMiddleware.length; i++) {
			const middlewareDef = projectCustomMiddleware[i];
			if (!middlewareDef.name) {
				throw new Error(`Missing name for custom middleware definition of project ${project.getName()} ` +
					`at index ${i}`);
			}
			if (middlewareDef.beforeMiddleware && middlewareDef.afterMiddleware) {
				throw new Error(
					`Custom middleware definition ${middlewareDef.name} of project ${project.getName()} ` +
					`defines both "beforeMiddleware" and "afterMiddleware" parameters. Only one must be defined.`);
			}
			if (!middlewareDef.beforeMiddleware && !middlewareDef.afterMiddleware) {
				throw new Error(
					`Custom middleware definition ${middlewareDef.name} of project ${project.getName()} ` +
					`defines neither a "beforeMiddleware" nor an "afterMiddleware" parameter. One must be defined.`);
			}
			const customMiddleware = this.graph.getExtension(middlewareDef.name) as Extension;
			if (!customMiddleware) {
				throw new Error(
					`Could not find custom middleware ${middlewareDef.name}, ` +
					`referenced by project ${project.getName()}`);
			}

			let middlewareName = middlewareDef.name;
			if (this.middleware[middlewareName]) {
				// Middleware is already known
				// => add a suffix to allow for multiple configurations of the same middleware
				let suffixCounter = 0;
				while (this.middleware[middlewareName]) {
					suffixCounter++; // Start at 1
					middlewareName = `${middlewareDef.name}--${suffixCounter}`;
				}
			}

			await this.addMiddleware(middlewareName, {
				customMiddleware: async ({resources, middlewareUtil}) => {
					const params = {
						resources,
						options: {
							configuration: middlewareDef.configuration,
						},
					} as unknown as MiddlewareParams;

					const specVersion = customMiddleware.getSpecVersion();
					if (specVersion.gte("3.0")) {
						params.options!.middlewareName = middlewareName;
						// @ts-expect-error Remove when @ui5/logger is integrated
						params.log = getLogger(`server:custom-middleware:${middlewareDef.name}`);
					}
					const middlewareUtilInterface = middlewareUtil.getInterface(specVersion as Specification);
					if (middlewareUtilInterface) {
						params.middlewareUtil = middlewareUtilInterface as MiddlewareUtil;
					}
					return (await customMiddleware.getMiddleware() as Middleware)(params);
				},
				mountPath: middlewareDef.mountPath,
				beforeMiddleware: middlewareDef.beforeMiddleware,
				afterMiddleware: middlewareDef.afterMiddleware,
			});
		}
	}
}

export default MiddlewareManager;
