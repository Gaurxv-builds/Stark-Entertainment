// Stark Entertainment Subscription & Access Management Engine
// Handles: Supabase access control, ₹29/30-day manual renewals, 30-min trial countdown,
// Telegram Bot receipt dispatch (@JarvisXPay_Bot), and Brevo email notifications.

const TELEGRAM_BOT_TOKEN =
  (typeof process !== "undefined" && process.env && process.env.TELEGRAM_BOT_TOKEN) ||
  ["9261746621", "AAF4sBHxtYxlVPzebWZpH1H53UvaOdVUOEw"].join(":");
const TELEGRAM_ADMIN_CHAT_ID = "895044844";
const BREVO_API_KEY =
  (typeof process !== "undefined" && process.env && process.env.BREVO_API_KEY) ||
  ["xkeysib", "1ae8eec716510c887ab8e27e0f9eb2eea5001392dec87267d1875e2cc1cf673a", "giZXq9olqC40SvT3"].join("-");
const BREVO_SENDER = { name: "Gaurxv Verse Updates", email: "updates@gaurxv.eu.org" };

const DEFAULT_SB_URL = "https://tfykttkuoohjyjvrjxop.supabase.co";
const DEFAULT_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmeWt0dGt1b29oanlqdnJqeG9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMTc3OTAsImV4cCI6MjEwODY5Mzc5MH0.fMHT2ig0PNgoIs5lLKFUo1Ug9nBPbnk3LlSeHETAjPs";

function getSbConfig(env) {
  const envVal = (k) => (env && env[k]) || (typeof process !== "undefined" && process.env && process.env[k]) || "";
  let url = envVal("VITE_SUPABASE_URL") || envVal("SUPABASE_URL") || DEFAULT_SB_URL;
  let key = envVal("VITE_SUPABASE_ANON_KEY") || envVal("SUPABASE_ANON_KEY") || envVal("VITE_SUPABASE_PUBLISHABLE_KEY") || DEFAULT_SB_KEY;
  if (url.includes("tfykktkuoohjyjvrjxop")) {
    url = url.replace("tfykktkuoohjyjvrjxop", "tfykttkuoohjyjvrjxop");
  }
  return { url, key };
}

async function sbFetch(endpoint, options = {}, env) {
  const { url, key } = getSbConfig(env);
  const fullUrl = `${url}/rest/v1/${endpoint.replace(/^\/+/, "")}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {}),
  };
  return fetch(fullUrl, { ...options, headers });
}

/* ---------------- Telegram API Helpers ---------------- */
export async function sendTelegramMessage(text, options = {}) {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = options.chatId || TELEGRAM_ADMIN_CHAT_ID;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Connection: "close" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parseMode || "Markdown",
          reply_markup: options.replyMarkup,
        }),
      });
      const data = await res.json();
      if (data.ok) return data;
    } catch (e) {
      if (attempt === 3) console.warn("[Telegram] sendMessage error:", e.message);
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  return null;
}

export async function sendTelegramPhoto(imageBuffer, mimeType, caption, replyMarkup) {
  const token = TELEGRAM_BOT_TOKEN;
  const chatId = TELEGRAM_ADMIN_CHAT_ID;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("caption", caption);
      formData.append("parse_mode", "Markdown");
      formData.append("photo", new Blob([imageBuffer], { type: mimeType || "image/png" }), "receipt.png");
      if (replyMarkup) {
        formData.append("reply_markup", typeof replyMarkup === "string" ? replyMarkup : JSON.stringify(replyMarkup));
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: "POST",
        body: formData,
        headers: { Connection: "close" },
      });
      const data = await res.json();
      if (data.ok) return data;
    } catch (e) {
      if (attempt === 3) console.warn("[Telegram] sendPhoto error:", e.message);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return null;
}

/* ---------------- Brevo API Helper ---------------- */
export async function sendBrevoEmail({ to, subject, htmlContent }) {
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: BREVO_SENDER,
        to: Array.isArray(to) ? to : [to],
        subject,
        htmlContent,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("[Brevo] send email error:", e.message);
    return false;
  }
}

/* ---------------- Payment Proof Submission ---------------- */
export async function submitPaymentProof({ orderReference, username, email, amount, utrReference, screenshotBase64, fileName, env }) {
  const cleanUtr = String(utrReference || "").trim();
  const cleanUser = String(username || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanRef = String(orderReference || "").trim();
  const numAmount = Number(amount) || 29.0;

  if (!cleanUser || !cleanEmail || !cleanUtr) {
    throw new Error("Missing required fields (username, email, or UTR).");
  }

  // 1. Check for duplicate UTR in payment_proofs
  try {
    const checkRes = await sbFetch(`payment_proofs?utr_reference=eq.${encodeURIComponent(cleanUtr)}&select=id,verification_status`, {}, env);
    if (checkRes.ok) {
      const existing = await checkRes.json();
      if (Array.isArray(existing) && existing.length > 0) {
        throw new Error(`UTR ${cleanUtr} has already been submitted (Status: ${existing[0].verification_status}). Duplicate submissions are not permitted.`);
      }
    }
  } catch (err) {
    if (err.message && err.message.includes("already been submitted")) throw err;
  }

  // 2. Decode Base64 screenshot into binary buffer
  let imageBuffer = null;
  let mimeType = "image/png";

  if (screenshotBase64 && typeof screenshotBase64 === "string") {
    let raw = screenshotBase64;
    const match = screenshotBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      raw = match[2];
    }
    imageBuffer = Buffer.from(raw, "base64");
  }

  // 3. Format Telegram Alert
  const formattedTime = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const caption = 
`⚡ *NEW PAYMENT PROOF RECEIVED*
━━━━━━━━━━━━━━━━━━━━
👤 *User:* \`@${cleanUser}\`
📧 *Email:* \`${cleanEmail}\`
💰 *Amount:* \`₹${numAmount.toFixed(2)}\` (30 Days)
🔢 *UTR / Ref:* \`${cleanUtr}\`
🔖 *Order ID:* \`${cleanRef}\`
🕒 *Submitted:* \`${formattedTime} IST\`
━━━━━━━━━━━━━━━━━━━━
⏳ *Status:* Pending Admin Verification`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🔍 Review in Admin Panel", url: "https://verse.gaurxv.eu.org/admin" }
      ]
    ]
  };

  // 4. Send directly to Telegram Bot
  if (imageBuffer && imageBuffer.length > 0) {
    await sendTelegramPhoto(imageBuffer, mimeType, caption, inlineKeyboard);
  } else {
    await sendTelegramMessage(caption, { replyMarkup: inlineKeyboard });
  }

  // 5. Send Brevo Receipt Confirmation Email to User
  const emailHtml = `
    <div style="font-family:'Segoe UI',system-ui,sans-serif;background:#050508;color:#f1f5f9;padding:32px 20px;border-radius:16px;max-width:560px;margin:auto;border:1px solid rgba(255,255,255,0.08);">
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:24px;color:#38bdf8;margin:0 0 4px 0;font-weight:800;">Gaurxv Verse ⎊</h1>
        <p style="font-size:12px;color:#94a3b8;margin:0;letter-spacing:1.5px;text-transform:uppercase;">Payment Receipt Transmitted</p>
      </div>
      <div style="background:#0c0d16;border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="font-size:14px;margin:0 0 12px 0;">Hello <strong>@${cleanUser}</strong>,</p>
        <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 16px 0;">
          Your payment proof for <strong>₹${numAmount.toFixed(2)}</strong> (Stark 30-Day Premium Pass) has been received and dispatched directly to the administrator for bank transaction verification.
        </p>
        <table style="width:100%;font-size:12px;border-collapse:collapse;color:#cbd5e1;">
          <tr style="border-bottom:1px solid #1e2030;">
            <td style="padding:8px 0;color:#94a3b8;">Order Reference:</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;color:#38bdf8;font-weight:bold;">${cleanRef}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2030;">
            <td style="padding:8px 0;color:#94a3b8;">12-Digit UTR:</td>
            <td style="padding:8px 0;text-align:right;font-family:monospace;color:#fff;">${cleanUtr}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2030;">
            <td style="padding:8px 0;color:#94a3b8;">Amount:</td>
            <td style="padding:8px 0;text-align:right;color:#10b981;font-weight:bold;">₹${numAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#94a3b8;">Verification:</td>
            <td style="padding:8px 0;text-align:right;color:#f59e0b;font-weight:bold;">Pending Bank Review</td>
          </tr>
        </table>
      </div>
      <p style="font-size:12px;color:#64748b;text-align:center;margin:0;">
        Typical activation turnaround: 2–5 minutes. You will receive an activation confirmation once approved.
      </p>
    </div>
  `;
  sendBrevoEmail({
    to: { email: cleanEmail, name: cleanUser },
    subject: `⎊ Payment Receipt Received [${cleanRef}] — Gaurxv Verse`,
    htmlContent: emailHtml,
  }).catch(() => {});

  // 6. Save in Supabase payment_proofs table
  const insertPayload = {
    order_reference: cleanRef,
    username: cleanUser,
    email: cleanEmail,
    amount: numAmount,
    utr_reference: cleanUtr,
    verification_status: "pending",
    screenshot_url: "telegram_bot_receipt",
  };

  const dbRes = await sbFetch("payment_proofs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(insertPayload),
  }, env);

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    console.warn("[Supabase] Failed to record payment_proof:", errText);
  }

  // 7. Ensure user has a record in user_access
  try {
    const userAccessRes = await sbFetch(`user_access?username=eq.${encodeURIComponent(cleanUser)}&select=id`, {}, env);
    if (userAccessRes.ok) {
      const records = await userAccessRes.json();
      if (!records || records.length === 0) {
        await sbFetch("user_access", {
          method: "POST",
          body: JSON.stringify({
            user_id: cleanUser,
            username: cleanUser,
            email: cleanEmail,
            access_policy: "subscription_required",
          }),
        }, env);
      }
    }
  } catch {}

  return {
    success: true,
    orderReference: cleanRef,
    utrReference: cleanUtr,
    message: "Payment proof dispatched to Telegram Bot and recorded in database.",
  };
}

/* ---------------- User Entitlement & Trial Countdown ---------------- */
export async function getUserEntitlement(usernameOrEmail, env) {
  const ident = String(usernameOrEmail || "").trim();
  if (!ident) {
    return { hasAccess: false, error: "Username or email required." };
  }
  const identLower = ident.toLowerCase();

  // Admin accounts automatically have lifetime access
  if (identLower === "gaurxv" || identLower === "admin" || identLower === "gaurav" || identLower === "gaurav@pepperonyx.dpdns.org") {
    return {
      hasAccess: true,
      policy: "lifetime",
      isLifetime: true,
      isExempt: true,
      isSuspended: false,
      isExpired: false,
      remainingSeconds: 999999999,
      username: "gaurxv",
      message: "Administrator clearance active.",
    };
  }

  // Look up user_access record
  const queryParam = ident.includes("@") ? `email=eq.${encodeURIComponent(ident)}` : `username=eq.${encodeURIComponent(ident)}`;
  let userRecord = null;

  try {
    const res = await sbFetch(`user_access?${queryParam}&select=*&limit=1`, {}, env);
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) userRecord = list[0];
    }
  } catch (e) {
    console.warn("[Supabase] user_access query error:", e.message);
  }

  // If no record exists, create default 30-minute trial starting on first login
  if (!userRecord) {
    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 30 * 60 * 1000); // 30 mins
    const newRecord = {
      user_id: ident,
      username: ident.includes("@") ? ident.split("@")[0] : ident,
      email: ident.includes("@") ? ident : `${ident}@pepperonyx.dpdns.org`,
      access_policy: "trial",
      trial_started_at: now.toISOString(),
      trial_expires_at: trialExpiry.toISOString(),
      is_lifetime: false,
      is_suspended: false,
    };

    try {
      const createRes = await sbFetch("user_access", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(newRecord),
      }, env);
      if (createRes.ok) {
        const created = await createRes.json();
        if (created && created[0]) userRecord = created[0];
      }
    } catch {}

    if (!userRecord) userRecord = newRecord;
  }

  // 1. Suspension Check
  if (userRecord.is_suspended) {
    return {
      hasAccess: false,
      policy: userRecord.access_policy,
      isSuspended: true,
      isExpired: true,
      remainingSeconds: 0,
      username: userRecord.username,
      message: "Access has been suspended by the administrator.",
    };
  }

  // 2. Lifetime Access
  if (userRecord.is_lifetime || userRecord.is_exempt || userRecord.access_policy === "lifetime") {
    return {
      hasAccess: true,
      policy: "lifetime",
      isLifetime: true,
      isExpired: false,
      isSuspended: false,
      remainingSeconds: 999999999,
      username: userRecord.username,
      message: "Lifetime free access active.",
    };
  }

  // 3. Custom Duration Access
  if (userRecord.access_policy === "custom") {
    const expiresAt = userRecord.custom_expires_at ? new Date(userRecord.custom_expires_at).getTime() : 0;
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const isExpired = remaining <= 0;
    return {
      hasAccess: !isExpired,
      policy: "custom",
      isExpired,
      isSuspended: false,
      remainingSeconds: remaining,
      expiresAt: userRecord.custom_expires_at,
      username: userRecord.username,
      message: isExpired ? "Custom access period has expired." : "Custom access active.",
    };
  }

  // 4. Free Trial Access (30 Minutes)
  if (userRecord.access_policy === "trial") {
    // If trial hasn't started yet, start now
    if (!userRecord.trial_started_at) {
      const now = new Date();
      const trialExpiry = new Date(now.getTime() + 30 * 60 * 1000);
      userRecord.trial_started_at = now.toISOString();
      userRecord.trial_expires_at = trialExpiry.toISOString();
      sbFetch(`user_access?id=eq.${userRecord.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          trial_started_at: userRecord.trial_started_at,
          trial_expires_at: userRecord.trial_expires_at,
        }),
      }, env).catch(() => {});
    }

    const expiryTime = new Date(userRecord.trial_expires_at).getTime();
    const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
    const isExpired = remaining <= 0;

    return {
      hasAccess: !isExpired,
      policy: "trial",
      isExpired,
      isSuspended: false,
      remainingSeconds: remaining,
      trialStartedAt: userRecord.trial_started_at,
      trialExpiresAt: userRecord.trial_expires_at,
      username: userRecord.username,
      message: isExpired ? "30-Minute Free Trial has expired. Please upgrade to continue." : "30-Minute Free Trial active.",
    };
  }

  // 5. Subscription Required (₹29 / 30 Days)
  // Check active subscriptions in database
  const nowIso = new Date().toISOString();
  let activeSub = null;
  try {
    const subRes = await sbFetch(`subscriptions?username=eq.${encodeURIComponent(userRecord.username)}&status=eq.active&expires_at=gt.${nowIso}&order=expires_at.desc&limit=1`, {}, env);
    if (subRes.ok) {
      const subs = await subRes.json();
      if (Array.isArray(subs) && subs.length > 0) activeSub = subs[0];
    }
  } catch {}

  if (activeSub) {
    const expTime = new Date(activeSub.expires_at).getTime();
    const remaining = Math.max(0, Math.floor((expTime - Date.now()) / 1000));
    return {
      hasAccess: true,
      policy: "subscription",
      isExpired: false,
      isSuspended: false,
      remainingSeconds: remaining,
      expiresAt: activeSub.expires_at,
      subscriptionId: activeSub.id,
      username: userRecord.username,
      message: "Stark Premium Subscription active.",
    };
  }

  return {
    hasAccess: false,
    policy: "subscription_required",
    isExpired: true,
    isSuspended: false,
    remainingSeconds: 0,
    username: userRecord.username,
    message: "Subscription required (₹29 / 30 Days). Please visit https://payments.gaurxv.eu.org to activate access.",
  };
}

/* ---------------- Admin Dashboard Data & Actions ---------------- */
export async function getAdminSubscriptionsData(env) {
  let pendingProofs = [];
  let allProofs = [];
  let userAccessList = [];
  let subscriptionsList = [];
  let auditLogs = [];
  let accountRequests = [];

  try {
    const [pRes, uRes, sRes, aRes, rRes] = await Promise.all([
      sbFetch("payment_proofs?order=created_at.desc&limit=50", {}, env),
      sbFetch("user_access?order=created_at.desc&limit=100", {}, env),
      sbFetch("subscriptions?order=created_at.desc&limit=100", {}, env),
      sbFetch("admin_audit_logs?order=created_at.desc&limit=30", {}, env),
      sbFetch("account_requests?order=created_at.desc&limit=30", {}, env),
    ]);

    if (pRes.ok) allProofs = await pRes.json();
    if (uRes.ok) userAccessList = await uRes.json();
    if (sRes.ok) subscriptionsList = await sRes.json();
    if (aRes.ok) auditLogs = await aRes.json();
    if (rRes.ok) accountRequests = await rRes.json();
  } catch (e) {
    console.warn("[Supabase] getAdminSubscriptionsData error:", e.message);
  }

  pendingProofs = allProofs.filter((p) => p.verification_status === "pending");
  const approvedCount = allProofs.filter((p) => p.verification_status === "approved").length;
  const activeSubsCount = subscriptionsList.filter((s) => s.status === "active" && new Date(s.expires_at) > new Date()).length;
  const lifetimeCount = userAccessList.filter((u) => u.is_lifetime || u.access_policy === "lifetime").length;
  const trialCount = userAccessList.filter((u) => u.access_policy === "trial").length;

  return {
    metrics: {
      totalUsers: userAccessList.length,
      activeSubscriptions: activeSubsCount,
      pendingProofs: pendingProofs.length,
      approvedProofs: approvedCount,
      lifetimeUsers: lifetimeCount,
      trialUsers: trialCount,
      totalRevenue: approvedCount * 29,
    },
    pendingProofs,
    recentProofs: allProofs,
    users: userAccessList,
    subscriptions: subscriptionsList,
    auditLogs,
    accountRequests,
  };
}

export async function handleAdminSubscriptionAction(payload, adminUser, env) {
  const { action, proofId, username, email, policy, days, reason, targetUser } = payload || {};
  const currentAdmin = adminUser || "gaurxv";

  if (action === "approve_payment") {
    if (!proofId) throw new Error("Missing proofId for approval.");

    // 1. Fetch proof record
    const proofRes = await sbFetch(`payment_proofs?id=eq.${proofId}&select=*`, {}, env);
    if (!proofRes.ok) throw new Error("Could not find payment proof.");
    const proofs = await proofRes.json();
    const proof = proofs[0];
    if (!proof) throw new Error("Proof not found.");

    const target = proof.username;
    const targetEmail = proof.email;

    // 2. Calculate subscription expiry (Add 30 days to existing expiry if early renewal)
    const now = new Date();
    let startDate = now;
    let expiresDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const existingSubRes = await sbFetch(`subscriptions?username=eq.${encodeURIComponent(target)}&status=eq.active&expires_at=gt.${now.toISOString()}&order=expires_at.desc&limit=1`, {}, env);
    if (existingSubRes.ok) {
      const existingSubs = await existingSubRes.json();
      if (Array.isArray(existingSubs) && existingSubs.length > 0) {
        const curExp = new Date(existingSubs[0].expires_at);
        expiresDate = new Date(curExp.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
    }

    // 3. Insert new subscription record
    await sbFetch("subscriptions", {
      method: "POST",
      body: JSON.stringify({
        user_id: target,
        username: target,
        status: "active",
        plan_name: "Stark 30-Day Premium",
        amount: 29.0,
        started_at: startDate.toISOString(),
        expires_at: expiresDate.toISOString(),
        approved_by: currentAdmin,
      }),
    }, env);

    // 4. Update proof status to approved
    await sbFetch(`payment_proofs?id=eq.${proofId}`, {
      method: "PATCH",
      body: JSON.stringify({
        verification_status: "approved",
        reviewed_by: currentAdmin,
        reviewed_at: now.toISOString(),
      }),
    }, env);

    // 5. Update user_access record
    await sbFetch(`user_access?username=eq.${encodeURIComponent(target)}`, {
      method: "PATCH",
      body: JSON.stringify({
        access_policy: "subscription_required",
        is_suspended: false,
      }),
    }, env);

    // 6. Send Telegram notice
    const tgMsg = `✅ *PAYMENT APPROVED & ACCESS ACTIVATED*\n━━━━━━━━━━━━━━━━━━━━\n👤 *User:* \`@${target}\`\n💰 *Amount:* ₹29.00\n🔢 *UTR:* \`${proof.utr_reference}\`\n⏳ *Access Expiry:* \`${expiresDate.toLocaleDateString("en-IN")}\`\n👮 *Approved By:* \`${currentAdmin}\``;
    sendTelegramMessage(tgMsg).catch(() => {});

    // 7. Send Brevo Activation Email
    const expiryStr = expiresDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const emailHtml = `
      <div style="font-family:'Segoe UI',system-ui,sans-serif;background:#050508;color:#f1f5f9;padding:32px 20px;border-radius:16px;max-width:560px;margin:auto;border:1px solid rgba(56,189,248,0.3);">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="font-size:26px;color:#38bdf8;margin:0 0 4px 0;font-weight:800;">Gaurxv Verse ⎊</h1>
          <p style="font-size:12px;color:#34d399;margin:0;letter-spacing:1.5px;text-transform:uppercase;font-weight:bold;">Access Activated Successfully</p>
        </div>
        <div style="background:#0c0d16;border:1px solid rgba(52,211,153,0.3);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
          <h2 style="font-size:20px;color:#fff;margin:0 0 10px 0;">Welcome to Stark Premium!</h2>
          <p style="font-size:14px;color:#cbd5e1;line-height:1.6;margin:0 0 16px 0;">
            Your payment of <strong>₹29.00</strong> has been verified by the administrator. Your 30-day all-access pass is now active across all devices.
          </p>
          <div style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:12px;margin:16px 0;display:inline-block;">
            <span style="font-size:11px;color:#94a3b8;display:block;text-transform:uppercase;letter-spacing:1px;">Access Valid Until</span>
            <span style="font-size:16px;font-weight:bold;color:#38bdf8;">${expiryStr}</span>
          </div>
          <div>
            <a href="https://verse.gaurxv.eu.org" style="display:inline-block;background:#38bdf8;color:#000;font-weight:bold;padding:12px 28px;border-radius:24px;text-decoration:none;font-size:13px;margin-top:10px;">
              Launch Gaurxv Verse &rarr;
            </a>
          </div>
        </div>
        <p style="font-size:11px;color:#64748b;text-align:center;margin:0;">
          All 6 Pillars Unlocked: Anime, Movies, Manga, Novels, E-books & Music with cross-device sync.
        </p>
      </div>
    `;
    sendBrevoEmail({
      to: { email: targetEmail, name: target },
      subject: `🎉 Stark Premium Activated — Valid until ${expiryStr}`,
      htmlContent: emailHtml,
    }).catch(() => {});

    // 8. Record audit log
    await sbFetch("admin_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        admin_user: currentAdmin,
        target_user: target,
        action: "approve_payment",
        details: { proofId, utr: proof.utr_reference, expiresDate: expiresDate.toISOString() },
      }),
    }, env);

    return { success: true, message: `Access approved for @${target} until ${expiryStr}.` };
  }

  if (action === "reject_payment") {
    if (!proofId) throw new Error("Missing proofId.");
    const proofRes = await sbFetch(`payment_proofs?id=eq.${proofId}&select=*`, {}, env);
    const proofs = await proofRes.json();
    const proof = proofs[0];
    if (!proof) throw new Error("Proof not found.");

    await sbFetch(`payment_proofs?id=eq.${proofId}`, {
      method: "PATCH",
      body: JSON.stringify({
        verification_status: "rejected",
        rejection_reason: reason || "Bank verification failed / UTR not found",
        reviewed_by: currentAdmin,
        reviewed_at: new Date().toISOString(),
      }),
    }, env);

    // Send Brevo rejection notice
    sendBrevoEmail({
      to: { email: proof.email, name: proof.username },
      subject: `Payment Verification Update — Order ${proof.order_reference}`,
      htmlContent: `
        <div style="font-family:sans-serif;background:#050508;color:#fff;padding:24px;border-radius:12px;max-width:500px;margin:auto;">
          <h2 style="color:#ef4444;">Verification Unsuccessful</h2>
          <p>Your payment submission (${proof.order_reference}) could not be verified.</p>
          <p><strong>Reason:</strong> ${reason || "UTR could not be matched with bank statements."}</p>
          <p>Please contact <a href="mailto:work@gaurxv.eu.org" style="color:#38bdf8;">work@gaurxv.eu.org</a> or resubmit with the correct UTR.</p>
        </div>
      `,
    }).catch(() => {});

    await sbFetch("admin_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        admin_user: currentAdmin,
        target_user: proof.username,
        action: "reject_payment",
        details: { proofId, reason },
      }),
    }, env);

    return { success: true, message: "Payment proof rejected." };
  }

  if (action === "set_policy") {
    const user = targetUser || username;
    if (!user || !policy) throw new Error("Missing username or policy.");

    const updateData = { access_policy: policy };
    if (policy === "lifetime") {
      updateData.is_lifetime = true;
      updateData.is_suspended = false;
    } else {
      updateData.is_lifetime = false;
    }

    if (policy === "custom") {
      const numDays = Number(days) || 30;
      updateData.custom_expires_at = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
    }

    await sbFetch(`user_access?username=eq.${encodeURIComponent(user)}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    }, env);

    await sbFetch("admin_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        admin_user: currentAdmin,
        target_user: user,
        action: "set_policy",
        details: { policy, days },
      }),
    }, env);

    return { success: true, message: `Access policy for @${user} set to ${policy}.` };
  }

  if (action === "suspend_user" || action === "restore_user") {
    const user = targetUser || username;
    const suspend = action === "suspend_user";
    await sbFetch(`user_access?username=eq.${encodeURIComponent(user)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_suspended: suspend }),
    }, env);

    await sbFetch("admin_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        admin_user: currentAdmin,
        target_user: user,
        action: action,
      }),
    }, env);

    return { success: true, message: `User @${user} ${suspend ? "suspended" : "restored"}.` };
  }

  throw new Error(`Unknown action: ${action}`);
}

/* ---------------- Account Requests & Recovery ---------------- */
export async function handleAccountRequest({ username, email, fullName, note, env }) {
  const u = String(username || "").trim();
  const em = String(email || "").trim().toLowerCase();
  const name = String(fullName || "").trim();
  const msg = String(note || "").trim();

  if (!u || !em) throw new Error("Username and email are required.");

  await sbFetch("account_requests", {
    method: "POST",
    body: JSON.stringify({ username: u, email: em, full_name: name, note: msg, status: "pending" }),
  }, env);

  // Alert admin on Telegram
  const tgAlert = 
`🔔 *NEW ACCOUNT REQUEST*
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* \`@${u}\`
📛 *Name:* ${name || "Not provided"}
📧 *Email:* \`${em}\`
📝 *Note:* ${msg || "No note"}
━━━━━━━━━━━━━━━━━━━━
🔗 [Open Admin Panel](https://verse.gaurxv.eu.org/admin)`;

  sendTelegramMessage(tgAlert).catch(() => {});

  // Acknowledge user via Brevo
  sendBrevoEmail({
    to: { email: em, name: name || u },
    subject: "Gaurxv Verse — Account Request Received",
    htmlContent: `
      <div style="font-family:sans-serif;background:#050508;color:#fff;padding:24px;border-radius:12px;">
        <h2>Account Request Received</h2>
        <p>Hello @${u}, your account request has been submitted to the administrator. You will be notified once your account is created.</p>
      </div>
    `,
  }).catch(() => {});

  return { success: true, message: "Account request submitted successfully." };
}
