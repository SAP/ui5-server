import parseurl from "parseurl";
import Router from "router";
import querystring from "node:querystring";
import {getLogger} from "@ui5/logger";
import bodyParser from "body-parser";
import type {NextFunction, Request, Response} from "express";

const log = getLogger("server:middleware:csp");

const HEADER_CONTENT_SECURITY_POLICY = "Content-Security-Policy";
const HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY = "Content-Security-Policy-Report-Only";
const rPolicy = /^([-_a-zA-Z0-9]+)(:report-only|:ro)?$/i;

/**
 *
 * @param res Response object
 * @param header Header's name
 * @param value Header's value
 */
function addHeader(res: Response, header: string, value: string) {
	const current = res.getHeader(header);
	if (current == null) {
		res.setHeader(header, value);
	} else if (Array.isArray(current)) {
		res.setHeader(header, [...current, value]);
	} else {
		res.setHeader(header, [String(current), value]);
	}
}

/**
 * Evaluates if the uriPath is either part of the pathName or in the request header referer
 *
 * @param uriPath path in the URI, e.g. "test-resources/sap/ui/qunit/testrunner.html"
 * @param req request
 * @param pathName path name of the request
 * @returns whether or not path fragment is in pathName or in referer header
 */
function containsPath(uriPath: string, req: Request, pathName: string) {
	return pathName.includes(uriPath) ||
		(req.headers.referer?.includes(uriPath));
}

/**
 * serveCSPReports whether to serve the csp resources
 *
 * ignorePaths URI paths which are ignored by the CSP reports,
 * e.g. ["test-resources/sap/ui/qunit/testrunner.html"]
 */

/**
 * Middleware which enables CSP (content security policy) support
 *
 * @see https://www.w3.org/TR/CSP/
 * @param sCspUrlParameterName CSP param name
 * @param oConfig Middleware's configuration
 * @param oConfig.allowDynamicPolicySelection Allow Dynamic Policy Selection
 * @param oConfig.allowDynamicPolicyDefinition Allow Dynamic Policy Definition
 * @param oConfig.defaultPolicy Default Policy
 * @param oConfig.defaultPolicyIsReportOnly Default Policy Is Report Only
 * @param oConfig.defaultPolicy2 Default Policy 2
 * @param oConfig.defaultPolicy2IsReportOnly Default Policy Is Report Only 2
 * @param oConfig.definedPolicies Defined Policies
 * @param oConfig.serveCSPReports Serve CSP Reports
 * @param oConfig.ignorePaths Ignore Paths
 * @returns Returns a server middleware closure.
 */
function createMiddleware(sCspUrlParameterName: string, oConfig: {
	allowDynamicPolicySelection: boolean;
	allowDynamicPolicyDefinition: boolean;
	defaultPolicy: string;
	defaultPolicyIsReportOnly: boolean;
	defaultPolicy2: string;
	defaultPolicy2IsReportOnly: boolean;
	definedPolicies: Record<string, string>;
	serveCSPReports: boolean;
	ignorePaths: string[];
}) {
	const {
		allowDynamicPolicySelection = false,
		allowDynamicPolicyDefinition = false,
		defaultPolicy = "default",
		defaultPolicyIsReportOnly = false,
		defaultPolicy2 = null,
		defaultPolicy2IsReportOnly = false,
		definedPolicies = {},
		serveCSPReports = false,
		ignorePaths = [],
	} = oConfig;

	/**
	 * List of CSP Report entries
	 */
	const cspReportEntries = [] as Record<string, string>[];
	const router = new Router();
	// .csplog
	// body parser is required to parse csp-report in body (json)
	if (serveCSPReports) {
		router.post("/.ui5/csp/report.csplog", bodyParser.json({type: "application/csp-report"}));
	}
	router.post("/.ui5/csp/report.csplog", function (req: Request, res: Response, next: NextFunction) {
		if (req.headers["content-type"] === "application/csp-report") {
			if (!serveCSPReports) {
				res.end();
				return;
			}
			// Write the violation into an array
			// They can be retrieved via a request to '/.ui5/csp/csp-reports.json'
			if (typeof req.body !== "object") {
				const error = new Error(`No body content available: ${req.url}`);
				log.error(error);
				next(error);
				return;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const cspReportObject = req.body["csp-report"] as Record<string, string>;
			if (cspReportObject) {
				// extract the csp-report and add it to the cspReportEntries list
				cspReportEntries.push(cspReportObject);
			}
			res.end();
		} else {
			next();
		}
	});

	// csp-reports.json
	if (serveCSPReports) {
		router.get("/.ui5/csp/csp-reports.json", (_req, res, _next) => {
			// serve csp reports
			const body = JSON.stringify({
				"csp-reports": cspReportEntries,
			}, null, "\t");
			res.writeHead(200, {
				"Content-Type": "application/json",
			});
			res.end(body);
		});
	}

	// html get requests
	// add csp headers
	router.use((req, res, next) => {
		const oParsedURL = parseurl(req)!;

		// add CSP headers only to get requests for *.html pages
		if (req.method !== "GET" || !oParsedURL.pathname?.endsWith(".html")) {
			next();
			return;
		}

		const containsIgnorePath = (ignoredPath: string) => {
			return containsPath(ignoredPath, req, oParsedURL.pathname!);
		};

		if (ignorePaths.some(containsIgnorePath)) {
			next();
			return;
		}

		// If default policies are defined, they will even be send without a present URL parameter.
		let policy: string = defaultPolicy && definedPolicies[defaultPolicy];
		let reportOnly = defaultPolicyIsReportOnly;
		const policy2: string | null = defaultPolicy2 && definedPolicies[defaultPolicy2];
		const reportOnly2 = defaultPolicy2IsReportOnly;

		const oQuery = querystring.parse(oParsedURL.query as string);
		const sCspUrlParameterValue = oQuery[sCspUrlParameterName] as string;
		if (sCspUrlParameterValue) {
			const mPolicyMatch = rPolicy.exec(sCspUrlParameterValue);

			if (mPolicyMatch) {
				if (allowDynamicPolicySelection) {
					policy = definedPolicies[mPolicyMatch[1]];
					reportOnly = mPolicyMatch[2] !== undefined;
				} // else: ignore parameter
			} else if (allowDynamicPolicyDefinition) {
				// Custom CSP policy directives get passed as part of the CSP URL-Parameter value
				if (sCspUrlParameterValue.endsWith(":report-only")) {
					policy = sCspUrlParameterValue.slice(0, -":report-only".length);
					reportOnly = true;
				} else if (sCspUrlParameterValue.endsWith(":ro")) {
					policy = sCspUrlParameterValue.slice(0, -":ro".length);
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
				// Add report-uri. This is mandatory for the report-only mode.
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY,
					policy + " report-uri /.ui5/csp/report.csplog;");
			} else {
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY, policy);
			}
		}
		if (policy2) {
			if (reportOnly2) {
				// Add report-uri. This is mandatory for the report-only mode.
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY_REPORT_ONLY,
					policy2 + " report-uri /.ui5/csp/report.csplog;");
			} else {
				addHeader(res, HEADER_CONTENT_SECURITY_POLICY, policy2);
			}
		}

		next();
	});

	return router;
}

export default createMiddleware;
