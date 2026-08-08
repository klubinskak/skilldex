type SkillToggleProps = {
  enabled: boolean
  size?: 'sm' | 'lg'
  /** When provided, the toggle is interactive; omit for a read-only indicator. */
  onToggle?: () => void
  /** Manageable skills only — plugin skills render dimmed and inert. */
  disabled?: boolean
}

/** On/off toggle reflecting a skill's enabled state; flips enable/disable when clicked. */
export function SkillToggle({ enabled, size = 'sm', onToggle, disabled = false }: SkillToggleProps) {
  const track = size === 'lg' ? 'h-[23px] w-10' : 'h-5 w-[34px]'
  const knob = size === 'lg' ? 'size-[19px]' : 'size-4'
  const trackColor = enabled ? 'bg-[#22c55e]' : 'bg-[#3f3f46]'

  const inner = (
    <span className={`flex items-center rounded-full px-0.5 ${track} ${trackColor} ${disabled ? 'opacity-50' : ''}`}>
      <span className={`rounded-full bg-white transition-all ${knob} ${enabled ? 'ml-auto' : 'mr-auto'}`} />
    </span>
  )

  if (!onToggle || disabled) {
    return (
      <span aria-hidden title={disabled ? 'Plugin skills are managed by their plugin' : enabled ? 'Enabled' : 'Disabled'}>
        {inner}
      </span>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Disable skill' : 'Enable skill'}
      title={enabled ? 'Disable' : 'Enable'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="cursor-pointer"
    >
      {inner}
    </button>
  )
}
