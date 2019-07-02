const log = require("@ui5/logger").getLogger("proxyConfiguration");
const {resourceFactory} = require("@ui5/fs");

const proxyConfigurations = {};

function addConfiguration(name, proxyConfig) {
	if (!name || !proxyConfig) {
		throw new Error(`proxyConfiguration: Function called with missing parameters`);
	}
	if (proxyConfigurations[name]) {
		throw new Error(`proxyConfiguration: A configuration with name ${name} is already known`);
	}

	if (!proxyConfig.destination) {
		proxyConfig.destination = {};
	}
	proxyConfigurations[name] = proxyConfig;
}

async function getConfigurationForProject(project) {
	const configNames = Object.keys(proxyConfigurations);
	if (configNames.length === 0) {
		throw new Error(`No proxy configurations have been added yet`);
	}
	if (configNames.length > 1) {
		throw new Error(`Found multiple proxy configurations. ` +
			`This is not yet supported.`); // TODO
	}
	const config = JSON.parse(JSON.stringify(proxyConfigurations[configNames[0]]));

	const {source} = resourceFactory.createCollectionsForTree(project);
	const manifestResource = await source.byPath("/manifest.json");
	if (manifestResource) {
		const manifest = JSON.parse(await manifestResource.getBuffer());
		if (manifest["sap.platform.abap"] && manifest["sap.platform.abap"].uri) {
			log.verbose(`Using sap.platform.abap URI configuration as application root ` +
				`path: ${manifest["sap.platform.abap"].uri}`);
			config.destination.appRoot = manifest["sap.platform.abap"].uri;
		}
	}
	log.verbose(`UI5 root path configured as: ${config.destination.ui5Root}`);

	return config;
}

module.exports = {
	addConfiguration,
	getConfigurationForProject
};
