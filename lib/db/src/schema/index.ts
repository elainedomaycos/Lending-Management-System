import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const loanStatusEnum = pgEnum("loan_status", [
  "active",
  "extended",
  "completed",
  "overdue",
  "draft",
  "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "paid",
  "partial",
  "missed",
  "pending",
]);

export const collectionTypeEnum = pgEnum("collection_type", [
  "Daily",
  "Monthly",
  "Lump Sum",
]);

export const borrowerStatusEnum = pgEnum("borrower_status", [
  "Active",
  "Overdue",
  "Completed",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "loan",
  "payment",
  "settlement",
  "borrower",
  "partner",
]);

export const borrowers = pgTable("borrowers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  barangay: text("barangay").notNull().default(""),
  status: borrowerStatusEnum("status").notNull().default("Active"),
  notes: text("notes").notNull().default(""),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull().default(""),
  share: numeric("share", { precision: 5, scale: 2 }).notNull().default("0"),
  notes: text("notes").notNull().default(""),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  number: text("number").notNull().unique(),
  borrowerId: uuid("borrower_id")
    .notNull()
    .references(() => borrowers.id, { onDelete: "cascade" }),
  partnerId: uuid("partner_id").references(() => partners.id, {
    onDelete: "set null",
  }),
  principal: numeric("principal", { precision: 14, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  interest: numeric("interest", { precision: 14, scale: 2 }).notNull(),
  totalDue: numeric("total_due", { precision: 14, scale: 2 }).notNull(),
  paid: numeric("paid", { precision: 14, scale: 2 }).notNull().default("0"),
  collectionType: collectionTypeEnum("collection_type").notNull(),
  targetDays: integer("target_days").notNull(),
  maxDays: integer("max_days").notNull(),
  loanDate: date("loan_date").notNull(),
  targetDate: date("target_date").notNull(),
  maturityDate: date("maturity_date").notNull(),
  status: loanStatusEnum("status").notNull().default("active"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  loanId: uuid("loan_id")
    .notNull()
    .references(() => loans.id, { onDelete: "cascade" }),
  borrowerId: uuid("borrower_id")
    .notNull()
    .references(() => borrowers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  expected: numeric("expected", { precision: 14, scale: 2 }).notNull(),
  paid: numeric("paid", { precision: 14, scale: 2 }).notNull(),
  method: text("method").notNull().default("Cash"),
  notes: text("notes").notNull().default(""),
  status: paymentStatusEnum("status").notNull().default("paid"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settlements = pgTable("settlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id")
    .notNull()
    .references(() => partners.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  date: date("date").notNull(),
  method: text("method").notNull().default("Cash"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: activityTypeEnum("type").notNull(),
  message: text("message").notNull(),
  date: timestamp("date", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  isSecret: boolean("is_secret").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertBorrowerSchema = createInsertSchema(borrowers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
});
export const insertSettlementSchema = createInsertSchema(settlements).omit({
  id: true,
  createdAt: true,
});
export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});
export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBorrower = z.infer<typeof insertBorrowerSchema>;
export type Borrower = typeof borrowers.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlements.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;