const fs = require('fs');
const moment = require('moment');
const {
    execSync,
} = require('child_process');

const warmTemp = 22.5;
const awayTemp = 15.0;

const config = {
    start: { temp: 22.5, start_hour: 6, start_minute: 30 },
    end: { temp: 15.0, start_hour: 23, start_minute: 0 },
};

const macAddr = ['30:07:4D:ED:EF:86', '8C:8E:F2:B3:9F:47']

function someOneIsAtHome() {
    const path = '../upc-box-ips/devices.json';
    const devices = JSON.parse(fs.readFileSync(path, 'utf8'));
    const devicesMacAddrs = devices.map(device => device.mac);
    const intersection = macAddr.filter(value => devicesMacAddrs.indexOf(value) !== -1);

    return intersection.length > 0;
}

const baseCmd = 'cd ../broadlink-thermostat-cli/ && ./broadlink-thermostat-cli.py';
function getThermostatData() {
    const result = execSync(baseCmd, { encoding: 'utf8' });
    const results = result.split("\n")

    if (results.length === 12) {
        const data = JSON.parse(results[9]);
        // console.log('data', data);
        return data;
    }
}

function setThermostatSchedules(schedules) {
    const cmd = `${baseCmd} --schedule='${JSON.stringify(schedules)}'`;
    const result = execSync(cmd, { encoding: 'utf8' });
    console.log('setThermostatSchedules', result);
}

function start() {
    const data = getThermostatData();
    if (!data) {
        console.log('Cannot access thermostat to get data');
        return;
    }
    const { hour, min, thermostat_temp } = data;

    const currentTime = moment({ hour, minute: min });
    const startTime = moment({ hour: config.start.start_hour, minute: config.start.start_minute });
    const endTime = moment({ hour: config.end.start_hour, minute: config.end.start_minute });

    isHeatingTime = currentTime.isBetween(startTime , endTime);
    let temp = config.end.temp;
    if (isHeatingTime && someOneIsAtHome()) {
        temp = config.start.temp;
    }
    console.log(`need to have temp ${temp}`);

    if (thermostat_temp === temp) {
        console.log('thermostat is already set to this temperature. No need to do anything.');
    } else {
        console.log('need to update temperature of the thermostat.');

        const schedules = [[
            config.start,
            config.start,
            { temp, start_hour: hour, start_minute: min+1 }, // we might use moment for the +1 min
            config.end,
            config.end,
            config.end,
        ], [ config.start, config.end ]];

        console.log('new schedules', schedules);
        setThermostatSchedules(schedules);
    }
}
start();

// if thermostat_temp !== than awayTemp && warmTemp dont do anything
// but if nobody is home for more than 1h then set awayTemp

// --schedule='[[{\"start_hour\":6,\"temp\":23.0,\"start_minute\":0},...],[...]]'" # ./broadlink-thermostat-cli.py --schedule='[[{"start_hour":6,"temp":22.5,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0}],[{"start_hour":6,"temp":22.5,"start_minute":0},{"start_hour":23,"temp":15.0,"start_minute":0}]]
