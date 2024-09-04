declare module "router" {
	import type {NextFunction, Request, Response} from "express";

	type cb = (req: Request, resp: Response, next: NextFunction) => void;

	export default class Router {
		post: (url: string, callback: cb) => void;
		get: (url: string, callback: cb) => void;
		use: (callback: cb) => void;
	}
}
