import { formatPrice } from '@/lib/utils'

interface Props {
  label:       string
  cents:       number
  sublabel?:   string
  highlight?:  boolean
  variant?:    'default' | 'gold' | 'green' | 'yellow'
}

const VARIANTS = {
  default: 'text-white',
  gold:    'text-transparent bg-clip-text bg-gold-gradient',
  green:   'text-emerald-400',
  yellow:  'text-yellow-400',
}

export default function EarningsStat({ label, cents, sublabel, highlight, variant = 'default' }: Props) {
  return (
    <div className={`card p-5 ${highlight ? 'border-gold-500/40' : ''}`}>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p className={`font-display text-2xl font-bold ${VARIANTS[variant]}`}>
        {formatPrice(cents / 100)}
      </p>
      {sublabel && <p className="text-slate-500 text-xs mt-1">{sublabel}</p>}
    </div>
  )
}
