/*
  This application collects values from sensors measuring light,
  temperature, humidity, EC and flow within a Hydroponics hardware system.
  It sends the data to a connected cloud backend, preferrable AWS, via MQTT protocol.

  Author: David Tran
  Date:   Jan 2019
*/


load('api_config.js');
load('api_events.js');
load('api_gpio.js');
load('api_mqtt.js');
load('api_net.js');
load('api_sys.js');
load('api_timer.js');
load('api_arduino_tsl2561.js');
load("api_dht.js");
load("api_adc.js");

/**** PINS ****/
let dhtPin = 15;
let mydht = DHT.create(dhtPin, DHT.DHT11);
let showerPin = 21;
let led = 5;	//built-in led pin on Lolin32 board
let btn = 17; //if button is connected to the board

/**** FREQUENTCYS and CONSTANTS****/
let freq = 3000;

/**** MQTT TOPICS ****/
let topic = 'hydro/' + Cfg.get('device.id') + '/sensorData';

// Enable pins at start. Built in led pin 5 turns on when low and off att high
GPIO.set_mode(showerPin, GPIO.MODE_OUTPUT);
GPIO.set_mode(led, GPIO.MODE_OUTPUT);
GPIO.write(led, 0);
GPIO.write(showerPin, 0);

// Initialize Adafruit_TSL2561 library
let tsl = Adafruit_TSL2561.create();
print('Adafruit_TSL2561.TSL2561_GAIN_16X -> ',Adafruit_TSL2561.TSL2561_GAIN_16X);
tsl.setGain(Adafruit_TSL2561.TSL2561_GAIN_0X);
tsl.setIntegrationTime(Adafruit_TSL2561.TSL2561_INTEGRATIONTIME_402MS);
tsl.begin();

// Monitor network connectivity.
Event.addGroupHandler(Net.EVENT_GRP, function(ev, evdata, arg) {
  let evs = '???';
  if (ev === Net.STATUS_DISCONNECTED) {
    evs = 'DISCONNECTED';
  } else if (ev === Net.STATUS_CONNECTING) {
    evs = 'CONNECTING';
  } else if (ev === Net.STATUS_CONNECTED) {
    evs = 'CONNECTED';
  } else if (ev === Net.STATUS_GOT_IP) {
    evs = 'GOT_IP';
  }
  print('== Net event:', ev, evs);
}, null);

let getSensorData = function() {
  let vis = tsl.getVisible();
  let ir = tsl.getInfrared();
  let temp = mydht.getTemp();
  let hum = mydht.getHumidity();
  let lux = tsl.calculateLux(vis, ir);
  let id = Cfg.get('device.id');
  let time = Timer.now();
  let fullTime = Timer.fmt("%c", time);
  let sensors = {
    Temp: temp,
    Humidity: hum,
    Lux: lux,
    deviceId: id,
    Timestamp: time,
    Time: fullTime
  };
  return sensors;
};

let send = function() {
  let msg = JSON.stringify(getSensorData());
  let ok = MQTT.pub(topic, msg, 1);
  print('Published:', ok, topic, '->', msg);
  //print('Sensor data: ', msg);
};

//Frequently send data to AWS IoT with sensordata
Timer.set(freq, Timer.REPEAT, function() {
      send();
}, null);

Timer.set(2000, Timer.REPEAT, function() {
      GPIO.toggle(led);
}, null);
