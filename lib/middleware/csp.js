const logger = require("@ui5/logger");
const log = logger.getLogger("server:middleware:csp");
const parseurl = require("parseurl");
const querystring = require("querystring");
const {promisify} = require("util");
const fs = require("graceful-fs");
const writeFile = promisify(fs.writeFile);

const HEADER_CONTENT_SECURITY_POLICY = "Content-Security-Policy";
const HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY = "Content-Security-Policy-Report-Only";
const rPolicy = /^([-_a-zA-Z0-9]+)(:report-only|:ro)?$/i;

function addHeader(res, header, value) {
	const current = res.getHeader(header);
	if ( current == null ) {
		res.setHeader(header, value);
	} else if ( Array.isArray(current) ) {
		res.setHeader(header, [...current, value]);
	} else {
		res.setHeader(header, [current, value]);
	}
}


/**
 * Writes the csp report entries to the given file path
 *
 * @param {string} filePath target file, e.g. csp-reports.json
 * @param {object[]} cspReportEntries array of csp-report json objects
 * @returns {Promise} which resolves when the file was written
 */
const writeCspReportsFiles = async (filePath, cspReportEntries) => {
	const objectToWrite = {
		"csp-reports": cspReportEntries
	};
	return writeFile(filePath, JSON.stringify(objectToWrite));
};

/**
 * @typedef {object} CspConfig
 * @property {boolean} allowDynamicPolicySelection
 * @property {boolean} allowDynamicPolicyDefinition
 * @property {string} defaultPolicy
 * @property {boolean} defaultPolicyIsReportOnly
 * @property {string} defaultPolicy2
 * @property {boolean} defaultPolicy2IsReportOnly
 * @property {object} definedPolicies
 * @property {string} cspReportPath path where the reports should be written to
 */

/**
 * @module @ui5/server/middleware/csp
 * Middleware which enables CSP (content security policy) support
 * @see https://www.w3.org/TR/CSP/
 * @param {string} sCspUrlParameterName
 * @param {CspConfig} oConfig
 * @param {module.MiddlewareUtil} middlewareUtil used to register an exit hook
 * @returns {Function} Returns a server middleware closure.
 */
function createMiddleware(sCspUrlParameterName, oConfig, middlewareUtil) {
	const {
		allowDynamicPolicySelection = false,
		allowDynamicPolicyDefinition = false,
		defaultPolicy = "default",
		defaultPolicyIsReportOnly = false,
		defaultPolicy2 = null,
		defaultPolicy2IsReportOnly = false,
		definedPolicies = {},
		cspReportPath = null
	} = oConfig;


	/**
	 * List of CSP Report entries
	 */
	const cspReportEntries = [];

	// initially write the file
	if (cspReportPath) {
		middlewareUtil.registerExitFunction(async () => {
			await writeCspReportsFiles(cspReportPath, cspReportEntries).then(() => {
				log.verbose(`Wrote csp reports initially to ${cspReportPath}`);
			});
		});
	}

	return function csp(req, res, next) {
		const oParsedURL = parseurl(req);

		if (req.method === "POST" ) {
			if (req.headers["content-type"] === "application/csp-report" &&
				oParsedURL.pathname.endsWith("/dummy.csplog") ) {
				// Write the violation into a csp-reports json file if cspReportPath parameter is set
				if (cspReportPath && req.body) {
					const reqBodyObject = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
					const cspReportObject = reqBodyObject["csp-report"];
					if (cspReportObject) {
						// extract the csp-report and add it to the cspReportEntries list
						cspReportEntries.push(cspReportObject);
					}
				}
				return;
			}
			next();
			return;
		}

		// add CSP headers only to get requests for *.html pages
		if (req.method !== "GET" || !oParsedURL.pathname.endsWith(".html")) {
			next();
			return;
		}

		// If default policies are defined, they will even be send without a present URL parameter.
		let policy = defaultPolicy && definedPolicies[defaultPolicy];
		let reportOnly = defaultPolicyIsReportOnly;
		const policy2 = defaultPolicy2 && definedPolicies[defaultPolicy2];
		const reportOnly2 = defaultPolicy2IsReportOnly;

		const oQuery = querystring.parse(oParsedURL.query);
		const sCspUrlParameterValue = oQuery[sCspUrlParameterName];
		if (sCspUrlParameterValue) {
			const mPolicyMatch = rPolicy.exec(sCspUrlParameterValue);

			if (mPolicyMatch) {
				if (allowDynamicPolicySelection) {
					policy = definedPolicies[mPolicyMatch[1]];
					reportOnly = mPolicyMatch[2] !== undefined;
				} // else: ignore parameter
			} else if (allowDynamicPolicyDefinition) {
				// Custom CSP policy directives get passed as part of the CSP URL-Parameter value
				if ( sCspUrlParameterValue.endsWith(":report-only") ) {
					policy = sCspUrlParameterValue.slice(0, - ":report-only".length);
					reportOnly = true;
				} else if ( sCspUrlParameterValue.endsWith(":ro") ) {
					policy = sCspUrlParameterValue.slice(0, - ":ro".length);
					reportOnly = true;
				} else {
					policy = sCspUrlParameterValue;
					reportOnly = false;
				}
			} // else: parameter ignored
		}

		// collect header values based on configuration
		if (policy) {
			if (reportOnly) {
				// Add dummy report-uri. This is mandatory for the report-only mode.
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY, policy + " report-uri dummy.csplog;");
			} else {
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY, policy);
			}
		}
		if (policy2) {
			if (reportOnly2) {
				// Add dummy report-uri. This is mandatory for the report-only mode.
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY, policy2 + " report-uri dummy.csplog;");
			} else {
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY, policy2);
			}
		}

		next();
	};
}

module.exports = createMiddleware;
