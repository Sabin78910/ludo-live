# Ludo Live – Play Console answers

**Play Console → Policy → App content.** These match the privacy policy section at
https://sabin78910.github.io/privacy-policy/#ludo-live and the code in `worker/src/room.ts`.

## Data safety
| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** (only when the player uses online rooms) |
| Is all user data encrypted in transit? | **Yes** (WSS/HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: room data deletes itself about 6 hours after a room empties; players can also email the contact address |

Data types to declare:

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Personal info → **Name** (the display name typed for a room; other players see it) | Yes | No | Yes (online rooms only) | App functionality |
| App activity → **Other user-generated content** (moves, emoji reactions) | Yes | No | Yes (online rooms only) | App functionality |
| Device or other IDs | **No** (the rejoin token is random per room, not a device ID) | | | |
| Location, contacts, photos, financial, health, messages, audio, files | **No** | | | |

Processing is ephemeral for room data (kept only for the life of the room). Cloudflare acts as a service provider, so
it does not count as "sharing".

## Other App content forms
| Form | Answer |
|---|---|
| Ads | **No, my app does not contain ads** |
| App access | All functionality is available without special access (no login) |
| Target audience | 13+ (13–15, 16–17, 18+). Do not select under-13 ages: online rooms let strangers see display names |
| Content rating (IARC) | Board game; no violence, sex, drugs or gambling; no real-money prizes; **users can interact: yes** (display names and emoji only, no chat); no location sharing; no purchases |
| News app | No |
| Government app | No |
| Financial features | None |
| Health | None |
| Data safety | As above |
| Privacy policy URL | https://sabin78910.github.io/privacy-policy/#ludo-live |
