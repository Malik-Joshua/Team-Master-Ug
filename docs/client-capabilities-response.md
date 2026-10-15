# TeamMaster: Response to Your Clarifications

Thank you for the detailed clarifications. TeamMaster is designed to be the club's single, centralised platform, and the three areas you raised fit that direction. Below is where each capability stands today, what is needed to deliver the rest, and the order we recommend.

**Status key:** **Available** = working today. **Configuration** = built, needs setup for your club. **Development** = new work required.

## Where each capability stands

| Capability | Status | Notes |
|---|---|---|
| Bulk import of the player roster (Excel / CSV) | Available | Name, position, date of birth, email and jersey number. Rows are checked before import and problems are flagged. |
| Basic player profile | Available | Date of birth, phone, emergency contact, photo, position, height and weight. |
| Coaches, medical staff, team managers and admin | Available | Role-based dashboards and access. Invited staff receive an email to set their own password. |
| Performance, training and match records by season | Available | Past seasons can be viewed. This is the foundation for importing historical data. |
| In-app notification when selected for a match | Available | Delivered inside TeamMaster. |
| Email notification when selected | Configuration + Development | Email delivery is built. We add a "confirm squad" step so players are notified only once the coaches confirm it, and we need a verified club email domain. |
| Unique player identification number | Development | A permanent club-wide number, never reused, linking every record to the player for life. |
| Senior men's, senior women's and age-grade teams | Development | Players belong to a team each season, so progression through the age groups is recorded automatically. |
| Full registration profile | Development | Residential address, previous clubs, playing experience, registration details and guardian contacts. |
| Identification documents and secure uploads | Development | Private storage, with each document restricted to the right people. |
| Medical information and injury declarations | Development | Strictly limited access (for example medical staff, administrators and the player). |
| Registration and consent forms, including guardian consent for minors | Development | Different forms for different player categories, with yearly renewal. |
| Import of wider legacy records | Development | Biodata, registration, playing history and administrative records, with duplicate detection and a review step before anything is saved. |
| Coaches seeing only their own team | Development | Needed once age-grade teams exist. |

## How we would approach legacy data

Existing records are imported in reviewed batches. Likely duplicates are flagged and any batch can be undone. Imported players are marked "unverified" and show how complete their record is. Players and administrators then fill in the gaps over time, so records are consolidated progressively rather than all at once. Playing history from before TeamMaster is held as past-season summaries, so it appears alongside current seasons.

## Recommended order of delivery

1. **Foundations:** the unique player number, teams and age groups, and player records that do not depend on a login (important for minors and imported players).
2. **Match selection emails,** with the squad confirmation step.
3. **Bulk import of existing player records,** with duplicate checking.
4. **Player profiles, forms and secure document upload.**
5. **Medical information and consent forms,** including guardian consent.
6. **Historical performance import,** season rollover and team-based access.

## Information that would help us

- How many player records exist, and in what form (Excel, Google Sheets, paper)?
- Which age-grade groups do you run, and what date is used to decide a player's age group?
- Will electronic consent be accepted, or must signed copies be uploaded?
- Which identification documents are accepted, and who verifies them?
- Who should be able to view medical information?
- Who should receive notifications for players without an email address, such as minors?
- Does the club own a domain from which emails should be sent?

Medical and identification data are personal data under Uganda's Data Protection and Privacy Act. We will build in access controls and audit logging, and recommend the club confirms its consent wording and retention periods with legal advice.
