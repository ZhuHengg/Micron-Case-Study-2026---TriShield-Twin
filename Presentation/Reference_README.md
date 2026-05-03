<p align="center">
  <img width="736" height="183" alt="Screenshot 2026-04-26 at 8 51 31 AM" src="https://github.com/user-attachments/assets/5b0bae76-2042-40b5-af23-d70ed72b80bd" />
</p>

# AI-Powered Miniapp Intelligence Layer

## Problem Statement

Transaction data in TnG eWallet is currently underutilized and exists in silos, while many miniapp deals—such as vouchers, cashback offers, and promotions—within miniapps of the platform remain unused. The core issue lies in discovery and timing. Today, users are required to manually open a marketplace, scroll through unfamiliar miniapps and offers, and guess what might be useful. In reality, this behavior rarely happens—especially in the middle of a transaction.

This breaks the entire miniapp ecosystem. Merchants create deals, but users never see them at the right moment. As a result, even highly relevant vouchers and promotions remain invisible.

The fundamental problem is that discovery is **active**, while real user needs are **contextual and moment-driven**. Deals should not rely on users to find them. Instead, they should appear automatically at the exact moment they are needed—and depending on the context, that moment could be **during payment** or **after payment**.

---

## Solution

We propose an **AI-powered Intelligence Layer** built on top of transaction data.

Instead of treating transactions as static records, this system interprets them as **real-time signals of user intent**. By analyzing transaction context such as location, spending category, timing, and behavioral patterns, the system understands what the user is likely to need next.

Based on this, the system proactively surfaces the most relevant miniapp deal—such as a voucher, discount, or service recommendation—at the right moment. Critically, the system determines **when** to show the deal on a case-by-case basis:

- **During payment** — For impulse-friendly, low-consideration deals tied to the user's current location and habits (e.g. a dessert voucher while paying for dinner).
- **After payment** — For higher-consideration decisions that require thought (e.g. hotel and car rental recommendations after booking a flight).

This transforms the experience from:

**Active discovery → Passive, intelligent engagement**

Where deals no longer wait to be discovered, but instead find the user when they are most relevant—and at the right stage of their transaction.

---

## Implementation

<table width="100%">
  <tr>
    <td align="center" width="50%">
      <img width="100%" alt="Screenshot 2026-04-26 at 9 03 55 AM" src="https://github.com/user-attachments/assets/18dc19bc-e838-411f-9d97-fc77bb466d1a" />
    </td>
    <td align="center" width="50%">
      <img width="100%" alt="Screenshot 2026-04-26 at 9 04 06 AM" src="https://github.com/user-attachments/assets/7950a4b6-8d39-49ca-ad73-896b68abc18a" />
    </td>
  </tr>
</table>

The system is designed as a real-time pipeline that converts raw transaction data into actionable deal delivery.

### 1. Transaction Ingestion

The user initiates or completes a transaction (e.g. payment, purchase, booking).

Examples:
- Paying for dinner at a mall
- Buying a plane ticket
- Paying for public transport
- Grocery shopping

---

### 2. Context Extraction

Raw transaction data is enriched into meaningful structured data:

- Merchant (e.g. Sushi Zanmai, AirAsia)
- Category (Dining, Travel, Transport, Groceries)
- Location (Mall name, City, Country)
- Time (Lunch, Dinner, Weekend, Late Night)
- User behavior history (e.g. frequently buys dessert after dinner, often books hotels after flights)

---

### 3. AI Intent Detection

AI models analyze patterns and infer user intent:

- Dinner payment at a mall + history of dessert purchases → Dessert craving likely
- Flight ticket purchase → Travel preparation intent
- Overseas transport usage → Local mobility need
- Repeated grocery trips → Household routine

---

### 4. Decision Engine

The system determines the most relevant deal to surface **and when to show it**:

| Trigger | Deal | Timing | Reasoning |
|---|---|---|---|
| Paying for dinner at a mall | Llaollao voucher (e.g. 20% off) | **During payment** | Low-consideration, impulse-friendly; user is at the location and historically goes for dessert after dinner |
| Buying a plane ticket | Hotel booking, car rental, eSIM deals | **After payment** | High-consideration; user needs time to think and plan, not an impulse decision |
| Overseas transport usage | Local transport pass deal | **After payment** | User is already in transit; show after current ride is settled |
| Frequent grocery shopping | Cashback voucher for nearby supermarket | **During payment** | Routine purchase; voucher can apply immediately to current basket |

---

### 5. Trigger & Delivery

The selected deal is surfaced through the appropriate channel based on timing:

**During Payment:**
- Inline deal card on the payment confirmation screen (before user confirms)
- One-tap voucher redemption applied directly to checkout

**After Payment:**
- Post-payment recommendation panel
- In-app notification with deal details
- Push notification for time-sensitive offers

No manual search required.

---

<p align="center">
  <img width="811" height="453" alt="Screenshot 2026-04-26 at 8 58 56 AM" src="https://github.com/user-attachments/assets/803ab57e-3851-4a05-b11f-5ae29e74027c" />
</p>

## Benefits

<p align="center">
  <img width="763" height="402" alt="Screenshot 2026-04-26 at 9 07 10 AM" src="https://github.com/user-attachments/assets/e5ff84be-e02b-497e-8ab1-cd1b6679ba2b" />
</p>

### For Users

- Seamless experience — relevant deals appear automatically without searching or browsing
- Right deals at the right time, matched to the right scenario (e.g. dessert voucher during dinner, travel deals after booking a flight)
- Personalized to actual spending habits and preferences
- No friction — vouchers are ready to use exactly when and where they matter

---

### For Merchants

Merchants only see their own four walls. A KFC outlet knows exactly who walked in, what they ordered, and when they paid — but the moment that customer leaves, the trail goes cold. Merchants have **no visibility** into:

- Where their customers go **before** and **after** the transaction
- What they spend on across **other categories** (groceries, transport, entertainment, travel)
- **Behavioral patterns** that span across merchants (e.g. salty meal → craving sweet dessert)
- **Location context** — which mall, neighborhood, or city the customer is currently in

TnG, on the other hand, sits at the **intersection of every transaction**. TnG sees that a user just paid at KFC, knows that most people crave something sweet after a salty meal, and knows there's a Llaollao two minutes away. **No single merchant can ever see this picture on their own.**

By collaborating with TnG, merchants gain access to:

- **Cross-merchant behavioral intelligence** — understand what their customers do across the entire ecosystem, not just within their store
- **Predictive intent signals** — reach users at the exact moment intent forms, even before the user knows they want something (e.g. Llaollao reaching the KFC customer mid-craving)
- **Real-time location and timing context** — surface offers when the user is physically nearby and in the right mindset, not hours later through a generic ad
- **Targeted marketing** — reach users who are genuinely likely to buy, based on real spending behavior, not broad demographics
- **Higher conversion, lower wasted spend** — promotions reach high-intent users at the moment of relevance, not random audiences

In short: merchants own the transaction, but TnG owns the **context around the transaction** — and context is what turns a promotion into a sale.

---

### For TnG eWallet

The intelligence layer is only as powerful as the **inventory of deals** available to surface. Without merchants, TnG has rich behavioral insight but **nothing to recommend**. The system identifies that a user is craving dessert after a KFC meal — but if no dessert merchant is onboarded nearby, that insight is wasted.

The more merchants TnG onboards:

- **The richer the recommendation pool** — every new merchant adds new deal categories, new locations, and new opportunities to match user intent
- **The more personalized the experience becomes** — with more options to choose from, the system can match users to the *exact* deal that fits their context, not just the closest available one
- **The denser the coverage** — users get relevant deals no matter where they are, what they're doing, or what they're craving
- **The stronger the flywheel** — more deals attract more user engagement, which generates more transaction data, which sharpens recommendations, which attracts even more merchants

Beyond the deal inventory, this transforms TnG itself:

- Adds an **intelligent layer** on top of the existing TnG platform, turning it from a payment tool into a smart commerce platform
- Fully **autonomous** — the system learns, decides, and delivers deals without manual curation
- **Attracts more users** — a smarter, more personalized experience gives users a reason to stay and transact more within TnG

#### The Mutual Dependency

> Merchants need TnG for the **context and intent data** they cannot collect on their own.
> TnG needs merchants for the **deal inventory** that makes its intelligence actionable.

Neither side wins alone — but together, they create a self-reinforcing ecosystem where every new merchant makes recommendations better, every better recommendation drives more engagement, and every transaction makes the system smarter.

---

## Key Insight

This system transforms the miniapp deal ecosystem from a passive marketplace into an intelligent, context-driven platform that understands **not just what to recommend, but when to recommend it**.

Instead of:
> Users searching for deals and vouchers

It becomes:
> Deals automatically appearing at the right moment — during payment for impulse-ready offers, and after payment for decisions that need thought

---

## One-Line Summary

We turn siloed transaction data into real-time, AI-driven deal delivery—where miniapp vouchers and recommendations intelligently find users at the right moment, whether during or after payment.
