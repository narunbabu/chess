● Now I have enough context. Here's the full design plan:                
                                                                                                                                                                                                                                        
  ---                                                                                                                                                                                                                                   
  Phone Verification Design Plan for Chess99                                                                                                                                                                                            
                                                                                                                                                                                                                                        
  Architecture Overview                                                                                                                                                                                                                 
                                                                
  User provides phone → Store in DB (unverified)                                                                                                                                                                                        
         ↓                                                      
  User chooses verification method:                                                                                                                                                                                                     
    A. WhatsApp click-to-verify                                 
    B. Missed call (via MSG91)                                                                                                                                                                                                          
         ↓                                
  Backend confirms → marks phone_verified_at                                                                                                                                                                                            
                                                                                                                                                                                                                                        
  ---                                     
  Database Changes (2 migrations)                                                                                                                                                                                                       
                                                                                                                                                                                                                                        
  Migration 1 — Add to users table:
  phone_number        VARCHAR(15) NULL                                                                                                                                                                                                  
  phone_country_code  VARCHAR(5)  DEFAULT '+91'                 
  phone_verified_at   TIMESTAMP   NULL         
                                                                                                                                                                                                                                        
  Migration 2 — New phone_verifications table:
  id, user_id, phone_number, method (whatsapp|missed_call),                                                                                                                                                                             
  token (6-char), expires_at (15 min), verified_at, attempts (max 3)
                                                                                                                                                                                                                                        
  ---                                                                                                                                                                                                                                   
  Backend API (new PhoneController)       
                                                                                                                                                                                                                                        
  ┌────────────────────────────────────────────┬────────────────────────────────────────────────────┐                                                                                                                                   
  │                  Endpoint                  │                      Purpose                       │                                                                                                                                   
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────┤                                                                                                                                   
  │ PUT /api/v1/user/phone                     │ Save number (strips formatting, validates pattern) │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────┤                                                                                                                                   
  │ POST /api/v1/user/phone/verify/whatsapp    │ Generate token → return wa.me link                 │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────┤                                                                                                                                   
  │ POST /api/v1/user/phone/verify/missed-call │ Trigger MSG91 missed call to user's number         │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────┤                                                                                                                                   
  │ POST /api/v1/user/phone/verify/confirm     │ OTP/token submit → mark verified                   │
  ├────────────────────────────────────────────┼────────────────────────────────────────────────────┤                                                                                                                                   
  │ POST /api/v1/webhooks/phone/missed-call    │ MSG91 webhook → auto-verify on callback            │                                                                                                                                   
  └────────────────────────────────────────────┴────────────────────────────────────────────────────┘
                                                                                                                                                                                                                                        
  ---                                                           
  Verification Method Details                                                                                                                                                                                                           
                                                                
  A. WhatsApp Click-Verify                                                                                                                                                                                                              
                                                                
  1. Backend generates token e.g. "CHESS-XK7P2"
  2. Stores in phone_verifications (expires 15 min)
  3. Returns link: https://wa.me/91XXXXXXXXXX?text=Chess99+verify+CHESS-XK7P2                                                                                                                                                           
  4. User taps → WhatsApp opens → they send the message
  5. Two options to confirm:                                                                                                                                                                                                            
     a. User manually clicks "I sent it" → we trust it (simpler, no WA Business API)                                                                                                                                                    
     b. WhatsApp Business API webhook receives message → auto-verify (needs Meta approval)                                                                                                                                              
  Recommendation: Start with option (a) — trust-based. Enough to deter bots, no API cost.                                                                                                                                               
                                                                                                                                                                                                                                        
  B. Missed Call Verify (Indian approach via MSG91)                                                                                                                                                                                     
                                                                                                                                                                                                                                        
  1. User enters their number                                                                                                                                                                                                           
  2. Backend calls MSG91 "Missed Call Verify" API → returns a unique phone number to call                                                                                                                                               
  3. Frontend shows: "Call 040-XXXXX to verify (free, auto-disconnect)"                                                                                                                                                                 
  4. User makes missed call                                     
  5. MSG91 webhook fires → backend auto-verifies                                                                                                                                                                                        
  Cost: ~₹0.20/verification. Requires MSG91 account (msg91.com).                                                                                                                                                                        
                                                                                                                                                                                                                                        
  ---                                                                                                                                                                                                                                   
  Behavioral Validation (backend + frontend)                                                                                                                                                                                            
                                                                                                                                                                                                                                        
  // Reject patterns:                                                                                                                                                                                                                   
  /^(\d)\1{9}$/       // 9999999999, 1111111111                                                                                                                                                                                         
  /^1234567890$/      // sequential                             
  /^0{10}$/           // all zeros        
  // Must be 10 digits (India) after stripping +91                                                                                                                                                                                      
  // Validate min: starts with 6-9 (valid Indian mobile)                                                                                                                                                                                
                                                                                                                                                                                                                                        
  ---                                                                                                                                                                                                                                   
  Frontend Changes                                                                                                                                                                                                                      
                                                                                                                                                                                                                                        
  1. Registration form — optional phone field below email/password:                                                                                                                                                                     
  [+91] [Phone number (optional)]                                                                                                                                                                                                       
         ↑ country code picker (simplified: +91 default)        
  "Verify later in Settings"                            
                                                                                                                                                                                                                                        
  2. Profile → new "Phone" section:       
  Phone Number                                                                                                                                                                                                                          
  [+91] [98XXXXXXXX]  [Change]                                                                                                                                                                                                          
                                                                                                                                                                                                                                        
  Verification status: ✓ Verified | ⚠ Not verified                                                                                                                                                                                      
  [Verify via WhatsApp]  [Verify via Missed Call]               
                                                                                                                                                                                                                                        
  ---                                                                                                                                                                                                                                   
  What requires an external account       
                                                                                                                                                                                                                                        
  ┌───────────────────────┬───────────────────────┬─────────────────────┬───────────────┐                                                                                                                                               
  │        Feature        │        Service        │        Cost         │    Signup     │
  ├───────────────────────┼───────────────────────┼─────────────────────┼───────────────┤                                                                                                                                               
  │ Missed call verify    │ MSG91 / Exotel        │ ~₹0.20/call         │ msg91.com     │
  ├───────────────────────┼───────────────────────┼─────────────────────┼───────────────┤                                                                                                                                               
  │ Auto WhatsApp confirm │ WhatsApp Business API │ Free tier available │ Meta Business │
  ├───────────────────────┼───────────────────────┼─────────────────────┼───────────────┤
  │ Trust-based WhatsApp  │ None                  │ Free                │ —             │
  └───────────────────────┴───────────────────────┴─────────────────────┴───────────────┘                                                                                                                                               
                                                                                                                                                                                                                                        
  My recommendation: Implement Phase 1 now (phone storage + WhatsApp trust-based + behavioral validation). Add MSG91 missed call later once you have the account.                                                                       
                                                                                                                                                                                                                                        
  ---                                                           
  Ready to implement? Confirm and I'll start with:                                                                                                                                                                                      
  1. Migration files                          
  2. PhoneController + routes                                                                                                                                                                                                           
  3. Registration form update                                   
  4. Profile page phone section + PhoneVerificationModal                                                                                                                                                                                
                                                        
  Do you have a MSG91 account yet, or should I implement WhatsApp-only for now?   