'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams }                        from 'next/navigation'
import { Save, Loader2, CheckCircle2, Lock, Zap } from 'lucide-react'
import FileUpload  from '@/components/branding/FileUpload'
import ColorPicker from '@/components/branding/ColorPicker'

function ProGate({ children, isProPlan }: { children: React.ReactNode; isProPlan: boolean }) {
  if (isProPlan) return <>{children}</>
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-navy-900/80 backdrop-blur-sm">
        <div className="text-center px-6">
          <Lock className="w-5 h-5 text-gold-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">Pro Feature</p>
          <p className="text-xs text-slate-400 mt-1">Upgrade to Pro to unlock white-label controls.</p>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  checked, onChange, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input type="checkbox" className="sr-only peer" checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} />
      <div className="w-11 h-6 bg-navy-700 rounded-full peer
        peer-checked:after:translate-x-full peer-checked:after:border-white
        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
        after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all
        peer-checked:bg-gold-500" />
    </label>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-3 gap-6">
      <div>
        <h2 className="font-semibold text-white text-sm">{title}</h2>
        {description && <p className="text-slate-400 text-xs mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="sm:col-span-2 card p-6">{children}</div>
    </div>
  )
}

export default function BrandingPage() {
  const { workspaceId } = useParams() as { workspaceId: string }
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [isProPlan, setIsProPlan] = useState(false)
  const [form, setForm] = useState({
    academy_name:          '',
    tagline:               '',
    logo_url:              '',
    hero_image_url:        '',
    primary_color:         '#1e293b',
    secondary_color:       '#0f172a',
    accent_color:          '#eab308',
    footer_text:           '',
    social_links:          { twitter: '', instagram: '', linkedin: '', youtube: '', website: '' },
    hide_powered_by_apex:  false,
    custom_email_branding: false,
    custom_cert_branding:  false,
    custom_login_branding: false,
    login_bg_url:          '',
    login_welcome_message: '',
    email_from_name:       '',
  })

  const load = useCallback(async () => {
    const res  = await fetch(`/api/platform/branding?workspaceId=${workspaceId}`)
    const json = await res.json()
    setIsProPlan(json.is_white_label ?? false)
    if (json.branding) {
      const b = json.branding
      setForm({
        academy_name:          b.academy_name          ?? '',
        tagline:               b.tagline               ?? '',
        logo_url:              b.logo_url              ?? '',
        hero_image_url:        b.hero_image_url        ?? '',
        primary_color:         b.primary_color         ?? '#1e293b',
        secondary_color:       b.secondary_color       ?? '#0f172a',
        accent_color:          b.accent_color          ?? '#eab308',
        footer_text:           b.footer_text           ?? '',
        social_links:          { twitter: '', instagram: '', linkedin: '', youtube: '', website: '', ...(b.social_links ?? {}) },
        hide_powered_by_apex:  b.hide_powered_by_apex  ?? false,
        custom_email_branding: b.custom_email_branding ?? false,
        custom_cert_branding:  b.custom_cert_branding  ?? false,
        custom_login_branding: b.custom_login_branding ?? false,
        login_bg_url:          b.login_bg_url          ?? '',
        login_welcome_message: b.login_welcome_message ?? '',
        email_from_name:       b.email_from_name       ?? '',
      })
    }
    setLoading(false)
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }))
  const setSocial = (k: string, v: string) =>
    setForm((f) => ({ ...f, social_links: { ...f.social_links, [k]: v } }))

  const save = async () => {
    setSaving(true)
    await fetch('/api/platform/branding', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        ...form,
        logo_url:       form.logo_url       || null,
        hero_image_url: form.hero_image_url || null,
        login_bg_url:   form.login_bg_url   || null,
        academy_name:   form.academy_name   || null,
        tagline:        form.tagline        || null,
        footer_text:    form.footer_text    || null,
        login_welcome_message: form.login_welcome_message || null,
        email_from_name:       form.email_from_name       || null,
      }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="py-20 text-center text-slate-500 text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>

  return (
    <div className="max-w-3xl space-y-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Branding</h1>
          <p className="text-slate-400 text-sm mt-1">Control how your academy looks and feels for students.</p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved</>
            : saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* Identity */}
      <Section title="Identity" description="Display name and tagline shown across your academy.">
        <div className="space-y-4">
          <div>
            <label className="label">Academy display name</label>
            <input className="input-field" value={form.academy_name}
              onChange={(e) => set('academy_name', e.target.value)} maxLength={100}
              placeholder="My Academy (leave blank to use workspace name)" />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input className="input-field" value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)} maxLength={200} />
          </div>
        </div>
      </Section>

      {/* Visual */}
      <Section title="Visual" description="Logo, hero image, and brand colors.">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-8">
            <FileUpload workspaceId={workspaceId} type="logo"
              currentUrl={form.logo_url} onUploaded={(u) => set('logo_url', u)}
              label="Logo" hint="Square, 256×256 recommended." />
            <FileUpload workspaceId={workspaceId} type="cover"
              currentUrl={form.hero_image_url} onUploaded={(u) => set('hero_image_url', u)}
              label="Hero Image" hint="1280×720 recommended." />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <ColorPicker value={form.accent_color} onChange={(c) => set('accent_color', c)} label="Accent color" />
            <ColorPicker value={form.primary_color} onChange={(c) => set('primary_color', c)} label="Primary bg" />
            <ColorPicker value={form.secondary_color} onChange={(c) => set('secondary_color', c)} label="Secondary bg" />
          </div>
        </div>
      </Section>

      {/* Footer + Social */}
      <Section title="Footer" description="Custom footer text and social media links.">
        <div className="space-y-4">
          <div>
            <label className="label">Footer text</label>
            <input className="input-field" value={form.footer_text}
              onChange={(e) => set('footer_text', e.target.value)} maxLength={500}
              placeholder="© 2025 My Academy. All rights reserved." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(['website','twitter','instagram','linkedin','youtube'] as const).map((k) => (
              <div key={k}>
                <label className="label capitalize">{k}</label>
                <input className="input-field text-sm" value={(form.social_links as any)[k] ?? ''}
                  onChange={(e) => setSocial(k, e.target.value)}
                  placeholder={k === 'website' ? 'https://example.com' : `https://${k}.com/...`} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* White Label */}
      <Section title="White Label" description="Remove Apex branding from your student experience.">
        <ProGate isProPlan={isProPlan}>
          <div className="space-y-4">
            {!isProPlan && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                Upgrade to Pro to remove Apex branding and enable white-label features.
              </div>
            )}
            {[
              { key: 'hide_powered_by_apex',  label: '"Powered by Apex University"', desc: 'Hide the Apex footer attribution from students.' },
              { key: 'custom_email_branding',  label: 'White-label emails',           desc: 'Use your logo and colors in all student emails.' },
              { key: 'custom_cert_branding',   label: 'White-label certificates',     desc: 'Apply your branding to course completion certificates.' },
              { key: 'custom_login_branding',  label: 'White-label login pages',      desc: 'Custom logo, colors, and background on login/signup.' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={(form as any)[key]}
                  onChange={(v) => set(key, v)}
                  disabled={!isProPlan}
                />
              </div>
            ))}
          </div>
        </ProGate>
      </Section>

      {/* Login Branding */}
      <Section title="Login Page" description="Customize the student login and signup experience. Pro only.">
        <ProGate isProPlan={isProPlan}>
          <div className="space-y-4">
            <div>
              <label className="label">Welcome message</label>
              <input className="input-field" value={form.login_welcome_message}
                onChange={(e) => set('login_welcome_message', e.target.value)} maxLength={300}
                placeholder="Welcome back! Sign in to continue learning." />
            </div>
            <div>
              <label className="label">Background image URL</label>
              <input className="input-field" value={form.login_bg_url}
                onChange={(e) => set('login_bg_url', e.target.value)}
                placeholder="https://..." />
              <p className="text-xs text-slate-500 mt-1">Displays behind the login card. Use a high-quality 1920×1080 image.</p>
            </div>
          </div>
        </ProGate>
      </Section>

      {/* Email Sender */}
      <Section title="Email Branding" description="Customize the sender name in student emails. Pro only.">
        <ProGate isProPlan={isProPlan}>
          <div>
            <label className="label">From name</label>
            <input className="input-field" value={form.email_from_name}
              onChange={(e) => set('email_from_name', e.target.value)} maxLength={100}
              placeholder="My Academy" />
            <p className="text-xs text-slate-500 mt-1">
              Emails will show "My Academy {'<'}noreply@apexuniversity.com{'>'}" in the sender field.
            </p>
          </div>
        </ProGate>
      </Section>
    </div>
  )
}
