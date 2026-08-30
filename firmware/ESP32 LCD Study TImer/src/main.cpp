#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>
#include <SPIFFS.h>
#include <Preferences.h>
#include "time.h"

// ---------------- LCD ----------------
LiquidCrystal_I2C lcd(0x27,16,2);

// Buttons
const int scrollButton = 27;
const int startPauseButton = 12;
const int stopButton = 14;

// Subjects
const char* subjects[] = {"Physics","Chem","Maths"};
int subjectIndex = 0;

// Timer vars
bool timerRunning = false;
unsigned long startTime = 0;
unsigned long elapsedTime = 0;
unsigned long totalTime[3] = {0,0,0};

// Backlight state
bool backlightOn = true;
unsigned long backlightTimeout = 5UL * 60UL * 1000UL; // 5 minutes in ms
unsigned long lastActivity = 0;
// Prevent rapid on/off toggles from simultaneous button presses
unsigned long lastBacklightToggle = 0;
const unsigned long backlightToggleDebounce = 500UL; // ms
// Long-press handling for Stop button
unsigned long stopLongPressStart = 0;
bool stopLongPressHandled = false;
const unsigned long stopLongPressMs = 1200UL;

// Preferences for persistence
Preferences prefs;

// ---------------- Wi-Fi / NTP ----------------
const char* ssid = "Airtel_Ashu";
const char* password = "28082005";
IPAddress local_IP(192,168,1,51);
IPAddress gateway(192,168,1,1);
IPAddress subnet(255,255,255,0);
IPAddress primaryDNS(8,8,8,8);
IPAddress secondaryDNS(8,8,4,4);

WebServer server(80);

// NTP
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 19800;
const int   daylightOffset_sec = 0;

// ---------------- Debounce Helper ----------------
const unsigned long debounceDelay = 80;   // ms, good value for tact switches

bool buttonPressed(int pin) {
  // store state per pin
  static bool lastState[40];
  static unsigned long lastChange[40];

  bool reading = (digitalRead(pin) == LOW);       // active LOW
  unsigned long now = millis();

  if (reading != lastState[pin] && (now - lastChange[pin] > debounceDelay)) {
    lastChange[pin] = now;
    lastState[pin] = reading;
    if (reading) return true;                     // register only on press
  }
  return false;
}

// ---------------- Helpers ----------------
String formatTime(unsigned long ms) {
  unsigned long sec = ms / 1000;
  unsigned h = sec / 3600;
  unsigned m = (sec % 3600) / 60;
  unsigned s = sec % 60;

  char buf[9];
  sprintf(buf,"%02u:%02u:%02u",h,m,s);
  return String(buf);
}

void showSubjectScreen() {
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print(subjects[subjectIndex]);
  lcd.setCursor(8,0);
  lcd.print("00:00:00");
  lcd.setCursor(0,1);
  lcd.print("Total");
  lcd.setCursor(8,1);
  lcd.print(formatTime(totalTime[subjectIndex]));
}

void updateSessionTimer() {
  elapsedTime = millis() - startTime;
  lcd.setCursor(8,0);
  lcd.print(formatTime(elapsedTime));
}

void updateTotalTime() {
  lcd.setCursor(8,1);
  lcd.print(formatTime(totalTime[subjectIndex]));
}

// ---------------- Logging ----------------
void saveTotals() {
  prefs.begin("study", false);
  prefs.putULong("phy", totalTime[0]);
  prefs.putULong("chem", totalTime[1]);
  prefs.putULong("math", totalTime[2]);
  prefs.end();
}

void loadTotals() {
  prefs.begin("study", false);
  totalTime[0] = prefs.getULong("phy",0);
  totalTime[1] = prefs.getULong("chem",0);
  totalTime[2] = prefs.getULong("math",0);
  prefs.end();
}

void appendDailyLog() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)) return;

  char datetimeStr[20];
  strftime(datetimeStr,sizeof(datetimeStr),"%Y-%m-%d %H:%M",&timeinfo);

  unsigned long pcm = totalTime[0]+totalTime[1]+totalTime[2];

  File f = SPIFFS.open("/logs.csv","a");
  if(f){
    f.printf("%s,%s,%s,%s,%s\n",
      datetimeStr,
      formatTime(totalTime[0]).c_str(),
      formatTime(totalTime[1]).c_str(),
      formatTime(totalTime[2]).c_str(),
      formatTime(pcm).c_str());
    f.close();
  }

  totalTime[0]=totalTime[1]=totalTime[2]=0;
  saveTotals();
}

// ---------------- Web ----------------
// Removed JSON assembly: this device stores/serves CSV logs directly.
// The web endpoint `/data` now serves the `/logs.csv` file (CSV) instead of building JSON.

// (NEW) Upload helpers
File uploadFile;
String uploadResultMessage = "No upload";

// (NEW) Merge uploaded CSV (append only new datetime rows)
String processUploadedLogs(const char* path) {
  int added = 0, skipped = 0;
  // Collect existing datetimes
  File existing = SPIFFS.open("/logs.csv","r");
  String existingDates = "|";
  if(existing){
    while(existing.available()){
      String line = existing.readStringUntil('\n');
      line.trim();
      if(line.length()==0 || line.startsWith("Date & Time")) continue;
      int c = line.indexOf(',');
      if(c>0){
        existingDates += line.substring(0,c) + "|";
      }
    }
    existing.close();
  }
  File up = SPIFFS.open(path,"r");
  if(!up) return "Upload read error";
  File out = SPIFFS.open("/logs.csv","a");
  if(!out){ up.close(); return "Append open error"; }
  while(up.available()){
    String line = up.readStringUntil('\n');
    line.trim();
    if(line.length()==0 || line.startsWith("Date & Time")) continue;
    int commaCount = 0;
    for(size_t i=0;i<line.length();++i) if(line.charAt(i)==',') commaCount++;
    if(commaCount != 4){ skipped++; continue; }
    int c = line.indexOf(',');
    if(c<=0){ skipped++; continue; }
    String datetime = line.substring(0,c);
    if(existingDates.indexOf("|"+datetime+"|") != -1){
      skipped++; continue;
    }
    out.println(line);
    existingDates += datetime + "|";
    added++;
  }
  up.close();
  out.close();
  char buf[64];
  snprintf(buf,sizeof(buf),"Imported: %d, skipped: %d", added, skipped);
  return String(buf);
}

// ---------------- Setup ----------------
void setup() {
#if defined(ARDUINO_XIAO_ESP32C3)
  Wire.begin(4,5);
#else
  Wire.begin();
#endif
  lcd.init();
  // Start with backlight ON by default
  lcd.backlight();
  backlightOn = true;
  lastActivity = millis();

  pinMode(scrollButton,INPUT_PULLUP);
  pinMode(startPauseButton,INPUT_PULLUP);
  pinMode(stopButton,INPUT_PULLUP);

  Serial.begin(115200);

  if(!SPIFFS.begin(true)) Serial.println("SPIFFS mount failed");

  if(!SPIFFS.exists("/logs.csv") || SPIFFS.open("/logs.csv","r").size()==0){
    File f = SPIFFS.open("/logs.csv","w");
    if(f){
      f.println("Date & Time,Physics,Chemistry,Math,PCM Total");
      f.close();
    }
  }

  loadTotals();

  if(!WiFi.config(local_IP,gateway,subnet,primaryDNS,secondaryDNS))
    Serial.println("Static IP failed");
  WiFi.begin(ssid,password);
  while(WiFi.status()!=WL_CONNECTED){delay(500); Serial.print(".");}
  Serial.println("\nConnected to Wi-Fi");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);

  // ...existing code setting up server. Keep existing routes.
  server.serveStatic("/",SPIFFS,"/index.html");
  server.serveStatic("/script.js",SPIFFS,"/script.js");
  server.serveStatic("/style.css",SPIFFS,"/style.css");
  server.serveStatic("/logs.csv", SPIFFS, "/logs.csv");
  // Serve CSV data directly. The front-end should request /data to get CSV (same as /logs.csv).
  server.serveStatic("/data", SPIFFS, "/logs.csv");
  server.on("/lognow",HTTP_GET,[](){ appendDailyLog(); server.send(200,"text/plain","OK"); });

  server.on("/clearlogs", HTTP_GET, []() {
    if(SPIFFS.exists("/logs.csv")) SPIFFS.remove("/logs.csv");
    File f = SPIFFS.open("/logs.csv", "w");
    if(f){
        f.println("Date & Time,Physics,Chemistry,Math,PCM Total");
        f.close();
    }
    Preferences prefs;
    prefs.begin("study", false);
    prefs.putULong("phy", 0);
    prefs.putULong("chem", 0);
    prefs.putULong("math", 0);
    prefs.end();

    totalTime[0]=totalTime[1]=totalTime[2]=0;
    elapsedTime=0;
    showSubjectScreen();

    server.send(200, "text/plain", "✅ All logs cleared!");
  });

  // (NEW) Upload route (multipart form-data)
  server.on("/uploadlogs", HTTP_POST,
    [](){ server.send(200,"text/plain", uploadResultMessage); },
    [](){
      HTTPUpload &up = server.upload();
      if(up.status == UPLOAD_FILE_START){
        uploadResultMessage = "Processing...";
        if(SPIFFS.exists("/upload_tmp.csv")) SPIFFS.remove("/upload_tmp.csv");
        uploadFile = SPIFFS.open("/upload_tmp.csv","w");
      } else if(up.status == UPLOAD_FILE_WRITE){
        if(uploadFile) uploadFile.write(up.buf, up.currentSize);
      } else if(up.status == UPLOAD_FILE_END){
        if(uploadFile) uploadFile.close();
        uploadResultMessage = processUploadedLogs("/upload_tmp.csv");
        SPIFFS.remove("/upload_tmp.csv");
      } else if(up.status == UPLOAD_FILE_ABORTED){
        if(uploadFile) { uploadFile.close(); SPIFFS.remove("/upload_tmp.csv"); }
        uploadResultMessage = "Upload aborted";
      }
    }
  );

  // Serve target and allow setting it (simple endpoints)
  server.on("/target", HTTP_GET, [](){
    prefs.begin("study", true);
    unsigned long t = prefs.getULong("targ", 0);
    prefs.end();
    String json = "{";
    json += "\"target_secs\":" + String(t) + ",";
    json += "\"target\":\"" + formatTime(t) + "\"";
    json += "}";
    server.send(200, "application/json", json);
  });

  // Simple setter: /settarget?secs=NN
  server.on("/settarget", HTTP_GET, [](){
    if(!server.hasArg("secs")){
      server.send(400, "text/plain", "Missing secs");
      return;
    }
    unsigned long s = (unsigned long) atol(server.arg("secs").c_str());
    prefs.begin("study", false);
    prefs.putULong("targ", s);
    prefs.end();
    server.send(200, "text/plain", "OK");
  });

  // Weekly target endpoints: /weektarget and /setweektarget
  server.on("/weektarget", HTTP_GET, [](){
    prefs.begin("study", true);
    unsigned long t = prefs.getULong("targ_week", 0);
    prefs.end();
    String json = "{";
    json += "\"target_secs\":" + String(t) + ",";
    json += "\"target\":\"" + formatTime(t) + "\"";
    json += "}";
    server.send(200, "application/json", json);
  });

  server.on("/setweektarget", HTTP_GET, [](){
    if(!server.hasArg("secs")){
      server.send(400, "text/plain", "Missing secs");
      return;
    }
    unsigned long s = (unsigned long) atol(server.arg("secs").c_str());
    prefs.begin("study", false);
    prefs.putULong("targ_week", s);
    prefs.end();
    server.send(200, "text/plain", "OK");
  });

  server.begin();
  showSubjectScreen();
}

// ---------------- Loop ----------------
void loop() {
  server.handleClient();

  // Subject scroll (only when timer is not running)
  if (!timerRunning && buttonPressed(scrollButton)) {
    subjectIndex = (subjectIndex + 1) % 3;
    elapsedTime = 0;
    lastActivity = millis();
    showSubjectScreen();
  }

  // Simultaneous Start+Stop -> force backlight off (short-press combo)
  // (removed) simultaneous Start+Stop backlight toggle - not used

  // Start / Pause
  if (buttonPressed(startPauseButton)) {
    lastActivity = millis();
    if (!timerRunning) {
      // starting the timer: ensure backlight is on
      startTime = millis() - elapsedTime;
      timerRunning = true;
      if (!backlightOn) {
        backlightOn = true;
        lcd.backlight();
      }
    } else {
      // pausing the timer: turn backlight off
      // pause timer (do not change backlight on pause)
      elapsedTime = millis() - startTime;
      timerRunning = false;
    }
  }

  // Stop
  // Stop short-press handling (record session time)
  if (buttonPressed(stopButton)) {
    // short press: behave as Stop (record elapsed time)
    if (timerRunning) {
      elapsedTime = millis() - startTime;
      timerRunning = false;
    }
    totalTime[subjectIndex] += elapsedTime;
    elapsedTime = 0;
    saveTotals();
    showSubjectScreen();
  }

  // Long-press Stop -> toggle backlight (handled separately so holding Stop toggles backlight)
  int stopState = digitalRead(stopButton);
  unsigned long now = millis();
  if (stopState == LOW) {
    if (stopLongPressStart == 0) stopLongPressStart = now;
    else if (!stopLongPressHandled && (now - stopLongPressStart >= stopLongPressMs)) {
      if (now - lastBacklightToggle > backlightToggleDebounce) {
        backlightOn = !backlightOn;
        if (backlightOn) lcd.backlight(); else lcd.noBacklight();
        lastBacklightToggle = now;
      }
      stopLongPressHandled = true;
    }
  } else {
    // released
    stopLongPressStart = 0;
    stopLongPressHandled = false;
  }

  // Update LCD
  if (timerRunning) updateSessionTimer();
  updateTotalTime();

  // (removed) auto-turn-off backlight after inactivity - backlight is controlled only by long-press

  // Daily logging at 2 AM
  struct tm timeinfo;
  if(getLocalTime(&timeinfo)){
    static int lastDay=-1;
    if(timeinfo.tm_hour==2 && lastDay!=timeinfo.tm_mday){
      appendDailyLog();
      lastDay=timeinfo.tm_mday;
    }
  }

  delay(5);     // short sleep to avoid busy-loop
}
