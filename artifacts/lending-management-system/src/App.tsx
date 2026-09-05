import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  AlertCircle, Archive, ArrowLeft, ArrowRight, BarChart3, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  CircleDollarSign, ClipboardList, Clock3, Download, FileBarChart,
  FileText, Filter, HandCoins, Home, Landmark, LayoutDashboard, LogOut,
  Menu, Phone, Plus, Printer, Receipt, RefreshCw, Search,
  Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Target, Trash2, TrendingUp,
  Undo2, UserPlus, Users, Wallet, X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Activity, Borrower, CollectionType, LendingSettings, Loan, ModalState,
  Partner, Payment, PaymentStatus, RecordKind, Settlement, Status, Toast,
} from './lib/types';
import {
  archiveRecord, deleteRecord, fetchAll, listSeedsRef, restoreRecord,
  saveActivity, saveBorrower, saveLoan, savePartner, savePayment, saveSettlement,
  saveSettings, seedIfEmpty, updateBorrower as updateBorrowerRow,
  updateLoan as updateLoanRow, updatePartner as updatePartnerRow,
  updatePayment as updatePaymentRow,
} from './lib/database';
import { isSupabaseReady } from './lib/supabase';

const money = (value: number) => `₱${Math.round(value).toLocaleString('en-PH')}`;
const shortDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
const isoDay = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const today = isoDay();
const daysPast = (iso: string) => Math.max(0, Math.floor((Date.parse(`${today}T00:00:00`) - Date.parse(`${iso}T00:00:00`)) / 86400000));
const statusLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const KIND_LABEL: Record<RecordKind, string> = { partner: 'partner', borrower: 'borrower', loan: 'loan', payment: 'collection' };
const KIND_TABLE: Record<RecordKind, 'partners' | 'borrowers' | 'loans' | 'payments'> = { partner: 'partners', borrower: 'borrowers', loan: 'loans', payment: 'payments' };
const isActiveLoan = (loan: Loan) => loan.status === 'active' || loan.status === 'extended' || loan.status === 'overdue';
const initials = (name: string) => name.split(' ').map((part) => part[0]).slice(0, 2).join('');
const csvCell = (value: string | number) => { const text = String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const content = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
};
function captureElementToPng(node: HTMLElement): Promise<string> {
  document.documentElement.setAttribute('data-capture', '1');
  const svgNS = 'http://www.w3.org/2000/svg';
  const xhtmlNS = 'http://www.w3.org/1999/xhtml';
  const width = node.scrollWidth || node.clientWidth;
  const height = node.scrollHeight || node.clientHeight;
  const clone = node.cloneNode(true) as HTMLElement;
  const inlineStyles = (el: HTMLElement) => {
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i += 1) { const name = cs[i]; el.style.setProperty(name, cs.getPropertyValue(name)); }
    Array.from(el.children).forEach((child) => inlineStyles(child as HTMLElement));
  };
  inlineStyles(clone);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.background = '#ffffff';
  clone.style.margin = '0';
  const outer = document.createElementNS(xhtmlNS, 'div');
  outer.style.width = `${width}px`;
  outer.style.fontFamily = getComputedStyle(node).fontFamily;
  outer.appendChild(clone);
  const fo = document.createElementNS(svgNS, 'foreignObject');
  fo.setAttribute('x', '0'); fo.setAttribute('y', '0');
  fo.setAttribute('width', String(width)); fo.setAttribute('height', String(height));
  fo.appendChild(outer);
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const background = document.createElementNS(svgNS, 'rect');
  background.setAttribute('width', '100%'); background.setAttribute('height', '100%'); background.setAttribute('fill', '#ffffff');
  svg.appendChild(background);
  svg.appendChild(fo);
  const source = `<?xml version="1.0" encoding="UTF-8"?>${new XMLSerializer().serializeToString(svg)}`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2; canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('No canvas context')); return; }
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (error) { reject(error); } finally { document.documentElement.removeAttribute('data-capture'); }
    };
    img.onerror = () => { document.documentElement.removeAttribute('data-capture'); reject(new Error('Image decode failed')); };
    img.src = url;
  });
}

const borrowerSeed: Borrower[] = [
  { id: 'b1', name: 'Maria Santos', phone: '0917 842 1930', address: 'Purok 3, San Roque', barangay: 'San Roque', status: 'Active', notes: 'Runs a small sari-sari store.' },
  { id: 'b2', name: 'Juan Dela Cruz', phone: '0918 334 7712', address: '18 Mabini Street', barangay: 'Poblacion', status: 'Active', notes: 'Preferred collection after 5 PM.' },
  { id: 'b3', name: 'Ana Garcia', phone: '0920 126 4098', address: 'Rizal Extension', barangay: 'Santa Elena', status: 'Active', notes: 'Pays through GCash.' },
  { id: 'b4', name: 'Pedro Reyes', phone: '0919 775 2045', address: 'Block 8, Riverside', barangay: 'San Isidro', status: 'Overdue', notes: 'Review extension before next visit.' },
  { id: 'b5', name: 'Jose Mendoza', phone: '0922 510 8810', address: 'Malvar Avenue', barangay: 'Poblacion', status: 'Completed', notes: 'Good payment history.' },
  { id: 'b6', name: 'Liza Bautista', phone: '0917 660 3391', address: 'Phase 2, Greenfields', barangay: 'Mabini', status: 'Active', notes: 'Monthly collection.' },
  { id: 'b7', name: 'Ramon Villanueva', phone: '0921 412 5820', address: 'Lower Balite Road', barangay: 'Balite', status: 'Active', notes: '' },
  { id: 'b8', name: 'Carla Navarro', phone: '0916 287 7404', address: '19 Sampaguita Lane', barangay: 'Santa Elena', status: 'Overdue', notes: 'Partial payments on current loan.' },
  { id: 'b9', name: 'Nestor Flores', phone: '0927 901 6632', address: 'Purok 1, Market Area', barangay: 'San Roque', status: 'Active', notes: '' },
  { id: 'b10', name: 'Sofia Aquino', phone: '0915 442 1209', address: 'Villa Teresa', barangay: 'Mabini', status: 'Completed', notes: 'Renewal candidate.' },
];

const partnerSeed: Partner[] = [
  { id: 'p1', name: 'Northstar Family Fund', contact: '0917 204 8871', share: 50, notes: 'Quarterly settlement.' },
  { id: 'p2', name: 'R. Villareal', contact: '0920 843 3310', share: 50, notes: 'Prefers monthly updates.' },
  { id: 'p3', name: 'Sampaguita Capital', contact: '0918 652 4902', share: 45, notes: 'Growth partner since 2023.' },
];

const makeLoan = (id: string, number: string, borrowerId: string, principal: number, paid: number, status: Status, type: CollectionType, offset: number, partnerId?: string, rate = 20): Loan => {
  const loanDate = isoDay(offset);
  const targetDate = isoDay(offset + 40);
  const maturityDate = isoDay(offset + 60);
  const interest = principal * rate / 100;
  return { id, number, borrowerId, principal, rate, interest, totalDue: principal + interest, paid, collectionType: type, targetDays: 40, maxDays: 60, loanDate, targetDate, maturityDate, status, partnerId };
};

const loanSeed: Loan[] = [
  makeLoan('l1', 'PL-24018', 'b1', 10000, 7500, 'active', 'Daily', -22, 'p1'),
  makeLoan('l2', 'PL-24019', 'b2', 15000, 12000, 'active', 'Daily', -36, 'p1'),
  makeLoan('l3', 'PL-24020', 'b3', 8000, 3500, 'active', 'Daily', -12, undefined),
  makeLoan('l4', 'PL-24021', 'b4', 12000, 6900, 'extended', 'Daily', -49, 'p2'),
  makeLoan('l5', 'PL-24022', 'b5', 10000, 12000, 'completed', 'Lump Sum', -88, 'p2'),
  makeLoan('l6', 'PL-24023', 'b6', 20000, 8000, 'active', 'Monthly', -31, 'p3'),
  makeLoan('l7', 'PL-24024', 'b7', 7500, 2100, 'active', 'Daily', -7, undefined),
  makeLoan('l8', 'PL-24025', 'b8', 18000, 5600, 'overdue', 'Daily', -74, 'p1'),
  makeLoan('l9', 'PL-24026', 'b9', 9000, 7200, 'active', 'Daily', -28, 'p3'),
  makeLoan('l10', 'PL-24027', 'b10', 12000, 14400, 'completed', 'Monthly', -112, undefined),
  makeLoan('l11', 'PL-24028', 'b1', 6000, 0, 'active', 'Daily', -3, undefined),
  makeLoan('l12', 'PL-24029', 'b2', 18000, 4000, 'active', 'Monthly', -18, 'p2'),
  makeLoan('l13', 'PL-24030', 'b3', 5000, 6000, 'completed', 'Daily', -95, undefined),
  makeLoan('l14', 'PL-24031', 'b7', 11000, 2500, 'extended', 'Daily', -52, 'p3'),
  makeLoan('l15', 'PL-24032', 'b8', 9000, 1700, 'overdue', 'Daily', -67, undefined),
  makeLoan('l16', 'PL-24033', 'b10', 7000, 0, 'draft', 'Daily', 0, undefined, 20),
];

const paymentSeed: Payment[] = [
  { id: 'pay1', date: today, borrowerId: 'b1', loanId: 'l1', expected: 300, paid: 300, method: 'Cash', notes: '', status: 'paid' },
  { id: 'pay2', date: today, borrowerId: 'b2', loanId: 'l2', expected: 450, paid: 300, method: 'GCash', notes: 'Will complete tomorrow.', status: 'partial' },
  { id: 'pay3', date: today, borrowerId: 'b4', loanId: 'l4', expected: 360, paid: 0, method: 'Cash', notes: '', status: 'missed' },
  { id: 'pay4', date: today, borrowerId: 'b3', loanId: 'l3', expected: 240, paid: 240, method: 'GCash', notes: '', status: 'paid' },
  { id: 'pay5', date: isoDay(-1), borrowerId: 'b8', loanId: 'l8', expected: 540, paid: 200, method: 'Cash', notes: '', status: 'partial' },
  { id: 'pay6', date: isoDay(-2), borrowerId: 'b1', loanId: 'l1', expected: 300, paid: 300, method: 'Cash', notes: '', status: 'paid' },
  { id: 'pay7', date: isoDay(-3), borrowerId: 'b7', loanId: 'l7', expected: 225, paid: 0, method: 'Cash', notes: 'No answer at visit.', status: 'missed' },
  { id: 'pay8', date: isoDay(-4), borrowerId: 'b6', loanId: 'l6', expected: 4800, paid: 4800, method: 'Bank Transfer', notes: '', status: 'paid' },
];

const settlementSeed: Settlement[] = [
  { id: 's1', partnerId: 'p1', amount: 2400, date: isoDay(-20), method: 'Cash', notes: 'Partial settlement on PL-24018.' },
  { id: 's2', partnerId: 'p2', amount: 1800, date: isoDay(-14), method: 'Bank Transfer', notes: 'Settlement on PL-24022.' },
  { id: 's3', partnerId: 'p1', amount: 1500, date: isoDay(-5), method: 'Cash', notes: 'Advance against PL-24025.' },
];

const activitySeed: Activity[] = [
  { id: 'a1', type: 'payment', message: '₱300 payment from Maria Santos via Cash.', date: today },
  { id: 'a2', type: 'settlement', message: '₱1,500 settlement to Northstar Family Fund.', date: isoDay(-4) },
  { id: 'a3', type: 'loan', message: 'PL-24029 created for Juan Dela Cruz.', date: isoDay(-6) },
];

listSeedsRef.current = { borrowers: borrowerSeed, partners: partnerSeed, loans: loanSeed, payments: paymentSeed, settlements: settlementSeed, activities: activitySeed };

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Borrowers', href: '/borrowers', icon: Users },
  { label: 'Loans', href: '/loans', icon: Wallet },
  { label: 'Collections', href: '/collections', icon: HandCoins },
  { label: 'Partners', href: '/partners', icon: BriefcaseBusiness },
  { label: 'Archive', href: '/archive', icon: Archive },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Audit trail', href: '/audit', icon: ClipboardList },
];

const getBorrower = (borrowers: Borrower[], id: string) => borrowers.find((item) => item.id === id);
const getPartner = (partners: Partner[], id?: string) => partners.find((item) => item.id === id);
const loanExpected = (loan: Loan) => loan.collectionType === 'Daily' ? loan.totalDue / loan.targetDays : loan.collectionType === 'Monthly' ? loan.totalDue / 4 : loan.totalDue;

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [offline, setOffline] = useState(!isSupabaseReady);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string>();
  const [editingLoanId, setEditingLoanId] = useState<string>();
  const [editingPartnerId, setEditingPartnerId] = useState<string>();
  const [editingBorrowerId, setEditingBorrowerId] = useState<string>();
  const [editingPaymentId, setEditingPaymentId] = useState<string>();
  const [pendingArchive, setPendingArchive] = useState<{ kind: RecordKind; id: string; name: string }>();
  const [pendingDelete, setPendingDelete] = useState<{ kind: RecordKind; id: string; name: string }>();
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>();
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>();
  const [globalSearch, setGlobalSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [displaySize, setDisplaySize] = useState('standard');
  const [settings, setSettings] = useState<LendingSettings>({ businessName: 'Divine Lending', contact: '0917 825 2044', address: 'San Roque, Batangas', lead: 'Divine Valdez', interest: '20', target: '40', maturity: '60', collectionType: 'Daily', partnerShare: '50' });
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reportImage, setReportImage] = useState<string>();
  const [reportTitle, setReportTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const state = await fetchAll();
        const seeded = await seedIfEmpty(state);
        const final = (seeded && (await fetchAll())) || state;
        if (cancelled) return;
        setBorrowers(final.borrowers);
        setPartners(final.partners);
        setLoans(final.loans);
        setPayments(final.payments);
        setSettlements(final.settlements);
        setActivities(final.activities);
        setSettings(final.settings);
        if (isSupabaseReady) setOffline(false);
      } catch (error) {
        if (cancelled) return;
        setOffline(true);
        setBorrowers(borrowerSeed);
        setPartners(partnerSeed);
        setLoans(loanSeed);
        setPayments(paymentSeed);
        setSettlements(settlementSeed);
        setActivities(activitySeed);
        showToast('Supabase unavailable', error instanceof Error ? error.message : 'Could not load data.', 'warning');
      } finally {
        if (!cancelled) setDataReady(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = (patch: Partial<LendingSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    void saveSettings(patch).catch((error: Error) => showToast('Settings not saved', error.message, 'warning'));
  };
  const logActivity = (type: Activity['type'], message: string) => {
    const activity: Activity = { id: crypto.randomUUID(), type, message, date: today };
    setActivities((current) => [activity, ...current]);
    void saveActivity(activity).catch(() => undefined);
  };
  const prepareReportPrint = async (tab: string) => {
    const node = document.getElementById(`report-${tab.toLowerCase()}`);
    if (!node) { showToast('Nothing to print', `The ${tab} view has no report to capture.`, 'warning'); return; }
    try {
      const dataUrl = await captureElementToPng(node as HTMLElement);
      setReportTitle(tab); setReportImage(dataUrl); setModal('report');
    } catch {
      setReportImage(undefined); showToast('Picture failed', 'The report could not be rendered as an image.', 'warning');
    }
  };

  const showToast = (title: string, message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now();
    setToasts((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
  };
  const openPayment = (loanId?: string, borrowerId?: string) => {
    setSelectedLoanId(loanId);
    setSelectedBorrowerId(borrowerId);
    setModal('payment');
  };
  const addBorrower = async (data: Omit<Borrower, 'id' | 'status'>) => {
    const borrower: Borrower = { ...data, id: crypto.randomUUID(), status: 'Active' };
    setBorrowers((current) => [borrower, ...current]);
    setModal(null);
    try {
      await saveBorrower(borrower);
      showToast('Borrower added', `${data.name} is ready for a new loan.`);
      void logActivity('borrower', `${data.name} added to the borrower book.`);
    } catch (error) {
      setBorrowers((current) => current.filter((item) => item.id !== borrower.id));
      showToast('Borrower not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const updateBorrower = async (id: string, data: Omit<Borrower, 'id' | 'status'>) => {
    const existing = borrowers.find((item: Borrower) => item.id === id);
    if (!existing) { setModal(null); setEditingBorrowerId(undefined); return; }
    const next: Borrower = { ...existing, ...data };
    setBorrowers((current) => current.map((item) => item.id === id ? next : item));
    setModal(null);
    setEditingBorrowerId(undefined);
    try {
      await updateBorrowerRow(next);
      showToast('Borrower updated', `${data.name} details saved.`);
      void logActivity('borrower', `${data.name} details updated.`);
    } catch (error) {
      setBorrowers((current) => current.map((item) => item.id === id ? existing : item));
      showToast('Borrower not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const addPartner = async (data: Omit<Partner, 'id'>) => {
    const partner: Partner = { ...data, id: crypto.randomUUID() };
    setPartners((current) => [partner, ...current]);
    setModal(null);
    try {
      await savePartner(partner);
      showToast('Partner added', `${data.name} has been added to your partner book.`);
      void logActivity('partner', `${data.name} added to the partner book.`);
    } catch (error) {
      setPartners((current) => current.filter((item) => item.id !== partner.id));
      showToast('Partner not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const updatePartner = async (id: string, data: Omit<Partner, 'id'>) => {
    const existing = partners.find((item: Partner) => item.id === id);
    if (!existing) { setModal(null); setEditingPartnerId(undefined); return; }
    const next: Partner = { ...existing, ...data };
    setPartners((current) => current.map((item) => item.id === id ? next : item));
    setModal(null);
    setEditingPartnerId(undefined);
    try {
      await updatePartnerRow(next);
      showToast('Partner updated', `${data.name} details saved.`);
      void logActivity('partner', `${data.name} details updated.`);
    } catch (error) {
      setPartners((current) => current.map((item) => item.id === id ? existing : item));
      showToast('Partner not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const describeRecord = (kind: RecordKind, id: string): string => {
    if (kind === 'partner') return partners.find((item: Partner) => item.id === id)?.name ?? 'this record';
    if (kind === 'borrower') return borrowers.find((item: Borrower) => item.id === id)?.name ?? 'this record';
    if (kind === 'loan') return loans.find((item: Loan) => item.id === id)?.number ?? 'this loan';
    const payment = payments.find((item: Payment) => item.id === id);
    return payment ? `${getBorrower(borrowers, payment.borrowerId)?.name ?? 'A borrower'} · ${money(payment.paid || payment.expected)}` : 'this collection';
  };
  const requestArchive = (kind: RecordKind, id: string) => setPendingArchive({ kind, id, name: describeRecord(kind, id) });
  const requestDelete = (kind: RecordKind, id: string) => setPendingDelete({ kind, id, name: describeRecord(kind, id) });
  const confirmArchive = async () => {
    if (!pendingArchive) return;
    const { kind, id, name } = pendingArchive;
    setPendingArchive(undefined);
    const stampedAt = new Date().toISOString();
    const prev = { borrowers, partners, loans, payments };
    if (kind === 'partner') setPartners((current) => current.map((item) => item.id === id ? { ...item, archivedAt: stampedAt } : item));
    else if (kind === 'borrower') setBorrowers((current) => current.map((item) => item.id === id ? { ...item, archivedAt: stampedAt } : item));
    else if (kind === 'loan') setLoans((current) => current.map((item) => item.id === id ? { ...item, archivedAt: stampedAt } : item));
    else setPayments((current) => current.map((item) => item.id === id ? { ...item, archivedAt: stampedAt } : item));
    try {
      await archiveRecord(KIND_TABLE[kind], id, stampedAt);
      showToast('Archived', `${name} moved to the archive. You can restore it anytime.`);
      void logActivity(kind === 'payment' ? 'payment' : kind, `${name} archived.`);
    } catch (error) {
      setBorrowers(prev.borrowers); setPartners(prev.partners); setLoans(prev.loans); setPayments(prev.payments);
      showToast('Could not archive', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id, name } = pendingDelete;
    setPendingDelete(undefined);
    const prev = { borrowers, partners, loans, payments };
    if (kind === 'partner') {
      setPartners((current) => current.filter((item) => item.id !== id));
      setLoans((current) => current.map((loan) => loan.partnerId === id ? { ...loan, partnerId: undefined } : loan));
    } else if (kind === 'borrower') {
      const orphanedLoanIds = loans.filter((loan) => loan.borrowerId === id).map((loan) => loan.id);
      setBorrowers((current) => current.filter((item) => item.id !== id));
      setLoans((current) => current.filter((loan) => loan.borrowerId !== id));
      setPayments((current) => current.filter((payment) => !orphanedLoanIds.includes(payment.loanId)));
    } else if (kind === 'loan') {
      setLoans((current) => current.filter((loan) => loan.id !== id));
      setPayments((current) => current.filter((payment) => payment.loanId !== id));
    } else {
      setPayments((current) => current.filter((item) => item.id !== id));
    }
    try {
      await deleteRecord(KIND_TABLE[kind], id);
      showToast('Deleted permanently', `${name} removed from the archive for good.`);
      void logActivity(kind === 'payment' ? 'payment' : kind, `${name} permanently deleted.`);
    } catch (error) {
      setBorrowers(prev.borrowers); setPartners(prev.partners); setLoans(prev.loans); setPayments(prev.payments);
      showToast('Could not delete', error instanceof Error ? error.message : 'Could not delete.', 'warning');
    }
  };
  const restoreRecordAsync = async (kind: RecordKind, id: string) => {
    const name = describeRecord(kind, id);
    const prev = { borrowers, partners, loans, payments };
    if (kind === 'partner') setPartners((current) => current.map((item) => item.id === id ? { ...item, archivedAt: null } : item));
    else if (kind === 'borrower') setBorrowers((current) => current.map((item) => item.id === id ? { ...item, archivedAt: null } : item));
    else if (kind === 'loan') setLoans((current) => current.map((item) => item.id === id ? { ...item, archivedAt: null } : item));
    else setPayments((current) => current.map((item) => item.id === id ? { ...item, archivedAt: null } : item));
    try {
      await restoreRecord(KIND_TABLE[kind], id);
      showToast('Restored', `${name} is back in your book.`);
      void logActivity(kind === 'payment' ? 'payment' : kind, `${name} restored from the archive.`);
    } catch (error) {
      setBorrowers(prev.borrowers); setPartners(prev.partners); setLoans(prev.loans); setPayments(prev.payments);
      showToast('Could not restore', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const addLoan = async (data: Omit<Loan, 'id' | 'number' | 'paid' | 'status'>) => {
    const numbers = loans.map((item) => { const match = item.number.match(/PL-(\d+)/); return match ? Number(match[1]) : 24033; });
    const nextNumber = `PL-${Math.max(24033, ...numbers) + 1}`;
    const borrowerName = getBorrower(borrowers, data.borrowerId)?.name ?? 'the borrower';
    const loan: Loan = { ...data, id: crypto.randomUUID(), number: nextNumber, paid: 0, status: 'active' };
    setLoans((current) => [loan, ...current]);
    setModal(null);
    try {
      await saveLoan(loan);
      showToast('Loan created', `${nextNumber} is now active for ${borrowerName}.`);
      void logActivity('loan', `${nextNumber} created for ${borrowerName}.`);
    } catch (error) {
      setLoans((current) => current.filter((item) => item.id !== loan.id));
      showToast('Loan not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const updateLoan = async (id: string, data: Omit<Loan, 'id' | 'number' | 'paid' | 'status'>, status: Status) => {
    const existing = loans.find((loan: Loan) => loan.id === id);
    if (!existing) { setModal(null); setEditingLoanId(undefined); return; }
    const next: Loan = { ...existing, ...data, status, paid: Math.min(existing.paid, data.totalDue) };
    setLoans((current) => current.map((loan) => loan.id === id ? next : loan));
    setModal(null);
    setEditingLoanId(undefined);
    try {
      await updateLoanRow(next);
      showToast('Loan updated', `${next.number} terms updated.`);
      void logActivity('loan', `${next.number} edited as ${statusLabel(status)}.`);
    } catch (error) {
      setLoans((current) => current.map((loan) => loan.id === id ? existing : loan));
      showToast('Loan not updated', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const recordPayment = async (data: Omit<Payment, 'id' | 'status'>) => {
    const payment: Payment = { ...data, id: crypto.randomUUID(), status: data.paid >= data.expected ? 'paid' : data.paid > 0 ? 'partial' : 'missed' };
    const loan = loans.find((item: Loan) => item.id === data.loanId);
    const nextLoan: Loan | undefined = loan ? { ...loan, paid: Math.min(loan.totalDue, loan.paid + data.paid), status: loan.paid + data.paid >= loan.totalDue ? 'completed' : loan.status } : undefined;
    setPayments((current) => [payment, ...current]);
    if (nextLoan) setLoans((current) => current.map((item) => item.id === nextLoan.id ? nextLoan : item));
    setModal(null);
    try {
      await savePayment(payment);
      if (nextLoan) await updateLoanRow(nextLoan);
      showToast('Payment recorded', `${money(data.paid)} recorded as ${statusLabel(payment.status)}.`);
      void logActivity('payment', `${getBorrower(borrowers, data.borrowerId)?.name} · ${money(data.paid)} ${statusLabel(payment.status)}.`);
    } catch (error) {
      setPayments((current) => current.filter((item) => item.id !== payment.id));
      if (loan && nextLoan) setLoans((current) => current.map((item) => item.id === loan.id ? loan : item));
      showToast('Payment not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const updatePaymentRecord = async (id: string, data: Omit<Payment, 'id' | 'status'>) => {
    const existing = payments.find((item: Payment) => item.id === id);
    if (!existing) { setModal(null); setEditingPaymentId(undefined); return; }
    const status: PaymentStatus = data.paid >= data.expected ? 'paid' : data.paid > 0 ? 'partial' : 'missed';
    const next: Payment = { ...existing, ...data, status };
    setPayments((current) => current.map((item) => item.id === id ? next : item));
    setModal(null);
    setEditingPaymentId(undefined);
    try {
      await updatePaymentRow(next);
      showToast('Payment updated', `${money(data.paid)} payment details saved.`);
      void logActivity('payment', `${getBorrower(borrowers, data.borrowerId)?.name ?? 'Payment'} · ${money(data.paid)} updated.`);
    } catch (error) {
      setPayments((current) => current.map((item) => item.id === id ? existing : item));
      showToast('Payment not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const recordSettlement = async (data: Omit<Settlement, 'id' | 'date'>) => {
    const settlement: Settlement = { ...data, id: crypto.randomUUID(), date: today };
    const partnerName = getPartner(partners, data.partnerId)?.name ?? 'the partner';
    setSettlements((current) => [settlement, ...current]);
    setModal(null);
    try {
      await saveSettlement(settlement);
      showToast('Settlement recorded', `${money(data.amount)} settled to ${partnerName}.`);
      void logActivity('settlement', `${money(data.amount)} settled to ${partnerName}.`);
    } catch (error) {
      setSettlements((current) => current.filter((item) => item.id !== settlement.id));
      showToast('Settlement not saved', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const reschedulePayment = async (id: string, newDate: string, reason: string) => {
    const target = payments.find((payment) => payment.id === id);
    if (!target) { setModal(null); return; }
    const next: Payment = { ...target, date: newDate, status: 'pending', notes: reason ? `${target.notes ? `${target.notes} · ` : ''}Rescheduled · ${reason}` : 'Rescheduled' };
    const borrowerName = getBorrower(borrowers, target.borrowerId)?.name ?? 'borrower';
    setPayments((current) => current.map((payment) => payment.id === id ? next : payment));
    setModal(null);
    try {
      await updatePaymentRow(next);
      showToast('Payment rescheduled', `Moved to ${shortDate(newDate)}.`, 'info');
      void logActivity('payment', `Payment rescheduled for ${borrowerName}.`);
    } catch (error) {
      setPayments((current) => current.map((payment) => payment.id === id ? target : payment));
      showToast('Could not reschedule', error instanceof Error ? error.message : 'Could not save.', 'warning');
    }
  };
  const activePartners = partners.filter((item: Partner) => !item.archivedAt);
  const archivedPartners = partners.filter((item: Partner) => Boolean(item.archivedAt));
  const activeBorrowers = borrowers.filter((item: Borrower) => !item.archivedAt);
  const archivedBorrowers = borrowers.filter((item: Borrower) => Boolean(item.archivedAt));
  const activeLoans = loans.filter((item: Loan) => !item.archivedAt);
  const archivedLoans = loans.filter((item: Loan) => Boolean(item.archivedAt));
  const activePayments = payments.filter((item: Payment) => !item.archivedAt);
  const archivedPayments = payments.filter((item: Payment) => Boolean(item.archivedAt));
  const sharedProps = { borrowers, loans, partners, payments, settlements, activities, settings, updateSettings, openPayment, requestArchive, requestDelete, restoreRecord: restoreRecordAsync, setModal, setSelectedLoanId, setEditingLoanId, setEditingPartnerId, setEditingBorrowerId, setEditingPaymentId, setSelectedBorrowerId, setSelectedPartnerId, setSelectedPaymentId, showToast, onPrint: prepareReportPrint };

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  if (!dataReady) return <SplashScreen offline={offline} />;
  const searchBorrowers = activeBorrowers.filter((item) => `${item.name} ${item.phone}`.toLowerCase().includes(globalSearch.toLowerCase()));
  const searchLoans = activeLoans.filter((item) => {
    const borrower = getBorrower(borrowers, item.borrowerId);
    return `${item.number} ${borrower?.name ?? ''}`.toLowerCase().includes(globalSearch.toLowerCase());
  });

  return (
    <div className={`app-shell ${displaySize === 'large' ? 'size-large' : displaySize === 'xlarge' ? 'size-xlarge' : ''}`}>
      <div className="flex min-h-[100dvh]">
        <aside className="desktop-sidebar sidebar flex shrink-0 flex-col px-4 py-5">
          <Link href="/" data-testid="link-brand" className="mb-9 flex items-center gap-3 px-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Landmark size={19} /></div>
            <div><div className="font-bold tracking-tight text-white">Lending</div><div className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground)/.64)]">Management System</div></div>
          </Link>
          <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground)/.48)]">Workspace</div>
          <nav className="space-y-1">
            {navItems.map(({ label, href, icon: Icon }) => <NavItem key={href} label={label} href={href} icon={Icon} />)}
          </nav>
          <div className="my-6 border-t border-[hsl(var(--sidebar-border))]" />
          <nav className="space-y-1">
            <NavItem label="Settings" href="/settings" icon={Settings2} />
          </nav>
          <div className="mt-auto rounded-xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.55)] p-3">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white"><Sparkles size={14} className="text-[hsl(var(--sidebar-primary))]" />Daily check-in</div>
            <p className="text-[11px] leading-relaxed text-[hsl(var(--sidebar-foreground)/.68)]">Keep your collection queue current before the afternoon rounds.</p>
            <Link href="/collections" data-testid="link-sidebar-collections" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[hsl(var(--sidebar-primary))]">Open queue <ArrowRight size={12} /></Link>
          </div>
        </aside>
        <main className="main-stage flex-1">
          {offline && <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--destructive)/.08)] px-4 py-2 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="banner-offline"><AlertCircle size={14} />Demo mode — Supabase not reachable, using local records.</div>}
          <header className="flex h-[72px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.86)] px-4 backdrop-blur-md sm:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button className="mobile-only icon-button h-9 w-9" onClick={() => showToast('Navigation', 'Use the bottom navigation to switch sections.', 'info')} data-testid="button-mobile-menu"><Menu size={17} /></button>
              <div className="relative hidden w-full min-w-0 max-w-[440px] flex-1 sm:block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} className="field h-10 min-w-0 pl-9 pr-3 text-sm" placeholder="Search borrowers or loan numbers" data-testid="input-global-search" />
                {globalSearch && <div className="absolute left-0 right-0 top-12 z-30 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-xl">
                  {searchBorrowers.slice(0, 3).map((item) => <Link href={`/borrowers/${item.id}`} onClick={() => setGlobalSearch('')} key={item.id} data-testid={`search-borrower-${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[hsl(var(--muted))]"><Users size={14} className="text-[hsl(var(--primary))]" />{item.name}<span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Borrower</span></Link>)}
                  {searchLoans.slice(0, 3).map((item) => <Link href={`/loans/${item.id}`} onClick={() => setGlobalSearch('')} key={item.id} data-testid={`search-loan-${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[hsl(var(--muted))]"><Wallet size={14} className="text-[hsl(var(--primary))]" />{item.number}<span className="ml-auto text-xs text-[hsl(var(--muted-foreground))]">Loan</span></Link>)}
                  {!searchBorrowers.length && !searchLoans.length && <div className="p-3 text-sm text-[hsl(var(--muted-foreground))]">No matching records.</div>}
                </div>}
              </div>
              <div className="sm:hidden"><span className="font-bold tracking-tight">Lending</span></div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <button className="icon-button h-9 w-9" onClick={() => showToast('All caught up', 'No new alerts for today.', 'info')} data-testid="button-notifications"><Bell size={17} /></button>
              <div className="hidden h-7 w-px bg-[hsl(var(--border))] sm:block" />
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--secondary-foreground))]">{initials(settings.lead)}</div>
                <div className="hidden leading-tight sm:block"><div className="text-sm font-semibold">{settings.lead}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">Administrator</div></div>
                <button className="icon-button h-7 w-7 border-0" onClick={() => setLoggedIn(false)} data-testid="button-logout"><LogOut size={15} /></button>
              </div>
            </div>
          </header>
          <Switch>
            <Route path="/"><DashboardPage {...sharedProps} /></Route>
            <Route path="/borrowers"><BorrowersPage {...sharedProps} /></Route>
            <Route path="/borrowers/:id"><BorrowerDetail {...sharedProps} /></Route>
            <Route path="/loans"><LoansPage {...sharedProps} /></Route>
            <Route path="/loans/:id"><LoanDetail {...sharedProps} /></Route>
            <Route path="/collections"><CollectionsPage {...sharedProps} /></Route>
            <Route path="/napalya"><NapalyaPage {...sharedProps} /></Route>
            <Route path="/partners"><PartnersPage {...sharedProps} /></Route>
            <Route path="/partners/:id"><PartnerDetail {...sharedProps} /></Route>
            <Route path="/archive"><ArchivePage borrowers={archivedBorrowers} loans={archivedLoans} payments={archivedPayments} partners={archivedPartners} restoreRecord={restoreRecordAsync} requestDelete={requestDelete} /></Route>
            <Route path="/reports"><ReportsPage {...sharedProps} /></Route>
            <Route path="/audit"><AuditPage {...sharedProps} /></Route>
            <Route path="/settings"><SettingsPage settings={settings} updateSettings={updateSettings} displaySize={displaySize} setDisplaySize={setDisplaySize} showToast={showToast} /></Route>
            <Route><NotFound /></Route>
          </Switch>
        </main>
      </div>
      <MobileNav />
      {modal === 'borrower' && <BorrowerModal editing={borrowers.find((item: Borrower) => item.id === editingBorrowerId)} onClose={() => { setModal(null); setEditingBorrowerId(undefined); }} onSave={addBorrower} onEdit={updateBorrower} />}
      {modal === 'partner' && <PartnerModal defaultShare={settings.partnerShare} editing={partners.find((item: Partner) => item.id === editingPartnerId)} onClose={() => { setModal(null); setEditingPartnerId(undefined); }} onSave={addPartner} onEdit={updatePartner} />}
      {modal === 'loan' && <LoanModal borrowers={activeBorrowers} partners={activePartners} loanRules={{ interest: settings.interest, target: settings.target, maturity: settings.maturity, collectionType: settings.collectionType }} editing={loans.find((loan: Loan) => loan.id === editingLoanId)} onClose={() => { setModal(null); setEditingLoanId(undefined); }} onSave={addLoan} onEdit={updateLoan} showToast={showToast} />}
      {modal === 'settlement' && <SettlementModal partners={activePartners} settleRecords={settlements} selectedPartnerId={selectedPartnerId} onClose={() => setModal(null)} onSave={recordSettlement} />}
      {modal === 'reschedule' && <RescheduleModal payment={payments.find((payment) => payment.id === selectedPaymentId)} onClose={() => setModal(null)} onSave={reschedulePayment} />}
      {modal === 'report' && reportImage && <ReportPrintModal image={reportImage} title={reportTitle} onClose={() => { setModal(null); setReportImage(undefined); }} showToast={showToast} />}
      {modal === 'payment' && <PaymentModal borrowers={borrowers} loans={loans} selectedLoanId={selectedLoanId} selectedBorrowerId={selectedBorrowerId} editing={payments.find((item: Payment) => item.id === editingPaymentId)} onClose={() => { setModal(null); setEditingPaymentId(undefined); }} onSave={recordPayment} onEdit={updatePaymentRecord} />}
      {pendingArchive && <Modal title={`Archive ${KIND_LABEL[pendingArchive.kind]}`} description="Keep the record, remove it from active use." onClose={() => setPendingArchive(undefined)}><div className="flex flex-col gap-5"><p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Move <b className="text-[hsl(var(--foreground))]">{pendingArchive.name}</b> to the archive? Its history stays on record and you can restore it anytime.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPendingArchive(undefined)} testId="button-cancel-archive">Cancel</Button><Button onClick={() => void confirmArchive()} icon={Archive} testId="button-confirm-archive">Archive {KIND_LABEL[pendingArchive.kind]}</Button></div></div></Modal>}
      {pendingDelete && <Modal title="Delete permanently" description="This cannot be undone." onClose={() => setPendingDelete(undefined)}><div className="flex flex-col gap-5"><p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Permanently delete <b className="text-[hsl(var(--foreground))]">{pendingDelete.name}</b>? The record is gone from the archive forever.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPendingDelete(undefined)} testId="button-cancel-delete">Cancel</Button><Button variant="danger" onClick={() => void confirmDelete()} icon={Trash2} testId="button-confirm-delete">Delete forever</Button></div></div></Modal>}
      <div className="toast-stack">{toasts.map((toast) => <div key={toast.id} className="toast" data-testid={`toast-${toast.id}`}><div className="flex items-start gap-2"><CheckCircle2 size={16} className={toast.tone === 'warning' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--chart-2))]'} /><div><div className="text-sm font-bold">{toast.title}</div><div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{toast.message}</div></div><button onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="ml-auto text-[hsl(var(--muted-foreground))]" data-testid={`button-dismiss-toast-${toast.id}`}><X size={14} /></button></div></div>)}</div>
    </div>
  );
}

function NavItem({ label, href, icon: Icon }: { label: string; href: string; icon: LucideIcon }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`nav-link flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'active' : 'text-[hsl(var(--sidebar-foreground)/.75)]'}`}><Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span>{label}</span></Link>;
}

function MobileNav() {
  return <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 items-center justify-around border-t border-[hsl(var(--border))] bg-[hsl(var(--card)/.96)] px-2 py-2 backdrop-blur-md">
    {navItems.slice(0, 5).map(({ label, href, icon: Icon }) => <Link href={href} key={href} data-testid={`mobile-nav-${label.toLowerCase()}`} className="flex min-w-[54px] flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]"><Icon size={17} /><span>{label}</span></Link>)}
  </nav>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow mb-2">{eyebrow || 'Workspace'}</div><h1 className="text-[26px] font-bold tracking-[-.03em] text-[hsl(var(--foreground))]">{title}</h1>{subtitle && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p>}</div>{action && <div className="flex flex-wrap gap-2">{action}</div>}</div>;
}
function Button({ children, onClick, variant = 'primary', icon: Icon, testId, type = 'button', disabled = false, small = false }: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: LucideIcon; testId: string; type?: 'button' | 'submit'; disabled?: boolean; small?: boolean }) {
  const styles = variant === 'primary' ? 'bg-[hsl(var(--primary))] text-white hover:brightness-95' : variant === 'danger' ? 'bg-[hsl(var(--destructive))] text-white' : variant === 'secondary' ? 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]' : 'text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]';
  const size = small ? 'gap-1 rounded-md px-2 py-1 text-[11px]' : 'gap-2 rounded-lg px-3.5 py-2 text-sm';
  return <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} className={`inline-flex items-center justify-center font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${size} ${styles}`}>{Icon && <Icon size={small ? 12 : 16} />}{children}</button>;
}
function MetricCard({ label, value, caption, icon: Icon, accent = 'primary' }: { label: string; value: string; caption: string; icon: LucideIcon; accent?: 'primary' | 'gold' | 'red' | 'green' }) {
  const colors = { primary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]', gold: 'bg-[hsl(var(--accent))] text-[hsl(31_62%_32%)]', red: 'bg-[hsl(1_71%_93%)] text-[hsl(var(--destructive))]', green: 'bg-[hsl(157_47%_91%)] text-[hsl(157_47%_30%)]' };
  return <div className="metric-card card p-4 sm:p-5"><div className="flex items-start justify-between"><div className="eyebrow">{label}</div><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${colors[accent]}`}><Icon size={16} /></div></div><div className="mt-4 text-[25px] font-bold tracking-[-.04em]">{value}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{caption}</div></div>;
}
function StatusBadge({ value }: { value: string }) { return <span className={`status status-${value.toLowerCase()}`} data-testid={`status-${value.toLowerCase()}`}>{value === 'Paid' || value === 'Completed' || value === 'Active' ? <Check size={12} /> : value === 'Missed' || value === 'Overdue' ? <AlertCircle size={12} /> : <Clock3 size={12} />}{value}</span>; }
function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) { return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)] px-6 py-12 text-center"><div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><ClipboardList size={19} /></div><h3 className="font-bold">{title}</h3><p className="mt-1 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">{message}</p>{action && <div className="mt-4">{action}</div>}</div>; }
function SplashScreen({ offline }: { offline: boolean }) { return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--secondary))] p-5"><div className="w-full max-w-sm rounded-2xl bg-[hsl(var(--card))] p-8 text-center shadow-2xl"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white"><Landmark size={22} /></div><h2 className="mt-5 text-lg font-bold">Opening your lending desk</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{offline ? 'Working with local demonstration records.' : 'Syncing with your Supabase workspace.'}</p></div></div>; }

function DashboardPage({ borrowers, loans, payments, activities, settings, setModal, setSelectedLoanId, showToast }: any) {
  const activeLoans = loans.filter((loan: Loan) => isActiveLoan(loan) && !loan.archivedAt);
  const outstanding = activeLoans.reduce((sum: number, loan: Loan) => sum + loan.totalDue - loan.paid, 0);
  const liveLoanIds = new Set(loans.filter((loan: Loan) => !loan.archivedAt).map((loan: Loan) => loan.id));
  const todayRows = payments.filter((payment: Payment) => payment.date === today && !payment.archivedAt && liveLoanIds.has(payment.loanId));
  const due = todayRows.reduce((sum: number, item: Payment) => sum + item.expected, 0);
  const collected = todayRows.reduce((sum: number, item: Payment) => sum + item.paid, 0);
  const attention = loans.filter((loan: Loan) => (loan.status === 'overdue' || loan.status === 'extended') && !loan.archivedAt);
  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const leadName = settings?.lead || 'there';
  return <div className="page-wrap page-enter">
    <PageHeader eyebrow="Overview" title={`${greeting}, ${leadName}.`} subtitle={`Here's your lending activity for ${shortDate(today)}.`} action={<Button onClick={() => setModal('loan')} icon={Plus} testId="button-dashboard-new-loan">New loan</Button>} />
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard label="Active loans" value={String(activeLoans.length)} caption="Across your current book" icon={Wallet} />
      <MetricCard label="Outstanding balance" value={money(outstanding)} caption="Principal and interest remaining" icon={CircleDollarSign} accent="gold" />
      <MetricCard label="Due today" value={money(due)} caption={`${todayRows.length} scheduled collections`} icon={Target} accent="red" />
      <MetricCard label="Collected today" value={money(collected)} caption={`${due ? Math.round(collected / due * 100) : 0}% of today's due`} icon={TrendingUp} accent="green" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">Today's collections</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Stay on top of the next collection round.</p></div><Link href="/collections" data-testid="link-view-all-collections" className="text-xs font-bold text-[hsl(var(--primary))]">View all <ArrowRight size={13} className="ml-1 inline" /></Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3 font-bold">Borrower</th><th className="px-3 py-3 font-bold">Expected</th><th className="px-3 py-3 font-bold">Paid</th><th className="px-3 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Action</th></tr></thead><tbody>{todayRows.map((payment: Payment) => { const borrower = getBorrower(borrowers, payment.borrowerId); const loan = loans.find((item: Loan) => item.id === payment.loanId); return <tr className="table-row border-t border-[hsl(var(--border))]" key={payment.id} data-testid={`row-dashboard-payment-${payment.id}`}><td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[10px] font-bold text-[hsl(var(--primary))]">{initials(borrower?.name || '')}</div><div><div className="font-semibold">{borrower?.name}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{loan?.number}</div></div></div></td><td className="px-3 py-3.5">{money(payment.expected)}</td><td className="px-3 py-3.5 font-semibold">{money(payment.paid)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(payment.status)} /></td><td className="px-5 py-3.5 text-right"><Button variant="ghost" onClick={() => { setSelectedLoanId(payment.loanId); setModal('payment'); }} testId={`button-dashboard-payment-${payment.id}`}>{payment.status === 'paid' ? 'View' : 'Record'}</Button></td></tr>; })}</tbody></table></div>
      </section>
      <section className="space-y-5">
        <div className="card p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Quick actions</div><h2 className="mt-1 font-bold">Keep work moving</h2></div><Sparkles size={18} className="text-[hsl(var(--primary))]" /></div><div className="mt-4 grid grid-cols-2 gap-2.5"><QuickAction icon={Plus} label="New loan" onClick={() => setModal('loan')} testId="button-quick-new-loan" /><QuickAction icon={HandCoins} label="Record payment" onClick={() => setModal('payment')} testId="button-quick-payment" /><QuickAction icon={UserPlus} label="Add borrower" onClick={() => setModal('borrower')} testId="button-quick-borrower" /><Link href="/reports" data-testid="link-quick-reports" className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-3 text-center text-xs font-semibold transition hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--muted))]"><FileBarChart size={18} className="text-[hsl(var(--primary))]" />View reports</Link></div></div>
        <div className="card p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Needs attention</div><h2 className="mt-1 font-bold">Follow-ups</h2></div><span className="rounded-full bg-[hsl(var(--destructive)/.1)] px-2 py-1 text-xs font-bold text-[hsl(var(--destructive))]">{attention.length}</span></div><div className="mt-4 space-y-2">{attention.slice(0, 3).map((loan: Loan) => <Link href={`/loans/${loan.id}`} key={loan.id} data-testid={`link-attention-${loan.id}`} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 transition hover:bg-[hsl(var(--muted))]"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${loan.status === 'overdue' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))] text-[hsl(31_62%_32%)]'}`}><AlertCircle size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{getBorrower(borrowers, loan.borrowerId)?.name}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{loan.status === 'overdue' ? 'Past maturity' : 'Past 40-day target'} · {money(loan.totalDue - loan.paid)} left</div></div><ArrowRight size={14} className="text-[hsl(var(--muted-foreground))]" /></Link>)}</div><Link href="/napalya" data-testid="link-attention-collections" className="mt-3 block text-center text-xs font-bold text-[hsl(var(--primary))]">Review all attention items</Link></div>
        <div className="card overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="eyebrow">Recent activity</div><h2 className="mt-1 font-bold">What changed in your book</h2></div>{activities.length ? <div className="divide-y divide-[hsl(var(--border))]">{activities.slice(0, 5).map((item: Activity) => { const Icon = item.type === 'payment' ? HandCoins : item.type === 'settlement' ? Receipt : item.type === 'loan' ? Wallet : item.type === 'borrower' ? UserPlus : BriefcaseBusiness; return <div key={item.id} className="flex items-center gap-3 px-5 py-3" data-testid={`row-activity-${item.id}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={14} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.message}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{shortDate(item.date)}</div></div></div>; })}</div> : <div className="px-5 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No activity yet.</div>}</div>
      </section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]"><div className="card p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Collection pulse</div><h2 className="mt-1 font-bold">This week at a glance</h2></div><span className="mono text-xs text-[hsl(var(--muted-foreground))]">MON—SUN</span></div><div className="mt-5 flex h-28 items-end gap-2">{[55, 72, 42, 83, 68, 91, 37].map((height, index) => <div className="flex flex-1 flex-col items-center gap-2" key={index}><div className="w-full rounded-t-md bg-[hsl(var(--primary)/.14)]" style={{ height: `${height}%` }}><div className="h-full w-full rounded-t-md bg-[hsl(var(--primary))]" style={{ height: `${index === 6 ? 45 : index % 2 ? 75 : 60}%` }} /></div><span className="text-[10px] text-[hsl(var(--muted-foreground))]">{['M','T','W','T','F','S','S'][index]}</span></div>)}</div></div><div className="soft-card card flex items-center justify-between gap-4 p-5"><div><div className="eyebrow">A small reminder</div><h2 className="mt-2 max-w-sm text-lg font-bold">A clear listahan makes a calm collection day.</h2><p className="mt-2 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">Record every visit while it is fresh so your balances stay trustworthy.</p></div><div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(31_62%_32%)] sm:flex"><ClipboardList size={28} /></div></div></div>
  </div>;
}
function QuickAction({ icon: Icon, label, onClick, testId }: { icon: LucideIcon; label: string; onClick: () => void; testId: string }) { return <button onClick={onClick} data-testid={testId} className="flex flex-col items-center gap-2 rounded-xl border border-[hsl(var(--border))] p-3 text-center text-xs font-semibold transition hover:border-[hsl(var(--primary)/.35)] hover:bg-[hsl(var(--muted))]"><Icon size={18} className="text-[hsl(var(--primary))]" />{label}</button>; }

function BorrowersPage({ borrowers, loans, setModal, showToast, requestArchive, setEditingBorrowerId }: any) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All'); const [refreshing, setRefreshing] = useState(false);
  const active = borrowers.filter((borrower: Borrower) => !borrower.archivedAt);
  const refreshBook = () => {
    setQuery(''); setFilter('All'); setRefreshing(true);
    showToast('Borrower book refreshed', 'Row counts and balances are back in sync.', 'info');
    window.setTimeout(() => setRefreshing(false), 900);
  };
  const filtered = active.filter((borrower: Borrower) => {
    const borrowerLoans = loans.filter((loan: Loan) => loan.borrowerId === borrower.id && isActiveLoan(loan) && !loan.archivedAt);
    const matchesQuery = `${borrower.name} ${borrower.phone} ${borrower.barangay}`.toLowerCase().includes(query.toLowerCase());
    const matches = filter === 'All' || (filter === 'Has balance' && borrowerLoans.some((loan: Loan) => loan.totalDue > loan.paid)) || borrower.status === filter;
    return matchesQuery && matches;
  });
  return <div className="page-wrap page-enter"><PageHeader eyebrow="People" title="Borrowers" subtitle={`${active.length} people in your borrower book.`} action={<Button onClick={() => setModal('borrower')} icon={UserPlus} testId="button-add-borrower">Add borrower</Button>} />
    <div className="card mb-5 p-3 sm:p-4"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field min-w-0 pl-9" placeholder="Search name, phone, or barangay" data-testid="input-borrower-search" /></div><div className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-1">{['All','Active','Has balance','Overdue'].map((item) => <button key={item} onClick={() => setFilter(item)} data-testid={`filter-borrowers-${item.toLowerCase().replace(' ','-')}`} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${filter === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>{item}</button>)}</div></div></div>
    <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">Borrower list</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{filtered.length} matching records</p></div><button className={`icon-button h-9 w-9 ${refreshing ? 'refresh-spin' : ''}`} onClick={refreshBook} title="Refresh borrower list" data-testid="button-refresh-borrowers"><RefreshCw size={15} /></button></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Borrower</th><th className="px-3 py-3">Phone</th><th className="px-3 py-3">Current loan</th><th className="px-3 py-3">Outstanding</th><th className="px-3 py-3">Collection</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{filtered.map((borrower: Borrower) => { const current = loans.find((loan: Loan) => loan.borrowerId === borrower.id && isActiveLoan(loan)); return <tr className="table-row border-t border-[hsl(var(--border))]" key={borrower.id} data-testid={`row-borrower-${borrower.id}`}><td className="px-5 py-3.5"><Link href={`/borrowers/${borrower.id}`} data-testid={`link-borrower-${borrower.id}`} className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{initials(borrower.name)}</div><div><div className="font-semibold">{borrower.name}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{borrower.barangay}</div></div></Link></td><td className="px-3 py-3.5 text-[hsl(var(--muted-foreground))]">{borrower.phone}</td><td className="px-3 py-3.5 mono text-xs">{current?.number || '—'}</td><td className="px-3 py-3.5 font-semibold">{current ? money(current.totalDue - current.paid) : '—'}</td><td className="px-3 py-3.5">{current?.collectionType || '—'}</td><td className="px-3 py-3.5"><StatusBadge value={borrower.status} /></td><td className="px-5 py-3.5 text-right"><div className="flex justify-end gap-1.5"><Button small variant="secondary" onClick={() => { setEditingBorrowerId(borrower.id); setModal('borrower'); }} icon={Settings2} testId={`button-edit-borrower-${borrower.id}`}>Edit</Button><Button small variant="secondary" onClick={() => requestArchive('borrower', borrower.id)} icon={Archive} testId={`button-archive-borrower-${borrower.id}`}>Archive</Button></div></td></tr>; })}</tbody></table></div> : <div className="p-5"><EmptyState title="No borrowers found" message="Try a different name, phone number, or filter." action={<Button variant="secondary" onClick={() => { setQuery(''); setFilter('All'); }} testId="button-clear-borrower-filter">Clear filters</Button>} /></div>}</div>
  </div>;
}

function BorrowerDetail({ borrowers, loans, payments, setModal, setSelectedLoanId }: any) {
  const { id = '' } = useParams<{ id: string }>(); const borrower = getBorrower(borrowers, id); const borrowerLoans = loans.filter((loan: Loan) => loan.borrowerId === id); const history = payments.filter((payment: Payment) => payment.borrowerId === id);
  if (!borrower) return <NotFound />;
  const current = borrowerLoans.find(isActiveLoan) || borrowerLoans[0];
  return <div className="page-wrap page-enter"><Link href="/borrowers" data-testid="link-back-borrowers" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]"><ArrowLeft size={15} />Back to borrowers</Link><PageHeader eyebrow="Borrower profile" title={borrower.name} subtitle={`${borrower.barangay} · Added to your book this year.`} action={<><Button variant="secondary" onClick={() => { setSelectedLoanId(current?.id); setModal('payment'); }} icon={HandCoins} testId="button-borrower-record-payment">Record payment</Button><Button onClick={() => setModal('loan')} icon={Plus} testId="button-borrower-new-loan">New loan</Button></>} />
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><section className="space-y-5"><div className="card p-5"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{initials(borrower.name)}</div><div><h2 className="font-bold">{borrower.name}</h2><StatusBadge value={borrower.status} /></div></div><div className="mt-5 space-y-3 border-t border-[hsl(var(--border))] pt-4 text-sm"><div className="flex items-center gap-3"><Phone size={15} className="text-[hsl(var(--muted-foreground))]" /><span>{borrower.phone}</span></div><div className="flex items-start gap-3"><Landmark size={15} className="mt-0.5 text-[hsl(var(--muted-foreground))]" /><span>{borrower.address}<br /><span className="text-xs text-[hsl(var(--muted-foreground))]">{borrower.barangay}</span></span></div></div>{borrower.notes && <div className="mt-4 rounded-lg bg-[hsl(var(--accent)/.52)] p-3 text-xs text-[hsl(31_62%_28%)]"><span className="font-bold">Note: </span>{borrower.notes}</div>}</div><div className="card p-5"><div className="eyebrow">Collection information</div><div className="mt-4 grid grid-cols-2 gap-4"><Info label="Type" value={current?.collectionType || '—'} /><Info label="Daily target" value={current?.collectionType === 'Daily' ? money(loanExpected(current)) : '—'} /><Info label="Target period" value={current ? `${current.targetDays} days` : '—'} /><Info label="Maximum period" value={current ? `${current.maxDays} days` : '—'} /></div></div></section>
      <section className="space-y-5">{current && <div className="card p-5"><div className="flex items-start justify-between"><div><div className="eyebrow">Current loan</div><h2 className="mt-1 text-lg font-bold">{current.number}</h2></div><StatusBadge value={statusLabel(current.status)} /></div><div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4"><Info label="Principal" value={money(current.principal)} /><Info label="Interest" value={money(current.interest)} /><Info label="Total due" value={money(current.totalDue)} /><Info label="Remaining" value={money(current.totalDue - current.paid)} /></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-[hsl(var(--muted-foreground))]">Payment progress</span><span className="font-bold">{Math.round(current.paid / current.totalDue * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, current.paid / current.totalDue * 100)}%` }} /></div></div><div className="mt-5 flex flex-wrap gap-4 text-xs text-[hsl(var(--muted-foreground))]"><span>Target: <b className="text-[hsl(var(--foreground))]">{shortDate(current.targetDate)}</b></span><span>Maturity: <b className="text-[hsl(var(--foreground))]">{shortDate(current.maturityDate)}</b></span></div><Link href={`/loans/${current.id}`} data-testid="link-borrower-current-loan" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">View loan details <ArrowRight size={15} /></Link></div>}<div className="card overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="eyebrow">Payment history</div><h2 className="mt-1 font-bold">Recent activity</h2></div>{history.length ? <div className="divide-y divide-[hsl(var(--border))]">{history.map((payment: Payment) => <div key={payment.id} className="flex items-center justify-between gap-3 px-5 py-3.5" data-testid={`row-borrower-payment-${payment.id}`}><div><div className="text-sm font-semibold">{shortDate(payment.date)}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{payment.method} · Expected {money(payment.expected)}</div></div><div className="text-right"><div className="font-semibold">{money(payment.paid)}</div><StatusBadge value={statusLabel(payment.status)} /></div></div>)}</div> : <div className="p-5"><EmptyState title="No payment history" message="Payments will appear here after the first collection." /></div>}</div></section></div>
  </div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>; }

function LoansPage({ loans, borrowers, setModal, setSelectedLoanId, setEditingLoanId, requestArchive }: any) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All');
  const active = loans.filter((loan: Loan) => !loan.archivedAt);
  const filtered = active.filter((loan: Loan) => `${loan.number} ${getBorrower(borrowers, loan.borrowerId)?.name}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || loan.status === filter.toLowerCase()));
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Portfolio" title="Loans" subtitle={`${active.length} loans across your portfolio.`} action={<Button onClick={() => setModal('loan')} icon={Plus} testId="button-new-loan">New loan</Button>} /><div className="card mb-5 p-3 sm:p-4"><div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input className="field min-w-0 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loan number or borrower" data-testid="input-loan-search" /></div><select className="field shrink-0 md:w-44" value={filter} onChange={(event) => setFilter(event.target.value)} data-testid="select-loan-filter"><option>All</option><option>Active</option><option>Extended</option><option>Overdue</option><option>Completed</option><option>Draft</option><option>Cancelled</option></select></div></div><div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">Loan book</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{filtered.length} matching loans</p></div><Filter size={16} className="text-[hsl(var(--muted-foreground))]" /></div><div className="overflow-x-auto"><table className="w-full min-w-[790px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Loan</th><th className="px-3 py-3">Borrower</th><th className="px-3 py-3">Principal</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Maturity</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{filtered.map((loan: Loan) => <tr key={loan.id} className="table-row border-t border-[hsl(var(--border))]" data-testid={`row-loan-${loan.id}`}><td className="px-5 py-3.5"><Link href={`/loans/${loan.id}`} data-testid={`link-loan-${loan.id}`} className="mono text-xs font-bold text-[hsl(var(--primary))]">{loan.number}</Link><div className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">{shortDate(loan.loanDate)}</div></td><td className="px-3 py-3.5 font-semibold">{getBorrower(borrowers, loan.borrowerId)?.name}</td><td className="px-3 py-3.5">{money(loan.principal)}</td><td className="px-3 py-3.5 font-semibold">{money(loan.totalDue - loan.paid)}</td><td className="px-3 py-3.5">{loan.collectionType}</td><td className="px-3 py-3.5 text-xs">{shortDate(loan.maturityDate)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(loan.status)} /></td><td className="px-5 py-3.5 text-right"><div className="flex justify-end gap-1.5"><Button small variant="secondary" onClick={() => { setEditingLoanId(loan.id); setModal('loan'); }} icon={Settings2} testId={`button-edit-loan-${loan.id}`}>Edit</Button><Button small variant="secondary" onClick={() => requestArchive('loan', loan.id)} icon={Archive} testId={`button-archive-loan-${loan.id}`}>Archive</Button></div></td></tr>)}</tbody></table></div></div></div>;
}

function LoanDetail({ loans, borrowers, partners, payments, setModal, setSelectedLoanId, setEditingLoanId, showToast }: any) {
  const { id = '' } = useParams<{ id: string }>(); const loan = loans.find((item: Loan) => item.id === id); if (!loan) return <NotFound />;
  const borrower = getBorrower(borrowers, loan.borrowerId); const partner = getPartner(partners, loan.partnerId); const history = payments.filter((payment: Payment) => payment.loanId === loan.id);
  return <div className="page-wrap page-enter"><Link href="/loans" data-testid="link-back-loans" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]"><ArrowLeft size={15} />Back to loans</Link><PageHeader eyebrow="Loan details" title={loan.number} subtitle={`${borrower?.name} · Started ${shortDate(loan.loanDate)}`} action={<><Button variant="secondary" onClick={() => { setSelectedLoanId(loan.id); setModal('payment'); }} icon={HandCoins} testId="button-loan-record-payment">Record payment</Button><Button variant="ghost" onClick={() => showToast('Print prepared', 'A print-ready view would open here.', 'info')} icon={Printer} testId="button-loan-print">Print</Button></>} />
    <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><section className="space-y-5"><div className="card p-5"><div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Loan summary</div><h2 className="mt-1 text-lg font-bold">{borrower?.name}</h2></div><StatusBadge value={statusLabel(loan.status)} /></div><div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4"><Info label="Principal" value={money(loan.principal)} /><Info label="Interest" value={`${money(loan.interest)} · ${loan.rate}%`} /><Info label="Total due" value={money(loan.totalDue)} /><Info label="Paid" value={money(loan.paid)} /><Info label="Remaining" value={money(loan.totalDue - loan.paid)} /><Info label="Collection" value={loan.collectionType} /><Info label="Target date" value={shortDate(loan.targetDate)} /><Info label="Maturity" value={shortDate(loan.maturityDate)} /></div><div className="mt-6"><div className="mb-2 flex justify-between text-xs"><span className="text-[hsl(var(--muted-foreground))]">Overall repayment</span><span className="font-bold">{money(loan.paid)} / {money(loan.totalDue)}</span></div><div className="h-3 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, loan.paid / loan.totalDue * 100)}%` }} /></div></div></div><div className="card p-5"><div className="flex items-center justify-between"><div><div className="eyebrow">Loan timeline</div><h2 className="mt-1 font-bold">Collection milestones</h2></div><CalendarDays size={18} className="text-[hsl(var(--primary))]" /></div><div className="mt-6 grid grid-cols-3 gap-2"><TimelineItem label="Loan start" date={shortDate(loan.loanDate)} done /><TimelineItem label="40-day target" date={shortDate(loan.targetDate)} done={loan.status !== 'active'} /><TimelineItem label="60-day maturity" date={shortDate(loan.maturityDate)} done={loan.status === 'overdue' || loan.status === 'completed'} /></div><div className="mt-4 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><div className="h-px flex-1 bg-[hsl(var(--border))]" /><span>Target collection is separate from maximum maturity</span><div className="h-px flex-1 bg-[hsl(var(--border))]" /></div></div><div className="card overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="eyebrow">Payment history</div><h2 className="mt-1 font-bold">Recorded payments</h2></div>{history.length ? <div className="divide-y divide-[hsl(var(--border))]">{history.map((payment: Payment) => <div key={payment.id} className="flex items-center justify-between px-5 py-3.5" data-testid={`row-loan-payment-${payment.id}`}><div><div className="text-sm font-semibold">{shortDate(payment.date)}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{payment.method}{payment.notes ? ` · ${payment.notes}` : ''}</div></div><div className="flex items-center gap-4 text-right"><div><div className="text-sm font-semibold">{money(payment.paid)}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">of {money(payment.expected)}</div></div><StatusBadge value={statusLabel(payment.status)} /></div></div>)}</div> : <div className="p-5"><EmptyState title="No payments yet" message="Record the first collection against this loan." /></div>}</div></section><aside className="space-y-5"><div className="card p-5"><div className="eyebrow">Partner allocation</div>{partner ? <><div className="mt-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{initials(partner.name)}</div><div><div className="font-bold">{partner.name}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{partner.share}% profit share</div></div></div><div className="mt-5 grid grid-cols-2 gap-4"><Info label="Principal reference" value={money(loan.principal)} /><Info label="Partner profit" value={money(loan.interest * partner.share / 100)} /><Info label="Business profit" value={money(loan.interest * (100 - partner.share) / 100)} /><Info label="Settlement" value={loan.status === 'completed' ? 'Ready' : 'Pending'} /></div></> : <div className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">This is a fully business-funded loan.</div>}</div><div className="card p-5"><div className="eyebrow">Actions</div><div className="mt-3 space-y-2"><Button variant="secondary" onClick={() => { setSelectedLoanId(loan.id); setModal('payment'); }} icon={HandCoins} testId="button-loan-action-payment">Record payment</Button><Button variant="secondary" onClick={() => { setEditingLoanId(loan.id); setModal('loan'); }} icon={Settings2} testId="button-loan-edit">Edit loan</Button><Button variant="ghost" onClick={() => showToast('Share link copied', 'A secure share link was copied for this prototype.', 'info')} icon={ArrowRight} testId="button-loan-share">Share loan summary</Button></div></div></aside></div>
  </div>;
}
function TimelineItem({ label, date, done }: { label: string; date: string; done: boolean }) { return <div className="text-center"><div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${done ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'}`}>{done ? <Check size={15} /> : <div className="h-2 w-2 rounded-full bg-current" />}</div><div className="text-xs font-bold">{label}</div><div className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{date}</div></div>; }

function CollectionsPage({ borrowers, loans, payments, setModal, setSelectedLoanId, requestArchive, setEditingPaymentId }: any) {
  const [filter, setFilter] = useState('All'); const [view, setView] = useState('queue'); const [monthOffset, setMonthOffset] = useState(0);
  const live = payments.filter((payment: Payment) => { const loan = loans.find((loan: Loan) => loan.id === payment.loanId); return !payment.archivedAt && !loan?.archivedAt; });
  const rows = live.filter((payment: Payment) => filter === 'All' || filter === 'Missed payments' ? (filter === 'All' ? true : payment.status === 'missed') : loans.find((loan: Loan) => loan.id === payment.loanId)?.collectionType === filter);
  const todayRows = payments.filter((payment: Payment) => payment.date === today && !payment.archivedAt && !loans.find((loan: Loan) => loan.id === payment.loanId)?.archivedAt); const expected = todayRows.reduce((sum: number, p: Payment) => sum + p.expected, 0); const collected = todayRows.reduce((sum: number, p: Payment) => sum + p.paid, 0);
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Daily operations" title="Collections" subtitle="Your collection queue, payment history, and schedule in one view." action={<><Link href="/napalya" data-testid="link-collections-missed" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]"><AlertCircle size={16} />Missed payments</Link><Button onClick={() => setModal('payment')} icon={HandCoins} testId="button-collections-record-payment">Record payment</Button></>} /><div className="mb-5 grid grid-cols-3 gap-3"><MetricCard label="Expected today" value={money(expected)} caption="Scheduled collections" icon={Target} /><MetricCard label="Collected today" value={money(collected)} caption={`${todayRows.filter((p: Payment) => p.status === 'paid').length} completed`} icon={CheckCircle2} accent="green" /><MetricCard label="Remaining today" value={money(Math.max(0, expected - collected))} caption="Needs follow-up" icon={AlertCircle} accent="red" /></div><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-1">{['All','Daily','Monthly','Missed payments'].map((item) => <button key={item} onClick={() => setFilter(item)} data-testid={`filter-collections-${item.toLowerCase().replace(' ','-')}`} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${filter === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>{item}</button>)}</div><div className="flex rounded-lg border border-[hsl(var(--border))] p-1"><button onClick={() => setView('queue')} data-testid="button-collections-queue-view" className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'queue' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : ''}`}>Queue</button><button onClick={() => setView('calendar')} data-testid="button-collections-calendar-view" className={`rounded-md px-3 py-1.5 text-xs font-bold ${view === 'calendar' ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]' : ''}`}>Calendar</button></div></div>{view === 'queue' ? <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">Collection queue</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{rows.length} records in this view</p></div><SlidersHorizontal size={16} className="text-[hsl(var(--muted-foreground))]" /></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Borrower</th><th className="px-3 py-3">Expected</th><th className="px-3 py-3">Paid</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{rows.map((payment: Payment) => <tr key={payment.id} className="table-row border-t border-[hsl(var(--border))]" data-testid={`row-collection-${payment.id}`}><td className="px-5 py-3.5"><div className="font-semibold">{getBorrower(borrowers, payment.borrowerId)?.name}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{shortDate(payment.date)} · {loans.find((loan: Loan) => loan.id === payment.loanId)?.number}</div></td><td className="px-3 py-3.5">{money(payment.expected)}</td><td className="px-3 py-3.5 font-semibold">{money(payment.paid)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(payment.status)} /></td><td className="px-5 py-3.5 text-right"><div className="flex justify-end gap-1.5"><Button small variant="secondary" onClick={() => { setEditingPaymentId(payment.id); setModal('payment'); }} icon={Settings2} testId={`button-edit-payment-${payment.id}`}>Edit</Button><Button small variant="secondary" onClick={() => requestArchive('payment', payment.id)} icon={Archive} testId={`button-archive-payment-${payment.id}`}>Archive</Button></div></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No collections in this view" message="Try another collection type or come back after adding a loan." /></div>}</div><div className="card p-5"><div className="eyebrow">Missed payments</div><h2 className="mt-1 font-bold">Follow up today</h2><div className="mt-4 space-y-3">{payments.filter((payment: Payment) => payment.status === 'missed').slice(0, 4).map((payment: Payment) => <div key={payment.id} className="flex items-center gap-3 border-b border-[hsl(var(--border))] pb-3" data-testid={`item-missed-${payment.id}`}><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]"><Phone size={14} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{getBorrower(borrowers, payment.borrowerId)?.name}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{money(payment.expected)} · {shortDate(payment.date)}</div></div><button onClick={() => { setSelectedLoanId(payment.loanId); setModal('payment'); }} data-testid={`button-missed-followup-${payment.id}`} className="text-xs font-bold text-[hsl(var(--primary))]">Follow up</button></div>)}</div><Link href="/reports" data-testid="link-collections-report" className="mt-4 block text-center text-xs font-bold text-[hsl(var(--primary))]">See collection report</Link></div></div> : <CalendarView loans={loans} payments={payments} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />}
  </div>;
}
function CalendarView({ loans, payments, monthOffset, setMonthOffset }: any) {
  const base = new Date(); base.setMonth(base.getMonth() + monthOffset, 1); const year = base.getFullYear(); const month = base.getMonth(); const first = new Date(year, month, 1).getDay(); const days = new Date(year, month + 1, 0).getDate(); const cells = Array.from({ length: first + days }, (_, index) => index < first ? null : index - first + 1);
  return <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><div className="eyebrow">Daily schedule</div><h2 className="mt-1 font-bold">{base.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h2></div><div className="flex gap-1"><button className="icon-button h-8 w-8" onClick={() => setMonthOffset(monthOffset - 1)} data-testid="button-calendar-previous"><ChevronLeft size={15} /></button><button className="icon-button h-8 w-8" onClick={() => setMonthOffset(monthOffset + 1)} data-testid="button-calendar-next"><ChevronRight size={15} /></button></div></div><div className="grid grid-cols-7 border-b border-[hsl(var(--border))] text-center text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className="py-3">{day}</div>)}</div><div className="calendar-grid">{cells.map((day, index) => { const dayString = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''; const dayPayments = payments.filter((payment: Payment) => payment.date === dayString && !payment.archivedAt); return <div className="calendar-cell" key={index}>{day && <><div className={`mb-2 text-xs font-bold ${dayString === today ? 'text-[hsl(var(--primary))]' : ''}`}>{day}{dayString === today && <span className="ml-1 rounded bg-[hsl(var(--primary))] px-1 py-0.5 text-[9px] text-white">Today</span>}</div>{dayPayments.slice(0, 2).map((payment: Payment) => <div key={payment.id} className={`mb-1 truncate rounded px-1.5 py-1 text-[10px] font-semibold ${payment.status === 'paid' ? 'bg-[hsl(157_47%_91%)] text-[hsl(157_47%_30%)]' : payment.status === 'missed' ? 'bg-[hsl(1_71%_93%)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--accent))] text-[hsl(31_62%_32%)]'}`}>{money(payment.paid || payment.expected)}</div>)}</>}</div>; })}</div><div className="flex flex-wrap gap-4 border-t border-[hsl(var(--border))] px-5 py-3 text-xs text-[hsl(var(--muted-foreground))]"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(157_47%_43%)]" />Paid</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(43_89%_59%)]" />Partial</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-[hsl(var(--destructive))]" />Missed</span><span>{loans.filter((loan: Loan) => loan.collectionType === 'Daily').length} daily loans scheduled</span></div></div>;
}

function PartnersPage({ partners, loans, settlements, setModal, setEditingPartnerId, requestArchive }: any) {
  const active = partners.filter((partner: Partner) => !partner.archivedAt);
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Capital partners" title="Partners" subtitle="Track principal, profit allocation, and settlements." action={<Button onClick={() => setModal('partner')} icon={Plus} testId="button-add-partner">Add partner</Button>} /><div className="grid gap-4 md:grid-cols-3">{active.map((partner: Partner) => { const partnerLoans = loans.filter((loan: Loan) => loan.partnerId === partner.id); const principal = partnerLoans.filter(isActiveLoan).reduce((sum: number, loan: Loan) => sum + loan.principal, 0); const profit = partnerLoans.reduce((sum: number, loan: Loan) => sum + loan.interest * partner.share / 100, 0); return <div key={partner.id} className="card relative p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"><Link href={`/partners/${partner.id}`} data-testid={`card-partner-${partner.id}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Open ${partner.name} profile`} /><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-sm font-bold text-[hsl(var(--primary))]">{initials(partner.name)}</div><span className="status status-active">Active</span></div><h2 className="mt-4 font-bold">{partner.name}</h2><div className="mt-4 grid grid-cols-2 gap-4 border-t border-[hsl(var(--border))] pt-4"><Info label="Active principal" value={money(principal)} /><Info label="Expected profit" value={money(profit)} /></div><div className="mt-4 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]"><span>{partnerLoans.length} linked loans</span><span className="font-bold text-[hsl(var(--primary))]">Open profile <ArrowRight size={12} className="inline" /></span></div><div className="relative z-10 mt-4 flex gap-2 border-t border-[hsl(var(--border))] pt-4"><Button small variant="secondary" onClick={() => { setEditingPartnerId(partner.id); setModal('partner'); }} icon={Settings2} testId={`button-edit-partner-${partner.id}`}>Edit</Button><Button small variant="secondary" onClick={() => requestArchive('partner', partner.id)} icon={Archive} testId={`button-archive-partner-${partner.id}`}>Archive</Button></div></div>; })}</div><div className="card mt-5 overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><h2 className="font-bold">Partner book</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">A quick view of pending settlements.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Partner</th><th className="px-3 py-3">Active loans</th><th className="px-3 py-3">Principal</th><th className="px-3 py-3">Profit share</th><th className="px-3 py-3">Settlement</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{partners.map((partner: Partner) => { const linked = loans.filter((loan: Loan) => loan.partnerId === partner.id); const principal = linked.filter((loan: Loan) => loan.status !== 'completed').reduce((sum: number, loan: Loan) => sum + loan.principal, 0); const earned = linked.reduce((sum: number, loan: Loan) => sum + loan.interest * partner.share / 100, 0); const settled = settlements.filter((item: Settlement) => item.partnerId === partner.id).reduce((sum: number, item: Settlement) => sum + item.amount, 0); const pending = Math.max(0, earned - settled); return <tr key={partner.id} className="table-row border-t border-[hsl(var(--border))]" data-testid={`row-partner-${partner.id}`}><td className="px-5 py-3.5 font-semibold">{partner.name}</td><td className="px-3 py-3.5">{linked.length}</td><td className="px-3 py-3.5">{money(principal)}</td><td className="px-3 py-3.5">{partner.share}%</td><td className="px-3 py-3.5">{pending > 0 ? <StatusBadge value="Pending" /> : <span className="status status-active"><Check size={12} />Settled</span>}</td><td className="px-5 py-3.5 text-right"><Link href={`/partners/${partner.id}`} data-testid={`button-view-partner-${partner.id}`} className="text-xs font-bold text-[hsl(var(--primary))]">View</Link></td></tr>; })}</tbody></table></div></div></div>;
}
function ArchivePage({ partners, loans, borrowers, payments, restoreRecord, requestDelete }: { partners: Partner[]; loans: Loan[]; borrowers: Borrower[]; payments: Payment[]; restoreRecord: (kind: RecordKind, id: string) => void; requestDelete: (kind: RecordKind, id: string) => void }) {
  const archivedOn = (value?: string | null) => (value ? shortDate(String(value).slice(0, 10)) : '—');
  const sections = [{ kind: 'partner' as RecordKind, items: partners, title: 'Partners', meta: (item: Partner) => `${loans.filter((loan: Loan) => loan.partnerId === item.id).length} linked loans` }, { kind: 'borrower' as RecordKind, items: borrowers, title: 'Borrowers', meta: (item: Borrower) => `${loans.filter((loan: Loan) => loan.borrowerId === item.id).length} linked loans` }, { kind: 'loan' as RecordKind, items: loans, title: 'Loans', meta: (item: Loan) => `${payments.filter((payment: Payment) => payment.loanId === item.id).length} recorded payments` }, { kind: 'payment' as RecordKind, items: payments, title: 'Collections', meta: (item: Payment) => `${getBorrower(borrowers, item.borrowerId)?.name || 'Borrower'} · ${money(item.paid)}` }];
  const total = partners.length + borrowers.length + loans.length + payments.length;
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Records" title="Archive" subtitle={total ? `${total} archived records kept on record.` : 'Nothing is archived yet.'} />{total ? <div className="space-y-8">{sections.map((section) => section.items.length ? <section key={section.title}><div className="mb-3 flex items-center justify-between"><div className="eyebrow">{section.title}</div><span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">{section.items.length} archived</span></div><div className="grid gap-4 md:grid-cols-3">{section.items.map((item: any) => <div key={item.id} className="card relative p-5 opacity-90"><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--muted))] text-sm font-bold text-[hsl(var(--muted-foreground))]">{initials(item.name)}</div><span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--muted-foreground))]">Archived</span></div><h2 className="mt-4 font-bold">{item.name}</h2><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Archived {archivedOn(item.archivedAt)} · {section.meta(item)}</div><div className="mt-4 flex gap-2 border-t border-[hsl(var(--border))] pt-4"><Button small variant="secondary" onClick={() => restoreRecord(section.kind, item.id)} icon={Undo2} testId={`button-restore-${section.kind}-${item.id}`}>Restore</Button><Button small variant="danger" onClick={() => requestDelete(section.kind, item.id)} icon={Trash2} testId={`button-delete-${section.kind}-${item.id}`}>Delete</Button></div></div>)}</div></section> : null)}</div> : <EmptyState title="Nothing archived yet" message="When you archive a partner, borrower, loan, or collection, it moves here where you can restore it or permanently delete it." />}</div>;
}
function PartnerDetail({ partners, loans, borrowers, settlements, setModal, setSelectedPartnerId, showToast }: any) {
  const { id = '' } = useParams<{ id: string }>(); const partner = getPartner(partners, id); if (!partner) return <NotFound />; const linked = loans.filter((loan: Loan) => loan.partnerId === id); const principal = linked.filter(isActiveLoan).reduce((sum: number, loan: Loan) => sum + loan.principal, 0); const profit = linked.reduce((sum: number, loan: Loan) => sum + loan.interest * partner.share / 100, 0); const historySettlements = settlements.filter((item: Settlement) => item.partnerId === id).sort((a: Settlement, b: Settlement) => b.date.localeCompare(a.date)); const settled = historySettlements.reduce((sum: number, item: Settlement) => sum + item.amount, 0);
  return <div className="page-wrap page-enter"><Link href="/partners" data-testid="link-back-partners" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]"><ArrowLeft size={15} />Back to partners</Link><PageHeader eyebrow="Partner profile" title={partner.name} subtitle={`${partner.contact} · ${partner.share}% default profit share`} action={<Button variant="secondary" onClick={() => { setSelectedPartnerId(id); setModal('settlement'); }} icon={Receipt} testId="button-partner-settlement">Record settlement</Button>} /><div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard label="Active principal" value={money(principal)} caption="Currently deployed" icon={Wallet} /><MetricCard label="Total profit" value={money(profit)} caption="Partner allocation" icon={TrendingUp} accent="gold" /><MetricCard label="Settled" value={money(settled)} caption="Disbursed to partner" icon={CheckCircle2} accent="green" /><MetricCard label="Pending" value={money(Math.max(0, profit - settled))} caption="To settle" icon={Clock3} accent="red" /></div><div className="card overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="eyebrow">Linked loans</div><h2 className="mt-1 font-bold">Portfolio with {partner.name}</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Borrower</th><th className="px-3 py-3">Loan date</th><th className="px-3 py-3">Principal</th><th className="px-3 py-3">Interest</th><th className="px-3 py-3">Partner profit</th><th className="px-3 py-3">Settlement</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{linked.map((loan: Loan) => <tr className="table-row border-t border-[hsl(var(--border))]" key={loan.id} data-testid={`row-partner-loan-${loan.id}`}><td className="px-5 py-3.5 font-semibold">{getBorrower(borrowers, loan.borrowerId)?.name}</td><td className="px-3 py-3.5">{shortDate(loan.loanDate)}</td><td className="px-3 py-3.5">{money(loan.principal)}</td><td className="px-3 py-3.5">{money(loan.interest)}</td><td className="px-3 py-3.5 font-semibold">{money(loan.interest * partner.share / 100)}</td><td className="px-3 py-3.5"><StatusBadge value={loan.status === 'completed' ? 'Paid' : 'Pending'} /></td><td className="px-5 py-3.5 text-right"><Link href={`/loans/${loan.id}`} data-testid={`link-partner-loan-${loan.id}`} className="text-xs font-bold text-[hsl(var(--primary))]">Open loan</Link></td></tr>)}</tbody></table></div></div><div className="card overflow-hidden"><div className="border-b border-[hsl(var(--border))] px-5 py-4"><div className="eyebrow">Settlement history</div><h2 className="mt-1 font-bold">Disbursements to {partner.name}</h2></div>{historySettlements.length ? <div className="divide-y divide-[hsl(var(--border))]">{historySettlements.map((item: Settlement) => <div key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5" data-testid={`row-settlement-${item.id}`}><div className="min-w-0"><div className="font-semibold">{money(item.amount)} <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">via {item.method}</span></div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{shortDate(item.date)}{item.notes && ` · ${item.notes}`}</div></div><span className="status status-active"><Check size={12} />Settled</span></div>)}</div> : <div className="px-5 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">No settlements recorded yet.</div>}</div></div>;
}

function AuditPage({ activities, settings }: any) {
  const [typeFilter, setTypeFilter] = useState('All'); const [query, setQuery] = useState(''); const [detail, setDetail] = useState<string>();
  const typeTone = (type: Activity['type']) => type === 'payment' || type === 'borrower' ? 'bg-[hsl(157_47%_91%)] text-[hsl(157_47%_30%)]' : type === 'settlement' ? 'bg-[hsl(var(--accent))] text-[hsl(31_62%_28%)]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]';
  const filtered = activities.filter((item: Activity) => (typeFilter === 'All' || item.type === typeFilter.toLowerCase()) && (item.message.toLowerCase().includes(query.toLowerCase()) || item.type.toLowerCase().includes(query.toLowerCase())));
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Workspace history" title="Audit trail" subtitle={`${activities.length} lifecycle events recorded in this session.`} action={<Button variant="secondary" onClick={() => { setTypeFilter('All'); setQuery(''); setDetail(undefined); }} icon={RefreshCw} testId="button-audit-reset">Reset</Button>} />
  <div className="mb-5 flex flex-col gap-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 md:flex-row md:items-center"><div className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" /><input className="field min-w-0 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events by message or type" data-testid="input-audit-search" /></div><div className="flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-1">{['All','Loan','Payment','Settlement','Borrower','Partner'].map((item) => <button key={item} onClick={() => { setTypeFilter(item); setDetail(undefined); }} data-testid={`filter-audit-${item.toLowerCase()}`} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${typeFilter === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>{item}</button>)}</div></div>
  <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><div className="eyebrow">Activity log</div><h2 className="mt-1 font-bold">Audit details</h2></div><span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{filtered.length} events</span></div>{filtered.length ? <div className="divide-y divide-[hsl(var(--border))]">{filtered.map((item: Activity) => { const Icon = item.type === 'payment' ? HandCoins : item.type === 'settlement' ? Receipt : item.type === 'loan' ? Wallet : item.type === 'borrower' ? UserPlus : BriefcaseBusiness; const expanded = detail === item.id; return <div key={item.id} data-testid={`row-audit-${item.id}`}><button onClick={() => setDetail(expanded ? undefined : item.id)} data-testid={`button-audit-detail-${item.id}`} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[hsl(var(--muted)/.4)]"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={15} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.message}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{shortDate(item.date)}</div></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeTone(item.type)}`}>{statusLabel(item.type)}</span><ChevronRight size={15} className={`shrink-0 text-[hsl(var(--muted-foreground))] transition ${expanded ? 'rotate-90' : ''}`} /></button>{expanded && <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.4)] px-5 py-4" data-testid={`audit-detail-${item.id}`}><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Info label="Record id" value={item.id} /><Info label="Event type" value={statusLabel(item.type)} /><Info label="Date" value={shortDate(item.date)} /><Info label="Author" value={`${settings?.lead || 'Administrator'} · Administrator`} /></div><p className="mt-4 rounded-lg bg-[hsl(var(--card))] p-3 text-sm"><span className="font-bold">Event: </span>{item.message}</p></div>}</div>; })}</div> : <div className="p-5"><EmptyState title="No events found" message="Try a different keyword or event type." /></div>}</div></div>;
}
function ReportsPage({ loans, partners, payments, borrowers, settlements, showToast, onPrint }: any) {
  const [tab, setTab] = useState('Overview'); const tabs = ['Overview', 'Collections', 'Loans', 'Overdue', 'Partners', 'Profit'];
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const liveLoans = loans.filter((loan: Loan) => !loan.archivedAt);
  const livePayments = payments.filter((payment: Payment) => !payment.archivedAt && !loans.find((loan: Loan) => loan.id === payment.loanId)?.archivedAt);
  const liveBorrowers = borrowers.filter((borrower: Borrower) => !borrower.archivedAt);
  const livePartners = partners.filter((partner: Partner) => !partner.archivedAt);
  const inRange = (date: string) => (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  const rangeLoans = liveLoans.filter((loan: Loan) => inRange(loan.loanDate));
  const rangePayments = livePayments.filter((payment: Payment) => inRange(payment.date));
  const rangeActive = Boolean(dateFrom || dateTo);
  const totalInterest = liveLoans.reduce((sum: number, loan: Loan) => sum + loan.interest, 0); const collected = livePayments.reduce((sum: number, payment: Payment) => sum + payment.paid, 0);
  const exportReport = (reportTab = tab) => {
    const scopeLoans = reportTab === 'Overview' ? liveLoans : rangeLoans;
    const scopePayments = reportTab === 'Overview' ? livePayments : rangePayments;
    const rows: (string | number)[][] = [reportTab === 'Overview' ? ['Metric', 'Value'] : reportTab === 'Collections' ? ['Date', 'Borrower', 'Loan', 'Expected', 'Collected', 'Status'] : reportTab === 'Partners' ? ['Partner', 'Share', 'Linked loans', 'Profit', 'Settled', 'Pending'] : reportTab === 'Profit' ? ['Borrower', 'Loan', 'Interest', 'Partner share', 'Partner profit', 'Business profit'] : reportTab === 'Overdue' ? ['Loan', 'Borrower', 'Days over target', 'Over maturity', 'Remaining', 'Status'] : ['Loan', 'Borrower', 'Principal', 'Interest', 'Total due', 'Paid', 'Remaining', 'Status']];
    if (reportTab === 'Overview') Object.entries({ Borrowers: liveBorrowers.length, 'Active loans': liveLoans.filter(isActiveLoan).length, 'Total interest': totalInterest, 'Collected to date': collected, 'Payments logged': livePayments.length }).forEach(([label, value]) => rows.push([label, value]));
    else if (reportTab === 'Collections') scopePayments.forEach((payment: Payment) => rows.push([payment.date, getBorrower(borrowers, payment.borrowerId)?.name ?? '', loans.find((loan: Loan) => loan.id === payment.loanId)?.number ?? '', payment.expected, payment.paid, statusLabel(payment.status)]));
    else if (reportTab === 'Partners') livePartners.forEach((partner: Partner) => { const linked = scopeLoans.filter((loan: Loan) => loan.partnerId === partner.id); const earned = linked.reduce((sum: number, loan: Loan) => sum + loan.interest * partner.share / 100, 0); const settled = settlements.filter((item: Settlement) => item.partnerId === partner.id).reduce((sum: number, item: Settlement) => sum + item.amount, 0); rows.push([partner.name, `${partner.share}%`, linked.length, earned, settled, Math.max(0, earned - settled)]); });
    else if (reportTab === 'Profit') scopeLoans.forEach((loan: Loan) => { const partner = getPartner(partners, loan.partnerId); const share = partner?.share ?? 0; const partnerProfit = share ? loan.interest * share / 100 : 0; rows.push([getBorrower(borrowers, loan.borrowerId)?.name ?? '', loan.number, loan.interest, share ? `${share}%` : '—', share ? partnerProfit : 0, share ? loan.interest - partnerProfit : loan.interest]); });
    else if (reportTab === 'Overdue') scopeLoans.filter((loan: Loan) => isActiveLoan(loan) && (daysPast(loan.targetDate) > 0 || daysPast(loan.maturityDate) > 0)).forEach((loan: Loan) => rows.push([loan.number, getBorrower(borrowers, loan.borrowerId)?.name ?? '', daysPast(loan.targetDate), daysPast(loan.maturityDate), loan.totalDue - loan.paid, statusLabel(loan.status)]));
    else scopeLoans.forEach((loan: Loan) => rows.push([loan.number, getBorrower(borrowers, loan.borrowerId)?.name ?? '', loan.principal, loan.interest, loan.totalDue, loan.paid, loan.totalDue - loan.paid, statusLabel(loan.status)]));
    downloadCsv(`${reportTab.toLowerCase()}-report-${today}.csv`, rows);
    showToast(`${reportTab} exported`, rangeActive ? `CSV scoped from ${dateFrom || 'start'} to ${dateTo || 'today'}.` : 'CSV file downloaded.', 'success');
  };
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Insights" title="Reports" subtitle="Simple answers for the numbers behind your lending book." action={<><Button variant="secondary" onClick={() => onPrint(tab)} icon={Printer} testId="button-print-report">Print picture</Button><Button onClick={() => exportReport()} icon={Download} testId="button-export-report">Export report</Button></>} /><div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><Filter size={15} className="shrink-0 text-[hsl(var(--muted-foreground))]" /><label className="flex items-center gap-2 text-xs font-bold"><span className="text-[hsl(var(--muted-foreground))]">From</span><input type="date" className="field h-9 w-auto px-2 py-1 text-xs" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} data-testid="input-report-date-from" /></label><label className="flex items-center gap-2 text-xs font-bold"><span className="text-[hsl(var(--muted-foreground))]">To</span><input type="date" className="field h-9 w-auto px-2 py-1 text-xs" value={dateTo} onChange={(event) => setDateTo(event.target.value)} data-testid="input-report-date-to" /></label><button onClick={() => { setDateFrom(''); setDateTo(''); }} data-testid="button-report-date-clear" className="rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">{rangeActive ? 'Clear range' : 'No range'}</button><span className="ml-auto text-[11px] text-[hsl(var(--muted-foreground))]">{rangeActive ? 'Table, picture and export are scoped to this range.' : 'Dates scope the Collections, Loans, Overdue, Partners and Profit tabs.'}</span></div><div className="mb-5 flex gap-1 overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-1 sm:w-fit">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} data-testid={`tab-report-${item.toLowerCase()}`} className={`whitespace-nowrap rounded-md px-4 py-2 text-xs font-bold ${tab === item ? 'bg-[hsl(var(--card))] text-[hsl(var(--primary))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]'}`}>{item}</button>)}</div>{tab === 'Overview' ? <div id="report-overview" className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div className="grid gap-4 sm:grid-cols-2"><ReportCard icon={HandCoins} title="Collection report" description="Daily and monthly collection performance." onClick={() => setTab('Collections')} testId="card-report-collections" /><ReportCard icon={Wallet} title="Loan report" description="Loans issued and current status." onClick={() => setTab('Loans')} testId="card-report-loans" /><ReportCard icon={BriefcaseBusiness} title="Partner report" description="Partner profit and settlement tracking." onClick={() => setTab('Partners')} testId="card-report-partners" /><ReportCard icon={TrendingUp} title="Profit report" description="Interest and profit summary." onClick={() => setTab('Profit')} testId="card-report-profit" /><ReportCard icon={FileText} title="Payment history" description="All recorded payments in one place." onClick={() => exportReport('Collections')} testId="card-report-payments" /><ReportCard icon={AlertCircle} title="Overdue report" description="Loans beyond target or maturity." onClick={() => setTab('Overdue')} testId="card-report-overdue" /></div><div className="card p-5"><div className="eyebrow">At a glance</div><h2 className="mt-1 font-bold">Book health</h2><div className="mt-6 space-y-5"><ReportBar label="Collected to date" value={collected} max={liveLoans.reduce((sum: number, loan: Loan) => sum + loan.totalDue, 0)} color="primary" /><ReportBar label="Active portfolio" value={liveLoans.filter((loan: Loan) => loan.status === 'active').length} max={liveLoans.length} color="green" /><ReportBar label="On-time collections" value={livePayments.filter((payment: Payment) => payment.status === 'paid').length} max={livePayments.length} color="gold" /></div><div className="mt-6 grid grid-cols-2 gap-4 border-t border-[hsl(var(--border))] pt-5"><Info label="Total interest" value={money(totalInterest)} /><Info label="Borrowers" value={String(liveBorrowers.length)} /><Info label="Partners" value={String(livePartners.length)} /><Info label="Payments logged" value={String(livePayments.length)} /></div></div></div> : <ReportTable tab={tab} loans={rangeLoans} partners={livePartners} borrowers={liveBorrowers} payments={rangePayments} settlements={settlements} onExport={() => exportReport(tab)} onPrint={() => onPrint(tab)} />}</div>;
}
function ReportCard({ icon: Icon, title, description, onClick, testId }: { icon: LucideIcon; title: string; description: string; onClick: () => void; testId: string }) { return <button onClick={onClick} data-testid={testId} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={19} /></div><h2 className="mt-4 font-bold">{title}</h2><p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))]">View report <ArrowRight size={13} className="transition group-hover:translate-x-1" /></span></button>; }
function ReportBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) { return <div><div className="mb-2 flex justify-between text-xs"><span>{label}</span><span className="font-bold">{typeof value === 'number' && value > 100 ? money(value) : `${Math.round(value / max * 100)}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className={`h-full rounded-full ${color === 'primary' ? 'bg-[hsl(var(--primary))]' : color === 'green' ? 'bg-[hsl(157_47%_43%)]' : 'bg-[hsl(43_85%_55%)]'}`} style={{ width: `${Math.min(100, value / max * 100)}%` }} /></div></div>; }
function ReportTable({ tab, loans, partners, borrowers, payments, settlements, onExport, onPrint }: any) { return <div id={`report-${tab.toLowerCase()}`} className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><div className="eyebrow">{tab} report</div><h2 className="mt-1 font-bold">{tab === 'Profit' ? 'Interest and partner allocation' : `Detailed ${tab.toLowerCase()} view`}</h2></div><div className="report-toolbar"><Button variant="ghost" onClick={onPrint} icon={Printer} testId={`button-print-${tab.toLowerCase()}`}>Print picture</Button><Button variant="secondary" onClick={onExport} icon={Download} testId={`button-export-${tab.toLowerCase()}`}>Export</Button></div></div>{tab === 'Overdue' && <div className="grid grid-cols-2 gap-4 border-b border-[hsl(var(--border))] p-4 sm:grid-cols-4">{(() => { const overdueLoans = loans.filter((loan: Loan) => isActiveLoan(loan) && (daysPast(loan.targetDate) > 0 || daysPast(loan.maturityDate) > 0)); const pastMaturity = overdueLoans.filter((loan: Loan) => daysPast(loan.maturityDate) > 0).length; return <><Info label="Overdue loans" value={String(overdueLoans.length)} /><Info label="Past 40-day target" value={String(overdueLoans.length - pastMaturity)} /><Info label="Past maturity" value={String(pastMaturity)} /><Info label="Total remaining" value={money(overdueLoans.reduce((sum: number, loan: Loan) => sum + loan.totalDue - loan.paid, 0))} /></>; })()}</div>}<div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr>{tab === 'Collections' ? <><th className="px-5 py-3">Date</th><th className="px-3 py-3">Borrower</th><th className="px-3 py-3">Expected</th><th className="px-3 py-3">Collected</th><th className="px-3 py-3">Status</th></> : tab === 'Partners' ? <><th className="px-5 py-3">Partner</th><th className="px-3 py-3">Share</th><th className="px-3 py-3">Linked loans</th><th className="px-3 py-3">Profit</th><th className="px-3 py-3">Settlement</th></> : tab === 'Overdue' ? <><th className="px-5 py-3">Loan</th><th className="px-3 py-3">Borrower</th><th className="px-3 py-3">Days over target</th><th className="px-3 py-3">Over maturity</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Status</th></> : <><th className="px-5 py-3">Loan</th><th className="px-3 py-3">Borrower</th><th className="px-3 py-3">Principal</th><th className="px-3 py-3">Interest</th><th className="px-3 py-3">Status</th></>}</tr></thead><tbody>{tab === 'Collections' ? payments.map((payment: Payment) => <tr className="border-t border-[hsl(var(--border))]" key={payment.id} data-testid={`report-collection-${payment.id}`}><td className="px-5 py-3.5">{shortDate(payment.date)}</td><td className="px-3 py-3.5 font-semibold">{getBorrower(borrowers, payment.borrowerId)?.name}</td><td className="px-3 py-3.5">{money(payment.expected)}</td><td className="px-3 py-3.5">{money(payment.paid)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(payment.status)} /></td></tr>) : tab === 'Partners' ? partners.map((partner: Partner) => { const linked = loans.filter((loan: Loan) => loan.partnerId === partner.id); const earned = linked.reduce((sum: number, loan: Loan) => sum + loan.interest * partner.share / 100, 0); const settled = settlements.filter((item: Settlement) => item.partnerId === partner.id).reduce((sum: number, item: Settlement) => sum + item.amount, 0); const pending = Math.max(0, earned - settled); return <tr className="border-t border-[hsl(var(--border))]" key={partner.id} data-testid={`report-partner-${partner.id}`}><td className="px-5 py-3.5 font-semibold">{partner.name}</td><td className="px-3 py-3.5">{partner.share}%</td><td className="px-3 py-3.5">{linked.length}</td><td className="px-3 py-3.5">{money(earned)}</td><td className="px-3 py-3.5"><StatusBadge value={pending > 0 ? 'Pending' : 'Active'} /></td></tr>; }) : tab === 'Overdue' ? loans.filter((loan: Loan) => loan.status !== 'completed' && (daysPast(loan.targetDate) > 0 || daysPast(loan.maturityDate) > 0)).map((loan: Loan) => <tr className="border-t border-[hsl(var(--border))]" key={loan.id} data-testid={`report-overdue-${loan.id}`}><td className="px-5 py-3.5 mono text-xs font-bold">{loan.number}</td><td className="px-3 py-3.5 font-semibold">{getBorrower(borrowers, loan.borrowerId)?.name}</td><td className="px-3 py-3.5">{daysPast(loan.targetDate) > 0 ? daysPast(loan.targetDate) : '—'}</td><td className="px-3 py-3.5">{daysPast(loan.maturityDate) > 0 ? daysPast(loan.maturityDate) : '—'}</td><td className="px-3 py-3.5 font-semibold">{money(loan.totalDue - loan.paid)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(loan.status)} /></td></tr>) : loans.map((loan: Loan) => <tr className="border-t border-[hsl(var(--border))]" key={loan.id} data-testid={`report-loan-${loan.id}`}><td className="px-5 py-3.5 mono text-xs font-bold">{loan.number}</td><td className="px-3 py-3.5 font-semibold">{getBorrower(borrowers, loan.borrowerId)?.name}</td><td className="px-3 py-3.5">{money(loan.principal)}</td><td className="px-3 py-3.5">{money(loan.interest)}</td><td className="px-3 py-3.5"><StatusBadge value={statusLabel(loan.status)} /></td></tr>)}</tbody></table></div></div>; }

function SettingsPage({ settings, updateSettings, displaySize, setDisplaySize, showToast }: { settings: { businessName: string; contact: string; address: string; lead: string; interest: string; target: string; maturity: string; collectionType: CollectionType; partnerShare: string }; updateSettings: (patch: Partial<{ businessName: string; contact: string; address: string; lead: string; interest: string; target: string; maturity: string; collectionType: CollectionType; partnerShare: string }>) => void; displaySize: string; setDisplaySize: (value: string) => void; showToast: (title: string, message: string, tone?: Toast['tone']) => void }) {
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Workspace preferences" title="Settings" subtitle="Tune the rules and display to fit your daily operation." /><div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]"><div className="space-y-5"><SettingsSection title="Business information" description="Shown on reports and borrower summaries."><div className="grid gap-4 sm:grid-cols-2"><Field label="Business name" value={settings.businessName} onChange={(value) => updateSettings({ businessName: value })} testId="input-settings-business-name" /><Field label="Contact number" value={settings.contact} onChange={(value) => updateSettings({ contact: value })} testId="input-settings-contact" /><Field label="Business address" value={settings.address} onChange={(value) => updateSettings({ address: value })} testId="input-settings-address" /><Field label="Collection lead" value={settings.lead} onChange={(value) => updateSettings({ lead: value })} testId="input-settings-lead" /></div></SettingsSection><SettingsSection title="Loan rules" description="Defaults used when creating a new loan."><div className="grid gap-4 sm:grid-cols-3"><Field label="Default interest rate" suffix="%" value={settings.interest} onChange={(value) => updateSettings({ interest: value })} testId="input-settings-interest" /><Field label="Target collection period" suffix="days" value={settings.target} onChange={(value) => updateSettings({ target: value })} testId="input-settings-target-days" /><Field label="Maximum maturity period" suffix="days" value={settings.maturity} onChange={(value) => updateSettings({ maturity: value })} testId="input-settings-maturity-days" /></div><div className="mt-4"><label className="mb-1.5 block text-xs font-bold">Default collection type</label><select className="field sm:w-64" value={settings.collectionType} onChange={(event) => updateSettings({ collectionType: event.target.value as CollectionType })} data-testid="select-settings-collection-type"><option>Daily</option><option>Monthly</option><option>Lump Sum</option></select></div></SettingsSection><SettingsSection title="Partner rules" description="Keep the profit split clear from the first conversation."><Field label="Default partner profit share" suffix="%" value={settings.partnerShare} onChange={(value) => updateSettings({ partnerShare: value })} testId="input-settings-partner-share" /></SettingsSection><SettingsSection title="Security" description="Prototype-only controls for a future secure workspace."><div className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" onClick={() => showToast('PIN change', 'PIN management will be connected to secure authentication later.', 'info')} icon={ShieldCheck} testId="button-change-pin">Change PIN</Button><Button variant="secondary" onClick={() => showToast('Session timeout', 'Session timeout options are ready for backend integration.', 'info')} icon={Clock3} testId="button-session-timeout">Session timeout</Button></div></SettingsSection></div><aside className="space-y-5"><SettingsSection title="Display size" description="Choose the most comfortable density for your tablet or phone."><div className="space-y-2">{[['standard','Standard','Balanced spacing for everyday use'],['large','Large','A little more breathing room'],['xlarge','Extra large','For easier reading at a distance']].map(([value,label,description]) => <button key={value} onClick={() => { setDisplaySize(value); showToast('Display updated', `${label} size is now active.`, 'info'); }} data-testid={`button-display-${value}`} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${displaySize === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary)/.45)]' : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`}><div className={`h-4 w-4 rounded-full border-4 ${displaySize === value ? 'border-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]'}`} /><div><div className="text-sm font-bold">{label}</div><div className="text-xs text-[hsl(var(--muted-foreground))]">{description}</div></div></button>)}</div></SettingsSection><SettingsSection title="Data" description="These actions are placeholders until a secure data layer is connected."><div className="space-y-2"><Button variant="secondary" onClick={() => showToast('Backup unavailable', 'Local mock data does not leave this browser.', 'info')} icon={Download} testId="button-backup-data">Backup data</Button><Button variant="secondary" onClick={() => showToast('Export unavailable', 'Connect a backend to export production data.', 'info')} icon={FileText} testId="button-export-data">Export data</Button></div></SettingsSection><div className="soft-card card p-5"><Sparkles size={18} className="text-[hsl(var(--primary))]" /><h2 className="mt-3 font-bold">Built for a better listahan</h2><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your settings are saved in this prototype while the page is open. A future version can sync them for the whole team.</p></div></aside></div><div className="mt-5 flex justify-end"><Button onClick={() => showToast('Settings saved', 'Your lending rules are ready for the next loan.', 'success')} testId="button-save-settings">Save settings</Button></div></div>;
}
function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="card p-5"><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{description}</p><div className="mt-5">{children}</div></section>; }
function Field({ label, value, onChange, testId, suffix }: { label: string; value: string; onChange: (value: string) => void; testId: string; suffix?: string }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold">{label}</span><div className="relative"><input className={`field ${suffix ? 'pr-12' : ''}`} value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId} />{suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--muted-foreground))]">{suffix}</span>}</div></label>; }

function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) { return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className={`modal-panel ${wide ? 'max-w-[900px]' : ''}`}><div className="flex items-start justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">{title}</h2>{description && <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{description}</p>}</div><button onClick={onClose} className="icon-button h-8 w-8" data-testid="button-close-modal"><X size={16} /></button></div><div className="p-5">{children}</div></div></div>; }
function ReportPrintModal({ image, title, onClose, showToast }: { image: string; title: string; onClose: () => void; showToast: (title: string, message: string, tone?: Toast['tone']) => void }) {
  const downloadPicture = (dataUrl: string, label: string) => { const link = document.createElement('a'); link.href = dataUrl; link.download = `${label.toLowerCase()}-report-${today}.png`; document.body.appendChild(link); link.click(); link.remove(); };
  const openPrint = (dataUrl: string, label: string) => {
    const win = window.open('', '_blank', 'width=980,height=1200');
    if (!win) { showToast('Pop-up blocked', 'Allow pop-ups to print the picture.', 'warning'); return; }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${label} report</title><style>@page{margin:1cm}html,body{margin:0;padding:0}body{display:flex;justify-content:center;align-items:flex-start;font-family:Arial,Helvetica,sans-serif}img{max-width:100%;}</style></head><body><img src="${dataUrl}" alt="${label} report" /></body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { try { win.print(); } catch { return; } }, 400);
  };
  return <Modal title="Report picture" description={`${title} report rendered as an image, ready to print or share.`} onClose={onClose} wide><div className="flex flex-col gap-4"><div className="max-h-[62vh] overflow-auto rounded-xl border border-[hsl(var(--border))] bg-white p-3"><img src={image} alt={`${title} report picture`} className="mx-auto w-auto" data-testid="img-report-picture" /></div><div className="flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-report-picture">Close</Button><Button variant="secondary" onClick={() => downloadPicture(image, title)} icon={Download} testId="button-download-picture">Download picture</Button><Button onClick={() => openPrint(image, title)} icon={Printer} testId="button-print-picture">Print picture</Button></div></div></Modal>;
}
function BorrowerModal({ editing, onClose, onSave, onEdit }: { editing?: Borrower; onClose: () => void; onSave: (data: Omit<Borrower, 'id' | 'status'>) => void; onEdit: (id: string, data: Omit<Borrower, 'id' | 'status'>) => void }) { const [name, setName] = useState(editing?.name || ''); const [phone, setPhone] = useState(editing?.phone || ''); const [address, setAddress] = useState(editing?.address || ''); const [barangay, setBarangay] = useState(editing?.barangay || ''); const [notes, setNotes] = useState(editing?.notes || ''); const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; const data = { name, phone, address, barangay, notes }; if (editing && onEdit) onEdit(editing.id, data); else onSave(data); }; return <Modal title={editing ? 'Edit borrower' : 'Add borrower'} description={editing ? 'Update the borrower record.' : 'Add a clear record before creating their first loan.'} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name *" value={name} onChange={setName} testId="input-new-borrower-name" /><Field label="Phone number" value={phone} onChange={setPhone} testId="input-new-borrower-phone" /><Field label="Address" value={address} onChange={setAddress} testId="input-new-borrower-address" /><Field label="Barangay" value={barangay} onChange={setBarangay} testId="input-new-borrower-barangay" /></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea className="field min-h-20 resize-y" value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="input-new-borrower-notes" /></label><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-borrower">Cancel</Button><Button type="submit" disabled={!name.trim()} testId="button-save-borrower">{editing ? 'Save changes' : 'Save borrower'}</Button></div></form></Modal>; }
function PartnerModal({ defaultShare, editing, onClose, onSave, onEdit }: { defaultShare: string; editing?: Partner; onClose: () => void; onSave: (data: Omit<Partner, 'id'>) => void; onEdit: (id: string, data: Omit<Partner, 'id'>) => void }) { const [name, setName] = useState(editing?.name || ''); const [contact, setContact] = useState(editing?.contact || ''); const [share, setShare] = useState(editing ? String(editing.share) : defaultShare); const [notes, setNotes] = useState(editing?.notes || ''); return <Modal title={editing ? 'Edit partner' : 'Add partner'} description="Set the default profit share used for linked loans." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (!name.trim()) return; const data = { name, contact, share: Number(share) || 50, notes }; if (editing && onEdit) onEdit(editing.id, data); else onSave(data); }} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Partner name *" value={name} onChange={setName} testId="input-new-partner-name" /><Field label="Contact number" value={contact} onChange={setContact} testId="input-new-partner-contact" /><Field label="Default profit share" suffix="%" value={share} onChange={setShare} testId="input-new-partner-share" /></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="input-new-partner-notes" /></label><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-partner">Cancel</Button><Button type="submit" disabled={!name.trim()} testId="button-save-partner">{editing ? 'Save changes' : 'Save partner'}</Button></div></form></Modal>; }
function LoanModal({ borrowers, partners, loanRules, editing, onClose, onSave, onEdit, showToast }: { borrowers: Borrower[]; partners: Partner[]; loanRules: { interest: string; target: string; maturity: string; collectionType: CollectionType }; editing?: Loan; onClose: () => void; onSave: (data: Omit<Loan, 'id' | 'number' | 'paid' | 'status'>) => void; onEdit: (id: string, data: Omit<Loan, 'id' | 'number' | 'paid' | 'status'>, status: Status) => void; showToast: (title: string, message: string, tone?: Toast['tone']) => void }) {
  const [borrowerId, setBorrowerId] = useState(editing?.borrowerId || borrowers[0]?.id || ''); const [principal, setPrincipal] = useState(editing ? String(editing.principal) : '10000'); const [rate, setRate] = useState(editing ? String(editing.rate) : loanRules.interest); const [type, setType] = useState<CollectionType>(editing?.collectionType || loanRules.collectionType); const [targetDays, setTargetDays] = useState(editing ? String(editing.targetDays) : loanRules.target); const [maxDays, setMaxDays] = useState(editing ? String(editing.maxDays) : loanRules.maturity); const [partnerId, setPartnerId] = useState(editing?.partnerId || ''); const [loanDate, setLoanDate] = useState(editing?.loanDate || today); const [status, setStatus] = useState<Status>(editing?.status || 'active');
  const amount = Number(principal) || 0; const interest = amount * (Number(rate) || 0) / 100; const totalDue = amount + interest; const daily = totalDue / (Number(targetDays) || 40); const monthly = totalDue / 4; const targetDate = new Date(`${loanDate}T00:00:00`); targetDate.setDate(targetDate.getDate() + (Number(targetDays) || 40)); const maturityDate = new Date(`${loanDate}T00:00:00`); maturityDate.setDate(maturityDate.getDate() + (Number(maxDays) || 60)); const partner = getPartner(partners, partnerId); const partnerProfit = interest * (partner?.share || 0) / 100;
  return <Modal title={editing ? 'Edit loan' : 'New loan'} description={editing ? 'Adjust the terms and the plan recalculates.' : 'Set the terms once. The system calculates the collection plan for you.'} onClose={onClose} wide><form onSubmit={(event) => { event.preventDefault(); if (!borrowerId || amount <= 0) { showToast('Check the loan details', 'Select a borrower and enter a principal amount.', 'warning'); return; } const data = { borrowerId, principal: amount, rate: Number(rate) || 0, interest, totalDue, collectionType: type, targetDays: Number(targetDays) || 40, maxDays: Number(maxDays) || 60, loanDate, targetDate: targetDate.toISOString().slice(0, 10), maturityDate: maturityDate.toISOString().slice(0, 10), partnerId: partnerId || undefined }; if (editing && onEdit) onEdit(editing.id, data, status); else onSave(data); }}><div className="grid gap-5 lg:grid-cols-[1fr_.8fr]"><div className="space-y-5"><div><div className="eyebrow mb-3">Borrower and terms</div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold">Borrower *</span><select className="field" value={borrowerId} onChange={(event) => setBorrowerId(event.target.value)} data-testid="select-loan-borrower">{borrowers.map((borrower) => <option value={borrower.id} key={borrower.id}>{borrower.name}</option>)}</select></label><Field label="Loan date" value={loanDate} onChange={setLoanDate} testId="input-loan-date" />{editing && <label><span className="mb-1.5 block text-xs font-bold">Status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value as Status)} data-testid="select-loan-status">{['draft','active','extended','overdue','completed','cancelled'].map((item) => <option value={item} key={item}>{statusLabel(item)}</option>)}</select></label>}<Field label="Principal amount *" value={principal} onChange={setPrincipal} testId="input-loan-principal" /><Field label="Interest rate" suffix="%" value={rate} onChange={setRate} testId="input-loan-rate" /></div></div><div><div className="eyebrow mb-3">Collection plan</div><div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold">Collection type</span><select className="field" value={type} onChange={(event) => setType(event.target.value as CollectionType)} data-testid="select-loan-collection-type"><option>Daily</option><option>Monthly</option><option>Lump Sum</option></select></label><Field label="Target period" suffix="days" value={targetDays} onChange={setTargetDays} testId="input-loan-target-days" /><Field label="Maximum maturity" suffix="days" value={maxDays} onChange={setMaxDays} testId="input-loan-max-days" /></div><div className="mt-3 rounded-lg bg-[hsl(var(--accent)/.5)] p-3 text-xs text-[hsl(31_62%_28%)]">{type === 'Daily' ? <>Daily target is <b>{money(daily)}</b> across the first <b>{targetDays} days</b>. Maximum maturity is <b>{maxDays} days</b>.</> : type === 'Monthly' ? <>Monthly schedule: <b>4 payments of {money(monthly)}</b>. Maturity stays at <b>{maxDays} days</b>.</> : <>Lump sum is due on the maturity date: <b>{shortDate(maturityDate.toISOString().slice(0, 10))}</b>.</>}</div></div><div><div className="eyebrow mb-3">Partner allocation</div><select className="field" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} data-testid="select-loan-partner"><option value="">No partner — business funded</option>{partners.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.share}% share</option>)}</select></div></div><div className="rounded-xl bg-[hsl(var(--sidebar))] p-5 text-white"><div className="eyebrow text-[hsl(var(--sidebar-foreground)/.6)]">Live calculation</div><div className="mt-5 space-y-4"><div className="flex justify-between text-sm"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">Principal</span><b>{money(amount)}</b></div><div className="flex justify-between text-sm"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">Interest ({rate}%)</span><b>{money(interest)}</b></div><div className="border-t border-[hsl(var(--sidebar-border))] pt-4"><div className="flex justify-between"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">Total due</span><b className="text-xl text-[hsl(var(--sidebar-primary))]">{money(totalDue)}</b></div></div><div className="rounded-lg bg-[hsl(var(--sidebar-accent))] p-3 text-xs"><div className="mb-1 flex justify-between"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">{targetDays}-day target</span><b>{shortDate(targetDate.toISOString().slice(0, 10))}</b></div><div className="flex justify-between"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">{maxDays}-day maturity</span><b>{shortDate(maturityDate.toISOString().slice(0, 10))}</b></div></div>{partner && <div className="space-y-2 pt-1 text-xs"><div className="flex justify-between"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">Partner profit</span><b>{money(partnerProfit)}</b></div><div className="flex justify-between"><span className="text-[hsl(var(--sidebar-foreground)/.7)]">Business profit</span><b>{money(interest - partnerProfit)}</b></div></div>}</div></div></div><div className="mt-5 flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-4"><Button variant="secondary" onClick={onClose} testId="button-cancel-loan">Cancel</Button><Button type="submit" icon={Check} testId={editing ? 'button-save-loan' : 'button-create-loan'}>{editing ? 'Save changes' : 'Create loan'}</Button></div></form></Modal>;
}
function PaymentModal({ borrowers, loans, editing, selectedLoanId, selectedBorrowerId, onClose, onSave, onEdit }: { borrowers: Borrower[]; loans: Loan[]; editing?: Payment; selectedLoanId?: string; selectedBorrowerId?: string; onClose: () => void; onSave: (data: Omit<Payment, 'id' | 'status'>) => void; onEdit: (id: string, data: Omit<Payment, 'id' | 'status'>) => void }) {
  const startingLoan = loans.find((loan) => loan.id === selectedLoanId) || loans.find((loan) => loan.borrowerId === selectedBorrowerId && isActiveLoan(loan)) || loans.find((loan) => loan.status === 'active'); const [loanId, setLoanId] = useState(editing?.loanId || startingLoan?.id || ''); const loan = loans.find((item) => item.id === loanId); const [date, setDate] = useState(editing?.date || today); const [paid, setPaid] = useState(editing?.paid !== undefined ? String(editing.paid) : ''); const [method, setMethod] = useState(editing?.method || 'Cash'); const [notes, setNotes] = useState(editing?.notes || ''); const expected = editing ? editing.expected : loan ? loanExpected(loan) : 0; const received = Number(paid) || 0; const shortfall = Math.max(0, expected - received); const status: PaymentStatus = received >= expected ? 'paid' : received > 0 ? 'partial' : 'missed';
  return <Modal title={editing ? 'Edit collection' : 'Record payment'} description={editing ? 'Update the recorded collection.' : 'Update the collection and loan balance at the same time.'} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (!loan) return; const data = { borrowerId: loan.borrowerId, loanId: loan.id, date, expected, paid: received, method, notes }; if (editing && onEdit) onEdit(editing.id, data); else onSave(data); }} className="space-y-5"><label className="block"><span className="mb-1.5 block text-xs font-bold">Loan</span><select className="field" value={loanId} disabled={Boolean(editing)} onChange={(event) => setLoanId(event.target.value)} data-testid="select-payment-loan">{loans.filter(isActiveLoan).map((item) => <option value={item.id} key={item.id}>{getBorrower(borrowers, item.borrowerId)?.name} · {item.number}</option>)}</select></label>{loan && <div className="grid grid-cols-3 gap-3 rounded-xl bg-[hsl(var(--muted))] p-4"><Info label="Expected today" value={money(expected)} /><Info label="Loan balance" value={money(loan.totalDue - loan.paid)} /><Info label="Collection type" value={loan.collectionType} /></div>}<Field label="Payment date" value={date} onChange={setDate} testId="input-payment-date" /><div className="grid gap-4 sm:grid-cols-2"><Field label="Actual payment" value={paid} onChange={setPaid} testId="input-payment-amount" /><label><span className="mb-1.5 block text-xs font-bold">Payment method</span><select className="field" value={method} onChange={(event) => setMethod(event.target.value)} data-testid="select-payment-method"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select></label></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="input-payment-notes" /></label><div className={`flex items-center justify-between rounded-lg p-3 text-sm ${status === 'paid' ? 'bg-[hsl(157_47%_91%)] text-[hsl(157_47%_30%)]' : status === 'partial' ? 'bg-[hsl(var(--accent))] text-[hsl(31_62%_28%)]' : 'bg-[hsl(1_71%_93%)] text-[hsl(var(--destructive))]'}`}><span>Payment status</span><b>{statusLabel(status)}{status === 'partial' && ` · ${money(shortfall)} short`}</b></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-payment">Cancel</Button><Button type="submit" icon={Check} testId="button-save-payment">{editing ? 'Save changes' : 'Save payment'}</Button></div></form></Modal>;
}

function SettlementModal({ partners, settleRecords, selectedPartnerId, onClose, onSave }: { partners: Partner[]; settleRecords: Settlement[]; selectedPartnerId?: string; onClose: () => void; onSave: (data: Omit<Settlement, 'id' | 'date'>) => void }) {
  const initialPartner = partners.find((item) => item.id === selectedPartnerId) || partners[0];
  const [partnerId, setPartnerId] = useState(initialPartner?.id || '');
  const [amount, setAmount] = useState(''); const [method, setMethod] = useState('Cash'); const [notes, setNotes] = useState('');
  const settledTotal = settleRecords.filter((item) => item.partnerId === partnerId).reduce((sum: number, item: Settlement) => sum + item.amount, 0);
  return <Modal title="Record settlement" description="Log a disbursement against a partner's earned profit." onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); if (!partnerId || Number(amount) <= 0) return; onSave({ partnerId, amount: Number(amount), method, notes }); }} className="space-y-5"><label className="block"><span className="mb-1.5 block text-xs font-bold">Partner</span><select className="field" value={partnerId} onChange={(event) => setPartnerId(event.target.value)} data-testid="select-settlement-partner">{partners.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.share}% share</option>)}</select></label>{partnerId && <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--muted))] p-4 text-sm"><span className="text-[hsl(var(--muted-foreground))]">Profit settled to date</span><b>{money(settledTotal)}</b></div>}<div className="grid gap-4 sm:grid-cols-2"><Field label="Amount *" value={amount} onChange={setAmount} testId="input-settlement-amount" /><label><span className="mb-1.5 block text-xs font-bold">Method</span><select className="field" value={method} onChange={(event) => setMethod(event.target.value)} data-testid="select-settlement-method"><option>Cash</option><option>GCash</option><option>Bank Transfer</option><option>Other</option></select></label></div><label className="block"><span className="mb-1.5 block text-xs font-bold">Notes</span><textarea className="field min-h-20" value={notes} onChange={(event) => setNotes(event.target.value)} data-testid="input-settlement-notes" /></label><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-settlement">Cancel</Button><Button type="submit" disabled={!partnerId || Number(amount) <= 0} testId="button-save-settlement">Record settlement</Button></div></form></Modal>;
}
function NapalyaPage({ borrowers, loans, payments, openPayment, setSelectedPaymentId, setModal }: any) {
  const missed = payments.filter((payment: Payment) => payment.status === 'missed' && !payment.archivedAt).sort((a: Payment, b: Payment) => b.date.localeCompare(a.date));
  const expected = missed.reduce((sum: number, payment: Payment) => sum + payment.expected, 0);
  const overdueLinked = loans.filter((loan: Loan) => !loan.archivedAt && missed.some((payment: Payment) => payment.loanId === loan.id) && (loan.status === 'overdue' || daysPast(loan.maturityDate) > 0)).length;
  return <div className="page-wrap page-enter"><PageHeader eyebrow="Attention queue" title="Missed payments" subtitle="Every unpaid collection that still needs a follow-up visit." action={<Link href="/collections" data-testid="link-missed-back-collections" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]"><ArrowLeft size={16} />Back to collections</Link>} /><div className="mb-5 grid grid-cols-3 gap-3"><MetricCard label="Missed payments" value={String(missed.length)} caption="Awaiting collection" icon={AlertCircle} accent="red" /><MetricCard label="Total expected" value={money(expected)} caption="Worth following up" icon={Target} accent="gold" /><MetricCard label="Overdue loans" value={String(overdueLinked)} caption="Past their maturity date" icon={Clock3} /></div>{missed.length ? <div className="card overflow-hidden"><div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4"><div><h2 className="font-bold">Missed collection list</h2><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Record the visit or move it to a better day.</p></div><span className="rounded-full bg-[hsl(var(--destructive)/.1)] px-2 py-1 text-xs font-bold text-[hsl(var(--destructive))]">{missed.length}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[hsl(var(--muted)/.6)] text-[11px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]"><tr><th className="px-5 py-3">Borrower</th><th className="px-3 py-3">Loan</th><th className="px-3 py-3">Expected</th><th className="px-3 py-3">Missed on</th><th className="px-3 py-3">Status</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody>{missed.map((payment: Payment) => { const borrower = getBorrower(borrowers, payment.borrowerId); const loan = loans.find((item: Loan) => item.id === payment.loanId); return <tr className="table-row border-t border-[hsl(var(--border))]" key={payment.id} data-testid={`row-missed-${payment.id}`}><td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[10px] font-bold text-[hsl(var(--primary))]">{initials(borrower?.name || '')}</div><div><div className="font-semibold">{borrower?.name}</div><div className="text-[11px] text-[hsl(var(--muted-foreground))]">{payment.method}</div></div></div></td><td className="px-3 py-3.5 mono text-xs">{loan?.number || '—'}</td><td className="px-3 py-3.5 font-semibold">{money(payment.expected)}</td><td className="px-3 py-3.5 text-[hsl(var(--muted-foreground))]">{shortDate(payment.date)}{daysPast(payment.date) > 0 && <span className="ml-1 text-xs font-bold text-[hsl(var(--destructive))]">{daysPast(payment.date)}d late</span>}</td><td className="px-3 py-3.5"><StatusBadge value="Missed" /></td><td className="px-5 py-3.5 text-right"><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => openPayment(payment.loanId)} testId={`button-missed-record-${payment.id}`} icon={Check}>Record</Button><Button variant="ghost" onClick={() => { setSelectedPaymentId(payment.id); setModal('reschedule'); }} testId={`button-missed-reschedule-${payment.id}`} icon={CalendarDays}>Reschedule</Button></div></td></tr>; })}</tbody></table></div></div> : <EmptyState title="Nothing missed" message="No missed payments right now. Keep your collection rounds current and this list stays empty." action={<Link href="/collections" data-testid="link-missed-empty-collections" className="text-sm font-bold text-[hsl(var(--primary))]">Open today's queue</Link>} />}</div>;
}
function RescheduleModal({ payment, onClose, onSave }: { payment?: Payment; onClose: () => void; onSave: (id: string, newDate: string, reason: string) => void }) {
  const [date, setDate] = useState(isoDay(1)); const [reason, setReason] = useState('');
  if (!payment) return null;
  return <Modal title="Reschedule payment" description={`Move this missed ${money(payment.expected)} to a better collection day.`} onClose={onClose}><form onSubmit={(event) => { event.preventDefault(); onSave(payment.id, date, reason); }} className="space-y-5"><Field label="Missed on" value={shortDate(payment.date)} onChange={() => undefined} testId="input-reschedule-original" /><Field label="New collection date *" value={date} onChange={setDate} testId="input-reschedule-date" /><label className="block"><span className="mb-1.5 block text-xs font-bold">Reason</span><textarea className="field min-h-20" value={reason} onChange={(event) => setReason(event.target.value)} data-testid="input-reschedule-reason" placeholder="e.g. Borrower was away at market" /></label><div className="rounded-lg bg-[hsl(var(--accent)/.5)] p-3 text-xs text-[hsl(31_62%_28%)]">The payment stays on your calendar for the new date until you record it.</div><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose} testId="button-cancel-reschedule">Cancel</Button><Button type="submit" icon={CalendarDays} testId="button-save-reschedule">Reschedule payment</Button></div></form></Modal>;
}
function LoginScreen({ onLogin }: { onLogin: () => void }) { const [pin, setPin] = useState(''); const [message, setMessage] = useState(''); return <div className="login-art flex min-h-[100dvh] items-center justify-center p-5"><div className="w-full max-w-[440px] rounded-2xl bg-[hsl(var(--card))] shadow-2xl"><div className="p-7 sm:p-10"><div className="mb-12 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white"><Landmark size={18} /></div><span className="font-bold">Lending Management System</span></div><div className="eyebrow">Welcome back</div><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">Sign in to your workspace</h2><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Enter your PIN to open today's lending desk.</p><form onSubmit={(event) => { event.preventDefault(); if (pin.length >= 4) onLogin(); else setMessage('Enter at least 4 digits to continue.'); }} className="mt-8 space-y-5"><input type="text" name="username" autoComplete="username" value="Divine Valdez" readOnly tabIndex={-1} aria-hidden="true" className="pointer-events-none absolute h-0 w-0 opacity-0" /><label className="block"><span className="mb-1.5 block text-xs font-bold">PIN</span><input type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, '')); setMessage(''); }} className="field text-center text-xl tracking-[.5em]" placeholder="₱₱₱₱" data-testid="input-login-pin" /></label>{message && <div className="flex items-center gap-2 text-xs font-semibold text-[hsl(var(--destructive))]" data-testid="text-login-error"><AlertCircle size={14} />{message}</div>}<Button type="submit" disabled={pin.length < 4} testId="button-login">Open workspace <ArrowRight size={16} /></Button></form><button onClick={() => setMessage('For this prototype, use any 4-digit PIN.')} data-testid="button-forgot-pin" className="mt-5 text-xs font-semibold text-[hsl(var(--primary))]">Forgot PIN?</button></div></div></div>; }
function NotFound() { return <div className="page-wrap flex min-h-[60vh] flex-col items-center justify-center text-center"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><FileText size={20} /></div><h1 className="text-2xl font-bold">Page not found</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">That page has moved or does not exist.</p><Link href="/" data-testid="link-not-found-home" className="mt-5 text-sm font-bold text-[hsl(var(--primary))]">Back to dashboard</Link></div>; }

export default App;