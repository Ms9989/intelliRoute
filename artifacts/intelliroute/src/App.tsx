import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  Database,
  LayoutDashboard,
  LogOut,
  MapPin,
  Network,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Terminal,
  Truck,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  getGetAnalyticsOverviewQueryKey,
  getGetCustomersQueryKey,
  getGetCustomerQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDbmsActivityQueryKey,
  getGetHighRiskShipmentsQueryKey,
  getGetOrdersQueryKey,
  getGetShipmentGraphQueryKey,
  getGetShipmentQueryKey,
  getGetShipmentsQueryKey,
  getHealthCheckQueryKey,
  useCreateCustomer,
  useCreateOrder,
  useCreatePrediction,
  useCreateShipment,
  useDeactivateCustomer,
  useExecuteDbmsOperation,
  useGetAnalyticsOverview,
  useGetCustomers,
  useGetCustomer,
  useGetDashboardSummary,
  useGetDbmsActivity,
  useGetHighRiskShipments,
  useGetOrders,
  useGetShipment,
  useGetShipmentGraph,
  useGetShipments,
  useHealthCheck,
  useLogin,
  useRecordDeliveryAttempt,
  useUpdateCustomer,
  useUpdateShipmentStatus,
} from '@workspace/api-client-react';
import {
  Route,
  Switch,
  Link,
  Router as WouterRouter,
  useLocation,
  useParams,
} from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

const navItems = [
  { href: '/', label: 'Control room', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/orders', label: 'Orders', icon: ClipboardList },
  { href: '/shipments', label: 'Shipments', icon: PackageCheck },
  { href: '/delivery', label: 'Delivery desk', icon: Truck },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/predictions', label: 'Predictions', icon: BrainCircuit },
  { href: '/graph', label: 'Graph explorer', icon: Network },
  { href: '/dbms-lab', label: 'DBMS lab', icon: Database },
];

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
const money = (value?: number) => typeof value === 'number' ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const compact = (value?: number) => typeof value === 'number' ? Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—';
const titleCase = (value?: string) => value ? value.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '—';
const riskClass = (risk?: string | null) => risk?.toLowerCase() === 'high' || risk?.toLowerCase() === 'critical' ? 'status-red' : risk?.toLowerCase() === 'medium' ? 'status-amber' : 'status-teal';
const statusClass = (status?: string) => {
  const normalized = status?.toLowerCase() || '';
  if (normalized.includes('fail') || normalized.includes('return') || normalized.includes('cancel')) return 'status-red';
  if (normalized.includes('pending') || normalized.includes('assign') || normalized.includes('transit')) return 'status-amber';
  if (normalized.includes('deliver') || normalized.includes('complete') || normalized.includes('active')) return 'status-teal';
  return 'status-slate';
};
const valueFrom = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  return '';
};

function Brand() {
  return <div className="flex items-center gap-3"><div className="brand-mark">IR</div><div className="brand-copy"><div className="font-extrabold tracking-tight text-sm">IntelliRoute</div><div className="font-mono text-[9px] opacity-60 tracking-[.18em]">GRAPH OPS</div></div></div>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [healthOpen, setHealthOpen] = useState(false);
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const sessionRole = localStorage.getItem('intelliroute-role') || 'Operations Manager';
  const initials = sessionRole.split(' ').map((item) => item[0]).join('').slice(0, 2);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="p-5 pb-7"><Brand /></div>
        <div className="px-3 flex-1">
          <div className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[.18em] opacity-40">Workspace</div>
          <nav className="space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} className={`nav-item ${location === href ? 'active' : ''}`}>
                <Icon size={16} strokeWidth={1.8} /><span className="nav-copy">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-3 space-y-2">
          <button data-testid="button-health-status" className="w-full text-left rounded-lg p-3 bg-white/5 hover:bg-white/10 transition-colors" onClick={() => setHealthOpen((open) => !open)}>
            <div className="flex items-center gap-2 text-[10px] font-bold"><span className={`w-2 h-2 rounded-full ${health.isError ? 'bg-red-400' : health.isLoading ? 'bg-amber-300' : 'bg-teal-300'}`} /><span className="role-copy">Neo4j connection</span></div>
            {healthOpen && <div className="role-copy mt-2 text-[10px] opacity-65">{health.isError ? 'Setup required' : health.data?.message || health.data?.neo4j || 'Operational'}</div>}
          </button>
          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-white/5">
            <div className="w-7 h-7 rounded-full bg-teal-700 grid place-items-center text-[10px] font-bold">{initials}</div>
            <div className="role-copy min-w-0"><div className="text-[10px] font-bold truncate">{sessionRole}</div><div className="font-mono text-[9px] opacity-50">ACADEMIC SESSION</div></div>
            <button data-testid="button-logout" className="ml-auto opacity-60 hover:opacity-100" onClick={() => { localStorage.removeItem('intelliroute-role'); setLocation('/login'); }}><LogOut size={14} /></button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="flex items-center gap-3"><div className="text-[10px] font-mono text-muted-foreground hidden sm:block">INTELLIROUTE /</div><div className="text-xs font-bold">{location === '/' ? 'Control room' : navItems.find((item) => location.startsWith(item.href) && item.href !== '/')?.label || 'Workspace'}</div></div>
          <div className="flex items-center gap-2"><span className="hidden sm:inline-flex items-center gap-2 text-[10px] font-mono text-muted-foreground"><Activity size={13} className="text-primary" /> LIVE GRAPH SYNC</span><div className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-[10px] font-bold text-secondary-foreground">{initials}</div></div>
        </header>
        {children}
      </main>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7"><div><div className="eyebrow mb-2">{eyebrow}</div><h1 className="text-2xl md:text-3xl font-extrabold tracking-[-.055em]">{title}</h1>{description && <p className="text-xs text-muted-foreground mt-2 max-w-2xl">{description}</p>}</div>{action}</div>;
}

function State({ type, message, onRetry }: { type: 'loading' | 'error' | 'empty'; message?: string; onRetry?: () => void }) {
  if (type === 'loading') return <div className="panel p-6 space-y-4"><div className="skeleton h-4 w-1/3" /><div className="skeleton h-8 w-2/3" /><div className="skeleton h-24 w-full" /></div>;
  if (type === 'error') return <div className="panel p-8 text-center"><AlertTriangle className="mx-auto text-destructive mb-3" size={24} /><div className="font-bold text-sm">Could not reach the graph service</div><p className="text-xs text-muted-foreground mt-2">{message || 'Neo4j may need credentials before this view can load.'}</p>{onRetry && <button data-testid="button-retry" className="button button-ghost mt-4" onClick={onRetry}><RefreshCw size={13} /> Retry</button>}</div>;
  return <div className="panel p-10 text-center"><CircleDot className="mx-auto text-muted-foreground mb-3" size={24} /><div className="font-bold text-sm">No records in this view</div><p className="text-xs text-muted-foreground mt-2">Try changing the filters or create the first record.</p></div>;
}

function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="dialog"><div className="modal"><div className="modal-header"><div><h2 className="font-extrabold tracking-tight">{title}</h2>{description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}</div><button data-testid="button-close-modal" className="button button-ghost !p-2" onClick={onClose}><X size={15} /></button></div><div className="modal-body">{children}</div></div></div>;
}

function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [role, setRole] = useState<'Admin' | 'Operations Manager' | 'Delivery Agent'>('Operations Manager');
  const roles = [
    { name: 'Operations Manager', detail: 'Monitor network health and exceptions', icon: ShieldCheck },
    { name: 'Delivery Agent', detail: 'Work assigned stops and record outcomes', icon: Truck },
    { name: 'Admin', detail: 'Explore graph operations and DBMS controls', icon: Database },
  ] as const;
  return <div className="login-shell">
    <div className="login-art"><div className="relative z-10 max-w-lg"><Brand /><div className="mt-28"><div className="eyebrow !text-teal-200 mb-4">Academic logistics lab / 04</div><h1 className="text-5xl md:text-7xl font-extrabold tracking-[-.075em] leading-[.94]">Every stop<br /><span className="text-amber-300">has a shape.</span></h1><p className="mt-7 text-sm leading-7 text-slate-300 max-w-sm">IntelliRoute turns last-mile delivery into a living graph. Trace the order, understand the failure, move the network.</p></div><div className="absolute left-[52px] right-0 bottom-[-230px] h-72 opacity-65"><div className="graph-line" style={{ width: 210, left: 68, top: 105, transform: 'rotate(18deg)' }} /><div className="graph-line" style={{ width: 180, left: 245, top: 72, transform: 'rotate(116deg)' }} /><div className="graph-line" style={{ width: 200, left: 190, top: 175, transform: 'rotate(-21deg)' }} /><div className="graph-node" style={{ left: 32, top: 85 }}>HUB<br />04</div><div className="graph-node center" style={{ left: 218, top: 35 }}>SHIPMENT<br />NODE</div><div className="graph-node" style={{ left: 158, top: 173 }}>ZONE<br />NORTH</div><div className="graph-node" style={{ left: 338, top: 92 }}>AGENT<br />M-17</div></div></div></div>
    <div className="login-card"><div className="w-full max-w-md"><div className="eyebrow mb-3">Enter the workspace</div><h2 className="text-3xl font-extrabold tracking-[-.06em]">Choose your role</h2><p className="text-xs text-muted-foreground mt-2 mb-7">A role-based session keeps every operation attributable.</p><div className="space-y-2">{roles.map(({ name, detail, icon: Icon }) => <button key={name} data-testid={`button-role-${name.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setRole(name)} className={`w-full text-left panel p-4 flex items-center gap-3 transition-all ${role === name ? 'border-primary bg-primary/5 shadow-md' : 'hover-elevate'}`}><div className={`w-9 h-9 rounded-lg grid place-items-center ${role === name ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}><Icon size={17} /></div><div className="flex-1"><div className="text-sm font-bold">{name}</div><div className="text-[11px] text-muted-foreground mt-1">{detail}</div></div>{role === name && <CheckCircle2 className="text-primary" size={18} />}</button>)}</div><button data-testid="button-enter-application" className="button button-primary w-full mt-6 h-11" disabled={login.isPending} onClick={() => login.mutate({ data: { role } }, { onSuccess: (session) => { localStorage.setItem('intelliroute-role', session.role || role); localStorage.setItem('intelliroute-user', session.userName || 'Academic user'); setLocation('/'); } })}>{login.isPending ? 'Opening session…' : 'Enter IntelliRoute'}<ArrowUpRight size={16} /></button>{login.isError && <div className="mt-4 text-xs text-destructive flex gap-2 items-center"><AlertTriangle size={14} /> Session could not start. Check the API service.</div>}<div className="mt-8 flex items-center justify-between text-[10px] font-mono text-muted-foreground"><span>BUILD 0.1.0 / NEO4J</span><span>ROLE AUTHENTICATED</span></div></div></div>
  </div>;
}

function MetricCard({ label, value, detail, tone = 'teal' }: { label: string; value: string; detail: string; tone?: 'teal' | 'amber' | 'red' }) {
  return <div className="panel panel-hover p-4 relative overflow-hidden"><div className={`absolute top-0 left-0 right-0 h-1 ${tone === 'amber' ? 'bg-accent' : tone === 'red' ? 'bg-destructive' : 'bg-primary'}`} /><div className="eyebrow">{label}</div><div className="metric-value mt-3">{value}</div><div className="text-[11px] text-muted-foreground mt-2">{detail}</div></div>;
}

function BarList({ items, accent = 'primary' }: { items: Record<string, unknown>[]; accent?: 'primary' | 'accent' }) {
  const values = items.map((item) => Number(valueFrom(item, ['count', 'value', 'total', 'successRate', 'deliveries'])) || 0);
  const max = Math.max(...values, 1);
  return <div className="space-y-3">{items.slice(0, 6).map((item, index) => { const label = String(valueFrom(item, ['reason', 'zone', 'agent', 'name', 'label', 'range', 'paymentType']) || `Segment ${index + 1}`); const value = values[index]; return <div key={`${label}-${index}`}><div className="flex justify-between text-[11px] mb-1"><span className="font-semibold truncate max-w-[70%]">{titleCase(label)}</span><span className="font-mono text-muted-foreground">{value}</span></div><div className="bar-track"><div className={`bar-fill ${accent === 'accent' ? 'bg-accent' : ''}`} style={{ width: `${Math.max(5, value / max * 100)}%` }} /></div></div>; })}</div>;
}

function Dashboard() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), retry: false } });
  const data = summary.data;
  if (summary.isLoading) return <div className="page-content"><PageHeader eyebrow="Operations / live" title="Control room" /><State type="loading" /></div>;
  if (summary.isError || !data) return <div className="page-content"><PageHeader eyebrow="Operations / live" title="Control room" /><State type="error" onRetry={() => summary.refetch()} /></div>;
  const metrics = data.metrics || {};
  return <div className="page-content">
    <PageHeader eyebrow="Operations / live" title="Control room" description="A graph-aware view of what is moving, what is drifting, and where the network needs a decision." action={<Link href="/shipments" className="button button-primary" data-testid="link-view-queue">Open shipment queue <ArrowUpRight size={14} /></Link>} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <MetricCard label="Total shipments" value={compact(metrics.totalShipments)} detail="Across the active network" />
      <MetricCard label="In transit" value={compact(metrics.inTransit)} detail="Moving between hubs" tone="amber" />
      <MetricCard label="At risk" value={compact(metrics.highRiskShipments)} detail="Requires operator attention" tone="red" />
      <MetricCard label="Success rate" value={metrics.successRate !== undefined ? `${Number(metrics.successRate).toFixed(1)}%` : '—'} detail="Delivered without return" />
    </div>
    <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-4 mb-4">
      <div className="panel p-5"><div className="flex items-start justify-between mb-6"><div><div className="eyebrow">Network pulse</div><h2 className="font-extrabold mt-1">Status distribution</h2></div><span className="text-[10px] font-mono text-muted-foreground">UPDATED {formatTime(new Date().toISOString())}</span></div><div className="flex items-end gap-3 h-40">{(data.statusDistribution || []).slice(0, 8).map((item, index) => { const label = String(valueFrom(item, ['status', 'label', 'name']) || `S${index + 1}`); const value = Number(valueFrom(item, ['count', 'value', 'total'])) || 0; const max = Math.max(...(data.statusDistribution || []).map((x) => Number(valueFrom(x, ['count', 'value', 'total'])) || 1)); return <div key={`${label}-${index}`} className="flex-1 h-full flex flex-col justify-end gap-2 group"><div className="text-center text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity">{value}</div><div className={`rounded-t-md min-h-[8px] ${index % 3 === 1 ? 'bg-accent' : 'bg-primary'}`} style={{ height: `${Math.max(8, value / max * 100)}%` }} /><div className="text-[9px] text-muted-foreground text-center truncate" title={label}>{titleCase(label)}</div></div>; })}</div></div>
      <div className="panel p-5"><div className="eyebrow mb-1">Failure signals</div><h2 className="font-extrabold mb-5">Why drops happen</h2><BarList items={(data.failureReasons || []) as Record<string, unknown>[]} accent="accent" /></div>
    </div>
    <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-4">
      <div className="panel"><div className="p-5 flex items-center justify-between"><div><div className="eyebrow mb-1">Attention queue</div><h2 className="font-extrabold">High-risk shipments</h2></div><Link href="/predictions" className="text-[11px] font-bold text-primary flex items-center gap-1" data-testid="link-high-risk">Review all <ChevronRight size={13} /></Link></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Shipment</th><th>Zone</th><th>Probability</th><th>Attention</th></tr></thead><tbody>{(data.highRiskShipments || []).slice(0, 5).map((shipment) => <tr key={shipment.shipmentId} data-testid={`row-risk-${shipment.shipmentId}`}><td><Link href={`/shipments/${shipment.shipmentId}`} className="font-mono font-bold text-primary hover:underline">{shipment.shipmentId}</Link><div className="text-[10px] text-muted-foreground mt-1">{shipment.customerName}</div></td><td>{shipment.zone}</td><td><span className={`status ${riskClass(shipment.riskLevel)}`}>{(shipment.failureProbability * 100).toFixed(0)}%</span></td><td className="max-w-[160px] truncate">{shipment.attention}</td></tr>)}</tbody></table></div></div>
      <div className="panel p-5"><div className="eyebrow mb-1">Trace log</div><h2 className="font-extrabold mb-5">Recent activity</h2><div className="space-y-4">{(data.recentActivity || []).slice(0, 6).map((activity) => <div key={activity.id} className="flex gap-3"><div className={`mt-1 w-6 h-6 rounded-full grid place-items-center ${activity.success ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{activity.success ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}</div><div className="min-w-0"><div className="text-xs font-semibold truncate">{activity.action} <span className="text-muted-foreground font-normal">on {activity.entity}</span></div><div className="text-[10px] text-muted-foreground mt-1 font-mono">{activity.user} · {formatTime(activity.timestamp)}</div></div></div>)}</div></div>
    </div>
  </div>;
}

function SearchBar({ value, onChange, placeholder = 'Search graph records…' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <div className="relative w-full md:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-search" className="field pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}

function CustomerModal({ onClose, customer }: { onClose: () => void; customer?: any }) {
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const [form, setForm] = useState({ name: customer?.name || '', email: customer?.email || '', phone: customer?.phone || '' });
  const save = () => customer ? update.mutate({ customerId: customer.customerId, data: form }, { onSuccess: onClose }) : create.mutate({ data: form }, { onSuccess: onClose });
  return <Modal title={customer ? 'Edit customer node' : 'Create customer node'} description="Customer data becomes a connected node in the delivery graph." onClose={onClose}><div className="space-y-4">{[['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone']].map(([key, label]) => <label key={key} className="block"><span className="eyebrow block mb-2">{label}</span><input data-testid={`input-customer-${key}`} className="field" value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}<div className="flex justify-end gap-2 pt-2"><button data-testid="button-cancel-customer" className="button button-ghost" onClick={onClose}>Cancel</button><button data-testid="button-save-customer" className="button button-primary" disabled={create.isPending || update.isPending || !form.name || !form.phone} onClick={save}>{create.isPending || update.isPending ? 'Saving…' : 'Save customer'}</button></div></div></Modal>;
}

function Customers() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | any>(null);
  const [notice, setNotice] = useState('');
  const query = useGetCustomers({ search: search || undefined }, { query: { queryKey: getGetCustomersQueryKey({ search: search || undefined }), retry: false } });
  const deactivate = useDeactivateCustomer();
  const client = useQueryClient();
  const customers = query.data || [];
  const deactivateCustomer = (customerId: string) => { if (window.confirm('Deactivate this customer node?')) deactivate.mutate({ customerId }, { onSuccess: () => { setNotice('Customer deactivated'); client.invalidateQueries({ queryKey: getGetCustomersQueryKey({ search: search || undefined }) }); } }); };
  return <div className="page-content"><PageHeader eyebrow="Network / people" title="Customers" description="Search the customer graph, inspect connected orders, and keep identity data clean." action={<button data-testid="button-create-customer" className="button button-primary" onClick={() => setModal('create')}><Plus size={15} /> New customer</button>} /><div className="panel"><div className="p-4 border-b flex flex-col sm:flex-row gap-3 justify-between"><SearchBar value={search} onChange={setSearch} placeholder="Search name, email, phone…" /><span className="text-[10px] font-mono text-muted-foreground self-center">{customers.length} NODES</span></div>{query.isLoading ? <div className="p-4"><State type="loading" /></div> : query.isError ? <div className="p-4"><State type="error" onRetry={() => query.refetch()} /></div> : customers.length === 0 ? <div className="p-4"><State type="empty" /></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>Status</th><th>Orders</th><th>Shipments</th><th /></tr></thead><tbody>{customers.map((customer) => <tr key={customer.customerId} data-testid={`row-customer-${customer.customerId}`}><td><Link href={`/customers/${customer.customerId}`} className="font-bold text-primary hover:underline">{customer.name}</Link><div className="font-mono text-[10px] text-muted-foreground mt-1">{customer.customerId}</div></td><td><div>{customer.email}</div><div className="text-muted-foreground text-[10px] mt-1">{customer.phone}</div></td><td><span className={`status ${statusClass(customer.status)}`}>{customer.status}</span></td><td className="font-mono">{customer.orderCount}</td><td className="font-mono">{customer.shipmentCount}</td><td><div className="flex justify-end gap-1"><Link href={`/customers/${customer.customerId}`} data-testid={`link-customer-${customer.customerId}`} className="button button-ghost !px-2">Open</Link><button data-testid={`button-edit-customer-${customer.customerId}`} className="button button-ghost !px-2" onClick={() => setModal(customer)}>Edit</button><button data-testid={`button-deactivate-customer-${customer.customerId}`} className="button button-ghost !px-2 text-destructive" onClick={() => deactivateCustomer(customer.customerId)}>Deactivate</button></div></td></tr>)}</tbody></table></div>}</div>{modal && <CustomerModal customer={modal === 'create' ? undefined : modal} onClose={() => { setModal(null); client.invalidateQueries({ queryKey: getGetCustomersQueryKey({ search: search || undefined }) }); }} />}{notice && <button data-testid="button-dismiss-notice" className="toast-note" onClick={() => setNotice('')}>{notice}</button>}</div>;
}

function CustomerDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const query = useGetCustomer(id, { query: { enabled: Boolean(id), queryKey: getGetCustomerQueryKey(id), retry: false } });
  if (query.isLoading) return <div className="page-content"><State type="loading" /></div>;
  if (query.isError || !query.data) return <div className="page-content"><State type="error" onRetry={() => query.refetch()} /></div>;
  const customer = query.data;
  return <div className="page-content"><PageHeader eyebrow="Customer / connected node" title={customer.name} description={`${customer.email} · ${customer.phone}`} action={<Link href="/customers" className="button button-ghost" data-testid="link-back-customers">Back to customers</Link>} /><div className="grid lg:grid-cols-[.7fr_1.3fr] gap-4"><div className="space-y-4"><div className="panel p-5"><div className="eyebrow">Node profile</div><div className="flex items-center gap-3 mt-4"><div className="w-12 h-12 rounded-xl bg-secondary text-secondary-foreground grid place-items-center font-extrabold">{customer.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}</div><div><div className="font-bold">{customer.name}</div><span className={`status ${statusClass(customer.status)} mt-2`}>{customer.status}</span></div></div><div className="grid grid-cols-2 gap-3 mt-6"><div className="bg-muted rounded-lg p-3"><div className="eyebrow">Orders</div><div className="metric-value text-2xl mt-1">{customer.orderCount}</div></div><div className="bg-muted rounded-lg p-3"><div className="eyebrow">Shipments</div><div className="metric-value text-2xl mt-1">{customer.shipmentCount}</div></div></div></div><div className="panel p-5"><div className="eyebrow mb-3">Known addresses</div>{(customer.addresses || []).length ? customer.addresses.map((address: any, index: number) => <div key={index} className="flex gap-3 items-start text-xs border-t py-3"><MapPin size={15} className="text-primary mt-0.5" /><span>{Object.values(address).filter(Boolean).join(', ') || `Address node ${index + 1}`}</span></div>) : <p className="text-xs text-muted-foreground">No address nodes connected.</p>}</div></div><div className="panel"><div className="p-5 border-b"><div className="eyebrow mb-1">Relationship history</div><h2 className="font-extrabold">Orders and shipments</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Amount</th><th>Priority</th><th>Status</th><th>Shipment</th></tr></thead><tbody>{(customer.orders || []).map((order: any) => <tr key={order.orderId}><td className="font-mono font-bold text-primary">{order.orderId}</td><td>{money(order.amount)}</td><td>{order.priority}</td><td><span className={`status ${statusClass(order.status)}`}>{order.status}</span></td><td>{order.shipmentId ? <Link href={`/shipments/${order.shipmentId}`} className="text-primary font-mono hover:underline">{order.shipmentId}</Link> : '—'}</td></tr>)}</tbody></table></div>{!(customer.orders || []).length && <div className="p-8"><State type="empty" /></div>}</div></div></div>;
}

function OrderModal({ onClose }: { onClose: () => void }) {
  const create = useCreateOrder();
  const [form, setForm] = useState({ customerId: '', amount: '', paymentType: 'Card', priority: 'Standard', productName: '', quantity: '1' });
  return <Modal title="Create order node" description="Orders connect customer intent to a shipment route." onClose={onClose}><div className="grid sm:grid-cols-2 gap-4">{[['customerId', 'Customer ID'], ['amount', 'Amount'], ['productName', 'Product'], ['quantity', 'Quantity']].map(([key, label]) => <label key={key} className="block"><span className="eyebrow block mb-2">{label}</span><input data-testid={`input-order-${key}`} className="field" type={key === 'amount' || key === 'quantity' ? 'number' : 'text'} value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}<label><span className="eyebrow block mb-2">Payment</span><select data-testid="select-order-payment" className="field" value={form.paymentType} onChange={(event) => setForm({ ...form, paymentType: event.target.value })}><option>Card</option><option>Cash</option><option>Wallet</option></select></label><label><span className="eyebrow block mb-2">Priority</span><select data-testid="select-order-priority" className="field" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Standard</option><option>Express</option><option>Critical</option></select></label></div><div className="flex justify-end gap-2 pt-6"><button data-testid="button-cancel-order" className="button button-ghost" onClick={onClose}>Cancel</button><button data-testid="button-save-order" className="button button-primary" disabled={create.isPending || !form.customerId || !form.amount} onClick={() => create.mutate({ data: { ...form, amount: Number(form.amount), quantity: Number(form.quantity) } }, { onSuccess: onClose })}>{create.isPending ? 'Creating…' : 'Create order'}</button></div></Modal>;
}

function Orders() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const query = useGetOrders({ search: search || undefined }, { query: { queryKey: getGetOrdersQueryKey({ search: search || undefined }), retry: false } });
  const orders = query.data || [];
  const client = useQueryClient();
  return <div className="page-content"><PageHeader eyebrow="Network / commerce" title="Orders" description="The demand layer. Search order intent before it becomes a physical route." action={<button data-testid="button-create-order" className="button button-primary" onClick={() => setModal(true)}><Plus size={15} /> New order</button>} /><div className="panel"><div className="p-4 border-b flex justify-between"><SearchBar value={search} onChange={setSearch} placeholder="Search order or customer ID…" /><span className="text-[10px] font-mono text-muted-foreground self-center">{orders.length} RECORDS</span></div>{query.isLoading ? <div className="p-4"><State type="loading" /></div> : query.isError ? <div className="p-4"><State type="error" onRetry={() => query.refetch()} /></div> : orders.length === 0 ? <div className="p-4"><State type="empty" /></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Order</th><th>Customer</th><th>Value</th><th>Payment</th><th>Priority</th><th>Status</th><th>Shipment</th><th>Placed</th></tr></thead><tbody>{orders.map((order) => <tr key={order.orderId} data-testid={`row-order-${order.orderId}`}><td className="font-mono font-bold text-primary">{order.orderId}</td><td className="font-mono">{order.customerId}</td><td>{money(order.amount)}<div className="text-[10px] text-muted-foreground mt-1">{order.itemCount || 0} items</div></td><td>{order.paymentType}</td><td><span className="status status-slate">{order.priority}</span></td><td><span className={`status ${statusClass(order.status)}`}>{order.status}</span></td><td>{order.shipmentId ? <Link href={`/shipments/${order.shipmentId}`} className="font-mono text-primary hover:underline">{order.shipmentId}</Link> : <span className="text-muted-foreground">Unassigned</span>}</td><td>{formatDate(order.orderDate)}</td></tr>)}</tbody></table></div>}</div>{modal && <OrderModal onClose={() => { setModal(false); client.invalidateQueries({ queryKey: getGetOrdersQueryKey({ search: search || undefined }) }); }} />}</div>;
}

function ShipmentModal({ onClose }: { onClose: () => void }) {
  const create = useCreateShipment();
  const [form, setForm] = useState({ orderId: '', customerId: '', addressId: '', agentId: '', hubId: '', zoneId: '', vehicleId: '', shipmentDate: new Date().toISOString().slice(0, 10), expectedDeliveryDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), distanceKm: '' });
  const set = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  return <Modal title="Create shipment node" description="Assign the order to a route-aware delivery execution record." onClose={onClose}><div className="grid sm:grid-cols-2 gap-4">{Object.entries(form).map(([key, value]) => <label key={key} className="block"><span className="eyebrow block mb-2">{titleCase(key)}</span><input data-testid={`input-shipment-${key}`} className="field" type={key.toLowerCase().includes('date') ? 'date' : key === 'distanceKm' ? 'number' : 'text'} value={value} onChange={(event) => set(key as keyof typeof form, event.target.value)} /></label>)}</div><div className="flex justify-end gap-2 pt-6"><button data-testid="button-cancel-shipment" className="button button-ghost" onClick={onClose}>Cancel</button><button data-testid="button-save-shipment" className="button button-primary" disabled={create.isPending || !form.orderId || !form.customerId || !form.agentId} onClick={() => create.mutate({ data: { ...form, vehicleId: form.vehicleId || null, distanceKm: Number(form.distanceKm) } }, { onSuccess: onClose })}>{create.isPending ? 'Creating…' : 'Create shipment'}</button></div></Modal>;
}

function Shipments() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const params = { search: search || undefined, status: status || undefined };
  const query = useGetShipments(params, { query: { queryKey: getGetShipmentsQueryKey(params), retry: false } });
  const shipments = query.data || [];
  const client = useQueryClient();
  return <div className="page-content"><PageHeader eyebrow="Network / physical" title="Shipment queue" description="Every shipment is an executable path through the graph. Filter the queue by its current state." action={<button data-testid="button-create-shipment" className="button button-primary" onClick={() => setModal(true)}><Plus size={15} /> New shipment</button>} /><div className="panel"><div className="p-4 border-b flex flex-col md:flex-row gap-3 justify-between"><div className="flex gap-2 flex-wrap"><SearchBar value={search} onChange={setSearch} placeholder="Search shipment, agent, zone…" /><select data-testid="select-shipment-status" className="field !w-auto" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="Pending">Pending</option><option value="In Transit">In Transit</option><option value="Delivered">Delivered</option><option value="Failed">Failed</option></select></div><span className="text-[10px] font-mono text-muted-foreground self-center">{shipments.length} SHIPMENTS</span></div>{query.isLoading ? <div className="p-4"><State type="loading" /></div> : query.isError ? <div className="p-4"><State type="error" onRetry={() => query.refetch()} /></div> : shipments.length === 0 ? <div className="p-4"><State type="empty" /></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Shipment</th><th>Customer</th><th>Route</th><th>Agent</th><th>Status</th><th>Risk</th><th>Attempts</th><th>Expected</th></tr></thead><tbody>{shipments.map((shipment) => <tr key={shipment.shipmentId} data-testid={`row-shipment-${shipment.shipmentId}`}><td><Link href={`/shipments/${shipment.shipmentId}`} className="font-mono font-bold text-primary hover:underline">{shipment.shipmentId}</Link><div className="text-[10px] text-muted-foreground mt-1">{shipment.orderId}</div></td><td>{shipment.customerName}<div className="font-mono text-[10px] text-muted-foreground mt-1">{shipment.customerId}</div></td><td><div>{shipment.zone}</div><div className="text-[10px] text-muted-foreground mt-1">{shipment.hub} · {shipment.distanceKm} km</div></td><td>{shipment.agent}</td><td><span className={`status ${statusClass(shipment.status)}`}>{shipment.status}</span></td><td>{shipment.riskLevel ? <span className={`status ${riskClass(shipment.riskLevel)}`}>{shipment.riskLevel} {shipment.failureProbability !== null ? `${Math.round(shipment.failureProbability * 100)}%` : ''}</span> : '—'}</td><td className="font-mono">{shipment.attemptCount}</td><td>{formatDate(shipment.expectedDeliveryDate)}</td></tr>)}</tbody></table></div>}</div>{modal && <ShipmentModal onClose={() => { setModal(false); client.invalidateQueries({ queryKey: getGetShipmentsQueryKey(params) }); }} />}</div>;
}

function ShipmentDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const query = useGetShipment(id, { query: { enabled: Boolean(id), queryKey: getGetShipmentQueryKey(id), retry: false } });
  const graph = useGetShipmentGraph(id, { query: { enabled: Boolean(id), queryKey: getGetShipmentGraphQueryKey(id), retry: false } });
  const statusMutation = useUpdateShipmentStatus();
  const attemptMutation = useRecordDeliveryAttempt();
  const client = useQueryClient();
  const [remarks, setRemarks] = useState('');
  const [failureReasonId, setFailureReasonId] = useState('');
  if (query.isLoading) return <div className="page-content"><State type="loading" /></div>;
  if (query.isError || !query.data) return <div className="page-content"><State type="error" onRetry={() => query.refetch()} /></div>;
  const shipment = query.data;
  const updateStatus = (nextStatus: string) => statusMutation.mutate({ shipmentId: id, data: { status: nextStatus } }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetShipmentQueryKey(id) }) });
  const recordAttempt = (status: string) => attemptMutation.mutate({ shipmentId: id, data: { status, remarks, failureReasonId: failureReasonId || null } }, { onSuccess: () => { setRemarks(''); setFailureReasonId(''); client.invalidateQueries({ queryKey: getGetShipmentQueryKey(id) }); } });
  return <div className="page-content"><PageHeader eyebrow="Shipment / operational context" title={shipment.shipmentId} description={`${shipment.customerName} · ${shipment.zone} · ${shipment.distanceKm} km path`} action={<Link href="/shipments" className="button button-ghost" data-testid="link-back-shipments">Back to queue</Link>} /><div className="grid lg:grid-cols-[1.1fr_.9fr] gap-4"><div className="space-y-4"><div className="panel p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="eyebrow">Current state</div><div className="flex items-center gap-3 mt-3"><span className={`status ${statusClass(shipment.status)}`}>{shipment.status}</span>{shipment.riskLevel && <span className={`status ${riskClass(shipment.riskLevel)}`}>{shipment.riskLevel} risk</span>}</div></div><div className="text-right"><div className="eyebrow">Failure probability</div><div className="metric-value text-3xl mt-1">{shipment.failureProbability !== null ? `${Math.round(shipment.failureProbability * 100)}%` : '—'}</div></div></div><div className="grid sm:grid-cols-4 gap-3 mt-6"><div><div className="eyebrow">Agent</div><div className="text-xs font-bold mt-2">{shipment.agent}</div></div><div><div className="eyebrow">Hub</div><div className="text-xs font-bold mt-2">{shipment.hub}</div></div><div><div className="eyebrow">Vehicle</div><div className="text-xs font-bold mt-2">{shipment.vehicle || 'Unassigned'}</div></div><div><div className="eyebrow">Attempts</div><div className="text-xs font-bold mt-2">{shipment.attemptCount}</div></div></div><div className="flex flex-wrap gap-2 mt-6">{['In Transit', 'Delivered', 'Failed', 'Returned'].map((next) => <button key={next} data-testid={`button-status-${next.toLowerCase().replace(' ', '-')}`} className={`button ${shipment.status === next ? 'button-primary' : 'button-ghost'}`} disabled={statusMutation.isPending || shipment.status === next} onClick={() => updateStatus(next)}>{next}</button>)}</div></div><div className="panel"><div className="p-5 border-b"><div className="eyebrow mb-1">Delivery attempts</div><h2 className="font-extrabold">Trace every outcome</h2></div><div className="p-5 space-y-4">{(shipment.attempts || []).map((attempt) => <div key={attempt.attemptId} className="flex gap-3"><div className={`w-7 h-7 rounded-full grid place-items-center ${attempt.status.toLowerCase().includes('fail') ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}><span className="font-mono text-[10px]">{attempt.attemptNumber}</span></div><div className="flex-1"><div className="flex justify-between gap-3"><span className="text-xs font-bold">{attempt.status}</span><span className="font-mono text-[10px] text-muted-foreground">{formatDate(attempt.attemptDate)}</span></div><p className="text-xs text-muted-foreground mt-1">{attempt.remarks || 'No remarks recorded.'}</p>{attempt.failureReason && <span className="text-[10px] text-destructive mt-2 inline-block">Reason: {attempt.failureReason}</span>}</div></div>)}{!(shipment.attempts || []).length && <p className="text-xs text-muted-foreground">No attempts have been recorded.</p>}<div className="border-t pt-4"><div className="eyebrow mb-3">Record delivery outcome</div><div className="grid sm:grid-cols-[.5fr_1fr] gap-2"><select data-testid="select-attempt-status" className="field" defaultValue="Failed" id="attempt-status"><option>Failed</option><option>Delivered</option><option>Rescheduled</option></select><input data-testid="input-attempt-remarks" className="field" placeholder="What happened at the door?" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></div><div className="flex gap-2 mt-2"><input data-testid="input-failure-reason" className="field" placeholder="Failure reason ID (optional)" value={failureReasonId} onChange={(event) => setFailureReasonId(event.target.value)} /><button data-testid="button-record-attempt" className="button button-primary" disabled={attemptMutation.isPending} onClick={() => recordAttempt((document.getElementById('attempt-status') as HTMLSelectElement).value)}>{attemptMutation.isPending ? 'Recording…' : 'Record'}</button></div></div></div></div></div><div className="space-y-4"><div className="panel p-5"><div className="eyebrow mb-1">Multi-hop context</div><h2 className="font-extrabold mb-4">Relationship graph</h2><GraphView graph={graph.data} loading={graph.isLoading} /><Link href={`/graph?shipment=${id}`} className="button button-ghost w-full mt-4" data-testid="link-expand-graph">Open graph explorer <Network size={14} /></Link></div><div className="panel p-5"><div className="eyebrow mb-1">Destination</div><h2 className="font-extrabold mb-3">Address node</h2><div className="flex gap-3 text-xs"><MapPin className="text-primary" size={16} /><span>{Object.values(shipment.address || {}).filter(Boolean).join(', ') || 'Address details not available'}</span></div></div></div></div></div>;
}

function Delivery() {
  const query = useGetShipments({ status: 'In Transit' }, { query: { queryKey: getGetShipmentsQueryKey({ status: 'In Transit' }), retry: false } });
  const updateStatus = useUpdateShipmentStatus();
  const attempt = useRecordDeliveryAttempt();
  const [selected, setSelected] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const client = useQueryClient();
  const shipments = query.data || [];
  return <div className="page-content"><PageHeader eyebrow="Field operations / assigned" title="Delivery desk" description="A focused view for agents: what is in hand, what needs a scan, and how to record the exception." /><div className="grid lg:grid-cols-[1.2fr_.8fr] gap-4"><div className="panel"><div className="p-5 border-b flex items-center justify-between"><div><div className="eyebrow">Assigned route</div><h2 className="font-extrabold">Active stops</h2></div><span className="status status-amber">{shipments.length} open</span></div>{query.isLoading ? <div className="p-4"><State type="loading" /></div> : query.isError ? <div className="p-4"><State type="error" /></div> : shipments.length === 0 ? <div className="p-4"><State type="empty" /></div> : <div>{shipments.map((shipment) => <button key={shipment.shipmentId} data-testid={`button-select-delivery-${shipment.shipmentId}`} onClick={() => setSelected(shipment)} className={`w-full text-left p-5 border-b hover:bg-primary/5 transition-colors ${selected?.shipmentId === shipment.shipmentId ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}><div className="flex justify-between gap-3"><div><div className="font-mono font-bold text-primary">{shipment.shipmentId}</div><div className="font-bold text-sm mt-1">{shipment.customerName}</div><div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2"><MapPin size={12} /> {shipment.zone} · {shipment.distanceKm} km</div></div><div className="text-right"><span className={`status ${riskClass(shipment.riskLevel)}`}>{shipment.riskLevel || 'Normal'}</span><div className="text-[10px] text-muted-foreground mt-3">Attempt {shipment.attemptCount + 1}</div></div></div></button>)}</div>}</div><div className="panel p-5 h-fit">{selected ? <><div className="eyebrow">Selected stop</div><h2 className="font-extrabold mt-1">{selected.customerName}</h2><div className="text-xs text-muted-foreground mt-1 font-mono">{selected.shipmentId}</div><div className="bg-muted rounded-lg p-4 mt-5"><div className="flex gap-3 text-xs"><MapPin size={16} className="text-primary shrink-0" /><span>{selected.zone} · {selected.hub}<br /><span className="text-muted-foreground">Address available in shipment context</span></span></div></div><label className="block mt-5"><span className="eyebrow block mb-2">Delivery note</span><textarea data-testid="textarea-delivery-note" className="field min-h-24 resize-y" value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Leave a trace for the next operator…" /></label><div className="grid grid-cols-2 gap-2 mt-3"><button data-testid="button-mark-delivered" className="button button-primary" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ shipmentId: selected.shipmentId, data: { status: 'Delivered' } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetShipmentsQueryKey({ status: 'In Transit' }) }); setSelected(null); } })}><CheckCircle2 size={14} /> Delivered</button><button data-testid="button-record-failure" className="button button-danger" disabled={attempt.isPending} onClick={() => attempt.mutate({ shipmentId: selected.shipmentId, data: { status: 'Failed', remarks, failureReasonId: null } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetShipmentsQueryKey({ status: 'In Transit' }) }); setRemarks(''); } })}><AlertTriangle size={14} /> Record failure</button></div></> : <div className="py-10 text-center"><Truck className="mx-auto text-primary mb-3" size={28} /><div className="font-bold text-sm">Select a stop</div><p className="text-xs text-muted-foreground mt-2">The next action, address context, and failure trace will appear here.</p></div>}</div></div></div>;
}

function Analytics() {
  const query = useGetAnalyticsOverview({ query: { queryKey: getGetAnalyticsOverviewQueryKey(), retry: false } });
  if (query.isLoading) return <div className="page-content"><PageHeader eyebrow="Network intelligence" title="Analytics" /><State type="loading" /></div>;
  if (query.isError || !query.data) return <div className="page-content"><PageHeader eyebrow="Network intelligence" title="Analytics" /><State type="error" onRetry={() => query.refetch()} /></div>;
  const data = query.data;
  return <div className="page-content"><PageHeader eyebrow="Network intelligence" title="Failure analysis" description="Turn graph relationships into operational decisions. Compare the reasons, places, and actors behind every drop." /><div className="grid grid-cols-2 gap-3 mb-5"><MetricCard label="Success rate" value={`${data.successRate.toFixed(1)}%`} detail="Delivered without a return" /><MetricCard label="Return rate" value={`${data.returnRate.toFixed(1)}%`} detail="Closed loop exceptions" tone="red" /></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4"><div className="panel p-5"><div className="eyebrow mb-1">Failure reason</div><h2 className="font-extrabold mb-5">Why attempts fail</h2><BarList items={data.failureByReason as Record<string, unknown>[]} accent="accent" /></div><div className="panel p-5"><div className="eyebrow mb-1">Zone analysis</div><h2 className="font-extrabold mb-5">Where drops cluster</h2><BarList items={data.failureByZone as Record<string, unknown>[]} /></div><div className="panel p-5"><div className="eyebrow mb-1">Agent analysis</div><h2 className="font-extrabold mb-5">Who needs support</h2><BarList items={data.failureByAgent as Record<string, unknown>[]} /></div><div className="panel p-5"><div className="eyebrow mb-1">Payment behavior</div><h2 className="font-extrabold mb-5">Payment vs failure</h2><BarList items={data.failureByPayment as Record<string, unknown>[]} accent="accent" /></div><div className="panel p-5"><div className="eyebrow mb-1">Distance</div><h2 className="font-extrabold mb-5">Distance ranges</h2><BarList items={data.distanceRanges as Record<string, unknown>[]} /></div><div className="panel p-5"><div className="eyebrow mb-1">Attempts per shipment</div><h2 className="font-extrabold mb-5">Operational drag</h2><BarList items={data.attemptsPerShipment as Record<string, unknown>[]} accent="accent" /></div></div></div>;
}

function Predictions() {
  const highRisk = useGetHighRiskShipments({ query: { queryKey: getGetHighRiskShipmentsQueryKey(), retry: false } });
  const create = useCreatePrediction();
  const [shipmentId, setShipmentId] = useState('');
  const client = useQueryClient();
  return <div className="page-content"><PageHeader eyebrow="Network intelligence / model" title="Predictions" description="Run a persisted failure-risk prediction for a shipment, then use the result as a traceable operational signal." /><div className="grid lg:grid-cols-[.75fr_1.25fr] gap-4"><div className="panel p-5 h-fit"><div className="w-10 h-10 rounded-xl bg-accent/20 text-accent-foreground grid place-items-center"><BrainCircuit size={20} /></div><h2 className="font-extrabold mt-5">Score a shipment</h2><p className="text-xs text-muted-foreground mt-2 leading-5">The prediction is written back to the graph with its model version and feature set.</p><label className="block mt-5"><span className="eyebrow block mb-2">Shipment ID</span><input data-testid="input-prediction-shipment" className="field" value={shipmentId} onChange={(event) => setShipmentId(event.target.value)} placeholder="SHP-1048" /></label><button data-testid="button-run-prediction" className="button button-primary w-full mt-3" disabled={create.isPending || !shipmentId} onClick={() => create.mutate({ shipmentId }, { onSuccess: () => { setShipmentId(''); client.invalidateQueries({ queryKey: getGetHighRiskShipmentsQueryKey() }); } })}>{create.isPending ? 'Running model…' : 'Run prediction'}<Play size={14} /></button>{create.data && <div className="mt-5 p-4 rounded-lg bg-primary/5 border border-primary/20"><div className="eyebrow">Latest result</div><div className="text-2xl font-extrabold mt-2">{Math.round(create.data.failureProbability * 100)}%</div><div className={`status ${riskClass(create.data.riskLevel)} mt-2`}>{create.data.riskLevel} risk</div><div className="text-[10px] font-mono text-muted-foreground mt-3">{create.data.modelVersion} · {formatTime(create.data.predictedAt)}</div></div>}</div><div className="panel"><div className="p-5 border-b flex justify-between"><div><div className="eyebrow mb-1">Persisted risk queue</div><h2 className="font-extrabold">High-risk shipments</h2></div><Zap className="text-accent" size={18} /></div>{highRisk.isLoading ? <div className="p-4"><State type="loading" /></div> : highRisk.isError ? <div className="p-4"><State type="error" onRetry={() => highRisk.refetch()} /></div> : !(highRisk.data || []).length ? <div className="p-4"><State type="empty" /></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Shipment</th><th>Customer</th><th>Probability</th><th>Risk</th><th>Attention</th></tr></thead><tbody>{(highRisk.data || []).map((shipment) => <tr key={shipment.shipmentId}><td><Link href={`/shipments/${shipment.shipmentId}`} className="font-mono font-bold text-primary hover:underline">{shipment.shipmentId}</Link></td><td>{shipment.customerName}<div className="text-[10px] text-muted-foreground mt-1">{shipment.zone}</div></td><td className="font-mono font-bold">{Math.round(shipment.failureProbability * 100)}%</td><td><span className={`status ${riskClass(shipment.riskLevel)}`}>{shipment.riskLevel}</span></td><td>{shipment.attention}</td></tr>)}</tbody></table></div>}</div></div></div>;
}

function GraphView({ graph, loading }: { graph?: any; loading?: boolean }) {
  if (loading) return <div className="graph-stage network-grid p-5"><div className="skeleton h-full w-full opacity-20" /></div>;
  const nodes = graph?.nodes || [];
  const positions = [{ left: '10%', top: '38%' }, { left: '42%', top: '12%' }, { left: '73%', top: '34%' }, { left: '35%', top: '68%' }, { left: '70%', top: '72%' }];
  return <div className="graph-stage">{nodes.slice(0, 5).map((node: any, index: number) => <div key={node.id} className={`graph-node ${index === 0 ? 'center' : ''}`} style={positions[index]} title={JSON.stringify(node.properties)}>{node.label || node.type}</div>)}{nodes.slice(1, 5).map((node: any, index: number) => <div key={`line-${node.id}`} className="graph-line" style={{ width: `${index % 2 ? 140 : 190}px`, left: index === 0 ? '27%' : index === 1 ? '52%' : '29%', top: index === 0 ? '43%' : index === 1 ? '42%' : '53%', transform: `rotate(${index % 2 ? -25 : 20}deg)` }} />)}{!nodes.length && <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">No graph edges returned</div>}</div>;
}

function GraphExplorer() {
  const params = new URLSearchParams(window.location.search);
  const [shipmentId, setShipmentId] = useState(params.get('shipment') || '');
  const graph = useGetShipmentGraph(shipmentId, { query: { enabled: Boolean(shipmentId), queryKey: getGetShipmentGraphQueryKey(shipmentId), retry: false } });
  return <div className="page-content"><PageHeader eyebrow="Graph intelligence / traversal" title="Graph explorer" description="Start with a shipment and inspect the connected customer, order, agent, hub, and zone nodes." /><div className="panel p-4 mb-4 flex flex-col sm:flex-row gap-2"><input data-testid="input-graph-shipment" className="field" value={shipmentId} onChange={(event) => setShipmentId(event.target.value)} placeholder="Enter shipment ID to traverse…" /><button data-testid="button-load-graph" className="button button-primary" disabled={!shipmentId} onClick={() => graph.refetch()}>Traverse <Network size={14} /></button></div>{graph.isError ? <State type="error" onRetry={() => graph.refetch()} /> : <div className="grid lg:grid-cols-[1.4fr_.6fr] gap-4"><div className="panel p-4"><GraphView graph={graph.data} loading={graph.isLoading} /></div><div className="panel"><div className="p-5 border-b"><div className="eyebrow">Traversal output</div><h2 className="font-extrabold mt-1">{graph.data?.nodes?.length || 0} nodes / {graph.data?.relationships?.length || 0} edges</h2></div><div className="p-5 space-y-3">{(graph.data?.nodes || []).map((node: any) => <div key={node.id} className="flex items-center gap-3"><div className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center"><CircleDot size={13} /></div><div><div className="text-xs font-bold">{node.label}</div><div className="font-mono text-[10px] text-muted-foreground">{node.type} · {node.id}</div></div></div>)}</div></div></div>}</div>;
}

function DbmsLab() {
  const activity = useGetDbmsActivity({ query: { queryKey: getGetDbmsActivityQueryKey(), retry: false } });
  const execute = useExecuteDbmsOperation();
  const [operation, setOperation] = useState<any>('multi-hop');
  const [shipmentId, setShipmentId] = useState('');
  const client = useQueryClient();
  const operations = ['filter', 'sort', 'aggregate', 'group-analysis', '1-hop', '2-hop', 'multi-hop', 'constraints', 'indexes', 'transaction'];
  const run = () => execute.mutate({ data: { operation, shipmentId: shipmentId || null } }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetDbmsActivityQueryKey() }) });
  return <div className="page-content"><PageHeader eyebrow="Academic workspace / database systems" title="DBMS lab" description="Run curated Cypher operations, inspect parameters and results, and make graph concepts observable." /><div className="grid lg:grid-cols-[.72fr_1.28fr] gap-4"><div className="space-y-4"><div className="panel p-5"><div className="eyebrow mb-1">Operation console</div><h2 className="font-extrabold">Choose a traversal</h2><div className="grid grid-cols-2 gap-2 mt-5">{operations.map((item) => <button key={item} data-testid={`button-operation-${item}`} onClick={() => setOperation(item)} className={`button !justify-start ${operation === item ? 'button-primary' : 'button-ghost'}`}><Terminal size={13} />{item}</button>)}</div><label className="block mt-5"><span className="eyebrow block mb-2">Shipment parameter</span><input data-testid="input-dbms-shipment" className="field" value={shipmentId} onChange={(event) => setShipmentId(event.target.value)} placeholder="Optional for schema operations" /></label><button data-testid="button-execute-operation" className="button button-warn w-full mt-3" disabled={execute.isPending} onClick={run}>{execute.isPending ? 'Executing…' : 'Execute operation'}<Play size={14} /></button></div><div className="panel p-5"><div className="eyebrow mb-1">Concepts in scope</div><div className="flex flex-wrap gap-2 mt-3">{['CRUD', 'Cypher', 'Parameters', 'Traversal', 'Constraints', 'Indexes', 'Transactions'].map((item) => <span key={item} className="status status-slate">{item}</span>)}</div></div></div><div className="space-y-4"><div className="panel overflow-hidden"><div className="p-5 border-b flex justify-between"><div><div className="eyebrow">Cypher output</div><h2 className="font-extrabold">{operation}</h2></div><Database className="text-primary" size={18} /></div>{execute.data ? <div><pre className="p-5 bg-slate-950 text-teal-200 text-[11px] leading-5 font-mono overflow-auto">{execute.data.query}</pre><div className="p-5 grid md:grid-cols-3 gap-3"><div><div className="eyebrow">Success</div><div className="text-sm font-bold mt-2">{execute.data.success ? 'Committed' : 'Rejected'}</div></div><div><div className="eyebrow">Affected</div><div className="text-sm font-bold mt-2">{execute.data.affected}</div></div><div><div className="eyebrow">Rows</div><div className="text-sm font-bold mt-2">{execute.data.result?.length || 0}</div></div></div><div className="p-5 border-t"><div className="eyebrow mb-2">Parameters</div><pre className="text-[11px] font-mono text-muted-foreground">{JSON.stringify(execute.data.parameters, null, 2)}</pre></div></div> : <div className="p-10 text-center"><Terminal className="mx-auto text-muted-foreground mb-3" size={25} /><div className="font-bold text-sm">Ready for a query</div><p className="text-xs text-muted-foreground mt-2">Select an operation to produce a traceable result.</p></div>}</div><div className="panel"><div className="p-5 border-b"><div className="eyebrow mb-1">Activity ledger</div><h2 className="font-extrabold">Recent DBMS operations</h2></div>{activity.isLoading ? <div className="p-4"><State type="loading" /></div> : activity.isError ? <div className="p-4"><State type="error" onRetry={() => activity.refetch()} /></div> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>User</th><th>Operation</th><th>Entity</th><th>Result</th></tr></thead><tbody>{(activity.data || []).slice(0, 8).map((item) => <tr key={item.id}><td className="font-mono text-[10px]">{formatTime(item.timestamp)}</td><td>{item.user}</td><td className="font-mono">{item.operation}</td><td>{item.entity}</td><td><span className={`status ${item.success ? 'status-teal' : 'status-red'}`}>{item.success ? 'Success' : 'Failed'}</span></td></tr>)}</tbody></table></div>}</div></div></div></div>;
}

function AppRouter() {
  const [location] = useLocation();
  const isLogin = location === '/login';
  return isLogin ? <Login /> : <Shell><Switch><Route path="/" component={Dashboard} /><Route path="/customers" component={Customers} /><Route path="/customers/:id" component={CustomerDetailPage} /><Route path="/orders" component={Orders} /><Route path="/shipments" component={Shipments} /><Route path="/shipments/:id" component={ShipmentDetailPage} /><Route path="/delivery" component={Delivery} /><Route path="/analytics" component={Analytics} /><Route path="/predictions" component={Predictions} /><Route path="/graph" component={GraphExplorer} /><Route path="/dbms-lab" component={DbmsLab} /><Route component={NotFound} /></Switch></Shell>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RoutedErrorBoundary><AppRouter /></RoutedErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;