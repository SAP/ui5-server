const log = require("@ui5/logger").getLogger("server:proxyConfiguration");

const proxyConfigurations = {};

function addConfiguration(name, proxyConfig) {
	if (!name || !proxyConfig) {
		throw new Error(`proxyConfiguration: Function called with missing parameters`);
	}
	if (proxyConfigurations[name]) {
		throw new Error(`proxyConfiguration: A configuration with name ${name} is already known`);
	}
	if (proxyConfig.rewriteRootPaths) {
		throw new Error(`Proxy Configuration ${name} must not define "rewriteRootPaths"`);
	}

	if (!proxyConfig.destination) {
		proxyConfig.destination = {};
	}
	proxyConfigurations[name] = proxyConfig;
}

async function getConfigurationForProject(tree) {
	const configNames = Object.keys(proxyConfigurations);
	if (configNames.length === 0) {
		throw new Error(`No proxy configurations have been added yet`);
	}
	if (configNames.length > 1) {
		throw new Error(`Found multiple proxy configurations. ` +
			`This is not yet supported.`); // TODO
	}

	log.verbose(`Applying proxy configuration ${configNames[0]} to project ${tree.metadata.name}...`);
	const config = JSON.parse(JSON.stringify(proxyConfigurations[configNames[0]]));
	config.rewriteRootPaths = {};

	if (config.destination.ui5Root && !config.appOnly) {
		log.verbose(`Using configured "destination.ui5Root": ${config.destination.ui5Root}`);
		config.rewriteRootPaths[config.destination.ui5Root] = {
			rewriteTo: ""
		};
	}

	mapProjectDependencies(tree, (project) => {
		if (project.specVersion !== "1.1a") {
			log.warn(`Project ${project.metadata.name} defines specification version ${project.specVersion}. ` +
				`Some proxy configuration features require projects to define specification version 1.1a`);
		}
		log.verbose(`Using ABAP URI ${project.metadata.abapUri} from metadata of project ${project.metadata.name}`);
		let prefix = "";
		if (project.type !== "application") {
			if (project.resources.pathMappings["/resources/"]) {
				// If the project defines a /resources path mapping,
				//	we expect this to match the ABAP URI deployment path
				prefix += "/resources/";

				// If this is not an application and there is no /resources path mapping, somebody does something wild
				//	and hopefully knows what he/she does
			}
			prefix += project.metadata.namespace;
		}
		config.rewriteRootPaths[project.metadata.abapUri] = {
			rewriteTo: prefix
		};
	});

	if (log.isLevelEnabled("verbose")) {
		log.verbose(`Configured ${Object.keys(config.rewriteRootPaths).length} root paths to rewrite for ` +
			`project ${tree.metadata.name};`);
		for (const abapUri in config.rewriteRootPaths) {
			if (config.rewriteRootPaths.hasOwnProperty(abapUri)) {
				if (config.rewriteRootPaths[abapUri].rewriteTo) {
					log.verbose(`Rewriting ${abapUri} to ${config.rewriteRootPaths[abapUri].rewriteTo}`);
				} else {
					log.verbose(`Rewriting ${abapUri}`);
				}
			}
		}
	}

	return config;
}

function mapProjectDependencies(tree, handler) {
	handler(tree);
	tree.dependencies.map((dep) => {
		mapProjectDependencies(dep, handler);
	});
}

module.exports = {
	addConfiguration,
	getConfigurationForProject
};
