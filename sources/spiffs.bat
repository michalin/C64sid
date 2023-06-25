@echo off
setlocal

set PORT=COM3
set MKSPIFFS_VER=0.2.3
set ESPTOOL_VER=4.5.1
set ESP=esp32-S2
set BAUD=921600
set ESPTOOLDIR=%LOCALAPPDATA%\Arduino15\packages\esp32\tools
set MKSPIFFS="%ESPTOOLDIR%\mkspiffs\%MKSPIFFS_VER%\mkspiffs.exe"
set ESPTOOL="%ESPTOOLDIR%\esptool_py\%ESPTOOL_VER%\esptool.exe"

REM Values from %LOCALAPPDATA%\Arduino15\packages\esp32\hardware\esp32\<version>\tools\partitions\default.csv
REM Using default partition scheme 
set OFFSET=0x290000
set SIZE=0x160000

%MKSPIFFS% -c data spiffs.bin -s %SIZE%
%ESPTOOL% --chip %ESP% --port %PORT% --baud %BAUD% write_flash -z %OFFSET% spiffs.bin
del spiffs.bin
endlocal
