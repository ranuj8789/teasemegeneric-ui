import {
  Activity,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Layers3,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Workflow,
} from 'lucide-react'

const formatNumber = new Intl.NumberFormat('en-IN')
const formatMoney = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function BusinessDashboard({ schemas = [], records = [], stats, onOpenPage, currentModule }) {
  const activeModules = schemas.filter((item) => item.active !== false)
  const recentRecords = records.slice(0, 5)

  const cards = [
    { label: 'Business modules', value: activeModules.length, note: 'Reusable ERP building blocks', icon: Layers3 },
    { label: 'Current module records', value: records.length, note: `Currently viewing ${currentModule}`, icon: Boxes },
    { label: 'Units available', value: formatNumber.format(stats.units || 0), note: `${stats.outOfStock || 0} out of stock`, icon: PackageCheck },
    { label: 'Retail value', value: formatMoney.format(stats.retailValue || 0), note: 'Based on current selling prices', icon: CircleDollarSign },
  ]

  return (
    <section className="workspace-page dashboard-page">
      <header className="hero-panel">
        <div>
          <span className="eyebrow light">AI-configurable Business OS</span>
          <h1>Build and run your ERP from one workspace.</h1>
          <p>Design modules, store records, create actions, automate workflows and connect business services without rebuilding the application for every organisation.</p>
          <div className="hero-actions">
            <button className="button button-light" type="button" onClick={() => onOpenPage('schema')}><Sparkles size={17}/> Design business model</button>
            <button className="button button-glass" type="button" onClick={() => onOpenPage('automation')}><Workflow size={17}/> Create automation</button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-core"><Sparkles size={29}/></div>
          <span className="orbit-node node-one"><ShoppingBag size={17}/></span>
          <span className="orbit-node node-two"><Boxes size={17}/></span>
          <span className="orbit-node node-three"><Activity size={17}/></span>
        </div>
      </header>

      <div className="erp-stat-grid">
        {cards.map(({ label, value, note, icon: Icon }) => (
          <article className="erp-stat-card" key={label}>
            <div className="erp-stat-icon"><Icon size={20}/></div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="surface-card quick-start-card">
          <div className="section-title-row">
            <div><span className="eyebrow">ERP launch path</span><h2>Start business operations</h2></div>
            <span className="status-chip ready">Foundation ready</span>
          </div>
          <div className="launch-steps">
            {[
              ['01', 'Design modules', 'Create modules, fields and relationships', 'schema'],
              ['02', 'Load inventory', 'Create records through generated forms', 'inventory'],
              ['03', 'Build actions', 'Configure events, actions and approval logic', 'automation'],
              ['04', 'Connect services', 'Email and future integrations', 'integrations'],
            ].map(([number, title, text, page]) => (
              <button className="launch-step" type="button" key={number} onClick={() => onOpenPage(page)}>
                <span>{number}</span><div><strong>{title}</strong><small>{text}</small></div><ArrowRight size={17}/>
              </button>
            ))}
          </div>
        </section>

        <section className="surface-card module-overview-card">
          <div className="section-title-row"><div><span className="eyebrow">Application map</span><h2>Active modules</h2></div><button className="text-button" type="button" onClick={() => onOpenPage('schema')}>Manage</button></div>
          <div className="module-pill-list">
            {activeModules.length ? activeModules.slice(0, 8).map((item) => (
              <div className="module-pill" key={item.id || item.module}>
                <span className="module-dot"/><div><strong>{item.title || item.module}</strong><small>{item.module}</small></div><span className="depth-label">L{item.depth || 1}</span>
              </div>
            )) : <div className="mini-empty">Create your first module to begin.</div>}
          </div>
        </section>

        <section className="surface-card recent-card">
          <div className="section-title-row"><div><span className="eyebrow">Live business data</span><h2>Recent records</h2></div><button className="text-button" type="button" onClick={() => onOpenPage('inventory')}>Open records</button></div>
          <div className="recent-records">
            {recentRecords.length ? recentRecords.map((record, index) => {
              const data = record.data || {}
              return <div className="recent-record" key={record.id || index}><div className="record-avatar">{String(data.name || data.title || currentModule).slice(0, 1).toUpperCase()}</div><div><strong>{data.name || data.title || `Record ${index + 1}`}</strong><small>{data.sku || data.category || currentModule}</small></div><span>{data.quantity ?? '—'}</span></div>
            }) : <div className="mini-empty">No records yet. Generated forms will appear in the Records workspace.</div>}
          </div>
        </section>
      </div>
    </section>
  )
}

export default BusinessDashboard
