const middlewareRepository = require("./middlewareRepository");

/**
 *
 *
 * @memberof module:@ui5/server.middleware
 */
class MiddlewareManager {
	constructor({tree, resources, options = {
		sendSAPTargetCSP: false
	}}) {
		if (!tree || !resources || !resources.all || !resources.rootProject || !resources.dependencies) {
			throw new Error("[MiddlewareManager]: One or more mandatory parameters not provided");
		}
		this.tree = tree;
		this.resources = resources;
		this.options = options;

		this.middleware = {};
		this.middlewareExecutionOrder = [];
	}

	async applyMiddleware(app) {
		await this.addStandardMiddleware();
		await this.addCustomMiddleware();

		return this.middlewareExecutionOrder.map((name) => {
			const m = this.middleware[name];
			app.use(m.mountPath, m.middleware);
		});
	}

	async addMiddleware(configuredMiddlewareName, {
		wrapperCallback, mountPath = "/",
		beforeMiddleware, afterMiddleware
	} = {}) {
		let middlewareCallback = middlewareRepository.getMiddleware(configuredMiddlewareName);
		if (wrapperCallback) {
			middlewareCallback = wrapperCallback(middlewareCallback);
		}

		let middlewareName = configuredMiddlewareName;
		if (this.middleware[middlewareName]) {
			// Middleware is already known
			// => add a suffix to allow for multiple configurations of the same middleware
			let suffixCounter = 0;
			while (this.middleware[middlewareName]) {
				suffixCounter++; // Start at 1
				middlewareName = `${configuredMiddlewareName}--${suffixCounter}`;
			}
		}
		if (this.middlewareExecutionOrder.includes(middlewareName)) {
			throw new Error(`Middleware ${middlewareName} already added to execution order. This should not happen.`);
		}

		if (beforeMiddleware || afterMiddleware) {
			const refMiddlewareName = beforeMiddleware || afterMiddleware;
			let refMiddlewareIdx = this.middlewareExecutionOrder.indexOf(refMiddlewareName);
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
			middleware: await Promise.resolve(middlewareCallback({resources: this.resources})),
			mountPath
		};
	}

	async addStandardMiddleware() {
		await this.addMiddleware("csp", {
			wrapperCallback: (cspModule) => {
				const oCspConfig = {
					allowDynamicPolicySelection: true,
					allowDynamicPolicyDefinition: true,
					definedPolicies: {
						"sap-target-level-1":
							"default-src 'self'; " +
							"script-src  'self' 'unsafe-eval'; " +
							"style-src   'self' 'unsafe-inline'; " +
							"font-src    'self' data:; " +
							"img-src     'self' * data: blob:; " +
							"frame-src   'self' https: data: blob:; " +
							"child-src   'self' https: data: blob:; " +
							"connect-src 'self' https: wss:;",
						"sap-target-level-2":
							"default-src 'self'; " +
							"script-src  'self'; " +
							"style-src   'self' 'unsafe-inline'; " +
							"font-src    'self' data:; " +
							"img-src     'self' * data: blob:; " +
							"frame-src   'self' https: data: blob:; " +
							"child-src   'self' https: data: blob:; " +
							"connect-src 'self' https: wss:;"
					}
				};
				if (this.options.sendSAPTargetCSP) {
					Object.assign(oCspConfig, {
						defaultPolicy: "sap-target-level-1",
						defaultPolicyIsReportOnly: true,
						defaultPolicy2: "sap-target-level-2",
						defaultPolicy2IsReportOnly: true,
					});
				}
				return () => {
					return cspModule("sap-ui-xx-csp-policy", oCspConfig);
				};
			}
		});
		await this.addMiddleware("compression");
		await this.addMiddleware("cors");
		await this.addMiddleware("discovery", {
			mountPath: "/discovery"
		});
		await this.addMiddleware("serveResources");
		await this.addMiddleware("serveThemes");
		await this.addMiddleware("versionInfo", {
			mountPath: "/resources/sap-ui-version.json",
			wrapperCallback: (versionInfoModule) => {
				return ({resources}) => {
					return versionInfoModule({
						resources,
						tree: this.tree
					});
				};
			}
		});
		await this.addMiddleware("connectUi5Proxy", {
			mountPath: "/proxy"
		});
		// Handle anything but read operations *before* the serveIndex middleware
		//	as it will reject them with a 405 (Method not allowed) instead of 404 like our old tooling
		await this.addMiddleware("nonReadRequests");
		await this.addMiddleware("serveIndex", {
			wrapperCallback: (middleware) => {
				return ({resources}) => middleware({
					resources,
					simpleIndex: this.options.simpleIndex
				});
			}
		});
	}

	async addCustomMiddleware() {
		const project = this.tree;
		const projectCustomMiddleware = project.server && project.server.customMiddleware;
		if (!projectCustomMiddleware || projectCustomMiddleware.length === 0) {
			return; // No custom middleware defined
		}

		for (let i = 0; i < projectCustomMiddleware.length; i++) {
			const middlewareDef = projectCustomMiddleware[i];
			if (!middlewareDef.name) {
				throw new Error(`Missing name for custom middleware definition of project ${project.metadata.name} ` +
					`at index ${i}`);
			}
			if (middlewareDef.beforeMiddleware && middlewareDef.afterMiddleware) {
				throw new Error(
					`Custom middleware definition ${middlewareDef.name} of project ${project.metadata.name} ` +
					`defines both "beforeMiddleware" and "afterMiddleware" parameters. Only one must be defined.`);
			}
			if (!middlewareDef.beforeMiddleware && !middlewareDef.afterMiddleware) {
				throw new Error(
					`Custom middleware definition ${middlewareDef.name} of project ${project.metadata.name} ` +
					`defines neither a "beforeMiddleware" nor an "afterMiddleware" parameter. One must be defined.`);
			}

			await this.addMiddleware(middlewareDef.name, {
				wrapperCallback: (middleware) => {
					return ({resources}) => {
						const options = {
							configuration: middlewareDef.configuration
						};
						return middleware({resources, options});
					};
				},
				mountPath: middlewareDef.mountPath,
				beforeMiddleware: middlewareDef.beforeMiddleware,
				afterMiddleware: middlewareDef.afterMiddleware
			});
		}
	}
}

module.exports = MiddlewareManager;
