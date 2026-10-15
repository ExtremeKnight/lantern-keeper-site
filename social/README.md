# Social autopilot

Posts to the **Facebook Page**, **Instagram** (@l4ntern.keeper) and **TikTok** (@l4nternkeeper) on a schedule, by itself.
Every 30 minutes GitHub runs `tools/autopost.js` (workflow **Social autopilot**, free because this repository is
public). It posts whatever in `social/schedule.json` is due and records it in `social/posted.json`, so nothing is posted twice.

| Platform | What happens |
|---|---|
| Facebook Page | Posted for you: pictures, carousels, Reels and Stories |
| Instagram | Posted for you: pictures, carousels, Reels and Stories |
| TikTok | The video arrives in the TikTok app's **inbox**: tap the notification, paste the caption, post (one tap). TikTok only allows fully automatic posting after it audits the app; see the end of this file. The caption to paste is on the workflow run's summary page. Pictures aren't sent to TikTok. |

## One-time setup (about 20 minutes)

Do these in order. Nothing here costs money. You set every password and token yourself: they go straight into
GitHub's encrypted secrets, and nobody else sees them, Claude included.

### 1. Instagram as a professional account, linked to the Page
1. In the Instagram app (@l4ntern.keeper): **Settings > Account type and tools > Switch to professional account**, and pick
   **Business** (category: *Video game*).
2. On the Facebook Page **Lantern Keeper**: **Settings > Linked accounts > Instagram > Connect**, and sign in to
   @l4ntern.keeper.

### 2. A Meta app for posting
1. At <https://developers.facebook.com/apps>, signed in as l4nternkeeper@gmail.com: **Create app**, name it
   *Lantern Keeper Autopilot*. Use cases: **Manage everything on your Page** and **Manage messaging & content on
   Instagram**. Keep the app in **Development** mode: you're its admin, so it can post to your own Page and account
   without Meta's review.
2. **App settings > Basic**: note the **App ID** and the **App secret**.
3. Open the **Graph API Explorer** (<https://developers.facebook.com/tools/explorer>), choose *Lantern Keeper
   Autopilot*. Under **Permissions**, add `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish` and `business_management`. Click **Generate Access Token**, and when
   Facebook asks, tick the **Lantern Keeper** Page and **@l4ntern.keeper**. Copy the token it shows.
4. In PowerShell, in this folder (`F:\Code\lantern-keeper-site`):

   ```powershell
   $env:META_APP_ID = "the App ID"; $env:META_APP_SECRET = "the App secret"
   node tools/autopost-auth.js meta
   ```

   Paste the token when it asks (it won't show). It finds the Page and the Instagram account, makes a Page token that
   doesn't expire, and saves it to GitHub.

### 3. A TikTok app for the inbox uploads
1. At <https://developers.tiktok.com>, sign in with the TikTok account: **Manage apps > Connect an app**. Name it
   *Lantern Keeper Autopilot*, platform **Web**. Website `https://lk.exenova.is-local.host`, Terms
   `https://lk.exenova.is-local.host/terms.html`, Privacy `https://lk.exenova.is-local.host/privacy-policy.html`.
2. Add **Login Kit** with the redirect URI `https://lk.exenova.is-local.host/social/tiktok-auth.html`, and the
   **Content Posting API** (scope `video.upload`; also keep `user.info.basic`).
3. Use the app's **Sandbox**: add @l4nternkeeper as a *target user*. Note the sandbox **Client key** and **Client secret**.
4. In PowerShell, in this folder:

   ```powershell
   $env:TIKTOK_CLIENT_KEY = "the client key"; $env:TIKTOK_CLIENT_SECRET = "the client secret"
   node tools/autopost-auth.js tiktok
   ```

   Open the address it prints, allow it, copy the code the page shows, and paste it into the terminal. The sign-in
   lasts a year: run this again before then (the workflow fails and GitHub emails you if it runs out).

### 4. Check it
- `node tools/autopost-auth.js check` lists what's set (names only).
- GitHub: **Actions > Social autopilot > Run workflow** with *Dry run* ticked lists what would be posted now, without
  posting.

## Day to day

- **See the plan:** `node tools/autopost.js --list` (each post, and done / due / later / missed).
- **Add or change posts:** edit `social/make-schedule.js` and run `node social/make-schedule.js`, or edit
  `social/schedule.json`. Put the pictures (JPEG; Instagram doesn't take PNG) and videos (MP4, 9:16) in `social/media/`.
  Commit and push: the site publishes the files, and the autopilot posts each one at its time.
- **Times** are Philippine time (`+08:00`). A post that couldn't go out for more than three days is marked *missed*
  rather than posted late.
- **When something fails**, the workflow run turns red and GitHub emails you. It tries again on the next runs (three
  tries). The reason is in `social/posted.json`.
- **Turn it off:** Actions > Social autopilot > the "..." menu > **Disable workflow**.

## Later: fully automatic TikTok
When the account has some following, submit the TikTok app for **review** (Content Posting API, *Direct Post*). Once
TikTok approves it, the autopilot can post TikToks publicly without the inbox step (a small change to `tiktok()` in
`tools/autopost.js`).
