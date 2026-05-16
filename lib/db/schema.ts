import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

// =========================
// ENUMS
// =========================

export const planEnum = pgEnum("plan", ["free", "pro", "agency"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused"
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "saved",
  "sent",
  "contacted",
  "ignored"
]);
export const leadSourceEnum = pgEnum("lead_source", [
  "google_places",
  "google_maps_scrape",
  "openstreetmap"
]);
export const leadSizeEnum = pgEnum("lead_size", ["pequena", "media", "grande"]);
export const searchModeEnum = pgEnum("search_mode", ["fast", "deep"]);

// =========================
// USERS — espelho do Clerk
// =========================

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // clerk user id (user_XXXX)
    email: text("email").notNull(),
    fullName: text("full_name"),
    imageUrl: text("image_url"),
    plan: planEnum("plan").notNull().default("free"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email)
  })
);

// =========================
// SUBSCRIPTIONS — estado Stripe
// =========================

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    plan: planEnum("plan").notNull().default("free"),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("subscriptions_user_idx").on(table.userId),
    stripeCustomerIdx: uniqueIndex("subscriptions_stripe_customer_idx").on(table.stripeCustomerId),
    stripeSubIdx: uniqueIndex("subscriptions_stripe_sub_idx").on(table.stripeSubscriptionId)
  })
);

// =========================
// SEARCH QUOTA — contagem mensal
// =========================

export const searchQuota = pgTable(
  "search_quota",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    searchesIncluded: integer("searches_included").notNull(),
    searchesUsed: integer("searches_used").notNull().default(0),
    addonRemaining: integer("addon_remaining").notNull().default(0),
    aiInsightsIncluded: integer("ai_insights_included").notNull().default(0),
    aiInsightsUsed: integer("ai_insights_used").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userPeriodIdx: uniqueIndex("search_quota_user_period_idx").on(table.userId, table.periodStart)
  })
);

// =========================
// ADDON PURCHASES — compras de pacotes extras
// =========================

export const addonPurchases = pgTable(
  "addon_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(), // "addon_200_searches"
    searchesAdded: integer("searches_added").notNull(),
    pricePaidCents: integer("price_paid_cents").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("addon_purchases_user_idx").on(table.userId),
    stripeSessionIdx: uniqueIndex("addon_purchases_stripe_session_idx").on(
      table.stripeCheckoutSessionId
    )
  })
);

// =========================
// SEARCH HISTORY — log de buscas (debug + analytics)
// =========================

export const searchHistory = pgTable(
  "search_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    niche: text("niche").notNull(),
    location: text("location").notNull(),
    mode: searchModeEnum("mode").notNull(),
    resultCount: integer("result_count").notNull().default(0),
    fromCache: boolean("from_cache").notNull().default(false),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedIdx: index("search_history_user_created_idx").on(table.userId, table.createdAt)
  })
);

// =========================
// LEADS — leads salvos por user
// =========================

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(), // "google-PLACE_ID" ou "gmap-HASH" ou "osm-TYPE-ID"
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: leadSourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    niche: text("niche").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    website: text("website"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    email: text("email"),
    mapsUrl: text("maps_url"),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    status: leadStatusEnum("status").notNull().default("new"),
    score: integer("score").notNull().default(0),
    companySize: leadSizeEnum("company_size").notNull().default("pequena"),
    diagnosis: text("diagnosis").notNull().default(""),
    nextAction: text("next_action").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userIdx: index("leads_user_idx").on(table.userId),
    userStatusIdx: index("leads_user_status_idx").on(table.userId, table.status),
    userUpdatedIdx: index("leads_user_updated_idx").on(table.userId, table.updatedAt),
    userSourceIdx: uniqueIndex("leads_user_source_idx").on(table.userId, table.source, table.sourceId)
  })
);

// =========================
// COMPANY PROFILE — perfil de marca por user
// =========================

export const companyProfile = pgTable(
  "company_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    brandName: text("brand_name").notNull().default("Grynd"),
    offer: text("offer")
      .notNull()
      .default("Sites, automacoes e presenca digital para negocios locais"),
    focusRegion: text("focus_region").notNull().default("Rio Claro e cidades proximas"),
    tone: text("tone").notNull().default("Curto, consultivo e direto"),
    signature: text("signature").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  }
);

// =========================
// STRIPE EVENTS — idempotência de webhooks
// =========================

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(), // event.id da Stripe
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow()
});

// Tipos derivados para uso no app
export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbSubscription = typeof subscriptions.$inferSelect;
export type DbSearchQuota = typeof searchQuota.$inferSelect;
export type DbLead = typeof leads.$inferSelect;
export type NewDbLead = typeof leads.$inferInsert;
export type DbCompanyProfile = typeof companyProfile.$inferSelect;
