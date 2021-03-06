'use strict';

const logger=require('./logger'),
    infoLogger=logger.getLogger('info'),
    // fix buf data format, see dlt 645 for detail
    preBuf = Buffer.alloc(4).fill('fe', 'hex'),
    divBuf = Buffer.from([0x68]),
    endBuf = Buffer.from([0x16]),

    //fix property Code
    propertyCode = {
        'elecFh': '02800002',
        'elecFr': '02030000',
        'elecFra': '02030100',
        'elecFrb': '02030200',
        'elecFrc': '02030300',
        'elecPf': '02060000',
        'elecPq': '02040000',
        'elecPqa': '02040100',
        'elecPqb': '02040200',
        'elecPqc': '02040300',
        'elecCa': '02020100',
        'elecCb': '02020200',
        'elecCc': '02020300',
        'elecUa': '02010100',
        'elecUb': '02010200',
        'elecUc': '02010300',
        'elecAe': '00000000',
        'elecAef': '00010000',
        'elecAea': '00150000',
        'elecAeb': '00290000',
        'elecAec': '003d0000',
        'elecFef': '00020000',
        'elecFea': '00160000',
        'elecFeb': '002a0000',
        'elecFec': '003e0000'
    },

    propertyScale = {
        'elecFh': 0.01,
        'elecFr': 0.0001,
        'elecFra':0.0001,
        'elecFrb':0.0001,
        'elecFrc':0.0001,
        'elecPf': 0.001,
        'elecPq': 0.0001,
        'elecPqa':0.0001,
        'elecPqb':0.0001,
        'elecPqc':0.0001,
        'elecCa': 0.001,
        'elecCb': 0.001,
        'elecCc': 0.001,
        'elecUa': 0.1,
        'elecUb': 0.1,
        'elecUc': 0.1,
        'elecAe': 0.01,
        'elecAef':0.01,
        'elecAea':0.01,
        'elecAeb':0.01,
        'elecAec':0.01,
        'elecFef':0.01,
        'elecFea':0.01,
        'elecFeb':0.01,
        'elecFec':0.01
    };

/**
 * @function cmdToBuf - a parser function to transform custom command to Serialport buffer
 * @param {Object} - cmd, a custom format of command
 * @returns {Buffer} - A serialport command Buffer
 *To use the `dltparser` parser, provide a structured cmd or a Buffer of Dlt protocal
 *Bellow are dataformat request
    const cmd = {
        sn: '3411001043',
        cmd: '11',
        data: {
            status:true,
            propertyName: 'elecUa',
            value:0
        }
    }

    let encodedData = Buffer.from([0xfe, 0xfe, 0xfe, 0xfe, 0x68, 0x43, 0x10, 0x00, 0x11, 0x34,
        0x00, 0x68, 0x11, 0x04, 0x33, 0x34, 0x34, 0x35, 0x4d, 0x16]);
 */
//First export function to transfer cmd to buf , cmd should be the same as above format
exports.cmdToBuf = (cmd) => {
    //meter sn shall not be longer than 12 bytes or will be cutoff
    //the buffer will be filled with 0 if meter sn is shorter than 12
    let encodeSn = (sn) => {
            const snLength = sn.length,
                snBuf = Buffer.alloc(6).fill(0, 'hex');

            for (let i = 0; i < snLength; i++) {
                let stopIndex = snLength - 2 * i;

                if (stopIndex <= 0) {
                    break;
                }
                snBuf.write(sn.substring(stopIndex - 2, stopIndex), i, 'hex');
            }
            return snBuf;
        },

        // Current V1.0 only support encodeData from master to slave
        //with fixed data length
        encodeData = () => {
            const fixBias = Buffer.from([0x33]),
                cBuf = Buffer.from(cmd.cmd, 'hex'),
                dataBuf = Buffer.from(propertyCode[cmd.data.propertyName], 'hex'),
                lBuf = Buffer.from([dataBuf.length], 'hex');

            for (let i = 0; i < dataBuf.length; i++) {
                dataBuf[i] = dataBuf[i] + fixBias[0];
            }
            return Buffer.concat([cBuf, lBuf, dataBuf.reverse()]);
        };


    try {
        const cmdBuf = Buffer.concat([divBuf, encodeSn(cmd.sn),
            divBuf, encodeData(cmd.sn)]);
        let csBuf = Buffer.from([0x00]);

        for (let i = 0; i < cmdBuf.length; i++) {
            csBuf[0] = csBuf[0] + cmdBuf[i];
        }
        return Buffer.concat([preBuf, cmdBuf, csBuf, endBuf]);
    } catch (e) {
        infoLogger.info('parse command to buffer error:',e);
        return Buffer.alloc(0);
    }

};

/**
 * A  dltparser module which allows to translate between structured cmd and Buffer
 * This version is a sync function ,for async function see promise version
 * currently only support limited command code like 11,91,b1 and d1, further support is under developing
 * TODO  support more Dlt code in the future
 * @function bufToCmd - a parser function to transform Serialport buffer back into custom Cmd
 * @param {Object} - cmd, a custom format of Buffer comply with Dlt645-2007
 * @returns {Object} - A custom serialport command B
 * To use the `dltparser` parser, provide a structured cmd or a Buffer of Dlt protocal
 * dataformat Bellow are dataformat request
    const cmd = {
        sn: '3411001043',
        cmd: '11',
        data: {
            status:true,
            propertyName: 'elecUa',
            value:0
        }
    }

    let encodedData = Buffer.from([0xfe, 0xfe, 0xfe, 0xfe, 0x68, 0x43, 0x10, 0x00, 0x11, 0x34,
        0x00, 0x68, 0x11, 0x04, 0x33, 0x34, 0x34, 0x35, 0x4d, 0x16]);

 */
exports.bufToCmd = (buf) => {
    //meter sn shall not be longer than 12 bytes or will be cutoff
    //the buffer will be filled with 0 if meter sn is shorter than 12
    let csCheck=(sbuf,cs)=>{
            let ibuf=Buffer.from(sbuf),
                csBuf = Buffer.from([0x00]);

            for (let i = 0; i < ibuf.length; i++) {
                csBuf[0] = csBuf[0] + ibuf[i];
            }
            return csBuf[0]===cs[0];
        },

        decodeSn=(sbuf,start,div)=>{
            let ibuf=Buffer.from(sbuf),
                snBuf=ibuf.slice(start+1,div),
                sn=snBuf.reverse().toString('hex');

            return sn.substr(sn.search(/[^0]/));
        },

        decodeData=(sbuf,div)=>{
            let ibuf=Buffer.from(sbuf),
                cmd={
                    'cmd':'',
                    'data':{
                        'status': false,
                        'propertyName':'',
                        'value': 0
                    }
                };

            cmd.cmd=ibuf[div+1].toString(16);

            if (cmd.cmd==='91'||cmd.cmd==='b1'){
                let dataLength=ibuf[div+2],
                    divBias=div+3,
                    cmdLength=4,
                    fixBias = Buffer.from([0x33]),
                    propBuf=ibuf.slice(divBias,divBias+cmdLength),
                    dataBuf=ibuf.slice(divBias+cmdLength,divBias+dataLength),
                    dataValue=0,
                    cmdStr='',
                    tem=0;

                for (let i=0;i<propBuf.length;i++){
                    propBuf[i]=propBuf[i]-fixBias[0];
                }

                for (let i=0;i<dataBuf.length;i++){
                    dataBuf[i]=dataBuf[i]-fixBias[0];
                    tem=parseInt(dataBuf[i].toString(16),10);
                    dataValue=dataValue+tem*100**i;
                }
                cmdStr=propBuf.reverse().toString('hex');

                for (let key in propertyCode){
                    if (propertyCode[key]===cmdStr){
                        cmd.data.propertyName=key;
                        let scale=propertyScale[key];

                        cmd.data.value=dataValue*scale;
                        cmd.data.status=true;
                        break;
                    }
                }
                return cmd;
            } else if (cmd.cmd==='d1'){
                cmd.data.value=buf.slice(buf.length-3,buf.length-2).toString('hex');
                cmd.data.propertyName='errCode';
                return cmd;
            }
            cmd.data.value='-1';
            cmd.data.propertyName='errCode';
            return cmd;

        };


    try {
        let start = buf.indexOf(divBuf),
            div= buf.lastIndexOf(divBuf),
            end = buf.indexOf(endBuf);

        if (csCheck(buf.slice(start,end-1),buf.slice(end-1,end))!==true){
            return {
                'cmd':'',
                'data':{
                    'status': false,
                    'propertyName':'errCode',
                    'value': 'csCheck Error'
                }
            };
        }
        const cmd=decodeData(buf,div);

        cmd.sn=decodeSn(buf,start,div);
        return cmd;
    } catch (e) {
        infoLogger.info('parse buffer to command error:',e);
        return {
            'cmd':'',
            'data':{
                'status': false,
                'propertyName':'errCode',
                'value': e.toString()
            }
        };
    }

};

