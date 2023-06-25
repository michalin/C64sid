# MOS6581-SID-Player
 Circuit and ESP32 sketch to play with a MOS 6581 (SID) through a web interface.

## Parts Needed
 - Solderless breadboard
 - ESP32-S2-SAOLA 1 Development Board
 - MOS 6581/6580/6582 Sound Interface Device (SID)
 - Jumper wires, resistors and capacitors as shown in the [schematics](schematic/schematic.pdf)

## Software Installation
### Libraries
The libraries can be installed via Arduino IDE Library Manager.
- [ArduinoJson](https://arduinojson.org)
- [ESPAsyncWebSrv](https://github.com/dvarrel/ESPAsyncWebSrv)

Just compile and upload the sketch to the ESP32.
   

### Web Interface
Upload the [web interface](sources/data/index.html) to the SPIFFS filesystem of the ESP32 by running the batch script [spiffs.bat](sources/spiffs.bat) on the command line. The website can also be opened from any local folder on your PC. 

### Usage
Type "http://sid.local" into the address line of your browser. If you select "C64 NTSC" or "C64 PAL" in the dropdown menu on the upper left, the page shows addresses to "Peek" or "Poke" on a real Commodore 64.

