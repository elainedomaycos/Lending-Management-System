export type Status = 'active' | 'extended' | 'completed' | 'overdue' | 'draft' | 'cancelled';
export type PaymentStatus = 'paid' | 'partial' | 'missed' | 'pending';
export type CollectionType = 'Daily' | 'Monthly' | 'Lump Sum';

export interface Borrower {
  id: string; name: string; phone: string; address: string; barangay: string;
  status: 'Active' | 'Overdue' | 'Completed'; notes: string;
  archivedAt?: string | null;
}
export interface Partner { id: string; name: string; contact: string; share: number; notes: string; archivedAt?: string | null; }
export interface Loan {
  id: string; number: string; borrowerId: string; principal: number; rate: number;
  interest: number; totalDue: number; paid: number; collectionType: CollectionType;
  targetDays: number; maxDays: number; loanDate: string; targetDate: string;
  maturityDate: string; status: Status; partnerId?: string;
  archivedAt?: string | null;
}
export interface Payment {
  id: string; date: string; borrowerId: string; loanId: string; expected: number;
  paid: number; method: string; notes: string; status: PaymentStatus;
  archivedAt?: string | null;
}
export interface Settlement { id: string; partnerId: string; amount: number; date: string; method: string; notes: string; }
export interface Activity { id: string; type: 'loan' | 'payment' | 'settlement' | 'borrower' | 'partner'; message: string; date: string; }
export interface Toast { id: number; title: string; message: string; tone?: 'success' | 'info' | 'warning'; }
export interface LendingSettings {
  businessName: string; contact: string; address: string; lead: string;
  interest: string; target: string; maturity: string;
  collectionType: CollectionType; partnerShare: string;
}
export type ModalState = 'borrower' | 'partner' | 'loan' | 'payment' | 'settlement' | 'reschedule' | 'report' | null;
export type RecordKind = 'partner' | 'borrower' | 'loan' | 'payment';