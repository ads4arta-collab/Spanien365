const Stripe = require("stripe");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

// PDF coordinates for EX-15 (page 1) - PDF coordinate system (0,0 = bottom-left)
// Page size: 595.32 x 841.92
// We convert: pdfY = pageHeight - topFromImage
const PH = 841.92; // page height

function y(top) {
  return PH - top;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const resend = new Resend(process.env.RESEND_API_KEY);

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== "checkout.session.completed") {
    return { statusCode: 200, body: "Event ignored" };
  }

  const session = stripeEvent.data.object;
  const d = session.metadata;

  try {
    // ── Build EX-15 ──────────────────────────────────────────────
    const ex15Path = path.join(__dirname, "pdfs", "ex15.pdf");
    const ex15Bytes = fs.readFileSync(ex15Path);
    const ex15Doc = await PDFDocument.load(ex15Bytes);
    const font = await ex15Doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 8;

    const page1 = ex15Doc.getPages()[0];
    const page2 = ex15Doc.getPages()[1];

    function drawText(page, text, x, topCoord) {
      if (!text) return;
      page.drawText(String(text).toUpperCase(), {
        x,
        y: y(topCoord),
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }

    function drawX(page, x, topCoord) {
      page.drawText("X", {
        x,
        y: y(topCoord),
        size: 7,
        font,
        color: rgb(0, 0, 0),
      });
    }

    // PAGE 1 — Sektion 1: DATOS DEL EXTRANJERO/A
    // Pasaporte / NIE field
    if (d.docType === "reisepass") {
      drawText(page1, d.docNumber, 97, 174);
    } else {
      drawText(page1, d.docNumber, 330, 174);
    }

    // Namen
    drawText(page1, d.lastName1, 97, 192);
    drawText(page1, d.lastName2, 390, 192);
    drawText(page1, d.firstName, 97, 211);

    // Geschlecht
    const sexMap = { H: 495, M: 520, X: 467 };
    if (sexMap[d.sex]) drawX(page1, sexMap[d.sex], 207);

    // Geburtsdatum, Ort, Land
    drawText(page1, d.birthDate, 130, 231);
    drawText(page1, d.birthPlace, 260, 229);
    drawText(page1, d.birthCountry, 455, 229);

    // Nationalität
    drawText(page1, d.nationality, 97, 248);

    // Familienstand
    const civilMap = { S: 407, C: 435, V: 463, D: 492, Sp: 521 };
    if (civilMap[d.maritalStatus]) drawX(page1, civilMap[d.maritalStatus], 248);

    // Vater & Mutter (Vorname + Nachname zusammen)
    drawText(page1, `${d.fatherFirstName} ${d.fatherLastName}`, 112, 266);
    drawText(page1, `${d.motherFirstName} ${d.motherLastName}`, 375, 266);

    // Adresse
    drawText(page1, d.street, 130, 284);
    drawText(page1, d.streetNumber, 498, 284);
    drawText(page1, d.city, 84, 302);
    drawText(page1, d.postalCode, 355, 302);
    drawText(page1, d.province, 465, 302);

    // Kontakt
    drawText(page1, d.phone, 100, 320);
    drawText(page1, d.email, 300, 320);

    // PAGE 2 — Sektion 4
    // Name oben auf Seite 2
    drawText(page2, `${d.lastName1} ${d.lastName2} ${d.firstName}`, 180, 82);

    // 4.1 Tipo documento: NIE
    drawX(page2, 70, 191);

    // 4.2 Motivos
    const reasonMap = {
      economico: 70,
      profesional: 265,
      social: 442,
    };
    const reasonKey = d.reason.includes("Wirtschaft")
      ? "economico"
      : d.reason.includes("Beruf")
      ? "profesional"
      : "social";
    if (reasonMap[reasonKey]) drawX(page2, reasonMap[reasonKey], 272);

    // 4.3 Lugar de presentación: Oficina de Extranjería
    drawX(page2, 70, 362);

    // 4.4 Situación
    if (d.status === "estancia") drawX(page2, 70, 407);
    else drawX(page2, 196, 407);

    // Datum (heute)
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    drawText(page2, today.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }), 350, 435);

    const ex15Filled = await ex15Doc.save();

    // ── Build Modelo 790-012 ──────────────────────────────────────
    const m790Path = path.join(__dirname, "pdfs", "modelo790.pdf");
    const m790Bytes = fs.readFileSync(m790Path);
    const m790Doc = await PDFDocument.load(m790Bytes);
    const font790 = await m790Doc.embedFont(StandardFonts.Helvetica);

    const p790 = m790Doc.getPages()[0];
    const PH790 = p790.getHeight();

    function draw790(text, x, topCoord) {
      if (!text) return;
      p790.drawText(String(text).toUpperCase(), {
        x,
        y: PH790 - topCoord,
        size: 7,
        font: font790,
        color: rgb(0, 0, 0),
      });
    }

    // NIF/NIE field
    draw790(d.docNumber, 68, 290);
    // Apellidos y nombre
    draw790(`${d.lastName1} ${d.lastName2}, ${d.firstName}`, 200, 290);
    // Dirección
    draw790(d.street, 150, 307);
    draw790(d.streetNumber, 520, 307);
    // Municipio, Provincia, CP
    draw790(d.city, 68, 323);
    draw790(d.province, 380, 323);
    draw790(d.postalCode, 500, 323);
    // Año (ejercicio)
    draw790(String(today.getFullYear()), 490, 210);
    // Importe
    draw790("9,84", 520, 560);

    const m790Filled = await m790Doc.save();

    // ── Send email via Resend ─────────────────────────────────────
    await resend.emails.send({
      from: "NIE Service <nie@spanien365.de>",
      to: d.email,
      subject: "Deine NIE-Formulare – fertig ausgefüllt",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#2C2416;">
          <div style="background:#2C2416;padding:24px;border-bottom:3px solid #C0622B;">
            <h1 style="color:#F7F1E8;font-size:22px;margin:0;">Spanien<span style="color:#C0622B;">365</span>.de</h1>
          </div>
          <div style="padding:28px 24px;">
            <p style="font-size:16px;">Hola ${d.firstName},</p>
            <p>deine NIE-Formulare sind fertig ausgefüllt und im Anhang dieser E-Mail.</p>
            <div style="background:#F7F1E8;border-left:3px solid #C0622B;padding:16px;margin:20px 0;">
              <strong>Was du jetzt tun musst:</strong>
              <ol style="margin:10px 0 0;padding-left:20px;line-height:1.8;">
                <li>Beide Formulare ausdrucken (je 2-fach)</li>
                <li>Modelo 790-012: bei einer Bank bezahlen (9,84 €) und abstempeln lassen</li>
                <li>EX-15: beim Termin unterschreiben (nicht vorher!)</li>
                <li>Beide Formulare + Reisepass/Ausweis + Kopien zum Termin mitbringen</li>
              </ol>
            </div>
            <p style="font-size:13px;color:#9a7e62;">Bei Fragen: info@spanien365.de</p>
          </div>
          <div style="background:#2C2416;padding:16px 24px;">
            <p style="color:rgba(247,241,232,0.5);font-size:11px;margin:0;">© spanien365.de — Alle Angaben ohne Gewähr. Kein Rechtsberatungsservice.</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: "EX-15_NIE_Antrag.pdf",
          content: Buffer.from(ex15Filled).toString("base64"),
        },
        {
          filename: "Modelo_790-012_Gebuehr.pdf",
          content: Buffer.from(m790Filled).toString("base64"),
        },
      ],
    });

    console.log(`✅ NIE formulare sent to ${d.email}`);
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    console.error("Processing error:", err);
    return { statusCode: 500, body: err.message };
  }
};
