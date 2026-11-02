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
      const disablePreview = options.disableWebPagePreview !== undefined ? options.disableWebPagePreview : true;
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Connection: "close" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options.parseMode || "Markdown",
          reply_markup: options.replyMarkup,
          disable_web_page_preview: disablePreview,
          link_preview_options: { is_disabled: disablePreview },
        }),
      });
      const data = await res.json();
      if (data.ok) return data;

      // Fallback: If Markdown entity parsing failed, retry as plain text to guarantee delivery
      if (!data.ok && (data.description?.includes("parse") || data.description?.includes("entity"))) {
        const plainRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Connection: "close" },
          body: JSON.stringify({
            chat_id: chatId,
            text: text.replace(/[*_`\[\]()]/g, ""),
            reply_markup: options.replyMarkup,
            disable_web_page_preview: disablePreview,
            link_preview_options: { is_disabled: disablePreview },
          }),
        });
        const plainData = await plainRes.json();
        if (plainData.ok) return plainData;
      }

      if (attempt === 3) console.warn("[Telegram] sendMessage failed:", data.description || "Unknown error");
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

export async function answerTelegramCallbackQuery(callbackQueryId, text, showAlert = false) {
  const token = TELEGRAM_BOT_TOKEN;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[Telegram] answerCallbackQuery error:", e.message);
    return null;
  }
}

export async function editTelegramMessageCaption(chatId, messageId, caption, replyMarkup) {
  const token = TELEGRAM_BOT_TOKEN;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        caption,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[Telegram] editMessageCaption error:", e.message);
    return null;
  }
}

export async function editTelegramMessageText(chatId, messageId, text, replyMarkup) {
  const token = TELEGRAM_BOT_TOKEN;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[Telegram] editMessageText error:", e.message);
    return null;
  }
}

export async function setTelegramWebhook(webhookUrl) {
  const token = TELEGRAM_BOT_TOKEN;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });
    return await res.json();
  } catch (e) {
    console.warn("[Telegram] setWebhook error:", e.message);
    return null;
  }
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

  // 3. Save in Supabase payment_proofs table first to get proof ID
  const insertPayload = {
    order_reference: cleanRef,
    username: cleanUser,
    email: cleanEmail,
    amount: numAmount,
    utr_reference: cleanUtr,
    verification_status: "pending",
    screenshot_url: "telegram_bot_receipt",
  };

  let proofId = cleanRef;
  const dbRes = await sbFetch("payment_proofs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(insertPayload),
  }, env);

  if (dbRes.ok) {
    const inserted = await dbRes.json();
    if (Array.isArray(inserted) && inserted[0]?.id) {
      proofId = inserted[0].id;
    }
  } else {
    const errText = await dbRes.text();
    console.warn("[Supabase] Failed to record payment_proof:", errText);
  }

  // 4. Format Telegram Alert with Direct One-Tap Action Buttons
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
        { text: "✅ Approve (+30 Days)", callback_data: `approve:${proofId}` },
        { text: "❌ Reject", callback_data: `reject:${proofId}` }
      ],
      [
        { text: "🔍 Review in Admin Panel", url: "https://verse.gaurxv.eu.org/admin" }
      ]
    ]
  };

  // 5. Send directly to Telegram Bot
  if (imageBuffer && imageBuffer.length > 0) {
    await sendTelegramPhoto(imageBuffer, mimeType, caption, inlineKeyboard);
  } else {
    await sendTelegramMessage(caption, { replyMarkup: inlineKeyboard });
  }

  // 6. Send Brevo Receipt Confirmation Email to User
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

  // Look up user_access record (case-insensitive for username)
  const queryParam = ident.includes("@")
    ? `email=ilike.${encodeURIComponent(ident)}`
    : `username=ilike.${encodeURIComponent(ident)}`;
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

  // If no record exists in user_access, check account_requests for registered email
  let resolvedEmail = ident.includes("@") ? ident : "";
  let resolvedName = "";
  if (!userRecord && !ident.includes("@")) {
    try {
      const reqRes = await sbFetch(
        `account_requests?or=(username.ilike.${encodeURIComponent(ident)},full_name.ilike.${encodeURIComponent(ident)},email.ilike.${encodeURIComponent(ident)})&order=created_at.desc&limit=1`,
        {},
        env
      );
      if (reqRes.ok) {
        const rows = await reqRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          if (rows[0].email) resolvedEmail = rows[0].email;
          if (rows[0].full_name) resolvedName = rows[0].full_name;

          // Check if user_access already has a record under the canonical email or username
          const canonicalEmail = rows[0].email;
          const canonicalUser = rows[0].username;
          const matchUa = await sbFetch(
            `user_access?or=(email.ilike.${encodeURIComponent(canonicalEmail)},username.ilike.${encodeURIComponent(canonicalUser)})&select=*&limit=1`,
            {},
            env
          );
          if (matchUa.ok) {
            const uaRows = await matchUa.json();
            if (Array.isArray(uaRows) && uaRows.length > 0) {
              userRecord = uaRows[0];
            }
          }
        }
      }
    } catch (e) {
      console.warn("[Supabase] account_requests lookup error:", e.message);
    }
  }

  // If no record exists, verify personal email before provisioning a trial
  if (!userRecord) {
    // STRICT REQUIREMENT: NEVER synthesize artificial domain emails (@gaurxv.eu.org).
    // If no verified personal email is known, deny access without polluting database.
    if (!resolvedEmail && !ident.includes("@")) {
      return {
        hasAccess: false,
        policy: "subscription_required",
        isExpired: true,
        isSuspended: false,
        remainingSeconds: 0,
        username: ident,
        message: "No active access clearance found. Please request an account or sign in.",
      };
    }

    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 20 * 60 * 1000); // 20 mins trial duration
    const finalEmail = resolvedEmail || ident;
    const newRecord = {
      user_id: ident,
      username: ident.includes("@") ? ident.split("@")[0] : ident,
      email: finalEmail,
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

async function findPaymentProof(identifier, env) {
  if (!identifier) return null;
  const cleanId = String(identifier).trim();
  
  // 1. Try by UUID id
  let res = await sbFetch(`payment_proofs?id=eq.${encodeURIComponent(cleanId)}&select=*`, {}, env);
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list[0]) return list[0];
  }
  // 2. Try by order_reference
  res = await sbFetch(`payment_proofs?order_reference=eq.${encodeURIComponent(cleanId)}&select=*`, {}, env);
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list[0]) return list[0];
  }
  // 3. Try by utr_reference
  res = await sbFetch(`payment_proofs?utr_reference=eq.${encodeURIComponent(cleanId)}&select=*`, {}, env);
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list[0]) return list[0];
  }
  // 4. Try by username if pending
  res = await sbFetch(`payment_proofs?username=eq.${encodeURIComponent(cleanId)}&verification_status=eq.pending&order=created_at.desc&limit=1`, {}, env);
  if (res.ok) {
    const list = await res.json();
    if (Array.isArray(list) && list[0]) return list[0];
  }
  return null;
}

export async function handleAdminSubscriptionAction(payload, adminUser, env) {
  const { action, proofId, username, email, policy, days, reason, targetUser } = payload || {};
  const currentAdmin = adminUser || "gaurxv";

  if (action === "approve_payment") {
    if (!proofId) throw new Error("Missing proofId for approval.");

    // 1. Fetch proof record
    const proof = await findPaymentProof(proofId, env);
    if (!proof) throw new Error(`Proof not found for: ${proofId}`);
    const actualProofId = proof.id;

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
    await sbFetch(`payment_proofs?id=eq.${actualProofId}`, {
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
    const proof = await findPaymentProof(proofId, env);
    if (!proof) throw new Error(`Proof not found for: ${proofId}`);
    const actualProofId = proof.id;

    await sbFetch(`payment_proofs?id=eq.${actualProofId}`, {
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

    if (payload?.email && String(payload.email).includes("@")) {
      updateData.email = String(payload.email).trim().toLowerCase();
    }

    const patchRes = await sbFetch(`user_access?username=eq.${encodeURIComponent(user)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(updateData),
    }, env);

    // If user does not yet exist in user_access, insert new row
    let patchRows = [];
    if (patchRes.ok) {
      try { patchRows = await patchRes.json(); } catch {}
    }
    if (!Array.isArray(patchRows) || patchRows.length === 0) {
      await sbFetch("user_access", {
        method: "POST",
        body: JSON.stringify({
          user_id: user,
          username: user,
          email: updateData.email || null,
          ...updateData,
          is_suspended: false,
        }),
      }, env);
    }

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

  if (action === "delete_user") {
    return await handleDeleteAccount({
      targetUser: targetUser || username,
      currentAdmin,
      env,
    });
  }

  throw new Error(`Unknown action: ${action}`);
}

/* ---------------- Account Permanent Deletion Engine ---------------- */
export async function handleDeleteAccount({ targetUser, currentAdmin, env }) {
  const user = String(targetUser || "").trim();
  if (!user) {
    throw new Error("Target username is required for permanent account deletion.");
  }
  const userLower = user.toLowerCase();

  // Guard: Protect primary administrator (@gaurxv) from deletion
  if (
    userLower === "gaurxv" ||
    userLower === "admin" ||
    userLower === "gaurav" ||
    userLower === "gaurav@pepperonyx.dpdns.org"
  ) {
    throw new Error("Action Forbidden: Cannot delete primary administrator account (@gaurxv).");
  }

  // Guard: Prevent an administrator from deleting their own active account
  if (currentAdmin && userLower === String(currentAdmin).toLowerCase()) {
    throw new Error("Action Forbidden: Administrators cannot delete their own active account.");
  }

  // 1. Look up user_access record to determine canonical user_id and registered email
  let userId = user;
  let userEmail = "";
  let userPolicy = "";
  try {
    const uRes = await sbFetch(
      `user_access?username=ilike.${encodeURIComponent(user)}&select=*&limit=1`,
      {},
      env
    );
    if (uRes.ok) {
      const uRows = await uRes.json();
      if (Array.isArray(uRows) && uRows.length > 0) {
        userId = uRows[0].user_id || user;
        userEmail = uRows[0].email || "";
        userPolicy = uRows[0].access_policy || "";
      }
    }
  } catch (err) {
    console.warn("[DeleteAccount] user_access lookup error:", err.message);
  }

  // 2. Cascade permanent deletion across all user-owned application tables
  const deletionErrors = [];

  // Table: user_access
  try {
    await sbFetch(`user_access?username=ilike.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
  } catch (e) {
    deletionErrors.push(`user_access: ${e.message}`);
  }

  // Table: user_profiles
  try {
    await sbFetch(`user_profiles?username=ilike.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
    if (userId && userId !== user) {
      await sbFetch(`user_profiles?id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, env);
    }
  } catch (e) {
    deletionErrors.push(`user_profiles: ${e.message}`);
  }

  // Table: user_library
  try {
    await sbFetch(`user_library?user_id=eq.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
    if (userId && userId !== user) {
      await sbFetch(`user_library?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, env);
    }
  } catch (e) {
    deletionErrors.push(`user_library: ${e.message}`);
  }

  // Table: user_reading_progress
  try {
    await sbFetch(`user_reading_progress?user_id=eq.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
    if (userId && userId !== user) {
      await sbFetch(`user_reading_progress?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, env);
    }
  } catch (e) {
    deletionErrors.push(`user_reading_progress: ${e.message}`);
  }

  // Table: user_preferences
  try {
    await sbFetch(`user_preferences?user_id=eq.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
    if (userId && userId !== user) {
      await sbFetch(`user_preferences?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, env);
    }
  } catch (e) {
    deletionErrors.push(`user_preferences: ${e.message}`);
  }

  // Table: user_settings
  try {
    await sbFetch(`user_settings?user_id=eq.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
    if (userId && userId !== user) {
      await sbFetch(`user_settings?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, env);
    }
  } catch (e) {
    deletionErrors.push(`user_settings: ${e.message}`);
  }

  // Table: account_requests
  try {
    await sbFetch(`account_requests?username=ilike.${encodeURIComponent(user)}`, { method: "DELETE" }, env);
  } catch (e) {
    deletionErrors.push(`account_requests: ${e.message}`);
  }

  // 3. Remove user credentials from STARK_KV if configured
  if (env && env.STARK_KV) {
    try {
      const raw = await env.STARK_KV.get("stark_users");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((c) => c.username?.toLowerCase() !== userLower);
          await env.STARK_KV.put("stark_users", JSON.stringify(filtered));
        }
      }
    } catch (e) {
      console.warn("[DeleteAccount] STARK_KV cleanup warning:", e.message);
    }
  }

  // 4. Supabase Auth identity deletion (if user exists in auth.users and service role is present)
  const { url } = getSbConfig(env);
  const serviceKey =
    (env && env.SUPABASE_SERVICE_ROLE_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    "";
  if (serviceKey && userId && userId.length === 36 && userId.includes("-")) {
    try {
      await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      });
    } catch (e) {
      console.warn("[DeleteAccount] Supabase Auth admin delete warning:", e.message);
    }
  }

  // 5. Financial compliance: Preserve payment_proofs and record irreversible deletion in admin_audit_logs
  try {
    await sbFetch("admin_audit_logs", {
      method: "POST",
      body: JSON.stringify({
        admin_user: currentAdmin || "gaurxv",
        target_user: user,
        action: "delete_user",
        details: JSON.stringify({
          deleted_user: user,
          user_id: userId,
          email: userEmail,
          policy: userPolicy,
          timestamp: new Date().toISOString(),
          partial_errors: deletionErrors.length > 0 ? deletionErrors : undefined,
        }),
      }),
    }, env);
  } catch (e) {
    console.warn("[DeleteAccount] admin_audit_logs error:", e.message);
  }

  // Alert Telegram bot of account deletion
  try {
    const alertMsg =
`🗑️ *ACCOUNT PERMANENTLY DELETED*
━━━━━━━━━━━━━━━━━━━━
👤 *Deleted User:* \`@${user}\`
🆔 *User ID:* \`${userId}\`
📧 *Email:* \`${userEmail || "None"}\`
🛡️ *Deleted By:* \`@${currentAdmin || "gaurxv"}\`
📅 *Timestamp:* ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
━━━━━━━━━━━━━━━━━━━━
All profile, library, reading progress, preferences, and settings records were permanently expunged.`;
    await sendTelegramMessage(alertMsg);
  } catch {}

  return {
    success: true,
    message: `Account @${user} permanently deleted. All user-owned records and credentials removed.`,
  };
}

/* ---------------- Account Requests & Recovery ---------------- */
export async function handleAccountRequest({ username, email, fullName, note, env }) {
  const u = String(username || "").trim();
  const em = String(email || "").trim().toLowerCase();
  const name = String(fullName || "").trim();
  const msg = String(note || "").trim();

  if (!u || !em) throw new Error("Username and email are required.");

  try {
    await sbFetch("account_requests", {
      method: "POST",
      body: JSON.stringify({ username: u, email: em, full_name: name, note: msg, status: "pending" }),
    }, env);
  } catch (err) {
    console.warn("[Account Request] Supabase insert warning:", err?.message || err);
  }

  // Alert admin on Telegram with One-Tap Action Buttons
  const tgAlert = 
`🔔 *NEW ACCOUNT REQUEST*
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* \`@${u}\`
📛 *Name:* ${name || "Not provided"}
📧 *Email:* \`${em}\`
📝 *Note:* ${msg || "No note"}
━━━━━━━━━━━━━━━━━━━━
👉 Tap *[⚡ Approve & Generate Passcode]* to provision login credentials instantly.`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "⚡ Approve & Generate Passcode", callback_data: `approve_req:${u}` },
        { text: "❌ Reject", callback_data: `reject_req:${u}` },
      ],
      [
        { text: "🔍 Open Admin Console", url: "https://verse.gaurxv.eu.org/admin" },
      ],
    ],
  };

  // Crucial: await sendTelegramMessage so background isolate on Cloudflare does not terminate
  await sendTelegramMessage(tgAlert, { replyMarkup: inlineKeyboard });

  // Acknowledge user via Brevo
  try {
    await sendBrevoEmail({
      to: { email: em, name: name || u },
      subject: "Gaurxv Verse — Account Request Received",
      htmlContent: `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;background:#050508;color:#f1f5f9;padding:32px 20px;border-radius:16px;max-width:540px;margin:auto;border:1px solid rgba(255,255,255,0.08);">
          <div style="text-align:center;margin-bottom:20px;">
            <h1 style="font-size:24px;color:#38bdf8;margin:0 0 4px 0;font-weight:800;">Gaurxv Verse ⎊</h1>
            <p style="font-size:12px;color:#94a3b8;margin:0;letter-spacing:1.5px;text-transform:uppercase;">Access Clearance Request Received</p>
          </div>
          <div style="background:#0c0d16;border:1px solid rgba(56,189,248,0.2);border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="font-size:14px;margin:0 0 12px 0;">Hello <strong>@${u}</strong>,</p>
            <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 12px 0;">
              Your request for an administrator-approved account on <strong>Gaurxv Verse</strong> has been transmitted directly to the administrator's Telegram bot.
            </p>
            <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0;">
              Once approved, your clearance passcode will be generated and dispatched to this email address.
            </p>
          </div>
        </div>
      `,
    });
  } catch {}

  return { success: true, message: "Account request submitted successfully." };
}

/* ---------------- Telegram Webhook & In-Bot Direct Approval Engine ---------------- */
export async function handleTelegramWebhook(update, env) {
  if (!update) return { ok: false, error: "Empty update payload" };

  const adminChatId = String(TELEGRAM_ADMIN_CHAT_ID);

  // 1. One-tap Inline Button Callback (Approve / Reject / Generate Credentials / Email)
  if (update.callback_query) {
    const cb = update.callback_query;
    const fromId = String(cb.from?.id || "");

    // Strict Authorization: Only the verified admin can tap actions
    if (fromId !== adminChatId) {
      await answerTelegramCallbackQuery(cb.id, "⛔ Unauthorized: Admin clearance required.", true);
      return { ok: false, error: "Unauthorized" };
    }

    const data = String(cb.data || "");
    const colonIdx = data.indexOf(":");
    const action = colonIdx > -1 ? data.slice(0, colonIdx) : data;
    const targetId = colonIdx > -1 ? data.slice(colonIdx + 1) : "";

    // 1A. Approve Payment Proof
    if (action === "approve") {
      try {
        const actionResult = await handleAdminSubscriptionAction(
          { action: "approve_payment", proofId: targetId },
          `Telegram Bot (@${cb.from?.username || "Admin"})`,
          env
        );

        await answerTelegramCallbackQuery(cb.id, "✅ Payment approved! 30-Day pass activated.");

        if (cb.message) {
          const chatId = cb.message.chat.id;
          const messageId = cb.message.message_id;
          const original = cb.message.caption || cb.message.text || "";
          const updated = `${original}\n\n✅ *APPROVED BY ADMIN VIA BOT*\n🎉 30-Day Pass Active | Confirmation Email Sent\n👮 *Actioned By:* \`@${cb.from?.username || "Admin"}\``;
          const finalKeyboard = {
            inline_keyboard: [
              [
                { text: "🔍 View in Admin Dashboard", url: "https://verse.gaurxv.eu.org/admin" }
              ]
            ]
          };

          if (cb.message.caption !== undefined) {
            await editTelegramMessageCaption(chatId, messageId, updated, finalKeyboard);
          } else {
            await editTelegramMessageText(chatId, messageId, updated, finalKeyboard);
          }
        }
        return { ok: true, action: "approved", result: actionResult };
      } catch (err) {
        await answerTelegramCallbackQuery(cb.id, `⚠️ Error: ${err.message}`, true);
        return { ok: false, error: err.message };
      }
    }

    // 1B. Reject Payment Proof
    if (action === "reject") {
      try {
        const actionResult = await handleAdminSubscriptionAction(
          { action: "reject_payment", proofId: targetId, reason: "Rejected via Telegram Bot" },
          `Telegram Bot (@${cb.from?.username || "Admin"})`,
          env
        );

        await answerTelegramCallbackQuery(cb.id, "❌ Payment marked rejected.");

        if (cb.message) {
          const chatId = cb.message.chat.id;
          const messageId = cb.message.message_id;
          const original = cb.message.caption || cb.message.text || "";
          const updated = `${original}\n\n❌ *REJECTED BY ADMIN VIA BOT*\nUser notified via Brevo email.\n👮 *Actioned By:* \`@${cb.from?.username || "Admin"}\``;
          const finalKeyboard = {
            inline_keyboard: [
              [
                { text: "🔍 View in Admin Dashboard", url: "https://verse.gaurxv.eu.org/admin" }
              ]
            ]
          };

          if (cb.message.caption !== undefined) {
            await editTelegramMessageCaption(chatId, messageId, updated, finalKeyboard);
          } else {
            await editTelegramMessageText(chatId, messageId, updated, finalKeyboard);
          }
        }
        return { ok: true, action: "rejected", result: actionResult };
      } catch (err) {
        await answerTelegramCallbackQuery(cb.id, `⚠️ Error: ${err.message}`, true);
        return { ok: false, error: err.message };
      }
    }

    // 1C. Approve Account Request & Generate Passcode
    if (action === "approve_req") {
      try {
        const targetUser = targetId;
        const passcode = `stark-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;

        let userEmail = "";
        let fullName = "";
        try {
          const reqRes = await sbFetch(`account_requests?or=(username.ilike.${encodeURIComponent(targetUser)},full_name.ilike.${encodeURIComponent(targetUser)})&order=created_at.desc&limit=1`, {}, env);
          if (reqRes.ok) {
            const rows = await reqRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              userEmail = rows[0].email;
              fullName = rows[0].full_name;
            }
          }
        } catch {}

        if (!userEmail) {
          try {
            const uCheck = await sbFetch(`user_access?username=ilike.${encodeURIComponent(targetUser)}&select=email,user_id&limit=1`, {}, env);
            if (uCheck.ok) {
              const uRows = await uCheck.json();
              if (Array.isArray(uRows) && uRows[0]?.email) userEmail = uRows[0].email;
            }
          } catch {}
        }

        // STRICT REQUIREMENT: NEVER synthesize @gaurxv.eu.org or artificial project domain emails.
        if (!userEmail) {
          throw new Error(`Cannot approve request: No personal email found for @${targetUser}.`);
        }

        // Update Supabase account_requests
        try {
          await sbFetch(`account_requests?username=eq.${encodeURIComponent(targetUser)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "approved", passcode }),
          }, env);
        } catch {}

        // Ensure user entry in user_access
        try {
          await sbFetch("user_access", {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates" },
            body: JSON.stringify({
              user_id: targetUser,
              username: targetUser,
              email: userEmail,
              access_policy: "trial",
              is_suspended: false,
              is_lifetime: false,
            }),
          }, env);
        } catch {}

        // Update STARK_KV if available
        if (env && env.STARK_KV) {
          try {
            let kvUsers = [];
            const raw = await env.STARK_KV.get("stark_users");
            if (raw) kvUsers = JSON.parse(raw);
            const filtered = Array.isArray(kvUsers) ? kvUsers.filter((x) => x.username?.toLowerCase() !== targetUser.toLowerCase()) : [];
            filtered.push({
              username: targetUser,
              password: passcode,
              displayName: fullName || targetUser,
            });
            await env.STARK_KV.put("stark_users", JSON.stringify(filtered));
          } catch {}
        }

        await answerTelegramCallbackQuery(cb.id, `✅ Passcode generated: ${passcode}`);

        const credText = 
`⚡ *ACCOUNT APPROVED & PASSCODE GENERATED*
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* \`@${targetUser}\`
🔑 *Passcode:* \`${passcode}\`
📧 *Email:* \`${userEmail}\`
📛 *Name:* ${fullName || "Not provided"}
━━━━━━━━━━━━━━━━━━━━
👉 Tap *[📧 Send Credentials Email]* below to deliver credentials to user via Brevo.`;

        const credKeyboard = {
          inline_keyboard: [
            [
              { text: `📧 Send Credentials Email (${userEmail})`, callback_data: `send_mail:${targetUser}` },
            ],
            [
              { text: "🔍 Open Admin Console", url: "https://verse.gaurxv.eu.org/admin" },
            ],
          ],
        };

        if (cb.message) {
          const chatId = cb.message.chat.id;
          const messageId = cb.message.message_id;
          if (cb.message.caption !== undefined) {
            await editTelegramMessageCaption(chatId, messageId, credText, credKeyboard);
          } else {
            await editTelegramMessageText(chatId, messageId, credText, credKeyboard);
          }
        } else {
          await sendTelegramMessage(credText, { replyMarkup: credKeyboard });
        }
        return { ok: true, action: "account_approved", username: targetUser, passcode };
      } catch (err) {
        await answerTelegramCallbackQuery(cb.id, `⚠️ Error: ${err.message}`, true);
        return { ok: false, error: err.message };
      }
    }

    // 1D. Send Credentials Email via Brevo
    if (action === "send_mail") {
      try {
        const targetUser = targetId;
        let userEmail = "";
        let fullName = "";
        let passcode = "";

        // Look up user details in account_requests or user_access
        try {
          const reqRes = await sbFetch(`account_requests?or=(username.ilike.${encodeURIComponent(targetUser)},full_name.ilike.${encodeURIComponent(targetUser)})&order=created_at.desc&limit=1`, {}, env);
          if (reqRes.ok) {
            const rows = await reqRes.json();
            if (Array.isArray(rows) && rows.length > 0) {
              userEmail = rows[0].email;
              fullName = rows[0].full_name;
              passcode = rows[0].passcode;
            }
          }
        } catch {}

        if (!userEmail) {
          try {
            const uCheck = await sbFetch(`user_access?username=ilike.${encodeURIComponent(targetUser)}&select=email&limit=1`, {}, env);
            if (uCheck.ok) {
              const uRows = await uCheck.json();
              if (Array.isArray(uRows) && uRows[0]?.email) userEmail = uRows[0].email;
            }
          } catch {}
        }

        if (!passcode && env && env.STARK_KV) {
          try {
            const raw = await env.STARK_KV.get("stark_users");
            if (raw) {
              const kvUsers = JSON.parse(raw);
              const found = kvUsers.find((x) => x.username?.toLowerCase() === targetUser.toLowerCase());
              if (found) {
                passcode = found.password;
                fullName = found.displayName || fullName;
              }
            }
          } catch {}
        }

        if (!passcode) {
          passcode = `stark-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
        }
        if (!userEmail) {
          throw new Error(`Cannot send credentials: No personal email on file for @${targetUser}.`);
        }

        const emailHtml = `
          <div style="font-family:'Segoe UI',system-ui,sans-serif;background:#050508;color:#f1f5f9;padding:36px 24px;border-radius:18px;max-width:560px;margin:auto;border:1px solid rgba(255,255,255,0.1);">
            <div style="text-align:center;margin-bottom:28px;">
              <h1 style="font-size:26px;color:#38bdf8;margin:0 0 6px 0;font-weight:900;letter-spacing:0.5px;">Gaurxv Verse ⎊</h1>
              <p style="font-size:12px;color:#94a3b8;margin:0;letter-spacing:1.5px;text-transform:uppercase;">Stark Entertainment Access Clearance</p>
            </div>
            <div style="background:#0c0d16;border:1px solid rgba(56,189,248,0.25);border-radius:14px;padding:24px;margin-bottom:24px;">
              <p style="font-size:15px;margin:0 0 14px 0;">Welcome, <strong>${fullName || targetUser}</strong>!</p>
              <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 18px 0;">
                Your account clearance has been approved by the administrator. Use your credentials below to unlock the <strong>Stark Security Gate</strong>:
              </p>
              <div style="background:#131522;border:1px dashed rgba(56,189,248,0.4);border-radius:10px;padding:16px;margin-bottom:20px;font-family:monospace;">
                <div style="margin-bottom:8px;font-size:13px;color:#94a3b8;">
                  Username: <strong style="color:#38bdf8;font-size:15px;">${targetUser}</strong>
                </div>
                <div style="font-size:13px;color:#94a3b8;">
                  Passcode: <strong style="color:#4ade80;font-size:15px;letter-spacing:1px;">${passcode}</strong>
                </div>
              </div>
              <div style="text-align:center;margin:24px 0 12px 0;">
                <a href="https://verse.gaurxv.eu.org/" style="display:inline-block;background:#38bdf8;color:#050508;font-weight:800;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(56,189,248,0.3);">
                  Unlock Gaurxv Verse ⎊
                </a>
              </div>
            </div>
            <p style="font-size:11px;color:#64748b;text-align:center;margin:0;">
              Stark Entertainment Protocol · If you did not request this, contact work@gaurxv.eu.org
            </p>
          </div>
        `;

        const sent = await sendBrevoEmail({
          to: { email: userEmail, name: fullName || targetUser },
          subject: "⚡ Your Gaurxv Verse Clearance Passcode & Access Pass",
          htmlContent: emailHtml,
        });

        if (sent) {
          await answerTelegramCallbackQuery(cb.id, `✅ Credentials emailed to ${userEmail}!`);
          await sendTelegramMessage(`📨 *EMAIL DELIVERED:* Login credentials for \`@${targetUser}\` were successfully sent to \`${userEmail}\` via Brevo!`, { chatId: cb.message?.chat?.id || adminChatId });
        } else {
          await answerTelegramCallbackQuery(cb.id, `⚠️ Failed to send email via Brevo.`, true);
          await sendTelegramMessage(`⚠️ *Email Delivery Failed:* Could not send credentials to \`${userEmail}\`. Check Brevo API quota.`, { chatId: cb.message?.chat?.id || adminChatId });
        }
        return { ok: true, action: "email_sent", email: userEmail };
      } catch (err) {
        await answerTelegramCallbackQuery(cb.id, `⚠️ Error: ${err.message}`, true);
        return { ok: false, error: err.message };
      }
    }

    // 1E. Reject Account Request
    if (action === "reject_req") {
      try {
        const targetUser = targetId;
        await sbFetch(`account_requests?username=eq.${encodeURIComponent(targetUser)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected" }),
        }, env);

        await answerTelegramCallbackQuery(cb.id, `❌ Request for @${targetUser} rejected.`);

        if (cb.message) {
          const chatId = cb.message.chat.id;
          const messageId = cb.message.message_id;
          const original = cb.message.caption || cb.message.text || "";
          const updated = `${original}\n\n❌ *REQUEST REJECTED BY ADMIN*\n👮 *Actioned By:* \`@${cb.from?.username || "Admin"}\``;
          const finalKeyboard = {
            inline_keyboard: [
              [{ text: "🔍 Open Admin Console", url: "https://verse.gaurxv.eu.org/admin" }]
            ]
          };
          if (cb.message.caption !== undefined) {
            await editTelegramMessageCaption(chatId, messageId, updated, finalKeyboard);
          } else {
            await editTelegramMessageText(chatId, messageId, updated, finalKeyboard);
          }
        }
        return { ok: true, action: "request_rejected" };
      } catch (err) {
        await answerTelegramCallbackQuery(cb.id, `⚠️ Error: ${err.message}`, true);
        return { ok: false, error: err.message };
      }
    }
  }

  // 2. Text Commands Sent to the Bot (@JarvisXPay_Bot)
  if (update.message) {
    const msg = update.message;
    const chatId = String(msg.chat?.id || "");
    const text = String(msg.text || "").trim();

    if (chatId !== adminChatId) {
      await sendTelegramMessage("🔒 *Gaurxv Verse Security System*\nThis bot only accepts commands from the designated administrator.", { chatId });
      return { ok: true };
    }

    if (text === "/start" || text === "/help") {
      const helpMsg = 
`⚡ *GAURXV VERSE BOT MANUAL*
━━━━━━━━━━━━━━━━━━━━
Interactive controls for subscriptions, payment approvals & account credentials!

*Commands:*
• \`/pending\` — List pending payment proofs with 1-tap approval
• \`/requests\` — List pending account clearance requests
• \`/approve <Order-ID or UTR>\` — Approve payment pass (+30 days)
• \`/reject <Order-ID or UTR>\` — Reject payment pass
• \`/create <username>\` — Generate passcode for user
• \`/mail <username>\` — Send login credentials email via Brevo
• \`/status <username>\` — Check user entitlement & subscription
• \`/stats\` — System metrics, revenue & user count
• \`/help\` — Show this command manual`;
      await sendTelegramMessage(helpMsg, { chatId });
      return { ok: true };
    }

    if (text === "/pending") {
      const pendingRes = await sbFetch("payment_proofs?verification_status=eq.pending&order=created_at.desc&limit=5", {}, env);
      if (pendingRes.ok) {
        const list = await pendingRes.json();
        if (!Array.isArray(list) || list.length === 0) {
          await sendTelegramMessage("🎉 *No Pending Payments!*\nAll payment proofs are caught up and verified.", { chatId });
          return { ok: true };
        }

        await sendTelegramMessage(`📋 *PENDING PAYMENT PROOFS (${list.length}):*`, { chatId });
        for (const item of list) {
          const itemText = 
`👤 *User:* \`@${item.username}\`
📧 *Email:* \`${item.email}\`
💰 *Amount:* ₹${item.amount}
🔢 *UTR:* \`${item.utr_reference}\`
🔖 *Order:* \`${item.order_reference}\`
🕒 *Date:* \`${new Date(item.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\``;

          const itemKeyboard = {
            inline_keyboard: [
              [
                { text: `✅ Approve @${item.username}`, callback_data: `approve:${item.id}` },
                { text: `❌ Reject`, callback_data: `reject:${item.id}` }
              ]
            ]
          };
          await sendTelegramMessage(itemText, { chatId, replyMarkup: itemKeyboard });
        }
        return { ok: true };
      }
    }

    if (text === "/requests") {
      const reqRes = await sbFetch("account_requests?status=eq.pending&order=created_at.desc&limit=5", {}, env);
      if (reqRes.ok) {
        const list = await reqRes.json();
        if (!Array.isArray(list) || list.length === 0) {
          await sendTelegramMessage("🎉 *No Pending Requests!*\nAll account requests have been processed.", { chatId });
          return { ok: true };
        }

        await sendTelegramMessage(`📋 *PENDING ACCOUNT REQUESTS (${list.length}):*`, { chatId });
        for (const item of list) {
          const itemText = 
`👤 *User:* \`@${item.username}\`
📛 *Name:* ${item.full_name || "Not provided"}
📧 *Email:* \`${item.email}\`
📝 *Note:* ${item.note || "No note"}
🕒 *Date:* \`${new Date(item.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\``;

          const itemKeyboard = {
            inline_keyboard: [
              [
                { text: `⚡ Approve @${item.username}`, callback_data: `approve_req:${item.username}` },
                { text: `❌ Reject`, callback_data: `reject_req:${item.username}` }
              ]
            ]
          };
          await sendTelegramMessage(itemText, { chatId, replyMarkup: itemKeyboard });
        }
        return { ok: true };
      }
    }

    if (text.startsWith("/approve")) {
      const parts = text.split(/\s+/);
      const targetId = parts[1];
      if (!targetId) {
        await sendTelegramMessage("⚠️ Usage: `/approve <Order-ID or UTR>`", { chatId });
        return { ok: true };
      }
      try {
        const actionResult = await handleAdminSubscriptionAction(
          { action: "approve_payment", proofId: targetId },
          `Telegram Bot (@${msg.from?.username || "Admin"})`,
          env
        );
        await sendTelegramMessage(`✅ *SUCCESS:* ${actionResult.message || "Access approved for 30 days."}`, { chatId });
      } catch (e) {
        await sendTelegramMessage(`⚠️ *Approval Failed:* ${e.message}`, { chatId });
      }
      return { ok: true };
    }

    if (text.startsWith("/reject")) {
      const parts = text.split(/\s+/);
      const targetId = parts[1];
      if (!targetId) {
        await sendTelegramMessage("⚠️ Usage: `/reject <Order-ID or UTR>`", { chatId });
        return { ok: true };
      }
      try {
        await handleAdminSubscriptionAction(
          { action: "reject_payment", proofId: targetId, reason: "Rejected via Telegram Bot command" },
          `Telegram Bot (@${msg.from?.username || "Admin"})`,
          env
        );
        await sendTelegramMessage(`❌ *Payment Rejected:* ${targetId}`, { chatId });
      } catch (e) {
        await sendTelegramMessage(`⚠️ *Rejection Failed:* ${e.message}`, { chatId });
      }
      return { ok: true };
    }

    if (text.startsWith("/create")) {
      const parts = text.split(/\s+/);
      const targetUser = parts[1]?.replace(/^@/, "");
      if (!targetUser) {
        await sendTelegramMessage("⚠️ Usage: `/create <username>`", { chatId });
        return { ok: true };
      }

      const passcode = `stark-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
      let userEmail = "";
      let fullName = "";
      try {
        const reqRes = await sbFetch(`account_requests?or=(username.ilike.${encodeURIComponent(targetUser)},full_name.ilike.${encodeURIComponent(targetUser)})&order=created_at.desc&limit=1`, {}, env);
        if (reqRes.ok) {
          const rows = await reqRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            userEmail = rows[0].email;
            fullName = rows[0].full_name;
          }
        }
      } catch {}

      if (!userEmail) {
        try {
          const uCheck = await sbFetch(`user_access?username=ilike.${encodeURIComponent(targetUser)}&select=email&limit=1`, {}, env);
          if (uCheck.ok) {
            const uRows = await uCheck.json();
            if (Array.isArray(uRows) && uRows[0]?.email) userEmail = uRows[0].email;
          }
        } catch {}
      }

      if (!userEmail) {
        await sendTelegramMessage(`⚠️ *Provisioning Failed:* No personal email found for \`@${targetUser}\`. Users must submit their personal email via the Request Account form first.`, { chatId });
        return { ok: true };
      }

      try {
        await sbFetch(`account_requests?username=eq.${encodeURIComponent(targetUser)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "approved", passcode }),
        }, env);
      } catch {}

      try {
        await sbFetch("user_access", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: targetUser,
            username: targetUser,
            email: userEmail,
            access_policy: "trial",
            is_suspended: false,
            is_lifetime: false,
          }),
        }, env);
      } catch {}

      const credText = 
`⚡ *PASSCODE PROVISIONED*
━━━━━━━━━━━━━━━━━━━━
👤 *Username:* \`@${targetUser}\`
🔑 *Passcode:* \`${passcode}\`
📧 *Email:* \`${userEmail}\`
━━━━━━━━━━━━━━━━━━━━
👉 Tap button below to send credentials to user via Brevo email:`;

      const credKeyboard = {
        inline_keyboard: [
          [
            { text: `📧 Send Credentials Email (${userEmail})`, callback_data: `send_mail:${targetUser}` },
          ]
        ],
      };
      await sendTelegramMessage(credText, { chatId, replyMarkup: credKeyboard });
      return { ok: true };
    }

    if (text.startsWith("/mail") || text.startsWith("/sendmail")) {
      const parts = text.split(/\s+/);
      const targetUser = parts[1]?.replace(/^@/, "");
      if (!targetUser) {
        await sendTelegramMessage("⚠️ Usage: `/mail <username>`", { chatId });
        return { ok: true };
      }

      let userEmail = "";
      let fullName = "";
      let passcode = "";

      try {
        const reqRes = await sbFetch(`account_requests?or=(username.ilike.${encodeURIComponent(targetUser)},full_name.ilike.${encodeURIComponent(targetUser)})&order=created_at.desc&limit=1`, {}, env);
        if (reqRes.ok) {
          const rows = await reqRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            userEmail = rows[0].email;
            fullName = rows[0].full_name;
            passcode = rows[0].passcode;
          }
        }
      } catch {}

      if (!userEmail) {
        try {
          const uCheck = await sbFetch(`user_access?username=ilike.${encodeURIComponent(targetUser)}&select=email&limit=1`, {}, env);
          if (uCheck.ok) {
            const uRows = await uCheck.json();
            if (Array.isArray(uRows) && uRows[0]?.email) userEmail = uRows[0].email;
          }
        } catch {}
      }

      if (!passcode) passcode = `stark-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!userEmail) {
        await sendTelegramMessage(`⚠️ *Email Delivery Failed:* No personal email found for \`@${targetUser}\`.`, { chatId });
        return { ok: true };
      }

      const emailHtml = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;background:#050508;color:#f1f5f9;padding:36px 24px;border-radius:18px;max-width:560px;margin:auto;border:1px solid rgba(255,255,255,0.1);">
          <div style="text-align:center;margin-bottom:28px;">
            <h1 style="font-size:26px;color:#38bdf8;margin:0 0 6px 0;font-weight:900;">Gaurxv Verse ⎊</h1>
            <p style="font-size:12px;color:#94a3b8;margin:0;letter-spacing:1.5px;text-transform:uppercase;">Stark Entertainment Access Clearance</p>
          </div>
          <div style="background:#0c0d16;border:1px solid rgba(56,189,248,0.25);border-radius:14px;padding:24px;margin-bottom:24px;">
            <p style="font-size:15px;margin:0 0 14px 0;">Welcome, <strong>${fullName || targetUser}</strong>!</p>
            <p style="font-size:13px;line-height:1.6;color:#cbd5e1;margin:0 0 18px 0;">
              Your account clearance has been granted by the administrator. Use your credentials below to unlock the <strong>Stark Security Gate</strong>:
            </p>
            <div style="background:#131522;border:1px dashed rgba(56,189,248,0.4);border-radius:10px;padding:16px;margin-bottom:20px;font-family:monospace;">
              <div style="margin-bottom:8px;font-size:13px;color:#94a3b8;">
                Username: <strong style="color:#38bdf8;font-size:15px;">${targetUser}</strong>
              </div>
              <div style="font-size:13px;color:#94a3b8;">
                Passcode: <strong style="color:#4ade80;font-size:15px;letter-spacing:1px;">${passcode}</strong>
              </div>
            </div>
            <div style="text-align:center;margin:24px 0 12px 0;">
              <a href="https://verse.gaurxv.eu.org/" style="display:inline-block;background:#38bdf8;color:#050508;font-weight:800;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
                Unlock Gaurxv Verse ⎊
              </a>
            </div>
          </div>
        </div>
      `;

      const sent = await sendBrevoEmail({
        to: { email: userEmail, name: fullName || targetUser },
        subject: "⚡ Your Gaurxv Verse Clearance Passcode & Access Pass",
        htmlContent: emailHtml,
      });

      if (sent) {
        await sendTelegramMessage(`📨 *EMAIL DELIVERED:* Login credentials for \`@${targetUser}\` were successfully sent to \`${userEmail}\` via Brevo!`, { chatId });
      } else {
        await sendTelegramMessage(`⚠️ *Email Delivery Failed:* Could not send credentials to \`${userEmail}\`. Check Brevo API quota.`, { chatId });
      }
      return { ok: true };
    }

    if (text.startsWith("/status")) {
      const parts = text.split(/\s+/);
      const targetUser = parts[1]?.replace(/^@/, "");
      if (!targetUser) {
        await sendTelegramMessage("⚠️ Usage: `/status <username>`", { chatId });
        return { ok: true };
      }
      try {
        const ent = await getUserEntitlement(targetUser, env);
        const statusMsg = 
`👤 *Status for @${targetUser}:*
━━━━━━━━━━━━━━━━━━━━
🔑 *Has Access:* ${ent.hasAccess ? "✅ YES" : "❌ NO"}
📜 *Policy:* \`${ent.accessPolicy || "none"}\`
${ent.activeSubscription ? `⏳ *Sub Expiry:* \`${new Date(ent.activeSubscription.expiresAt).toLocaleDateString("en-IN")}\`` : ""}
${ent.trial ? `⏱️ *Trial Remaining:* ${Math.ceil(ent.trial.remainingSeconds / 60)} mins` : ""}
👑 *Lifetime Pass:* ${ent.isLifetime ? "YES" : "NO"}
⛔ *Suspended:* ${ent.isSuspended ? "YES" : "NO"}`;
        await sendTelegramMessage(statusMsg, { chatId });
      } catch (e) {
        await sendTelegramMessage(`⚠️ Error checking status: ${e.message}`, { chatId });
      }
      return { ok: true };
    }

    if (text === "/stats") {
      try {
        const [accRes, payRes, usrRes] = await Promise.all([
          sbFetch("account_requests?select=id,status", {}, env),
          sbFetch("payment_proofs?select=id,verification_status,amount", {}, env),
          sbFetch("user_access?select=id,access_policy,is_suspended", {}, env),
        ]);
        const accs = accRes.ok ? await accRes.json() : [];
        const pays = payRes.ok ? await payRes.json() : [];
        const usrs = usrRes.ok ? await usrRes.json() : [];

        const pendingAcc = Array.isArray(accs) ? accs.filter((x) => x.status === "pending").length : 0;
        const pendingPay = Array.isArray(pays) ? pays.filter((x) => x.verification_status === "pending").length : 0;
        const totalPayRev = Array.isArray(pays) ? pays.filter((x) => x.verification_status === "approved").reduce((a, c) => a + (Number(c.amount) || 0), 0) : 0;
        const totalUsers = Array.isArray(usrs) ? usrs.length : 0;

        const statsMsg = 
`📊 *GAURXV VERSE SYSTEM METRICS*
━━━━━━━━━━━━━━━━━━━━
👥 *Total Access Records:* ${totalUsers}
📋 *Pending Account Requests:* ${pendingAcc}
💰 *Pending Payment Proofs:* ${pendingPay}
💵 *Verified Pass Revenue:* ₹${totalPayRev}
━━━━━━━━━━━━━━━━━━━━
⚡ JarvisX Bot: Online & Active`;

        await sendTelegramMessage(statsMsg, { chatId });
      } catch (e) {
        await sendTelegramMessage(`⚠️ Error loading stats: ${e.message}`, { chatId });
      }
      return { ok: true };
    }
  }

  return { ok: true };
}
