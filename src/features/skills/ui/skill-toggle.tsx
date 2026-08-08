type SkillToggleProps = { enabled: boolean; size?: 'sm' | 'lg' }

/**
 * Visual on/off toggle that reflects a skill's enabled state. Non-interactive
 * for now — toggling is wired to skill management in a later phase.
 */
export function SkillToggle({ enabled, size = 'sm' }: SkillToggleProps) {
  const track = size === 'lg' ? 'h-[23px] w-10' : 'h-5 w-[34px]'
  const knob = size === 'lg' ? 'size-[19px]' : 'size-4'
  return (
    <span
      aria-hidden
      title={enabled ? 'Enabled' : 'Disabled'}
      className={`flex items-center rounded-full px-0.5 ${track} ${enabled ? 'bg-[#22c55e]' : 'bg-[#3f3f46]'}`}
    >
      <span className={`rounded-full bg-white transition-all ${knob} ${enabled ? 'ml-auto' : 'mr-auto'}`} />
    </span>
  )
}
