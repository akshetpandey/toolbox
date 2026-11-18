import EmojiPicker, { Categories } from 'emoji-picker-react'
import type { EmojiClickData, EmojiDataLoader } from 'emoji-picker-react'
import { useLocale } from '@/i18n/LocaleContext'
import type { Language } from '@/i18n/locales'
import { useWorkspaceTranslator as useTranslator } from '@/i18n/useWorkspaceTranslator'

const emojiData: Partial<Record<Language, EmojiDataLoader>> = {
  de: () => import('emoji-picker-react/data/emojis-de'),
  es: () => import('emoji-picker-react/data/emojis-es'),
  fr: () => import('emoji-picker-react/data/emojis-fr'),
  ja: () => import('emoji-picker-react/data/emojis-ja'),
  nl: () => import('emoji-picker-react/data/emojis-nl'),
  pl: () => import('emoji-picker-react/data/emojis-pl'),
  'pt-BR': () => import('emoji-picker-react/data/emojis-pt'),
  ru: () => import('emoji-picker-react/data/emojis-ru'),
}

export default function RedactionEmojiPicker({
  onEmojiClick,
}: {
  onEmojiClick: (emoji: EmojiClickData) => void
}) {
  const { language } = useLocale()
  const t = useTranslator()
  return (
    <EmojiPicker
      emojiStyle="native"
      lang={language}
      emojiData={emojiData[language]}
      onEmojiClick={onEmojiClick}
      width="100%"
      height={400}
      categories={[
        { category: Categories.SUGGESTED, name: t('emojiSuggested') },
        { category: Categories.SMILEYS_PEOPLE, name: t('emojiPeople') },
        { category: Categories.ANIMALS_NATURE, name: t('emojiNature') },
        { category: Categories.FOOD_DRINK, name: t('emojiFood') },
        { category: Categories.TRAVEL_PLACES, name: t('emojiTravel') },
        { category: Categories.ACTIVITIES, name: t('emojiActivities') },
        { category: Categories.OBJECTS, name: t('emojiObjects') },
        { category: Categories.SYMBOLS, name: t('emojiSymbols') },
        { category: Categories.FLAGS, name: t('emojiFlags') },
      ]}
      previewConfig={{ defaultCaption: t('emojiPreviewCaption') }}
      labels={{
        searchPlaceholder: t('emojiSearch'),
        searchLabel: t('emojiSearchLabel'),
        searchClear: t('fileUploadClear'),
        searchResultsNone: t('emojiNoResults'),
        searchResultsOne: t('emojiOneResult'),
        searchResultsMany: t('emojiManyResults', { count: '%n' }),
        categoryNavigation: t('emojiCategories'),
        reactions: t('emojiReactions'),
        expandReactions: t('emojiShowAll'),
        loading: t('imagesRedactLoadingEmojis'),
        loadingError: t('emojiLoadFailed'),
        retryLoading: t('emojiRetry'),
        skinToneNeutral: t('emojiToneNeutral'),
        skinToneLight: t('emojiToneLight'),
        skinToneMediumLight: t('emojiToneMediumLight'),
        skinToneMedium: t('emojiToneMedium'),
        skinToneMediumDark: t('emojiToneMediumDark'),
        skinToneDark: t('emojiToneDark'),
      }}
    />
  )
}
