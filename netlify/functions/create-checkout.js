const Stripe = require("stripe");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let formData;
  try {
    formData = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "NIE Nummer Formular Service",
              description:
                "Fertig ausgefülltes EX-15 + Modelo 790-012 per E-Mail",
            },
            unit_amount: 2900, // 29,00 EUR in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.URL}/danke.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL}/nie-nummer.html`,
      customer_email: formData.email,
      metadata: {
        docType: formData.docType || "reisepass",
        docNumber: formData.docNumber || "",
        lastName1: formData.lastName1 || "",
        lastName2: formData.lastName2 || "",
        firstName: formData.firstName || "",
        sex: formData.sex || "",
        birthDate: formData.birthDate || "",
        birthPlace: formData.birthPlace || "",
        birthCountry: formData.birthCountry || "",
        nationality: formData.nationality || "",
        maritalStatus: formData.maritalStatus || "",
        fatherFirstName: formData.fatherFirstName || "",
        fatherLastName: formData.fatherLastName || "",
        motherFirstName: formData.motherFirstName || "",
        motherLastName: formData.motherLastName || "",
        street: formData.street || "",
        streetNumber: formData.streetNumber || "",
        city: formData.city || "",
        postalCode: formData.postalCode || "",
        province: formData.province || "",
        phone: formData.phone || "",
        email: formData.email || "",
        reason: formData.reason || "",
        status: formData.status || "",
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("Stripe error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
