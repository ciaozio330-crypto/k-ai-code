import express from 'express';
import Stripe from 'stripe';
import db from '../db.js';
import { authenticateToken } from '../middleware.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

const PLAN_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Piano non valido' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing`,
      customer_email: req.user.email,
      metadata: { userId: req.user.id, plan },
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        db.prepare(`UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?`)
          .run(sub.metadata.plan, sub.id, sub.metadata.userId);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        db.prepare(`UPDATE users SET plan = 'free' WHERE id = ?`).run(sub.metadata.userId);
        break;
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;