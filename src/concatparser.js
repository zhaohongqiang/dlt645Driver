'use strict';
const { Transform } = require('stream');
const logger=require('./logger'),
    errorLogger=logger.getLogger('error');
/**
 * A transform stream that  concat several data with a specified concat boundary and emits it
 * The code of this class is based on  DelimiterParser and InterByteTimeout Classes from  serialport package with slight modification
 * 1. The DelimiterParser is used to split a long data stream to several parts with delimiter,
 *     while ConcatParser is to concat short data to a longer one
 * 2. Use includeBoundary :boolean option to decide whether to  include the boundary symbol in data
 * 3. Use maxBufferSize option to control Buffersize and flush when buffer is full
 * 4. Use Interval option to flush if timeout
 * @class ConcatParser - class to concat buffer to complete command
 * @constructor
 * @param {Object} options- see test files for more option
 * @extends Transform
 * @summary To use the `ConcatParser` parser, provide a boundary as a string, buffer, or array of bytes. Runs in O(n) time.
 * @example
const SerialPort = require('serialport');
const ConcatParser = require('./ConcatParser');
const port = new SerialPort('/dev/tty-usbserial1');
const parser = port.pipe(new ConcatParser({ boundary: '\n'));
parser.on('data', (data)=>{console.log});
 * @auther weizy@126.com
 * @version 1.0.0
 */


class ConcatParser extends Transform {
    constructor(options = {}) {
        super(options);
        try {
            if (typeof options.boundary === 'undefined') {
                throw new TypeError('"boundary" is not a bufferable object');
            }

            if (options.boundary.length === 0) {
                throw new TypeError('"boundary" has a 0 or undefined length');
            }

            this.includeBoundary = typeof options.includeBoundary !== 'undefined' ? options.includeBoundary : true;
            this.interval = typeof options.interval !== 'undefined' ? options.interval : 3000;
            this.maxBufferSize = typeof options.maxBufferSize !== 'undefined' ? options.maxBufferSize : 65535;
            this.intervalID = -1;
            this.boundary = Buffer.from(options.boundary);
            this.buffer = Buffer.alloc(0);

        } catch (error) {
            errorLogger.error('Init concatparser error:',error);
        }
    }

    _transform(chunk, encoding, cb) {

        clearTimeout(this.intervalID);
        let data = Buffer.concat([this.buffer, chunk]),
            dataLength = data.length,
            position;

        if (dataLength >= this.maxBufferSize) {
            this.buffer = data.slice(0, this.maxBufferSize);
            data = Buffer.alloc(0);
            this.emitData();
        } else if ((position = data.indexOf(this.boundary)) !== -1) {
            this.buffer = data.slice(0, position + (this.includeBoundary ? this.boundary.length : 0));
            data = Buffer.alloc(0);
            this.emitData();
        }
        this.buffer = data;
        this.intervalID = setTimeout(this.emitData.bind(this), this.interval);
        cb();
    }

    emitData() {
        clearTimeout(this.intervalID);
        if (this.buffer.length > 0) {
            this.push(this.buffer);
        }
        this.buffer = Buffer.alloc(0);
    }
    _flush(cb) {
        this.emitData();
        cb();
    }
}

module.exports = ConcatParser;