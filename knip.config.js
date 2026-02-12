const config = {
	/**
	 * As we currently only need unused dependency checks, we disable all checks except for that
	 */
	rules: {
		files: "off",
		duplicates: "off",
		classMembers: "off",
		unlisted: "off",
		binaries: "off",
		unresolved: "off",
		catalog: "off",
		exports: "off",
		types: "off",
		enumMembers: "off",
	},

	ignoreDependencies: [
		/**
		 * Used via nyc ava --node-arguments="--experimental-loader=@istanbuljs/esm-loader-hook"
		 * which is not detected by knip as a usage of this package
		 */
		"@istanbuljs/esm-loader-hook",

		/**
		 * Used as jsdoc template in package.json script, which is not detected
		 */
		"docdash",

		/**
		 * We ignore these dependencies here because these are dynamic imports
		 * and knip is unable to detect that these are being used
		 * (lib/middleware/MiddlewareManager.js)
		 */
		"compression",
		"cors"
	]
};

export default config;
