# Unattended monitoring operation

The published private Site is the source of truth for monitoring configuration.
Obtain fresh service access with Sites `get_site` for this project at each run; never persist the returned bearer token. Send it only to the returned live Site origin in `OAI-Sites-Authorization: Bearer ...`.
POST `/api/coop/run` with `{}`. This performs due weather checks for enabled user monitors and processes the durable delivery queue. Then GET `/api/coop/heartbeat`. Verify the heartbeat timestamp is current. Do not alter user thresholds, enable monitors, subscribe a device, redeploy, or expose credentials during routine runs. If no monitor is enabled, a run may legitimately check zero sites. Notify the user only on execution failure; actual weather alerts are sent through registered Web Push subscriptions by the server.

A task must receive the linked Site ID, resolve current access, and successfully call and read back the writer. A saved task alone is not proof of a monitoring run. The saved cadence is hourly in Asia/Taipei; this is not a safety critical sensor service.
