let extension;
class TestHelper {
	constructor() {
		this.why = require("why-is-node-running");
		this.delay = require("await-delay");
		this.expect = require("expect.js");
		this.nodeUtils = require("util");
		this.sinon = require("sinon");
		this.path = require("path");
		this.callsites = require("callsites");
		this.spawn = require("child_process").spawn;
	}
	static create() {
		return new TestHelper();
	}
	static extend(child) {
		extension = child;
		return TestHelper;
	}
	static describe(options, handler) {
		if (typeof options === 'function') {
		  handler = options;
		  options = {};
		}
		if (!options.timeout) options.timeout = 5e3;
		if (!options.depth) options.depth = 4;
		const test = new (extension || TestHelper)();
		const doDescribe = options.only ? describe.only : describe;
		return doDescribe(test.testName(options.depth), function() {
		  this.timeout(options.timeout);
		  handler(test);
		}).timeout(options.timeout);
	}
	getTestFile () {
		return this.callsites()
			.find(
				(call) => (
					!call.getFileName().endsWith("test-helper.js") && 
					!call.getFileName().endsWith("test_helper.js")
				)
			)
			.getFileName();
	}
    unlinkFiles (files) {
        files.forEach(file => {
            try {
            this.fs.unlinkSync(file);
            } catch (e) {
            //do nothing
            }
        });
    };

	testName(depth) {
		const segments = this.getTestFile().split(this.path.sep);
		const calculatedDepth = isNaN(depth) ? 4 : depth;
		return segments
			.slice(segments.length - calculatedDepth)
			.join("/")
			.replace(".js", "");
	}

	async printOpenHandles(delayMs) {
		if (delayMs) await this.delay(delayMs);
		await this.why();
	}

	async printOpenHandlesAfter(delayMs) {
		after(() => {
			this.printOpenHandles(delayMs);
		});
	}

	constructMock(props = [], obj) {
		return props.reduce((mock, prop) => {
			this._.set(mock, prop.path, prop.value);
			return mock;
		}, obj || {});
	}

	log(msg, ...args) {
		console.log(msg);
		if (args.length > 0) {
			console.log(JSON.stringify(args, null, 2));
		}
	}

	async tryMethod(...args) {
		try {
			const instance = args.shift();
			const methodName = args.shift();
			return await instance[methodName].apply(instance, args);
		} catch (e) {
			return e.message;
		}
	}

	tempDirectory() {
		let directoryPath = this.path.resolve(__dirname, "../temp");
		this.fs.ensureDirSync(directoryPath);
		return directoryPath;
	}

	tryNonAsyncMethod(...args) {
		try {
			const instance = args.shift();
			const methodName = args.shift();
			return instance[methodName].apply(instance, args);
		} catch (e) {
			return e.message;
		}
	}

    randomInt = function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

module.exports = TestHelper;
