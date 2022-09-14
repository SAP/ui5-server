import test from "ava";
import middlewareRepository from "../../../../lib/middleware/middlewareRepository.js";
import cspModule from "../../../../lib/middleware/csp.js";

test("getMiddleware", (t) => {
	const res = middlewareRepository.getMiddleware("csp");
	t.deepEqual(res, {
		middleware: cspModule
	}, "Returned correct middleware module");
});

test("getMiddleware: Unknown middleware", (t) => {
	const err = t.throws(() => {
		middlewareRepository.getMiddleware("🐬");
	});
	t.is(err.message, "middlewareRepository: Unknown Middleware 🐬",
		"Threw error with correct message");
});
