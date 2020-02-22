Object.defineProperty(global, "__stack", {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        return Error.prepareStackTrace = orig, stack
    }
}),
Object.defineProperty(global, "__line", {
    get: function () {
        return __stack[1].getLineNumber()
    }
});
module.exports = {
    /**
     *
     * @param {string} path
     * @returns {{socket: module.exports, queue: {app: function(*=, *=, *=): void, bodyParser: *, connectedSocket: boolean, getJobData: function(*): {options: *, id: *, type: *}, request: function(*=, *=, *=): *, afterService: function(Object, Object, {id: string, failed: Array, complete: Array, failedAlive: boolean, completeAlive: boolean, title: string, url: string, timeout: number, service: Array, callable: string, data: Array, body: string, error: string, job: {type: string, options: Array, id: number}}), kueUiExpress: function(*, *, *=, *=): void, logger: {}, start: function({service: number}): void, doJobComplete: function(string, $ObjMap): void, doJobProcess: function(string, *=, callable): boolean, defaultServices: {service: number}, beforeService: function(Object, Object, {id: string, failed: Array, complete: Array, failedAlive: boolean, completeAlive: boolean, title: string, url: string, timeout: number, service: Array, callable: string, data: Array, body: string, error: string, job: {type: string, options: Array, id: number}}), afterComplete: function({id: string, failed: Array, complete: Array, failedAlive: boolean, completeAlive: boolean, title: string, url: string, timeout: number, service: Array, callable: string, data: Array, body: string, error: string, job: {type: string, options: Array, id: number}}), initialization: function(*): this, doJobFailed: function(*=, *): void, afterProgress: function({id: string, failed: Array, complete: Array, failedAlive: boolean, completeAlive: boolean, title: string, url: string, timeout: number, service: Array, callable: string, data: Array, body: string, error: string, job: {type: string, options: Array, id: number}}), kue: function(*=): void, socket: {}, afterFailed: function({id: string, failed: Array, complete: Array, failedAlive: boolean, completeAlive: boolean, title: string, url: string, timeout: number, service: Array, callable: string, data: Array, body: string, error: string, job: {type: string, options: Array, id: number}}), config: {}, queue: {}}}}
     */
    initialization: function(path){
        const config = require('./config').load(path);
        return {
            queue: require('./queue').initialization(config),
            socket: require('./socket').initialization(config)
        };
    }
};