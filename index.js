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
	const accessory = this.findOrCreateAccessory(device);
	
	let hasServices = false;
	if (device.matches('cap:actions')) {
		this.addSwitch(device, accessory);
		hasServices = true;
	} else if (device.matches('cap:temperature')) {
		this.log.debug("Found a Temperature Sensor!", device)
	} else if (device.matches('cap:motion')) {
		this.addMotionSensor(device, accessory);
		hasServices = true;
	} else if (device.matches('cap:illuminance')) {
		this.log.warn("Have illumination??");
	} else {
		this.log.warn("Found child device of unknown type", device.miioModel || device.model || device);
	}

	if (hasServices) {
		this.log.warn(`Got ${accessory.services.length} services for ${accessory.displayName}, adding it to HomeKit`);
				
		if (accessory.isNew) {
			this.log("Accessory is new, registering it with HomeBridge");
			this.api.registerPlatformAccessories("homebridge-miio-gateway", "XiaomiMiioGateway", [accessory]);
		}	
	}
}

XiaomiMiioGateway.prototype.addSwitch = function(device, accessory) {
	this.log.debug("Found a switch", device);
	
  const service = accessory.getService(Service.StatelessProgrammableSwitch, "Click") || accessory.addService(Service.StatelessProgrammableSwitch, "Click");
  const switchEvent = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

	device.on('action', event => {
		this.log.debug(`Button clicked. Action: ${event.action}`);
		// Force single press for now, since miio buttons seem unreliable
		switchEvent.setValue(0);
	});

	return accessory;
}

XiaomiMiioGateway.prototype.addMotionSensor = function(device, accessory) {
	this.log.debug("Found a Motion Sensor", device)

  const service = accessory.getService(Service.MotionSensor, "Motion") || accessory.addService(Service.MotionSensor, "Motion");
  const motionEvent = service.getCharacteristic(Characteristic.MotionDetected);

	// console.dir(motionEvent);
	for (const attr in motionEvent) {
		console.log(attr);
	}
	
	this.log.error("Current status: ", device.property('status'), device.status);
	
	device.on('movement', event => {
		this.log.debug(`Motion Detected. Event: ${event}`);
		// Force single press for now, since miio buttons seem unreliable
		motionEvent.updateValue(true);
	});

	device.on('inactivity', event => {
		this.log.debug(`It's over now'`);
		// Force single press for now, since miio buttons seem unreliable
		motionEvent.updateValue(false);
	});

	return accessory;
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
