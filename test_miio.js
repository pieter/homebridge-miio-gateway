var keypress = require('keypress');
 
// make `process.stdin` begin emitting "keypress" events 
keypress(process.stdin);

const miio = require('miio');
	
async function doIt() {
	// Resolve a device, specifying the token (see below for how to get the token)
	const device = await miio.device({ address: '192.168.1.213', token: '35f04e7163788ce50c92e5eee0bb9d22' })
		// console.log('Connected to', device)
		// console.log("Children: ", device.children())
		// console.log("Done");
		const children = device.children();
		for (const child of children) {
			console.log("Child: ", child.miioModel);
			// console.dir(child);
			
			if (child.miioModel == 'lumi.switch') {
				console.log("Configuring switch...");
				
				child.on('action', event => console.log('Action', event.action, 'with data', event.data));
				
			}
			if (child.miioModel == 'lumi.plug') {
				console.log("Found the plug!");
				let isOn = await child.power();
				console.log("Is on: " + isOn);



				process.stdin.on('keypress', function (ch, key) {
				  console.log('got "keypress"', key);
				  if (key && key.name == 'enter') {
						isOn = !isOn
						child.setPower(isOn);
				    // process.stdin.pause();
				  }
				});

			}
			
			
		}
		
		
		// device.children().forEach(child => {
		// 	console.log("Found child: ", child)
		// })
}

doIt();