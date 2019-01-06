const fs = require('fs');
const moment = require('moment');
const {
    execSync,
} = require('child_process');

const warmTemp = 22.5;
const awayTemp = 15.0;

const macAddr = ['30:07:4D:ED:EF:86', '8C:8E:F2:B3:9F:47']

function someOneIsAtHome() {
    const path = '../upc-box-ips/devices.json';
    const devices = JSON.parse(fs.readFileSync(path, 'utf8'));
    const devicesMacAddrs = devices.map(device => device.mac);
    const intersection = macAddr.filter(value => devicesMacAddrs.indexOf(value) !== -1);

    return intersection.length > 0;
}

function getThermostatData() {
    const cmd = 'cd ../broadlink-thermostat-cli/ && ./broadlink-thermostat-cli.py';
    const result = execSync(cmd, { encoding: 'utf8' });
    const results = result.split("\n")

    if (results.length === 12) {
        const data = JSON.parse(results[9]);
        // console.log('data', data);
        return data;
    }
}

function start() {
    const { hour, min, thermostat_temp } = getThermostatData();

    const currentTime = moment({ hour, minute: min });
    const startTime = moment('06:30', 'HH:mm');
    const endTime = moment('23:00', 'HH:mm');

    isHeatingTime = currentTime.isBetween(startTime , endTime);
    let temperature = awayTemp;
    if (isHeatingTime && someOneIsAtHome()) {
        temperature = warmTemp;
    }
    console.log(`need to have temp ${temperature}`);

    if (thermostat_temp !== temperature) {
        console.log('need to update temperature of the thermostat.');
    } else {
        console.log('thermostat is already set to this temperature. No need to do anything.');
    }
}
start();

// we could do this, only if manuel mode is activated
// we could check if temp is different than 22 or 15 before to change it
