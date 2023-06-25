/* Copyright (C) 2023  Doctor Volt

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program.  If not, see <https://www.gnu.org/licenses></https:>.
*/

#include <ArduinoJson.h>
#include <driver/dedic_gpio.h>

// Commands received from Web UI
#define CMD_READ_REGS 40
#define CMD_RESET 41
#define CMD_EFFECTS 42
#define EFFECT_WAVE 1
#define EFFECT_ENV 2

void web_init(const char *ssid, const char *password);
void web_write(const char *data);

const uint8_t data_pins[] = {1, 2, 3, 4, 5, 6, 7, 8};
const uint8_t addr_pins[] = {9, 10, 11, 12, 13};
const uint8_t reset_pin = 14;
const uint8_t clk_pin = 15;
const uint8_t rw_pin = 16;
const uint8_t csel_pin = 17;

SemaphoreHandle_t regRWsemaphore = xSemaphoreCreateBinary();
TaskHandle_t effect_taskHdl = NULL;
struct effect_task_params
{
    int effect;
    int strength;
    int reg1;
} effectTaskParams;

//    ESP_ERROR_CHECK(dedic_gpio_new_bundle(&addr_gpio_config, &sid_addr));
void bulk_write(const uint8_t *pins, uint8_t data, uint8_t len)
{
    for (uint8_t i = 0; i < len; i++)
    {
        digitalWrite(pins[i], bitRead(data, i));
    }
}

uint8_t bulk_read(const uint8_t *pins)
{
    uint8_t rdval = 0;
    for (uint8_t i; i < 8; i++)
    {
        rdval += digitalRead(pins[i]) << i;
    }
    return rdval;
}

void reg_write(uint8_t regnum, uint8_t regval)
{
    // Serial.printf("-->reg_write(register: %d, value: %d\n", regnum, regval);
    xSemaphoreTake(regRWsemaphore, 1000);
    for (uint8_t i = 0; i < 8; i++)
        pinMode(data_pins[i], OUTPUT);
    bulk_write(data_pins, regval, 8); // sizeof(data_pins));
    bulk_write(addr_pins, regnum, 5); // sizeof(addr_pins));
    digitalWrite(rw_pin, LOW);
    digitalWrite(csel_pin, LOW);
    delayMicroseconds(100); // Write register
    digitalWrite(csel_pin, HIGH);
    digitalWrite(rw_pin, HIGH);
    for (uint8_t i = 0; i < 8; i++)
        pinMode(data_pins[i], INPUT);
    xSemaphoreGive(regRWsemaphore);
}

uint8_t reg_read(uint8_t regnum)
{
    xSemaphoreTake(regRWsemaphore, 1000);
    bulk_write(addr_pins, regnum, sizeof(addr_pins));
    digitalWrite(rw_pin, HIGH);
    digitalWrite(csel_pin, LOW);
    uint8_t rdval = bulk_read(data_pins);
    digitalWrite(csel_pin, HIGH);
    //  Serial.printf("-->reg_read(register: %d) = %d\n", regnum, rdval);
    xSemaphoreGive(regRWsemaphore);
    return rdval;
}

void setup()
{
    Serial.begin(115200);
    web_init("hausnetz", "FFm30cmg?");

    for (uint8_t i = 0; i < 8; i++)
        pinMode(data_pins[i], INPUT);
    for (uint8_t i = 0; i < 5; i++)
        pinMode(addr_pins[i], OUTPUT);
    pinMode(csel_pin, OUTPUT);
    digitalWrite(csel_pin, HIGH); // Chip not selected
    pinMode(rw_pin, OUTPUT);
    digitalWrite(rw_pin, HIGH);
    pinMode(reset_pin, OUTPUT);
    digitalWrite(reset_pin, HIGH); // Reset SID
    ledcSetup(0, 1000000, 4);      // 1 MHz clock signal
    ledcAttachPin(clk_pin, 0);
    ledcWrite(0, 8);
    //xSemaphoreGive(regRWsemaphore);
    xTaskCreate([](void *f)
                {
            effect_task_params *tp = (effect_task_params*) f;
            int r;
            while(1){
                r = tp->effect == EFFECT_WAVE ? 27 : 28;
                int f = 256*tp->reg1 + tp->strength * tp->reg1/32 * reg_read(r);
                reg_write(0, f & 0xFF);
                reg_write(1, (f >> 8));
            } },
                "fm", 10000, (void *)&effectTaskParams, 1, &effect_taskHdl);
    vTaskSuspend(effect_taskHdl);
}

void handleWebMessage(const char *data, size_t len)
{
    // Serial.printf("-->handleWebMessage(*data=%s, len=%d\n", data, len);
    static int reg1;
    DynamicJsonDocument jdoc(200);
    deserializeJson(jdoc, data);
    if (jdoc["regnum"] == 1)
        effectTaskParams.reg1 = jdoc["value"];

    if (jdoc["regnum"] < 25) // Write register
    {
        reg_write((int)jdoc["regnum"], (int)jdoc["value"]);
        delay(10);
        return;
    }

    switch ((int)jdoc["regnum"]) // Command
    {
    case CMD_READ_REGS:
    {
        JsonArray jarray = jdoc.to<JsonArray>();
        for (uint8_t reg = 25; reg <= 28; reg++)
        {
            jarray.add(reg_read(reg));
            delay(10);
        }
        web_write(jdoc.as<String>().c_str());
    }
    break;
    case CMD_RESET:
        Serial.println("reset");
        if(effect_taskHdl)
            vTaskSuspend(effect_taskHdl);
        digitalWrite(reset_pin, LOW);
        delay(10);
        digitalWrite(reset_pin, HIGH);
        break;
    case CMD_EFFECTS:
        Serial.println(jdoc["value"].as<String>().c_str());
        effectTaskParams.effect = jdoc["value"]["effect"];
        effectTaskParams.strength = jdoc["value"]["strength"];
        if (effectTaskParams.effect)
            vTaskResume(effect_taskHdl);
        else
            vTaskSuspend(effect_taskHdl);

    } // switch
} // handleWebMessage

uint8_t val;
void loop()
{
    // Serial.printf("AD1: %d\n", reg_read(25));
    // delay(1000);
}
