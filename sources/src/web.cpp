/* Copyright (C) 2020  Doctor Volt
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

//#define LOCAL_WEB //Website located on PC

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#ifndef LOCAL_WEB
#include <SPIFFS.h>
#endif
#include <mdns.h>
//#include <AsyncElegantOTA.h>

// Replace with your network credentials
const char *hostname = "sid.local";

void handleWebMessage(const char *data, size_t len);

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");
//AsyncEventSource es("/es");

void onEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type,
             void *arg, uint8_t *data, size_t len)
{
  switch (type)
  {
  case WS_EVT_CONNECT:
    Serial.printf("WebSocket client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    break;
  case WS_EVT_DISCONNECT:
    Serial.printf("WebSocket client #%u disconnected\n", client->id());
    break;
  case WS_EVT_DATA:
    // handleWebSocketMessage(arg, data, len);
    {
      AwsFrameInfo *info = (AwsFrameInfo *)arg;
      if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT)
      {
        handleWebMessage((const char *)data, len); 
      }
    }
    break;
  case WS_EVT_PONG:
    Serial.println("WebSocket Pong:");
  case WS_EVT_ERROR:
    Serial.println("WebSocket Error");
  }
}

void web_init(const char *ssid, const char *password)
{
  // Serial port for debugging purposes

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    Serial.print(".");
    delay(500);
  }
  // Print ESP Local IP Address
  Serial.println();
  Serial.println("WiFi Connected");

  // Assign DNS name
  mdns_init();
  mdns_hostname_set(hostname);

  ws.onEvent(onEvent);
  server.addHandler(&ws);

  // Initialize SPIFFS
  #ifndef LOCAL_WEB
  Serial.printf("Open http://%s in browser\r\n", hostname);
  if (!SPIFFS.begin(true))
  {
    Serial.println("An Error has occurred while mounting SPIFFS");
    return;
  }
  server.serveStatic("/", SPIFFS, "/").setDefaultFile("index.html");
  #endif

  /*Event source initialization*/
  /*es.onConnect([](AsyncEventSourceClient *client)
               {
    Serial.println("es.onConnect");
    if(client->lastId()){
      Serial.printf("Event Client reconnected! Last message ID: %u\n", client->lastId());
    }
    if(client->connected()){
      Serial.println("Event source connected");

    } });
*/
  // CORS Magic to allow access to event server from anywhere
  DefaultHeaders::Instance().addHeader(F("Access-Control-Allow-Origin"), F("*"));
  // DefaultHeaders::Instance().addHeader(F("Access-Control-Allow-Headers"), F("content-type"));
  // Start server
  server.begin();
  //server.addHandler(&es);
  // AsyncElegantOTA.begin(&server);
}

void web_write_event(const char *data)
{
  // ws.textAll((const char*)buffer, len);
  //es.send(data);
}

void web_write(const char *data)
{
  ws.textAll(data);
  // es.send(data, NULL);
}

void web_cleanup()
{
  ws.cleanupClients();
}
