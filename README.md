# 🚽 The Throne · 20 Shore Breeze

The toilet queue for the house. **Book it, sit it, flush it.**

Pick who you are (Sepehr, Dorsa, Rana, Mo, Mahyar, Parsa), then:

- **I'm going in! 🏃**: claim the throne when it's free
- **Book my spot 🎟️**: join the line while someone's in there
- **I'm done! Flush 🧻**: free it up; the next person in line gets pinged
- **Cut the line 😈**: allowed, but it goes on your record
- **Forgot to flush?**: anyone can mark it free if someone forgot to check out

When it's your turn, the page chimes, vibrates and shows a notification. The next person in line gets 5 minutes to claim it before it's first come, first served. A session that's been going for an hour gets auto-freed. Throne Awards and the log cover the last 12 hours.

## How it works

A static site with no backend or database of its own. Every button press posts one message to a [ntfy.sh](https://ntfy.sh) topic, and every phone replays that topic through the same rules (`state.js`), so everyone sees the same queue. Updates arrive live over Server-Sent Events.

Push alerts with the app closed: install the ntfy app and subscribe to the topic shown at the bottom of the page.

Testing without touching the real queue: add `?topic=anything-else` to the URL.

## Dev

```sh
npx serve .     # or python3 -m http.server
npm test        # queue logic tests (node --test)
```
