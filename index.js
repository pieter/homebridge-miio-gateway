const miio = require('miio');
let Accessory, Service, Characteristic, UUIDGen;

const abstractHomekit = require('./abstract-homekit');
const DEFAULT_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

module.exports = function(homebridge) {
  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

	abstractHomekit.init(Service, Characteristic, this.log);
	
  // register platform in to homebridge
  homebridge.registerPlatform("homebridge-miio-gateway", "XiaomiMiioGateway", XiaomiMiioGateway, true);
}

function XiaomiMiioGateway(log, config, api) {
  log("Setting up Miio platform");
	abstractHomekit.setLog(log);
	
  this.log = log;
  this.config = config || {};
	this.config.pollInterval = this.config.pollInterval || DEFAULT_POLL_INTERVAL;
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
	const accessory = this.addConnectedDevice(device);

	for (const child of device.children()) {
		this.addConnectedDevice(child);
	}
	
	// Set up regular polling, since otherwise the gateway might time out
	this.log.debug("Polling with interval", this.config.pollInterval);
	setInterval(() =>
		device.poll()
			.then(() => accessory.updateReachability(true))
			.catch(er => {
				this.log.warn("Device did not respond to poll", er);
				accessory.updateReachability(false);
			})
		, this.config.pollInterval);
}

XiaomiMiioGateway.prototype.addConnectedDevice = function(device) {
	this.log.debug("Found a device", device);
	
	const accessory = this.findOrCreateAccessory(device);
	abstractHomekit.decorateAccessory(accessory, device);
		
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
