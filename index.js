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

    if (!devices.length) {
        throw 'failed to get devices';
    }

    const devicesMacAddrs = devices.map(device => device.mac);
    const intersection = macAddr.filter(value => devicesMacAddrs.indexOf(value) !== -1);

    // console.log('intersection', intersection);
    return intersection.length > 0;
}

let tryToChangeSchedule = 0;
function isAllowToChangeSchedule() {
    tryToChangeSchedule++;
    return tryToChangeSchedule > 2;
}

const baseCmd = 'cd ../broadlink-thermostat-cli/ && ./broadlink-thermostat-cli.py';
function getThermostatData() {
    const result = execSync(baseCmd, { encoding: 'utf8' });
    const results = result.split("\n")

    if (results.length === 12) {
        const data = JSON.parse(results[9]);
        console.log('data', data);
        return data;
    }
}

function executeThermostatSchedules(schedules) {
    const cmd = `${baseCmd} --schedule='${JSON.stringify(schedules)}'`;
    const result = execSync(cmd, { encoding: 'utf8' });
    console.log('executeThermostatSchedules', result);
}

function setNextSchedule(currentTime, temp) {
    const nextTime = currentTime.add(1, 'minutes');
    const nextSchedule = { temp, start_hour: nextTime.hours(), start_minute: nextTime.minutes() };
    const schedules = [[
        config.start,
        config.start,
        nextSchedule,
        config.end,
        config.end,
        config.end,
    ], [ nextSchedule, config.end ]];

    console.log('new schedules', schedules);
    executeThermostatSchedules(schedules);
}

function setDefaultSchedules() {
    const schedules = [[
        config.start,
        config.start,
        { temp: config.end.temp, start_hour: 9, start_minute: 00 },
        { temp: config.start.temp, start_hour: 15, start_minute: 30 },
        config.end,
        config.end,
    ], [ nextSchedule, config.end ]];

    console.log('set default schedules', schedules);
    executeThermostatSchedules(schedules);
}

let failedDeviceRetry = 0;
function onFailedToGetDevice() {
    console.log('Failed to get devices...');
    failedDeviceRetry++;
    if (failedDeviceRetry > 10) {
        setDefaultSchedules();
    }
}

function isHeatingTime(currentTime) {
    const startTime = moment({ hour: config.start.start_hour, minute: config.start.start_minute });
    const endTime = moment({ hour: config.end.start_hour, minute: config.end.start_minute });

    return currentTime.isBetween(startTime , endTime);
}

function thermostatService({ hour, min, thermostat_temp }) {
    const currentTime = moment({ hour, minute: min });
    let temp = config.end.temp;
    if (isHeatingTime(currentTime) && someOneIsAtHome()) {
        temp = config.start.temp;
    }
    failedDeviceRetry = 0;
    console.log(`need to have temp ${temp}`);

    if (thermostat_temp === temp) {
        console.log('thermostat is already set to this temperature. No need to do anything.');
        tryToChangeSchedule = 0;
    } else {
        console.log('need to update temperature of the thermostat.');
        // if (isAllowToChangeSchedule()) {
            setNextSchedule(currentTime, temp);
        // } else {
        //     console.log('wait a bit before to change...', tryToChangeSchedule);
        // }
    }
}

function main() {
    const data = getThermostatData();
    if (!data) {
        console.log('Cannot access thermostat to get data');
    } else {
        try {
            thermostatService(data);
        } catch (error) {
            if (error === 'failed to get devices') {
                onFailedToGetDevice();
            } else {
                console.error('Error:', error);
            }
        }
    }
    setTimeout(main, 95 * 1000); // every 65 sec
}
main();

// if thermostat_temp !== than awayTemp && warmTemp dont do anything
// but if nobody is home for more than 1h then set awayTemp

// start heating only after 20min
