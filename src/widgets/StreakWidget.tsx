import { HStack, VStack, Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, containerBackground } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface StreakWidgetProps {
  streak?: number;
  daysTogether?: number;
  partnerAnswered?: boolean;
  userAnswered?: boolean;
  bothAnswered?: boolean;
  partnerPseudo?: string;
  themeId?: string;
}

const StreakWidgetLayout = (props: StreakWidgetProps, _environment: WidgetEnvironment) => {
  'widget';

  const streak = props.streak || 1;
  const partnerPseudo = props.partnerPseudo || 'Partenaire';
  const isBoth = props.bothAnswered || (props.userAnswered && props.partnerAnswered);
  const isPartner = props.partnerAnswered && !props.userAnswered;
  const isWaiting = props.userAnswered && !props.partnerAnswered;

  let status = 'Touche pour ouvrir ➔';
  if (isBoth) {
    status = '🎉 Défi du jour relevé !';
  } else if (isPartner) {
    status = `💌 ${partnerPseudo} a répondu !`;
  } else if (isWaiting) {
    status = `⏳ En attente de ${partnerPseudo}`;
  }

  const streakLabel = streak > 1 ? 'JOURS ENSEMBLE' : 'JOUR ENSEMBLE';

  return (
    <VStack modifiers={[containerBackground('#FF4B2B', 'widget'), padding({ all: 14 })]}>
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
          NousDeux
        </Text>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#FFE5E0')]}>
          🔥 DUO
        </Text>
      </HStack>
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ size: 32, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
          {`🔥 ${streak}`}
        </Text>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#FFE5E0')]}>
          {streakLabel}
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle('#FFFFFF')]}>
          {status}
        </Text>
      </VStack>
    </VStack>
  );
};

export const StreakWidget = createWidget('StreakWidget', StreakWidgetLayout);
export default StreakWidget;
