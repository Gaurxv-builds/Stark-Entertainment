# Stark Entertainment // Dedicated Payment Portal

**Live Target URL:** https://payments.gaurxv.eu.org/  
**Main Universe URL:** https://verse.gaurxv.eu.org/

---

## What is This?

This is the standalone, single-file, production-ready payment and subscription website for **Stark Entertainment / Gaurxv Verse**.

### Key Features
1. **Official UPI QR Code & Direct Payment Integration:**
   - Embeds your official Cloudinary UPI payment QR image (`https://res.cloudinary.com/nibjmho0/image/upload/v1793381159/payment_upi.png`).
   - One-click copy for your Paytm UPI ID (`paytmqr6qi789@ptys`).
   - Mobile-friendly **Pay via UPI App** intent button that automatically opens PhonePe, GPay, or Paytm on mobile devices.
2. **Order ID & Account Attribution:**
   - Generates unique Order IDs (`STARK-ORD-XXXXXX`).
   - Accepts URL parameters (e.g. `https://payments.gaurxv.eu.org/?user=alex&email=alex@example.com`) to prefill the user's details automatically from their Stark Verse session.
3. **12-Digit UTR Submission & Validation:**
   - Input field with regex and length validation for UPI reference numbers.
   - Optional payment screenshot link.
4. **Backend Integration:**
   - Submits payment proof directly to the backend endpoint `https://verse.gaurxv.eu.org/api/subscription/submit-payment`.
   - The backend validates the submission, stores it in Supabase PostgreSQL, dispatches an instant Telegram alert to `@JarvisXPay_Bot` (Admin Chat `895044844`), and sends a Brevo confirmation email to the user.

---

## 🚀 How to Deploy to `payments.gaurxv.eu.org`

### Option 1: Cloudflare Pages (Recommended - 1 Minute)

1. Open **[Cloudflare Dashboard](https://dash.cloudflare.com/)** → **Workers & Pages** → **Create application** → **Pages**.
2. Select **Upload assets**:
   - Create a folder or use the `payment-portal` directory.
   - Upload `index.html`.
3. Project Name: `stark-payments`.
4. Click **Deploy**.
5. Go to **Custom domains** in your new Pages project:
   - Click **Set up a custom domain**.
   - Enter `payments.gaurxv.eu.org`.
   - Cloudflare will automatically configure the DNS record and issue an SSL certificate!

---

### Option 2: Deploy directly from GitHub

1. Push this folder to a GitHub repository (e.g., `Gaurxv-builds/stark-payments`).
2. In Cloudflare Pages (or Vercel / Netlify), connect the repository and choose:
   - Framework preset: `None` / `HTML`
   - Build output directory: `.`
3. Add custom domain `payments.gaurxv.eu.org`.

---

## Testing Local Preview

You can test this file locally in any browser by simply double-clicking `payment-portal/index.html` or running:

```bash
npx serve payment-portal
```
