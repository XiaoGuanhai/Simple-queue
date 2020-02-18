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
    initialization: function(path){
        const config = require('./config').load(path);
        return {
            queue: require('./queue').initialization(config),
            socket: require('./socket').initialization(config)
        };
    }
};