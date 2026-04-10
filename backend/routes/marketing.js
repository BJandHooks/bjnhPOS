/**
 * Phase 9 — Marketing: Social posting & local event listings
 * Platforms: Facebook, Instagram, TikTok, Google My Business
 *
 * API credentials go in .env:
 *   META_APP_ID, META_APP_SECRET
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   BASE_URL  (your public domain, e.g. https://bjnhpos.com)
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

// ─── helpers ────────────────────────────────────────────────────────────────

async function getConnection(platform) {
  const r = await db.query('SELECT * FROM platform_connections WHERE platform=$1', [platform]);
  return r.rows[0] || null;
}

// Refresh a Meta (FB/IG) long-lived token if close to expiry
async function refreshMetaToken(conn) {
  if (\!conn.token_expires_at) return conn.access_token;
  const expiresAt = new Date(conn.token_expires_at);
  const hoursLeft = (expiresAt - Date.now()) / 3600000;
  if (hoursLeft > 24) return conn.access_token;
  // Exchange for a new long-lived token
  const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${conn.access_token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.access_token) {
    const expires = new Date(Date.now() + (data.expires_in || 5183944) * 1000);
    await db.query('UPDATE platform_connections SET access_token=$1, token_expires_at=$2, updated_at=NOW() WHERE platform=$3', [data.access_token, expires, conn.platform]);
    return data.access_token;
  }
  return conn.access_token;
}

// ─── Platform connections ────────────────────────────────────────────────────

// GET /api/marketing/connections — status of all 4 platforms
router.get('/connections', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT platform,is_connected,page_name,page_id,token_expires_at,connected_at FROM platform_connections ORDER BY platform');
    const all = ['facebook','instagram','tiktok','google_business'];
    const map = {};
    for (const row of r.rows) map[row.platform] = row;
    res.json(all.map(p => map[p] || { platform: p, is_connected: false }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Meta (Facebook + Instagram) OAuth ───────────────────────────────────────

// GET /api/marketing/oauth/facebook/start
router.get('/oauth/facebook/start', auth, (req, res) => {
  const scopes = ['pages_manage_posts','pages_read_engagement','instagram_basic','instagram_content_publish','pages_show_list'].join(',');
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/facebook/callback`;
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&scope=${scopes}&state=bjnhpos`;
  res.json({ oauth_url: url });
});

// GET /api/marketing/oauth/facebook/callback
router.get('/oauth/facebook/callback', async (req, res) => {
  const { code } = req.query;
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/facebook/callback`;
  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${process.env.META_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}&client_secret=${process.env.META_APP_SECRET}&code=${code}`);
    const tokenData = await tokenRes.json();
    // Exchange for long-lived token
    const llRes = await fetch(`https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${tokenData.access_token}`);
    const llData = await llRes.json();
    const longToken = llData.access_token;
    const expires = new Date(Date.now() + (llData.expires_in || 5183944) * 1000);
    // Get pages
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longToken}`);
    const pagesData = await pagesRes.json();
    const page = pagesData.data?.[0];
    if (\!page) return res.status(400).json({ error: 'No Facebook Page found on this account.' });
    const pageToken = page.access_token;
    // Get linked Instagram account
    const igRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${pageToken}`);
    const igData = await igRes.json();
    const igAccountId = igData.instagram_business_account?.id || null;
    // Save Facebook
    await db.query(`
      INSERT INTO platform_connections (platform,access_token,token_expires_at,page_id,page_name,is_connected,connected_at)
      VALUES ('facebook',$1,$2,$3,$4,true,NOW())
      ON CONFLICT (platform) DO UPDATE SET access_token=$1,token_expires_at=$2,page_id=$3,page_name=$4,is_connected=true,connected_at=NOW(),updated_at=NOW()
    `, [pageToken, expires, page.id, page.name]);
    // Save Instagram (shares FB page token, different account ID)
    if (igAccountId) {
      await db.query(`
        INSERT INTO platform_connections (platform,access_token,token_expires_at,page_id,instagram_account_id,page_name,is_connected,connected_at)
        VALUES ('instagram',$1,$2,$3,$4,$5,true,NOW())
        ON CONFLICT (platform) DO UPDATE SET access_token=$1,token_expires_at=$2,page_id=$3,instagram_account_id=$4,page_name=$5,is_connected=true,connected_at=NOW(),updated_at=NOW()
      `, [pageToken, expires, page.id, igAccountId, page.name + ' (Instagram)']);
    }
    res.redirect(`${process.env.BASE_URL}/marketing?connected=facebook`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Disconnect Facebook (and Instagram)
router.post('/oauth/facebook/disconnect', auth, async (req, res) => {
  try {
    await db.query("UPDATE platform_connections SET is_connected=false,access_token=NULL,refresh_token=NULL WHERE platform IN ('facebook','instagram')");
    res.json({ message: 'Disconnected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TikTok OAuth ─────────────────────────────────────────────────────────────

// GET /api/marketing/oauth/tiktok/start
router.get('/oauth/tiktok/start', auth, (req, res) => {
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/tiktok/callback`;
  const scopes = 'user.info.basic,video.upload,video.publish';
  const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirect)}&state=bjnhpos`;
  res.json({ oauth_url: url });
});

// GET /api/marketing/oauth/tiktok/callback
router.get('/oauth/tiktok/callback', async (req, res) => {
  const { code } = req.query;
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/tiktok/callback`;
  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, code, grant_type: 'authorization_code', redirect_uri: redirect }),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in, open_id } = tokenData.data || tokenData;
    const expires = new Date(Date.now() + (expires_in || 86400) * 1000);
    // Get user info
    const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url', { headers: { Authorization: `Bearer ${access_token}` } });
    const userData = await userRes.json();
    const displayName = userData.data?.user?.display_name || 'TikTok Account';
    await db.query(`
      INSERT INTO platform_connections (platform,access_token,refresh_token,token_expires_at,page_id,page_name,is_connected,connected_at)
      VALUES ('tiktok',$1,$2,$3,$4,$5,true,NOW())
      ON CONFLICT (platform) DO UPDATE SET access_token=$1,refresh_token=$2,token_expires_at=$3,page_id=$4,page_name=$5,is_connected=true,connected_at=NOW(),updated_at=NOW()
    `, [access_token, refresh_token, expires, open_id, displayName]);
    res.redirect(`${process.env.BASE_URL}/marketing?connected=tiktok`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Refresh TikTok token
router.post('/oauth/tiktok/refresh', auth, async (req, res) => {
  try {
    const conn = await getConnection('tiktok');
    if (\!conn?.refresh_token) return res.status(400).json({ error: 'No refresh token stored' });
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY, client_secret: process.env.TIKTOK_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: conn.refresh_token }),
    });
    const data = await r.json();
    const { access_token, refresh_token, expires_in } = data.data || data;
    const expires = new Date(Date.now() + (expires_in || 86400) * 1000);
    await db.query("UPDATE platform_connections SET access_token=$1,refresh_token=$2,token_expires_at=$3,updated_at=NOW() WHERE platform='tiktok'", [access_token, refresh_token, expires]);
    res.json({ message: 'Token refreshed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/oauth/tiktok/disconnect', auth, async (req, res) => {
  try {
    await db.query("UPDATE platform_connections SET is_connected=false,access_token=NULL,refresh_token=NULL WHERE platform='tiktok'");
    res.json({ message: 'Disconnected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Google My Business OAuth ─────────────────────────────────────────────────

// GET /api/marketing/oauth/google/start
router.get('/oauth/google/start', auth, (req, res) => {
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/google/callback`;
  const scopes = encodeURIComponent('https://www.googleapis.com/auth/business.manage');
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=bjnhpos`;
  res.json({ oauth_url: url });
});

// GET /api/marketing/oauth/google/callback
router.get('/oauth/google/callback', async (req, res) => {
  const { code } = req.query;
  const redirect = `${process.env.BASE_URL}/api/marketing/oauth/google/callback`;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    const expires = new Date(Date.now() + (expires_in || 3600) * 1000);
    // Get GMB account & first location
    const acctRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', { headers: { Authorization: `Bearer ${access_token}` } });
    const acctData = await acctRes.json();
    const account = acctData.accounts?.[0];
    let locationId = null, locationName = 'Google Business';
    if (account) {
      const locRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title`, { headers: { Authorization: `Bearer ${access_token}` } });
      const locData = await locRes.json();
      const loc = locData.locations?.[0];
      if (loc) { locationId = loc.name; locationName = loc.title || 'Google Business'; }
    }
    await db.query(`
      INSERT INTO platform_connections (platform,access_token,refresh_token,token_expires_at,page_id,page_name,is_connected,connected_at)
      VALUES ('google_business',$1,$2,$3,$4,$5,true,NOW())
      ON CONFLICT (platform) DO UPDATE SET access_token=$1,refresh_token=$2,token_expires_at=$3,page_id=$4,page_name=$5,is_connected=true,connected_at=NOW(),updated_at=NOW()
    `, [access_token, refresh_token, expires, locationId, locationName]);
    res.redirect(`${process.env.BASE_URL}/marketing?connected=google`);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Refresh Google token
async function refreshGoogleToken() {
  const conn = await getConnection('google_business');
  if (\!conn?.refresh_token) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, refresh_token: conn.refresh_token, grant_type: 'refresh_token' }),
  });
  const data = await r.json();
  if (data.access_token) {
    const expires = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    await db.query("UPDATE platform_connections SET access_token=$1,token_expires_at=$2,updated_at=NOW() WHERE platform='google_business'", [data.access_token, expires]);
    return data.access_token;
  }
  return conn.access_token;
}

router.post('/oauth/google/disconnect', auth, async (req, res) => {
  try {
    await db.query("UPDATE platform_connections SET is_connected=false,access_token=NULL,refresh_token=NULL WHERE platform='google_business'");
    res.json({ message: 'Disconnected' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Post queue ───────────────────────────────────────────────────────────────

// GET /api/marketing/posts
router.get('/posts', auth, async (req, res) => {
  const { status, track } = req.query;
  try {
    let q = 'SELECT * FROM marketing_posts WHERE 1=1';
    const params = [];
    if (status) { params.push(status); q += ` AND status=$${params.length}`; }
    if (track)  { params.push(track);  q += ` AND track=$${params.length}`; }
    q += ' ORDER BY COALESCE(scheduled_at, created_at) DESC';
    const r = await db.query(q, params);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing/posts — create draft or scheduled post
router.post('/posts', auth, async (req, res) => {
  const { title, caption, media_url, media_type='image', platforms, scheduled_at, track='prime', inventory_id, event_id } = req.body;
  if (\!caption || \!platforms?.length) return res.status(400).json({ error: 'caption and platforms required' });
  try {
    const r = await db.query(`
      INSERT INTO marketing_posts (title,caption,media_url,media_type,platforms,status,scheduled_at,track,inventory_id,event_id,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [title, caption, media_url, media_type, platforms, scheduled_at ? 'scheduled' : 'draft', scheduled_at || null, track, inventory_id || null, event_id || null, req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/marketing/posts/:id
router.patch('/posts/:id', auth, async (req, res) => {
  const { title, caption, media_url, platforms, scheduled_at, track, status } = req.body;
  try {
    const r = await db.query(`
      UPDATE marketing_posts SET
        title=COALESCE($1,title), caption=COALESCE($2,caption), media_url=COALESCE($3,media_url),
        platforms=COALESCE($4,platforms), scheduled_at=COALESCE($5,scheduled_at),
        track=COALESCE($6,track), status=COALESCE($7,status), updated_at=NOW()
      WHERE id=$8 RETURNING *
    `, [title, caption, media_url, platforms, scheduled_at, track, status, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/marketing/posts/:id
router.delete('/posts/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM marketing_posts WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Publish a post to all selected platforms ─────────────────────────────────

// POST /api/marketing/posts/:id/publish
router.post('/posts/:id/publish', auth, async (req, res) => {
  try {
    const postRes = await db.query('SELECT * FROM marketing_posts WHERE id=$1', [req.params.id]);
    if (\!postRes.rows.length) return res.status(404).json({ error: 'Post not found' });
    const post = postRes.rows[0];
    await db.query("UPDATE marketing_posts SET status='publishing', updated_at=NOW() WHERE id=$1", [post.id]);

    const results = {};
    const errors = {};

    for (const platform of post.platforms) {
      try {
        if (platform === 'facebook') results.facebook = await publishToFacebook(post);
        if (platform === 'instagram') results.instagram = await publishToInstagram(post);
        if (platform === 'tiktok') results.tiktok = await publishToTikTok(post);
        if (platform === 'google_business') results.google_business = await publishToGoogleBusiness(post);
        // Save result
        await db.query('INSERT INTO marketing_post_results (post_id,platform,external_post_id,external_url,status) VALUES ($1,$2,$3,$4,$5)',
          [post.id, platform, results[platform]?.id || null, results[platform]?.url || null, 'published']);
      } catch (e) {
        errors[platform] = e.message;
        await db.query('INSERT INTO marketing_post_results (post_id,platform,status,error_message) VALUES ($1,$2,$3,$4)',
          [post.id, platform, 'failed', e.message]);
      }
    }

    const allFailed = Object.keys(errors).length === post.platforms.length;
    await db.query(`UPDATE marketing_posts SET status=$1,published_at=$2,post_results=$3,error_details=$4,updated_at=NOW() WHERE id=$5`,
      [allFailed ? 'failed' : 'published', allFailed ? null : new Date(), JSON.stringify(results), Object.keys(errors).length ? JSON.stringify(errors) : null, post.id]);

    res.json({ results, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Facebook publish ─────────────────────────────────────────────────────────
async function publishToFacebook(post) {
  const conn = await getConnection('facebook');
  if (\!conn?.is_connected) throw new Error('Facebook not connected');
  const token = await refreshMetaToken(conn);
  const pageId = conn.page_id;
  let endpoint, body;
  if (post.media_url && post.media_type === 'image') {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    body = { url: post.media_url, caption: post.caption, access_token: token };
  } else if (post.media_url && post.media_type === 'video') {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/videos`;
    body = { file_url: post.media_url, description: post.caption, access_token: token };
  } else {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    body = { message: post.caption, access_token: token };
  }
  const r = await fetch(endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return { id: data.id, url: `https://www.facebook.com/${data.id}` };
}

// ── Instagram publish ────────────────────────────────────────────────────────
async function publishToInstagram(post) {
  const conn = await getConnection('instagram');
  if (\!conn?.is_connected || \!conn.instagram_account_id) throw new Error('Instagram not connected');
  const token = await refreshMetaToken(conn);
  const igId = conn.instagram_account_id;
  if (\!post.media_url) throw new Error('Instagram requires a media URL');
  // Step 1: create container
  const containerBody = post.media_type === 'video' || post.media_type === 'reel'
    ? { media_type: 'REELS', video_url: post.media_url, caption: post.caption, access_token: token }
    : { image_url: post.media_url, caption: post.caption, access_token: token };
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(containerBody) });
  const container = await containerRes.json();
  if (container.error) throw new Error(container.error.message);
  // Step 2: publish container
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igId}/media_publish`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ creation_id: container.id, access_token: token }) });
  const published = await publishRes.json();
  if (published.error) throw new Error(published.error.message);
  return { id: published.id, url: `https://www.instagram.com/p/${published.id}` };
}

// ── TikTok publish ───────────────────────────────────────────────────────────
async function publishToTikTok(post) {
  const conn = await getConnection('tiktok');
  if (\!conn?.is_connected) throw new Error('TikTok not connected');
  if (\!post.media_url) throw new Error('TikTok requires a video URL');
  const token = conn.access_token;
  // TikTok Content Posting API — URL-based upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ post_info: { title: post.caption.slice(0,150), privacy_level:'PUBLIC_TO_EVERYONE', disable_duet:false, disable_comment:false, disable_stitch:false }, source_info: { source:'PULL_FROM_URL', video_url: post.media_url } }),
  });
  const initData = await initRes.json();
  if (initData.error?.code \!== 'ok' && initData.error) throw new Error(initData.error.message || 'TikTok publish failed');
  return { id: initData.data?.publish_id, url: 'https://www.tiktok.com' };
}

// ── Google My Business publish ───────────────────────────────────────────────
async function publishToGoogleBusiness(post) {
  const conn = await getConnection('google_business');
  if (\!conn?.is_connected || \!conn.page_id) throw new Error('Google Business not connected');
  let token = conn.access_token;
  // Refresh if expired
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) token = await refreshGoogleToken();
  const locationName = conn.page_id; // e.g. "accounts/123/locations/456"
  const body = {
    languageCode: 'en',
    summary: post.caption,
    callToAction: post.media_url ? { actionType: 'LEARN_MORE' } : undefined,
    media: post.media_url ? [{ mediaFormat: post.media_type === 'video' ? 'VIDEO' : 'PHOTO', sourceUrl: post.media_url }] : undefined,
  };
  const r = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return { id: data.name, url: data.searchUrl || 'https://business.google.com' };
}

// ─── Caption pool ─────────────────────────────────────────────────────────────

router.get('/captions', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM caption_pool ORDER BY created_at DESC');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing/captions — add one or bulk paste
router.post('/captions', auth, async (req, res) => {
  const { captions, tags } = req.body; // captions: string[] or single string
  const list = Array.isArray(captions) ? captions : [captions];
  try {
    const inserted = [];
    for (const caption of list) {
      if (\!caption?.trim()) continue;
      const r = await db.query('INSERT INTO caption_pool (caption,tags,created_by) VALUES ($1,$2,$3) RETURNING *', [caption.trim(), tags || [], req.user.id]);
      inserted.push(r.rows[0]);
    }
    res.status(201).json(inserted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/marketing/captions/:id/approve
router.patch('/captions/:id/approve', auth, async (req, res) => {
  try {
    const r = await db.query('UPDATE caption_pool SET approved=$1 WHERE id=$2 RETURNING *', [req.body.approved ?? true, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/captions/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM caption_pool WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/marketing/captions/random — pull one approved caption for autopilot
router.get('/captions/random', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM caption_pool WHERE approved=true ORDER BY used_count ASC, last_used_at ASC NULLS FIRST LIMIT 1');
    if (\!r.rows.length) return res.status(404).json({ error: 'No approved captions in pool' });
    const caption = r.rows[0];
    await db.query('UPDATE caption_pool SET used_count=used_count+1, last_used_at=NOW() WHERE id=$1', [caption.id]);
    res.json(caption);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Local event listings ─────────────────────────────────────────────────────

// GET /api/marketing/event-listings
router.get('/event-listings', auth, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM local_event_listings ORDER BY start_time DESC');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing/event-listings — create listing record
router.post('/event-listings', auth, async (req, res) => {
  const { event_id, platform, title, description, start_time, end_time, location, cover_image_url, ticket_url } = req.body;
  if (\!platform || \!title || \!start_time) return res.status(400).json({ error: 'platform, title, start_time required' });
  try {
    const r = await db.query(`
      INSERT INTO local_event_listings (event_id,platform,title,description,start_time,end_time,location,cover_image_url,ticket_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [event_id||null, platform, title, description, start_time, end_time||null, location||null, cover_image_url||null, ticket_url||null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/marketing/event-listings/:id/publish — push listing to platform
router.post('/event-listings/:id/publish', auth, async (req, res) => {
  try {
    const listingRes = await db.query('SELECT * FROM local_event_listings WHERE id=$1', [req.params.id]);
    if (\!listingRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const listing = listingRes.rows[0];
    let result;
    if (listing.platform === 'facebook') result = await publishFBEvent(listing);
    else if (listing.platform === 'google_business') result = await publishGMBEvent(listing);
    else return res.status(400).json({ error: `Direct publish not supported for ${listing.platform}. Use their native tools.` });
    await db.query('UPDATE local_event_listings SET status=$1,external_event_id=$2,external_url=$3,last_synced_at=NOW(),updated_at=NOW() WHERE id=$4',
      ['published', result.id, result.url, listing.id]);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/marketing/event-listings/:id/sync — re-sync to platform
router.patch('/event-listings/:id/sync', auth, async (req, res) => {
  try {
    await db.query('UPDATE local_event_listings SET last_synced_at=NOW(),updated_at=NOW() WHERE id=$1', [req.params.id]);
    res.json({ message: 'Sync timestamp updated. Re-publish to push changes.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Facebook Event publish ────────────────────────────────────────────────────
async function publishFBEvent(listing) {
  const conn = await getConnection('facebook');
  if (\!conn?.is_connected) throw new Error('Facebook not connected');
  const token = await refreshMetaToken(conn);
  const pageId = conn.page_id;
  const body = {
    name: listing.title,
    description: listing.description || '',
    start_time: new Date(listing.start_time).toISOString(),
    end_time: listing.end_time ? new Date(listing.end_time).toISOString() : undefined,
    place: listing.location ? { name: listing.location } : undefined,
    cover: listing.cover_image_url ? { url: listing.cover_image_url } : undefined,
    ticket_uri: listing.ticket_url || undefined,
    access_token: token,
  };
  const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}/events`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return { id: data.id, url: `https://www.facebook.com/events/${data.id}` };
}

// ── Google My Business Event (Local Post) ─────────────────────────────────────
async function publishGMBEvent(listing) {
  const conn = await getConnection('google_business');
  if (\!conn?.is_connected || \!conn.page_id) throw new Error('Google Business not connected');
  let token = conn.access_token;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) token = await refreshGoogleToken();
  const body = {
    languageCode: 'en',
    topicType: 'EVENT',
    event: {
      title: listing.title,
      schedule: { startDate: listing.start_time, endDate: listing.end_time || listing.start_time },
    },
    summary: listing.description || listing.title,
    callToAction: listing.ticket_url ? { actionType: 'BOOK', url: listing.ticket_url } : undefined,
    media: listing.cover_image_url ? [{ mediaFormat: 'PHOTO', sourceUrl: listing.cover_image_url }] : undefined,
  };
  const r = await fetch(`https://mybusiness.googleapis.com/v4/${conn.page_id}/localPosts`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(body) });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message);
  return { id: data.name, url: data.searchUrl || 'https://business.google.com' };
}

module.exports = router;
