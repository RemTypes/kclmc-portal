# KCLMC Platform

The official digital infrastructure and operations platform for King's College London Mountaineering Club (KCLMC), managing climbing passes, roster reconciliation, and safety compliance.

## Language

**Climber**:
An authenticated university student or associate affiliated with KCLMC.
_Avoid_: User, account, customer, client

**Climbing Pass**:
A digital membership credential with dynamic verification QR code unlocking climbing wall discounts and society meets.
_Avoid_: Card, badge, ticket, membership card

**Recreational Member**:
A climber registered for full indoor and outdoor climbing activities, covered by mandatory British Mountaineering Council (BMC) club liability insurance.
_Avoid_: Full member, active member, standard member

**Social Member**:
An entry-level climber registered exclusively for indoor bouldering sessions without outdoor trip eligibility or BMC liability insurance.
_Avoid_: Boulderer, casual member

**Committee Member**:
An elected society officer with administrative privileges (Role ≥ 1) subject to mandatory two-factor authentication (2FA).
_Avoid_: Admin, staff, moderator

**2FA Challenge**:
A short-lived, cryptographically sealed state token containing pending session credentials awaiting TOTP or backup code verification before a full session is activated.
_Avoid_: OTP token, pending auth, login code

**KCLSU Roster**:
The official student union registry of paid society members used to reconcile and activate digital climbing passes.
_Avoid_: Purchase list, membership sheet, buyers list

**Safety Gate**:
The compulsory duty-of-care verification step requiring emergency contacts and mobile phone numbers before a climbing pass unlocks.
_Avoid_: Safety form, onboarding gate, profile check
