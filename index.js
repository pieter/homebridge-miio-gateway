const miio = require('miio');
let Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  // register platform in to homebridge
  homebridge.registerPlatform("homebridge-miio-gateway", "XiaomiMiioGateway", XiaomiMiioGateway, true);
}

function XiaomiMiioGateway(log, config, api) {
  log("Setting up Miio platform");
  var platform = this;
  this.log = log;
	console.dir(log);
  this.config = config || {};
  this.accessories = {};
  this.api = api;

  // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories
  // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
  // Or start discover new accessories
  this.api.on('didFinishLaunching', () => {
		for (const deviceConfig of config.gateways) {
			this.discoverGateway(deviceConfig)
				.catch(e => {
					this.log.warn("Error while discovering gateway:", e);
					this.log.warn("Retrying...");
					return this.discoverGateway(deviceConfig);
				})
				.catch(e => {
					this.log.error("Gateway could not be found after retry");
				});
		}
  });
}

// query a specific accessory for updated state
XiaomiMiioGateway.prototype.discoverGateway = async function(config) {
	this.log("Finding gateway with config", config);
	
	const device = await miio.device(config);

	this.log("Device found for config", config);
	if (!device.matches("type:miio:gateway")) {
		throw new Exception("Configured device is not a compatible gateway: " + config + " device: " + device);
	}

	this.log.debug("Looking for connected devices...");
	this.addConnectedDevice(device);

	for (const child of device.children()) {
		this.addConnectedDevice(child);
	}
}

XiaomiMiioGateway.prototype.addConnectedDevice = async function(device) {
	this.log.debug("Found a device", device);

	const accessory = this.findOrCreateAccessory(device);
		
	if (device.matches('cap:actions')) {
		this.addSwitch(device, accessory);
	}
	
	if (device.matches('cap:temperature')) {
		this.log.debug("Found a Temperature Sensor, which is not supported right now");
	} 
	
	if (device.matches('cap:motion')) {
		this.addMotionSensor(device, accessory);
	}
	
	if (device.matches('cap:illuminance')) {
		this.addIllumination(device, accessory);
	}
	
	if (device.matches('cap:battery-level')) {
		this.addBatteryLevel(device, accessory);
	}
	
	// Check if anything added a service; we have 1 service by default.
	if (accessory.hasRealServices()) {
		this.log.debug(`Got ${accessory.services.length} services for ${accessory.displayName}, adding it to HomeKit`);
				
		if (accessory.isNew) {
			this.log("Accessory is new, registering it with HomeBridge");
			this.api.registerPlatformAccessories("homebridge-miio-gateway", "XiaomiMiioGateway", [accessory]);
		}	
	} else {
		this.log.debug(`Looks like we didn't add any services to this ${device.miioModel || device.model}, skipping it`);
	}
}

XiaomiMiioGateway.prototype.addIllumination = function(device, accessory) {
	this.log.debug("Adding Light Sensor service");
	
  const service = accessory.findOrCreateService(Service.LightSensor, "Light Sensor");
  const lightLevel = service.getCharacteristic(Characteristic.CurrentAmbientLightLevel);
	
	device.on('illuminanceChanged', (newVal) => {
		this.log.debug(`${accessory.displayName} illuminance changed`, newVal);
		lightLevel.updateValue(newVal.value);
	});

	// Set initial illuminance
	device.illuminance().then(x =>  {
		this.log.debug(`Got initial illuminance for ${accessory.displayName}:`, x.value);
		lightLevel.updateValue(x.value);
	});
}

XiaomiMiioGateway.prototype.addBatteryLevel = function(device, accessory) {
	this.log.debug("Adding Battery Level service");
	
  const service = accessory.findOrCreateService(Service.BatteryService, "Battery Level");
  const batteryLevel = service.getCharacteristic(Characteristic.BatteryLevel);
	service.getCharacteristic(Characteristic.ChargingState).updateValue(Characteristic.ChargingState.NOT_CHARGEABLE);

	device.on('batteryLevelChanged', (newVal) => {
		this.log.debug(`${accessory.displayName} battery level changed`, newVal);
		batteryLevel.updateValue(newVal.value);
	});

	// Set initial illuminance
	device.batteryLevel().then(x =>  {
		this.log.debug(`Got initial battery level for ${accessory.displayName}:`, x);
		batteryLevel.updateValue(x);
	});
}


XiaomiMiioGateway.prototype.addSwitch = function(device, accessory) {
	this.log.debug("Adding Switch service");
	
  const service = accessory.findOrCreateService(Service.StatelessProgrammableSwitch, "Click");
  const switchEvent = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

	const actionMap = {
		'click': Characteristic.ProgrammableSwitchEvent.SINGLE_PRESS,
		'double_click': Characteristic.ProgrammableSwitchEvent.DOUBLE_PRESS,
		'long_click_press': Characteristic.ProgrammableSwitchEvent.LONG_PRESS
	}
	
	device.on('action', event => {
		this.log.debug(`Button clicked. Action: ${event.action}`);
		
		if (actionMap[event.actionMap]) {
			switchEvent.setValue(actionMap[event.action]);
		} else {
			this.log.debug(`Action ${event.action} not implemented, doing nothing`);
		}
		
	});
}

XiaomiMiioGateway.prototype.addMotionSensor = function(device, accessory) {
	this.log.debug("Adding Motion Sensor service");

  const service = accessory.findOrCreateService(Service.MotionSensor, "Motion");
  const motionEvent = service.getCharacteristic(Characteristic.MotionDetected);

	device.on('movement', event => {
		this.log.debug(`Motion Detected. Event: ${event}`);
		motionEvent.updateValue(true);
	});

	device.on('inactivity', event => {
		this.log.debug(`It's over now'`);
		motionEvent.updateValue(false);
	});
}

XiaomiMiioGateway.prototype.findOrCreateAccessory = function(device, name, onInit) {
	const uuid = UUIDGen.generate(device.id);
	let accessory;

	if (this.accessories[uuid]) {
		this.log.debug("Found existing accessory with uuid ", uuid);
		accessory = this.accessories[uuid];
	} else {
		this.log.debug("Registering new acessory with uuid", uuid);
		accessory = new Accessory(`${device.miioModel || device.model} ${device.id}`, uuid);
		accessory.isNew = true;
	}

	accessory.findOrCreateService = function(service, name) {
		return this.getService(service, name) || accessory.addService(service, name);
	}
	
	accessory.hasRealServices = function() {
		return !!this.services.find(s => !(s instanceof Service.AccessoryInformation || s instanceof Service.BatteryService));
	}
	
	// update serial number and stuff
	accessory.getService(Service.AccessoryInformation)
	  .setCharacteristic(Characteristic.Manufacturer, "Xiaomi")
	  .setCharacteristic(Characteristic.Model, device.miioModel || device.model)
	  .setCharacteristic(Characteristic.SerialNumber, device.id);	

	accessory.updateReachability(true);
	return accessory;
}

// Function invoked when homebridge tries to restore cached accessory
// Developer can configure accessory at here (like setup event handler)
// Update current value
XiaomiMiioGateway.prototype.configureAccessory = function(accessory) {
	this.log.debug("Loading existing accessory", accessory.UUID);
	console.dir(accessory);
  this.accessories[accessory.UUID] = accessory;
}
