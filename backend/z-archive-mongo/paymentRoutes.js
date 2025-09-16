const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { authenticateUser, verifyUserRole } = require("../middleware/auth");

// ✅ Create a Checkout Session for Job Posting
router.post("/create-checkout-session", authenticateUser, verifyUserRole("recruiter"), async (req, res) => {
  try {
    const { jobId, plan } = req.body;
    const pricing = {
      basic: 5000, // $50 for one job post
      recurring: 2500, // $25 for renewal
    };

    if (!pricing[plan]) return res.status(400).json({ message: "Invalid plan selected." });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Job Post" },
            unit_amount: pricing[plan],
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/payment-success?jobId=${jobId}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancelled`,
    });

    res.json({ id: session.id });
  } catch (error) {
    res.status(500).json({ message: "Error creating payment session", error: error.message });
  }
});

module.exports = router;
