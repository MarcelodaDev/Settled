# Settled

**Every invoice, settled.** An AI collections assistant for freelancers, built on PayPal.

Write what you want to bill the way you'd tell an assistant, for example *"Bill Juan $300 for the website, 50% upfront, due in 15 days"*, and Settled:

1. Interprets the instruction with AI: client, amount, item, deposit and due date.
2. Shows you the proposal to confirm. **Nothing is created until you approve it.** Not sure what to charge? It helps you price the job from an hour-by-hour breakdown and from what you billed for similar work before.
3. Creates the invoice in PayPal (sandbox) with its payment link.
4. Tracks its status (sent, deposit received, paid, overdue) in an invoices dashboard.
5. Drafts payment reminders and answers questions like *"Who owes me?"* or *"How much came in this week?"*.

It works in **English and Spanish**: the interface switches with one click, and the AI understands instructions and questions in either language. A freelancer in Latin America can bill a local client in Spanish and an overseas client in English from the same place.

**Live demo:** [settled-sise.onrender.com](https://settled-sise.onrender.com) (free Render plan: the first visit after a while can take about a minute while the server wakes up).

Built for the *Build What's Next with PayPal and AI* hackathon. **It only uses the PayPal sandbox: no real money moves.**

> Status: in development. This README is updated as the project moves forward.

## Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML, CSS and JavaScript, with [AG Grid](https://www.ag-grid.com/) for the invoices dashboard
- **Payments:** PayPal Invoicing API v2 (sandbox)
- **AI:** models via [OpenRouter](https://openrouter.ai/) with tool calling
- **Hosting:** Render

## How it works

1. **Instruction.** The text goes to `POST /api/cobros/interpretar`. The AI doesn't reply with free text: it fills in a `proponer_cobro` function with a fixed schema (forced tool calling). It's not allowed to invent emails, amounts or dates; whatever is missing comes back as notes for the freelancer.
2. **Review.** The server validates the proposal again in code, and the interface shows it as an editable form with a one-sentence summary of what will happen. This step **never** touches PayPal.
   - **Pricing help** (`POST /api/cobros/estimar`): for freelancers who don't know what to charge yet. The AI breaks the job into tasks with estimated hours and states its assumptions; the freelancer sets their hourly rate and can adjust any hours; **code computes hours × rate**. The AI never suggests prices or "market rates": it has no reliable data for that, and a beginner could undercharge based on an invented figure.
   - **From the second job on, it also uses the freelancer's own history.** The AI receives past invoices with only their id and item (no amounts) and marks which ones are similar work; code then shows what was actually billed for them in PayPal and the average. A website matches past websites, even across languages; a logo doesn't.
3. **Invoice.** On confirmation, `POST /api/cobros` validates once more, creates a draft in the Invoicing API v2, sends it and returns the payment link (`detail.metadata.recipient_view_url`).
   - The deposit is a partial payment with a minimum amount (`configuration.partial_payment`).
   - Each proposal carries its own invoice number. If the confirmation is sent twice, PayPal rejects the repeated number (`DUPLICATE_INVOICE_NUMBER`) and no duplicate is created.
4. **Status.** `GET /api/cobros/:id` reads the status straight from PayPal, the source of truth. `data/cobros.json` only stores extras PayPal doesn't keep, like the original instruction.
5. **Invoices dashboard.** `GET /api/cobros` lists the account's invoices from PayPal.
   - PayPal's list endpoint doesn't include the item, the payment link or payment dates. Those come from each invoice's detail, are cached in memory and are only fetched again when the paid amount changes; status and amounts are always fresh.
   - "Overdue" isn't a PayPal status: the server computes it as an open invoice past its due date (Ecuador time).
6. **Reminders.** Clicking an invoice opens its details, where the AI drafts a reminder (`POST /api/cobros/:id/recordatorio`).
   - **The tone is decided by code**, based on how late the payment is: friendly before the due date, firm up to 14 days late, final notice after that. The freelancer can override it.
   - **The message language is chosen separately** from the interface language, because the client is the one reading it.
   - The invoice is read **fresh from PayPal** when drafting, so a paid invoice is never chased and amounts are never stale. If the client already paid a deposit, the reminder thanks them and asks only for the balance.
   - The due-date situation ("due in 15 days", "20 days overdue") is computed by the server and handed to the AI already written, so it can't invent a delay.
   - The AI writes `{{enlace}}` instead of the URL and the server inserts the real PayPal link on its own line: a model can mangle a long URL.
   - The freelancer edits the text and sends it through their own channel: copy, WhatsApp or email. Each send is logged in a history (`POST /api/cobros/:id/recordatorios`), something PayPal doesn't record.
7. **Questions.** In the dashboard you can ask "Who owes me?", "How much came in this week?" or "Which invoices are overdue?", in English or Spanish (`POST /api/consultas`).
   - **The AI doesn't do math.** It only translates the question into a structured query (`consultar_cobros`): what to measure, which invoices, which client, which period.
   - **Code computes everything**: periods in Ecuador time (Monday-to-Sunday weeks), totals and per-client grouping. Collected money is summed by each payment's date, so a deposit counts in the week it came in.
   - **Code also writes the answer** from the computed figures. We tried letting the AI phrase it and, in three tests, it changed the meaning of the data; in a collections product, one wrong figure costs more trust than a more natural sentence is worth.
   - **The grid filters down to the exact invoices behind the answer**, and a line below shows how the question was understood ("Understood: payments received · this week").

## Dashboard with AG Grid

The dashboard uses [AG Grid Community](https://www.ag-grid.com/) 36.2.0, served from `node_modules` (pinned version, no CDN).

- **Custom theme** on top of Quartz (`themeQuartz.withParams`): the same paper, ink and hairline rules as the rest of the interface, with no rounded corners or column borders.
- **Custom cell renderers** built with DOM nodes: client and item on two lines, status toned by urgency ("Overdue by N days", "Opened by client", "Reminded today").
- **Sort by urgency** with a custom comparator: the most overdue first.
- **Quick filter** for search and an **external filter** by status (All, Outstanding, Overdue, Paid) and by the invoices behind the last question.
- **Pinned totals row** that sums only what passes the filters.
- **Adaptive columns**: based on the grid's real width, secondary columns are hidden by priority instead of forcing horizontal scroll.
- **Bilingual**: headers, cells, totals and AG Grid's own messages (`getLocaleText`) follow the selected language.

## AI usage

- **Model:** `minimax/minimax-m3.1-flash:free` via OpenRouter, a free model (configurable with `OPENROUTER_MODEL`). Free models on OpenRouter allow a limited number of requests per day, so the app caps AI calls at 45 per day by default (`LIMITE_IA_DIARIO`) and shows a clear message when the quota is used up.
- **What for:**
  - Turning billing instructions, in English or Spanish, into structured invoice data, writing the item as a professional invoice line and flagging missing or ambiguous data (for example, currencies other than USD).
  - Drafting payment reminders in the tone that fits the delay and in the client's language, using the real invoice data from PayPal.
  - Understanding questions about the invoices and turning them into a query the server runs.
  - Breaking a job into tasks with estimated hours, and recognizing which past invoices were similar work.
- **How:** always with forced tool calling (`proponer_cobro`, `estimar_trabajo`, `redactar_recordatorio`, `consultar_cobros`), so every reply has a fixed schema the server validates. The AI never computes amounts or dates: code does. Where the model proved unreliable in testing (asking for a client's last name, mixing filters that contradict each other), a small deterministic rule in the server corrects it instead of relying on the prompt.

## Running it locally

Requirements:

- Node.js 22.9 or later
- A PayPal developer account, with sandbox credentials under *Apps & Credentials*
- An [OpenRouter](https://openrouter.ai/keys) API key

```bash
cp .env.example .env   # then fill in the keys
npm install
npm start              # http://localhost:3000  (npm run dev reloads on save)
```

To test a payment, open the invoice link **in a regular browser (Chrome, Firefox…)** and sign in with your **Personal** sandbox account (*Testing Tools > Sandbox Accounts* on developer.paypal.com). PayPal opens a pop-up window to confirm the payment: if the browser blocks it, clicking "Pay" does nothing.

## Deploying to Render

The repo includes a Render [Blueprint](render.yaml): a Node web service on the free plan, with `npm ci` to build, `npm start` to run and `/api/salud` as the health check.

1. On [dashboard.render.com](https://dashboard.render.com): **New > Blueprint** and pick this repository.
2. Render asks for the variables marked as secret: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `OPENROUTER_API_KEY` and `FREELANCER_NOMBRE` (optional, used to sign reminders). They are never stored in the repo.
3. Every push to `main` redeploys the app.

Safeguards for the public demo:

- **Sandbox only:** the server refuses to start if `PAYPAL_API_BASE` doesn't point to the PayPal sandbox.
- **Rate limits** per visitor and globally on the routes that call the AI or create invoices, so nobody can drain the AI credits.
- The free plan **sleeps after 15 minutes without visits** and takes about a minute to wake up: open the URL shortly before using it.
- Render's disk is ephemeral: `data/cobros.json` (original instructions and reminder history) is lost on redeploy. Invoices aren't, because they live in PayPal.

## A note on the code

The code (variable names and comments) is written in Spanish, the author's working language. The product, its interface and this documentation are in English, with Spanish available in the app.

## License

[MIT](LICENSE)
