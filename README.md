# HomeBridge Xiaomi Gateway support through miio

This package provides support for Xiaomi Gateway and attached devices, like switches and temperature sensors, in homebridge.

There are many similar packages, like the following:

* [homebridge-mi-aqara](https://github.com/YinHangCode/homebridge-mi-aqara)
* [homebridge-mi-gateway](https://github.com/stanzhai/homebridge-mi-gateway)
* [homebridge-smarthome](https://github.com/rench/homebridge-smarthome)
* [homebridge-xiaomi-gateway](https://github.com/theo-69/homebridge-xiaomi-gateway)

### Why create another package?

Most of these plugins have their own protocol parsing logic, which can be a bit of a hit-and-miss. In my case, this didn't work because the plugins seem to either depend on multicast, or don't allow you to bind to a specific source address.

By using [miio](https://github.com/aholstenson/miio), a gateway can be configured using its IP Address and token (if necessary), which means multicast isn't required. Miio seems to be more stable than the other implementations, at least for me.

### What is suppported?

This plugin currently supports:

 * Humidity / Temperature sensors
 * Motions Sensors ('Human Body Detector' in Xiaomi-speak)
 * Switches (I tested the round one, but others should work as well)
 * Power Plugs
 * Gateway light

## Configuration

First you'll need to enable local access in the Xiaomi Mi Home app. Here's how that works on iOS:

* Select your gateway
* Go to about
* Tap a few times quickly **below** the last item. This should cause some extra menu options to show up.
* Select the second new option and toggle the switch. Hit 'save' at the bottom, then go back
* Select the third option and write down the ip address and token

Now add the plugin to your homebridge config:

```json
"platforms": [
  {
    "platform": "XiaomiMiioGateway",
    "gateways": [
      {
        "address": "192.168.1.XXX",
        "token": "0ab9152c80b94827960db8c6ef49ee39"
      }
    ]
  },
  ...
]
````

Check out the plugin locally, and start homebridge. It should show the found devices in the log. Use `homebridge -D` to get more debug output.

**Note**: right now this library depends on a few fixes required in `miio`, which is why it's not available on NPM yet.