import { Heart } from 'lucide-react'

type FavouriteButtonProps = {
  favourite: boolean
  size?: 'sm' | 'lg'
  onToggle: () => void
}

/** Heart toggle marking a skill as a favourite. Filled when favourited. */
export function FavouriteButton({ favourite, size = 'sm', onToggle }: FavouriteButtonProps) {
  const icon = size === 'lg' ? 'size-[18px]' : 'size-[15px]'
  return (
    <button
      type="button"
      aria-pressed={favourite}
      aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
      title={favourite ? 'Remove from favourites' : 'Add to favourites'}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={`grid place-items-center rounded-md transition ${
        favourite ? 'text-[#fb7185]' : 'text-[#52525b] hover:text-[#a1a1aa]'
      }`}
    >
      <Heart className={icon} fill={favourite ? 'currentColor' : 'none'} />
    </button>
  )
}
