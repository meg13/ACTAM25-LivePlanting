/*
 * LIVE PLANTING - Arduino Sketch
 * 
 * Sensors:
 * - A1: capacitive soil moisture sensor (analogico)
 * - A2: bioelectrical sensor (analogico)
 * 
 * Output: serial data in CSV format "umidita_raw,bio_raw"
 */

const uint8_t PIN_UMIDITA = A1;
const uint8_t PIN_BIO     = A2;

// LED for visual feedback
const uint8_t LED_PIN = LED_BUILTIN;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  
  // Initial message (wait 2 sec for Serial Monitor to open)
  delay(2000);
  Serial.println("# LIVE PLANTING - Arduino Ready");
  Serial.println("# Sensori: A1=Umidita, A2=Bio");
  Serial.println("# Format: umidita_raw,bio_raw");
  delay(500);
}

void loop() {
  // Read humidity (average of 5 readings to reduce noise)
  long umidita_sum = 0;
  for(int i = 0; i < 5; i++) {
    umidita_sum += analogRead(PIN_UMIDITA);
    delay(2);
  }
  int umidita = umidita_sum / 5;
  
  // Read bio (average of 5 readings)
  long bio_sum = 0;
  for(int i = 0; i < 5; i++) {
    bio_sum += analogRead(PIN_BIO);
    delay(2);
  }
  int bio_raw = bio_sum / 5;
  
  // Basic validation: if both are out of range, blink LED
  bool umidita_valid = (umidita >= 100 && umidita <= 950);
  bool bio_valid = (bio_raw >= 50 && bio_raw <= 1000);
  
  // Send data
  Serial.print(umidita);
  Serial.print(",");
  Serial.println(bio_raw);
  
  // Feedback LED: Blink fast if invalid data
  if (!umidita_valid || !bio_valid) {
    digitalWrite(LED_PIN, HIGH);
    delay(20);
    digitalWrite(LED_PIN, LOW);
  } else {
    // Blink slow if valid data
    if (millis() % 2000 < 100) {
      digitalWrite(LED_PIN, HIGH);
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }

  // Sampling frequency: 20 Hz (50ms total between readings and delay)
  delay(20);
}
