let Service, Characteristic, log;

const capabilityMap = {
	'cap:actions': addSwitch,
	'cap:temperature': addTemperatureSensor,
	'cap:motion': addMotionSensor,
	'cap:illuminance': addIllumination,
	'cap:battery-level': addBatteryLevel,
	'cap:relative-humidity': addHumidity,
}

exports.init = function(service, characteristic) {
	Service = service;
	Characteristic = characteristic;
}

exports.setLog = function(_log) { log = _log; }

exports.decorateAccessory = function(accessory, device) {
	log.debug("Found a device", device);
	for (const cap in capabilityMap) {
		if (device.matches(cap)) {
			capabilityMap[cap](device, accessory);
		}
	}
}

function addIllumination(device, accessory) {
	log.debug("Adding Light Sensor service");
	
  const service = accessory.findOrCreateService(Service.LightSensor, "Light Sensor");
  const lightLevel = service.getCharacteristic(Characteristic.CurrentAmbientLightLevel);
	
	device.on('illuminanceChanged', (newVal) => {
		log.debug(`${accessory.displayName} illuminance changed`, newVal);
		lightLevel.updateValue(newVal.value);
	});

	// Set initial illuminance
	device.illuminance().then(x =>  {
		log.debug(`Got initial illuminance for ${accessory.displayName}:`, x.value);
		lightLevel.updateValue(x.value);
	});
}

function addBatteryLevel(device, accessory) {
	log.debug("Adding Battery Level service");
	
  const service = accessory.findOrCreateService(Service.BatteryService, "Battery Level");
  const batteryLevel = service.getCharacteristic(Characteristic.BatteryLevel);
	service.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGEABLE);

	device.on('batteryLevelChanged', (newVal) => {
		log.debug(`${accessory.displayName} battery level changed`, newVal);
		batteryLevel.updateValue(newVal.value);
	});

	// Set initial illuminance
	device.batteryLevel().then(x =>  {
		log.debug(`Got initial battery level for ${accessory.displayName}:`, x);
		batteryLevel.updateValue(x);
	});
}


function addSwitch(device, accessory) {
	log.debug("Adding Switch service");
	
  const service = accessory.findOrCreateService(Service.StatelessProgrammableSwitch, "Click");
  const switchEvent = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

	const actionMap = {
		'click': Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
		'double_click': Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
		'long_click_press': Characteristic.ProgrammableSwitchEvent.LONG_PRESS
	}
	
	device.on('action', event => {
		log.debug(`Button clicked. Action: ${event.action}`);
		
		if (actionMap[event.actionMap]) {
			switchEvent.setValue(actionMap[event.action]);
		} else {
			log.debug(`Action ${event.action} not implemented, doing nothing`);
		}
		
	});
}

function addMotionSensor(device, accessory) {
	log.debug("Adding Motion Sensor service");

  const service = accessory.findOrCreateService(Service.MotionSensor, "Motion");
  const motionEvent = service.getCharacteristic(Characteristic.MotionDetected);

	device.on('movement', event => {
		log.debug(`Motion Detected. Event: ${event}`);
		motionEvent.updateValue(true);
	});

	device.on('inactivity', event => {
		log.debug(`It's over now'`);
		motionEvent.updateValue(false);
	});
}

function addTemperatureSensor(device, accessory) {
	log.debug("Adding Temperature Sensor service");

  const service = accessory.findOrCreateService(Service.TemperatureSensor, "Temperature");
  const temperatureLevel = service.getCharacteristic(Characteristic.CurrentTemperature);

	device.on('temperatureChanged', temp => {
		log.debug(`New Temperature:`, temp);
		temperatureLevel.updateValue(temp.value);
	});

	device.temperature().then(temp => {
		log.debug(`Received initial Temperature:`, temp);
		temperatureLevel.updateValue(temp.value);
	});
}

function addHumidity(device, accessory) {
	log.debug("Adding Humidity service");

  const service = accessory.findOrCreateService(Service.HumiditySensor, "Humidity");
  const humidityLevel = service.getCharacteristic(Characteristic.CurrentRelativeHumidity);

	device.on('relativeHumidityChanged', humidity => {
		log.debug(`New Humidity:`, humidity);
		humidityLevel.updateValue(humidity);
	});

	device.relativeHumidity().then(humidity => {
		log.debug(`Received initial Humidity:`, humidity);
		humidityLevel.updateValue(humidity);
	});
}
