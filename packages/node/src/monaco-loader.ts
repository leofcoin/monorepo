import * as monaco from 'monaco-editor'

globalThis.MonacoEnvironment = {
	getWorkerUrl: function (moduleId, label) {
		if (label === 'typescript' || label === 'javascript') {
			return './monaco/ts.worker.js';
		}
		return './monaco/editor.worker.js';
	}
};

export default monaco