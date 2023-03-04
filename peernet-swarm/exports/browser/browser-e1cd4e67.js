function _mergeNamespaces(n, m) {
	m.forEach(function (e) {
		e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
			if (k !== 'default' && !(k in n)) {
				var d = Object.getOwnPropertyDescriptor(e, k);
				Object.defineProperty(n, k, d.get ? d : {
					enumerable: true,
					get: function () { return e[k]; }
				});
			}
		});
	});
	return Object.freeze(n);
}

var global;
var hasRequiredGlobal;

function requireGlobal () {
	if (hasRequiredGlobal) return global;
	hasRequiredGlobal = 1;
	var naiveFallback = function () {
		if (typeof self === "object" && self) return self;
		if (typeof window === "object" && window) return window;
		throw new Error("Unable to resolve global `this`");
	};

	global = (function () {
		if (this) return this;

		// Unexpected strict mode (may happen if e.g. bundled into ESM module)

		// Fallback to standard globalThis if available
		if (typeof globalThis === "object" && globalThis) return globalThis;

		// Thanks @mathiasbynens -> https://mathiasbynens.be/notes/globalthis
		// In all ES5+ engines global object inherits from Object.prototype
		// (if you approached one that doesn't please report)
		try {
			Object.defineProperty(Object.prototype, "__global__", {
				get: function () { return this; },
				configurable: true
			});
		} catch (error) {
			// Unfortunate case of updates to Object.prototype being restricted
			// via preventExtensions, seal or freeze
			return naiveFallback();
		}
		try {
			// Safari case (window.__global__ works, but __global__ does not)
			if (!__global__) return naiveFallback();
			return __global__;
		} finally {
			delete Object.prototype.__global__;
		}
	})();
	return global;
}

var name = "websocket";
var description = "Websocket Client & Server Library implementing the WebSocket protocol as specified in RFC 6455.";
var keywords = [
	"websocket",
	"websockets",
	"socket",
	"networking",
	"comet",
	"push",
	"RFC-6455",
	"realtime",
	"server",
	"client"
];
var author = "Brian McKelvey <theturtle32@gmail.com> (https://github.com/theturtle32)";
var contributors = [
	"Iñaki Baz Castillo <ibc@aliax.net> (http://dev.sipdoc.net)"
];
var version$1 = "1.0.34";
var repository = {
	type: "git",
	url: "https://github.com/theturtle32/WebSocket-Node.git"
};
var homepage = "https://github.com/theturtle32/WebSocket-Node";
var engines = {
	node: ">=4.0.0"
};
var dependencies = {
	bufferutil: "^4.0.1",
	debug: "^2.2.0",
	"es5-ext": "^0.10.50",
	"typedarray-to-buffer": "^3.1.5",
	"utf-8-validate": "^5.0.2",
	yaeti: "^0.0.6"
};
var devDependencies = {
	"buffer-equal": "^1.0.0",
	gulp: "^4.0.2",
	"gulp-jshint": "^2.0.4",
	"jshint-stylish": "^2.2.1",
	jshint: "^2.0.0",
	tape: "^4.9.1"
};
var config = {
	verbose: false
};
var scripts = {
	test: "tape test/unit/*.js",
	gulp: "gulp"
};
var main = "index";
var directories = {
	lib: "./lib"
};
var browser$2 = "lib/browser.js";
var license = "Apache-2.0";
var require$$0 = {
	name: name,
	description: description,
	keywords: keywords,
	author: author,
	contributors: contributors,
	version: version$1,
	repository: repository,
	homepage: homepage,
	engines: engines,
	dependencies: dependencies,
	devDependencies: devDependencies,
	config: config,
	scripts: scripts,
	main: main,
	directories: directories,
	browser: browser$2,
	license: license
};

var version = require$$0.version;

var _globalThis;
if (typeof globalThis === 'object') {
	_globalThis = globalThis;
} else {
	try {
		_globalThis = requireGlobal();
	} catch (error) {
	} finally {
		if (!_globalThis && typeof window !== 'undefined') { _globalThis = window; }
		if (!_globalThis) { throw new Error('Could not determine global this'); }
	}
}

var NativeWebSocket = _globalThis.WebSocket || _globalThis.MozWebSocket;
var websocket_version = version;


/**
 * Expose a W3C WebSocket class with just one or two arguments.
 */
function W3CWebSocket(uri, protocols) {
	var native_instance;

	if (protocols) {
		native_instance = new NativeWebSocket(uri, protocols);
	}
	else {
		native_instance = new NativeWebSocket(uri);
	}

	/**
	 * 'native_instance' is an instance of nativeWebSocket (the browser's WebSocket
	 * class). Since it is an Object it will be returned as it is when creating an
	 * instance of W3CWebSocket via 'new W3CWebSocket()'.
	 *
	 * ECMAScript 5: http://bclary.com/2004/11/07/#a-13.2.2
	 */
	return native_instance;
}
if (NativeWebSocket) {
	['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function(prop) {
		Object.defineProperty(W3CWebSocket, prop, {
			get: function() { return NativeWebSocket[prop]; }
		});
	});
}

/**
 * Module exports.
 */
var browser = {
    'w3cwebsocket' : NativeWebSocket ? W3CWebSocket : null,
    'version'      : websocket_version
};

var browser$1 = /*#__PURE__*/_mergeNamespaces({
	__proto__: null,
	default: browser
}, [browser]);

export { browser$1 as b };
