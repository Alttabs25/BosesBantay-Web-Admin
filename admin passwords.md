Summary

All four requirements are implemented and verified end-to-end:



1\. Login page — role dropdown removed; role now comes from the account itself. Added a "Nakalimutan ang Password?" link.



2\. Account creation \& role assignment — new "Mga Admin Portal Account" section in User Accounts, visible only to System Administrator: create an account (name, email, role, temp password — with a random-generator helper), reset an account's password, or delete an account. Every account starts with a temp password and mustChangePassword: true.



3\. First-time login enforcement — logging in with a temp password redirects straight to a dedicated, chrome-free "Kailangang Baguhin ang Password" screen instead of the dashboard. ProtectedRoute blocks access to the rest of the app until it's completed — verified this actually holds by creating a fresh account as Admin and immediately logging in as that new user.



4\. Password recovery — "Forgot Password" takes an email, always shows the same generic message regardless of whether it's registered (no account-enumeration leak), and only actually issues a verification code for real accounts. Entering the code + new password resets it. I simulated the "email" via a clearly-labeled demo toast showing the code, since there's no real email backend.



One consistency fix along the way: Profile's "Authority Role" field used to be freely editable by the logged-in user, which directly contradicted "System Administrators assign the specific role" — a Tanod could've typed "System Administrator" into their own profile. Made it read-only, and added real current-password verification to the voluntary password-change form there too.



For testing, since the role picker is gone, here are the seeded accounts 



**(all "password123" except the demo temp-password one)**:



captain.justine@quezoncity.gov.ph — Barangay Captain

secretary.ana@quezoncity.gov.ph — Barangay Secretary

tanod.carlo@quezoncity.gov.ph — Tanod/BPSO

lupon.rosario@quezoncity.gov.ph — Lupon Member

kagawad.miguel@quezoncity.gov.ph — Kagawad

admin.patricia@quezoncity.gov.ph — System Administrator

ramon.villanueva@quezoncity.gov.ph / PW: Barangay#2026 — demonstrates the forced first-login flow

