/*
 * LIVE PLANTING - Arduino Sketch
 * 
 * Sensori:
 * - A1: Sensore umidità capacitivo (analogico)
 * - A2: Sensore bioelettrico (analogico)
 * 
 * Output: Dati seriali formato CSV "umidita_raw,bio_raw"
 */

const uint8_t PIN_UMIDITA = A1;
const uint8_t PIN_BIO     = A2;

// LED per feedback visivo
const uint8_t LED_PIN = LED_BUILTIN;

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  
  // Messaggio iniziale (attendi 2 sec per apertura Serial Monitor)
  delay(2000);
  Serial.println("# LIVE PLANTING - Arduino Ready");
  Serial.println("# Sensori: A1=Umidita, A2=Bio");
  Serial.println("# Format: umidita_raw,bio_raw");
  delay(500);
}

void loop() {
  // Leggi umidità (media di 5 letture per ridurre rumore)
  long umidita_sum = 0;
  for(int i = 0; i < 5; i++) {
    umidita_sum += analogRead(PIN_UMIDITA);
    delay(2);
  }
  int umidita = umidita_sum / 5;
  
  // Leggi bio (media di 5 letture)
  long bio_sum = 0;
  for(int i = 0; i < 5; i++) {
    bio_sum += analogRead(PIN_BIO);
    delay(2);
  }
  int bio_raw = bio_sum / 5;
  
  // Validazione base: se entrambi sono fuori range, lampeggia LED
  bool umidita_valid = (umidita >= 100 && umidita <= 950);
  bool bio_valid = (bio_raw >= 50 && bio_raw <= 1000);
  
  // Invia dati (SOLO valori numerici, nessun testo extra)
  Serial.print(umidita);
  Serial.print(",");
  Serial.println(bio_raw);
  
  // Feedback LED: lampeggia veloce se dati invalidi
  if (!umidita_valid || !bio_valid) {
    digitalWrite(LED_PIN, HIGH);
    delay(20);
    digitalWrite(LED_PIN, LOW);
  } else {
    // Lampeggio lento se tutto OK
    if (millis() % 2000 < 100) {
      digitalWrite(LED_PIN, HIGH);
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }
  
  // Frequenza campionamento: 20 Hz (50ms totale tra letture e delay)
  delay(20);
}
