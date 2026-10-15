#!/usr/bin/env node
// Writes social/schedule.json for the 0.31 launch fortnight (17 to 30 October 2026, Philippine time). Edit the list below
// and run it again (node social/make-schedule.js), or edit schedule.json by hand: tools/autopost.js checks it either way.
// Times: 12:00 for pictures, 19:00 for videos (evening is when most players are on their phones).
'use strict';
const fs = require('fs'), path = require('path');
const M = f => 'social/media/' + f, AT = (d, t) => `2026-10-${d}T${t}:00+08:00`, ALL = ['facebook', 'instagram', 'tiktok'], META = ['facebook', 'instagram'];
const LINK = 'https://lk.exenova.is-local.host', BIO = 'Play free: link in bio';
// captions: the Facebook one carries the link; Instagram and TikTok point to the bio (links in captions aren't clickable there)
const cap = (text, fbTags, igTags, ttTags) => ({ default: `${text}\n\nPlay free: ${LINK}\n\n${fbTags}`, instagram: `${text}\n\n${BIO} 🏮\n.\n${igTags}`, tiktok: `${text} ${BIO} 🏮 ${ttTags}` });
const T = { // hashtag sets
  core: ['#LanternKeeper #IndieGame #FreeToPlay #Roguelite', '#LanternKeeper #IndieGame #FreeToPlay #Roguelite #IndieGames #GameDev #TowerDefense #IdleGame #Lighthouse #PixelArt', '#LanternKeeper #indiegame #roguelite #gaming #fyp'],
  update: ['#LanternKeeper #GameUpdate #IndieGame #FreeToPlay', '#LanternKeeper #GameUpdate #IndieGame #FreeToPlay #Roguelite #IndieGames #GameDev #NewUpdate', '#LanternKeeper #gameupdate #indiegame #gaming #fyp'],
  coop: ['#LanternKeeper #CoopGames #PlayWithFriends #IndieGame', '#LanternKeeper #CoopGames #PlayWithFriends #IndieGame #FreeToPlay #MultiplayerGames #GamingCommunity', '#LanternKeeper #coopgames #playwithfriends #gaming #fyp'],
  boss: ['#LanternKeeper #BossFight #IndieGame #Roguelite', '#LanternKeeper #BossFight #IndieGame #Roguelite #FreeToPlay #IndieGames #GameDev', '#LanternKeeper #bossfight #indiegame #gaming #fyp'],
};
const posts = [
  { id: 'zero-to-92', at: AT(17, '19:00'), kind: 'video', media: [M('zero-to-92.mp4')], to: ALL,
    caption: cap('You start with one lantern. This is wave 92. How far would you get?', ...T.core) },
  { id: 'update-031-carousel', at: AT(18, '12:00'), kind: 'carousel', media: [1, 2, 3, 4, 5].map(i => M(`feed-02-update-${i}.jpg`)), to: META,
    caption: cap('Lantern Keeper 0.31 is here 🏮\n\n• Sign in with Google, Discord, Twitch or X, or with a code by email\n• Crews: your own group of keepers, with a tag and a crew chat\n• Seasons: a Season path with titles, and ranked PvP seasons\n• Seed challenges: send a friend the exact same night\n• Photo mode, saved outfits and lighthouse decorations\n\nWhich one are you trying first?', ...T.update) },
  { id: 'update-031', at: AT(18, '19:00'), kind: 'video', media: [M('update-031.mp4')], to: ALL,
    caption: cap('0.31 in 20 seconds: crews, seasons, seed challenges and new comfort settings. Still free, still no ads.', ...T.update) },
  { id: 'pick-one', at: AT(19, '19:00'), kind: 'video', media: [M('pick-one.mp4')], to: ALL,
    caption: cap('After every wave you pick 1 of 3. Which one are you taking? Comment 1, 2 or 3 👇', ...T.core) },
  { id: 'crews', at: AT(20, '12:00'), kind: 'image', media: [M('feed-03-crews.jpg')], to: META,
    caption: cap('Find your crew 🚢 Up to 30 keepers, open or by request, with a tag next to your names and your own crew chat. Tag the friend you\'d make your officer.', ...T.coop) },
  { id: 'crews-story', at: AT(20, '18:00'), kind: 'story', media: [M('vertical-03-crews.jpg')], to: ['instagram'], caption: { default: '' } },
  { id: 'boss-in-3', at: AT(21, '19:00'), kind: 'video', media: [M('boss-in-3.mp4')], to: ALL,
    caption: cap('Every fifth wave, a guardian rises. Burst her down or outlast her? (Tower health was set to 15% for this shot; the repair and the win are real play.)', ...T.boss) },
  { id: 'seed', at: AT(22, '12:00'), kind: 'image', media: [M('feed-04-seed.jpg')], to: META,
    caption: cap('Same night. Same creatures. Who lasts longer? Every night has a seed: send yours to a friend and the game opens on the exact same night.', ...T.core) },
  { id: 'makes-sense', at: AT(22, '19:00'), kind: 'video', media: [M('makes-sense.mp4')], to: ALL,
    caption: cap('Free. No ads. Never pay-to-win. Plays in your browser, offline too. Which one sold you?', ...T.core) },
  { id: 'hook-wave', at: AT(23, '19:00'), kind: 'video', media: [M('hook-wave.mp4')], to: ALL,
    caption: cap('Every night, the fog comes. Tap what slips through, pick an upgrade, survive. How far would you get?', ...T.core) },
  { id: 'access', at: AT(24, '12:00'), kind: 'image', media: [M('feed-05-access.jpg')], to: META,
    caption: cap('Play your way. New in 0.31: easy-read text, creature outlines, assisted tapping for one-handed play, a battery saver and a streamer mode. Controllers, larger text and colour-vision palettes were already there.', '#LanternKeeper #AccessibleGaming #IndieGame #FreeToPlay', '#LanternKeeper #AccessibleGaming #GamingForEveryone #IndieGame #FreeToPlay #IndieGames #GameDev', '#LanternKeeper #accessiblegaming #indiegame #gaming #fyp') },
  { id: 'together', at: AT(24, '19:00'), kind: 'video', media: [M('together.mp4')], to: ALL,
    caption: cap('Some nights are better together. Co-op for up to four keepers, duels, and a harbour to meet in. Who are you bringing?', ...T.coop) },
  { id: 'family', at: AT(25, '12:00'), kind: 'image', media: [M('feed-06-family.jpg')], to: META,
    caption: cap('For parents and guardians: Family settings. Turn chat, online play and spending on or off, and set a daily playtime reminder, all behind a PIN only you know.', '#LanternKeeper #FamilyGaming #IndieGame #NoAds', '#LanternKeeper #FamilyGaming #SafeGaming #IndieGame #NoAds #FreeToPlay #GamingForKids', '#LanternKeeper #familygaming #indiegame #fyp') },
  { id: 'grow', at: AT(26, '19:00'), kind: 'video', media: [M('grow.mp4')], to: ALL,
    caption: cap('Every night you lose makes you stronger. Damage or health first?', ...T.core) },
  { id: 'season', at: AT(27, '12:00'), kind: 'image', media: [M('feed-07-season.jpg')], to: META,
    caption: cap('A new season is lighting up. Every night adds season light: Endless waves, stages, region clears and the daily challenge. Titles at steps 10, 20 and 30. Which title are you going for?', ...T.update) },
  { id: 'season-story', at: AT(27, '18:00'), kind: 'story', media: [M('vertical-07-season.jpg')], to: ['instagram'], caption: { default: '' } },
  { id: 'hook-boss', at: AT(28, '19:00'), kind: 'video', media: [M('hook-boss.mp4')], to: ALL,
    caption: cap('The Moth Queen does not come alone. Ready for her? (Tower health was set to 15% for this shot; the repair and the win are real play.)', ...T.boss) },
  { id: 'hello', at: AT(29, '12:00'), kind: 'image', media: [M('feed-01-hello.jpg')], to: META,
    caption: cap('Every night, the fog comes. You are the last keeper on the coast. A free idle roguelite: your lantern fires on its own, your taps break what slips through, and after every wave you choose one of three upgrades.', ...T.core) },
  { id: 'hello-story', at: AT(29, '18:00'), kind: 'story', media: [M('vertical-01-hello.jpg')], to: ['instagram'], caption: { default: '' } },
  { id: 'seed-story', at: AT(30, '18:00'), kind: 'story', media: [M('vertical-04-seed.jpg')], to: ['instagram'], caption: { default: '' } },
];
fs.writeFileSync(path.join(__dirname, 'schedule.json'), JSON.stringify({ about: 'Posts for tools/autopost.js (times are Philippine time). Made by social/make-schedule.js.', posts }, null, 1) + '\n');
console.log(`wrote social/schedule.json: ${posts.length} posts, ${posts[0].at.slice(0, 10)} to ${posts[posts.length - 1].at.slice(0, 10)}`);
