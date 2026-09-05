import type {
  Activity,
  Borrower,
  CollectionType,
  LendingSettings,
  Loan,
  Partner,
  Payment,
  PaymentStatus,
  Settlement,
} from './types';
import { supabase } from './supabase';

export interface SeedData {
  borrowers: Borrower[];
  partners: Partner[];
  loans: Loan[];
  payments: Payment[];
  settlements: Settlement[];
  activities: Activity[];
}

export interface DatabaseState {
  borrowers: Borrower[];
  partners: Partner[];
  loans: Loan[];
  payments: Payment[];
  settlements: Settlement[];
  activities: Activity[];
  settings: LendingSettings;
}

interface BorrowerRow {
  id: string; name: string; phone: string; address: string; barangay: string;
  status: 'Active' | 'Overdue' | 'Completed'; notes: string; archived_at: string | null;
}
interface PartnerRow { id: string; name: string; contact: string; share: unknown; notes: string; archived_at: string | null; }
interface LoanRow {
  id: string; number: string; borrower_id: string; partner_id: string | null;
  principal: unknown; rate: unknown; interest: unknown; total_due: unknown; paid: unknown;
  collection_type: CollectionType; target_days: number; max_days: number;
  loan_date: string; target_date: string; maturity_date: string; status: Loan['status'];
  archived_at: string | null;
}
interface PaymentRow {
  id: string; loan_id: string; borrower_id: string; date: string;
  expected: unknown; paid: unknown; method: string; notes: string; status: PaymentStatus;
  archived_at: string | null;
}
interface SettlementRow { id: string; partner_id: string; amount: unknown; date: string; method: string; notes: string; }
interface ActivityRow { id: string; type: Activity['type']; message: string; date: string; }
interface SettingRow { key: string; value: string; is_secret: boolean; }

const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0));
const asDate = (value: unknown): string => String(value ?? '').slice(0, 10);

const toBorrower = (row: BorrowerRow): Borrower => ({
  id: row.id, name: row.name, phone: row.phone, address: row.address,
  barangay: row.barangay, status: row.status, notes: row.notes,
  archivedAt: row.archived_at ?? null,
});
const toPartner = (row: PartnerRow): Partner => ({
  id: row.id, name: row.name, contact: row.contact, share: num(row.share),
  notes: row.notes, archivedAt: row.archived_at ?? null,
});
const toLoan = (row: LoanRow): Loan => ({
  id: row.id, number: row.number, borrowerId: row.borrower_id, partnerId: row.partner_id ?? undefined,
  principal: num(row.principal), rate: num(row.rate), interest: num(row.interest),
  totalDue: num(row.total_due), paid: num(row.paid), collectionType: row.collection_type,
  targetDays: Number(row.target_days || 0), maxDays: Number(row.max_days || 0),
  loanDate: asDate(row.loan_date), targetDate: asDate(row.target_date),
  maturityDate: asDate(row.maturity_date), status: row.status,
  archivedAt: row.archived_at ?? null,
});
const toPayment = (row: PaymentRow): Payment => ({
  id: row.id, loanId: row.loan_id, borrowerId: row.borrower_id, date: asDate(row.date),
  expected: num(row.expected), paid: num(row.paid), method: row.method,
  notes: row.notes, status: row.status, archivedAt: row.archived_at ?? null,
});
const toSettlement = (row: SettlementRow): Settlement => ({
  id: row.id, partnerId: row.partner_id, amount: num(row.amount),
  date: asDate(row.date), method: row.method, notes: row.notes,
});
const toActivity = (row: ActivityRow): Activity => ({
  id: row.id, type: row.type, message: row.message, date: asDate(row.date),
});

const fromBorrower = (borrower: Borrower): Partial<BorrowerRow> => ({
  id: borrower.id, name: borrower.name, phone: borrower.phone, address: borrower.address,
  barangay: borrower.barangay, status: borrower.status, notes: borrower.notes,
  archived_at: borrower.archivedAt ?? null,
});
const fromPartner = (partner: Partner): Partial<PartnerRow> => ({
  id: partner.id, name: partner.name, contact: partner.contact,
  share: partner.share, notes: partner.notes, archived_at: partner.archivedAt ?? null,
});
const fromLoan = (loan: Loan): Partial<LoanRow> => ({
  id: loan.id, number: loan.number, borrower_id: loan.borrowerId,
  partner_id: loan.partnerId ?? null, principal: loan.principal, rate: loan.rate,
  interest: loan.interest, total_due: loan.totalDue, paid: loan.paid,
  collection_type: loan.collectionType, target_days: loan.targetDays, max_days: loan.maxDays,
  loan_date: loan.loanDate, target_date: loan.targetDate,
  maturity_date: loan.maturityDate, status: loan.status,
  archived_at: loan.archivedAt ?? null,
});
const fromPayment = (payment: Payment): Partial<PaymentRow> => ({
  id: payment.id, loan_id: payment.loanId, borrower_id: payment.borrowerId,
  date: payment.date, expected: payment.expected, paid: payment.paid,
  method: payment.method, notes: payment.notes, status: payment.status,
  archived_at: payment.archivedAt ?? null,
});
const fromSettlement = (settlement: Settlement): Partial<SettlementRow> => ({
  id: settlement.id, partner_id: settlement.partnerId, amount: settlement.amount,
  date: settlement.date, method: settlement.method, notes: settlement.notes,
});
const fromActivity = (activity: Activity): Partial<ActivityRow> => ({
  id: activity.id, type: activity.type, message: activity.message, date: activity.date,
});

const DEFAULT_SETTINGS: LendingSettings = {
  businessName: 'Divine Lending', contact: '0917 825 2044', address: 'San Roque, Batangas',
  lead: 'Divine Valdez', interest: '20', target: '40', maturity: '60',
  collectionType: 'Daily', partnerShare: '50',
};

const SETTING_KEY_MAP: Record<string, keyof LendingSettings> = {
  business_name: 'businessName', contact: 'contact', address: 'address', lead: 'lead',
  interest: 'interest', target: 'target', maturity: 'maturity',
  collection_type: 'collectionType', partner_share: 'partnerShare',
};
const SETTING_KEY_INVERSE: Record<keyof LendingSettings, string> = {
  businessName: 'business_name', contact: 'contact', address: 'address', lead: 'lead',
  interest: 'interest', target: 'target', maturity: 'maturity',
  collectionType: 'collection_type', partnerShare: 'partner_share',
};

const raiseOnError = (result: { error: { message: string } | null }): void => {
  if (result.error) throw new Error(result.error.message);
};

export const listSeedsRef = { current: null as SeedData | null };

export async function fetchAll(): Promise<DatabaseState> {
  if (!supabase) throw new Error('Supabase is not configured');
  const [borrowers, partners, loans, payments, settlements, activities, settings] = await Promise.all([
    supabase.from('borrowers').select('*').order('created_at', { ascending: true }),
    supabase.from('partners').select('*').order('created_at', { ascending: true }),
    supabase.from('loans').select('*').order('created_at', { ascending: true }),
    supabase.from('payments').select('*').order('created_at', { ascending: true }),
    supabase.from('settlements').select('*').order('created_at', { ascending: true }),
    supabase.from('activities').select('*').order('created_at', { ascending: true }),
    supabase.from('settings').select('*').order('created_at', { ascending: true }),
  ]);
  raiseOnError(borrowers); raiseOnError(partners); raiseOnError(loans);
  raiseOnError(payments); raiseOnError(settlements); raiseOnError(activities); raiseOnError(settings);

  const loaded: DatabaseState = {
    borrowers: (borrowers.data ?? []).map(toBorrower),
    partners: (partners.data ?? []).map(toPartner),
    loans: (loans.data ?? []).map(toLoan),
    payments: (payments.data ?? []).map(toPayment),
    settlements: (settlements.data ?? []).map(toSettlement),
    activities: (activities.data ?? []).map(toActivity),
    settings: { ...DEFAULT_SETTINGS },
  };
  for (const row of (settings.data ?? []) as SettingRow[]) {
    const key = SETTING_KEY_MAP[row.key];
    if (key) loaded.settings[key] = row.value as never;
  }
  return loaded;
}

export async function seedIfEmpty(state: DatabaseState): Promise<boolean> {
  const seeds = listSeedsRef.current;
  if (!seeds || !supabase) return false;
  const hasData = [state.borrowers, state.partners, state.loans, state.payments, state.settlements].some((rows) => rows.length > 0);
  if (hasData) return false;

  const idMap = new Map<string, string>();
  const newId = () => crypto.randomUUID();

  const borrowers = seeds.borrowers.map((item) => ({ ...item, id: newId() }));
  borrowers.forEach((item, index) => idMap.set(seeds.borrowers[index].id, item.id));
  const partners = seeds.partners.map((item) => ({ ...item, id: newId() }));
  partners.forEach((item, index) => idMap.set(seeds.partners[index].id, item.id));
  const loans = seeds.loans.map((item) => ({
    ...item,
    id: newId(),
    borrowerId: idMap.get(item.borrowerId) ?? item.borrowerId,
    partnerId: item.partnerId ? (idMap.get(item.partnerId) ?? item.partnerId) : undefined,
  }));
  const payments = seeds.payments.map((item) => ({
    ...item,
    id: newId(),
    borrowerId: idMap.get(item.borrowerId) ?? item.borrowerId,
    loanId: idMap.get(item.loanId) ?? item.loanId,
  }));
  const settlements = seeds.settlements.map((item) => ({
    ...item,
    id: newId(),
    partnerId: idMap.get(item.partnerId) ?? item.partnerId,
  }));
  const activities = seeds.activities.map((item) => ({ ...item, id: newId() }));

  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    supabase.from('borrowers').insert(borrowers.map(fromBorrower)),
    supabase.from('partners').insert(partners.map(fromPartner)),
    supabase.from('loans').insert(loans.map(fromLoan)),
    supabase.from('payments').insert(payments.map(fromPayment)),
    supabase.from('settlements').insert(settlements.map(fromSettlement)),
    supabase.from('activities').insert(activities.map(fromActivity)),
  ]);
  raiseOnError(r1); raiseOnError(r2); raiseOnError(r3);
  raiseOnError(r4); raiseOnError(r5); raiseOnError(r6);
  return true;
}

export async function saveBorrower(borrower: Borrower): Promise<Borrower> {
  if (supabase) { const result = await supabase.from('borrowers').insert(fromBorrower(borrower)).select(); raiseOnError(result); if (result.data?.length) return toBorrower(result.data[0] as BorrowerRow); }
  return borrower;
}

export async function updateBorrower(borrower: Borrower): Promise<Borrower> {
  if (supabase) { const result = await supabase.from('borrowers').update(fromBorrower(borrower)).eq('id', borrower.id).select(); raiseOnError(result); if (result.data?.length) return toBorrower(result.data[0] as BorrowerRow); }
  return borrower;
}

export async function savePartner(partner: Partner): Promise<Partner> {
  if (supabase) { const result = await supabase.from('partners').insert(fromPartner(partner)).select(); raiseOnError(result); if (result.data?.length) return toPartner(result.data[0] as PartnerRow); }
  return partner;
}

export async function updatePartner(partner: Partner): Promise<Partner> {
  if (supabase) { const result = await supabase.from('partners').update(fromPartner(partner)).eq('id', partner.id).select(); raiseOnError(result); if (result.data?.length) return toPartner(result.data[0] as PartnerRow); }
  return partner;
}

export async function archiveRecord(table: 'partners' | 'borrowers' | 'loans' | 'payments', id: string, archivedAt: string): Promise<void> {
  if (!supabase) return;
  const result = await supabase.from(table).update({ archived_at: archivedAt }).eq('id', id);
  raiseOnError(result);
}

export async function restoreRecord(table: 'partners' | 'borrowers' | 'loans' | 'payments', id: string): Promise<void> {
  if (!supabase) return;
  const result = await supabase.from(table).update({ archived_at: null }).eq('id', id);
  raiseOnError(result);
}

export async function deleteRecord(table: 'partners' | 'borrowers' | 'loans' | 'payments', id: string): Promise<void> {
  if (!supabase) return;
  const result = await supabase.from(table).delete().eq('id', id);
  raiseOnError(result);
}

export async function saveLoan(loan: Loan): Promise<Loan> {
  if (supabase) { const result = await supabase.from('loans').insert(fromLoan(loan)).select(); raiseOnError(result); if (result.data?.length) return toLoan(result.data[0] as LoanRow); }
  return loan;
}

export async function updateLoan(loan: Loan): Promise<Loan> {
  if (supabase) { const result = await supabase.from('loans').update(fromLoan(loan)).eq('id', loan.id).select(); raiseOnError(result); if (result.data?.length) return toLoan(result.data[0] as LoanRow); }
  return loan;
}

export async function savePayment(payment: Payment): Promise<Payment> {
  if (supabase) { const result = await supabase.from('payments').insert(fromPayment(payment)).select(); raiseOnError(result); if (result.data?.length) return toPayment(result.data[0] as PaymentRow); }
  return payment;
}

export async function updatePayment(payment: Payment): Promise<Payment> {
  if (supabase) { const result = await supabase.from('payments').update(fromPayment(payment)).eq('id', payment.id).select(); raiseOnError(result); if (result.data?.length) return toPayment(result.data[0] as PaymentRow); }
  return payment;
}

export async function saveSettlement(settlement: Settlement): Promise<Settlement> {
  if (supabase) { const result = await supabase.from('settlements').insert(fromSettlement(settlement)).select(); raiseOnError(result); if (result.data?.length) return toSettlement(result.data[0] as SettlementRow); }
  return settlement;
}

export async function saveActivity(activity: Activity): Promise<Activity> {
  if (!supabase) return activity;
  const result = await supabase.from('activities').insert(fromActivity(activity)).select();
  raiseOnError(result);
  if (result.data?.length) return toActivity(result.data[0] as ActivityRow);
  return activity;
}

export async function saveSettings(patch: Partial<LendingSettings>): Promise<void> {
  if (!supabase) return;
  const entries = Object.entries(patch) as [keyof LendingSettings, string][];
  for (const [key, value] of entries) {
    const row = { key: SETTING_KEY_INVERSE[key], value: String(value ?? ''), is_secret: false };
    const result = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    raiseOnError(result);
  }
}