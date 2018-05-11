const { color } = require('abstract-things/values');

let Service, Characteristic, log;

exports.createGatewayLight = function createGatewayLight(device, accessory, switchPower, _service, _characteristic, _log) {
	// Hacky
	Service = _service;
	Characteristic = _characteristic;
	log = _log;
	
  const service = accessory.findOrCreateService(Service.Lightbulb, "Light");
	if (device.matches('cap:brightness', 'cap:dimmable')) {
		addBrightnessControls(device, service);
	} else {
		switchPower(service.getCharacteristic(Characteristic.On), device);
	}
	
	if (device.matches('cap:colorable')) {
		addColorControls(device, service);
	}
}

function addBrightnessControls(device, service) {
	const brightness = service.getCharacteristic(Characteristic.Brightness);
  const onState = service.getCharacteristic(Characteristic.On);

	let currentBrightness = 50;

	// Complicated logic here -- we need to sync both the power state
	// and the brightness...
	onState.on('get', async (cb) => {
		cb(null, (await device.brightness()) > 0);
	});

	onState.on('set', async (val, cb) => {
		log.debug("Setting ON state to:", val);
		if (val == true) {
			await device.brightness('' + currentBrightness);
		} else {
			await device.power(false);
		}

		cb();
	});

	brightness.on('get', (cb) => {
		cb(null, currentBrightness);
	});

	brightness.on('set', async (val, cb) => {
		log.debug(`Setting brightness to:`, val);
		currentBrightness = val;
		await device.brightness('' + val);
		cb();
	});

	function updateBrightness(bVal) {
		log.debug(`Received new brightness:`, bVal);
		if (bVal == 0) { 
			log.debug("Turning off light, brightness is 0");
			onState.updateValue(false);
			return;
		}
		
		currentBrightness = bVal;
		brightness.updateValue(bVal);
	}
	device.on('brightnessChanged', updateBrightness);
	device.brightness().then(bVal => {
		currentBrightness = bVal;
		brightness.updateValue(bVal);
	})
}

function addColorControls(device, service) {
	const hueState = service.getCharacteristic(Characteristic.Hue);
	const satState = service.getCharacteristic(Characteristic.Saturation);
	
	// We store the hue and sat because they come in
	// concurrently (looks like the callback here is ignored?)
	// So we schedule a single update function to update both at once.
	let desiredHue, desiredSat, colorUpdate;	
	hueState.on('set', async (val, cb) => {
		desiredHue = val;
		
		if (!colorUpdate) {
			colorUpdate = setTimeout(updateColor, 0);
		}
		cb();
	});

	satState.on('set', async (val, cb) => {
		desiredSat = val;

		if (!colorUpdate) {
			colorUpdate = setTimeout(updateColor, 0);
		}
		cb();			
	})

	async function updateColor() {
		let currentColor = (await device.color()).hsl;
		log.debug("Current color:", currentColor);

		const newColor = color.hsl(desiredHue || currentColor.hue, desiredSat || currentColor.saturation, 50);
		log.debug("New color: ", newColor, newColor.rgb);
		
		await device.color(newColor.rgb);
		
		desiredSat = desiredHue = colorUpdate = null;
	}
}