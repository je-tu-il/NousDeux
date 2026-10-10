import { HStack, VStack, Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, containerBackground } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export interface QuestionWidgetProps {
  todayQuestion?: string;
  categoryName?: string;
  partnerAnswered?: boolean;
  userAnswered?: boolean;
  bothAnswered?: boolean;
  partnerPseudo?: string;
  themeId?: string;
  gradientColors?: [string, string];
}

const QuestionWidgetLayout = (props: QuestionWidgetProps, _environment: WidgetEnvironment) => {
  'widget';

  const question = props.todayQuestion || 'Quelle est la plus belle chose que ton partenaire ait faite pour toi ?';
  const partnerPseudo = props.partnerPseudo || 'Partenaire';
  const isBoth = props.bothAnswered || (props.userAnswered && props.partnerAnswered);
  const isPartner = props.partnerAnswered && !props.userAnswered;
  const isWaiting = props.userAnswered && !props.partnerAnswered;

  let badge = '💬 QUESTION DU JOUR';
  let cta = 'Touche pour répondre ✨';

  if (isBoth) {
    badge = '✨ DÉCOUVERT';
    cta = 'Vous avez tous les deux répondu 🎉';
  } else if (isPartner) {
    badge = '💌 À TOI DE JOUER';
    cta = `${partnerPseudo} a répondu ! Touche pour voir ✨`;
  } else if (isWaiting) {
    badge = '⏳ EN ATTENTE';
    cta = `En attente de ${partnerPseudo}... 💕`;
  }

  return (
    <VStack modifiers={[containerBackground('#FF6A88', 'widget'), padding({ all: 14 })]}>
      <HStack>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
          NousDeux
        </Text>
        <Text modifiers={[font({ size: 10, weight: 'semibold' }), foregroundStyle('#FFE5E0')]}>
          {badge}
        </Text>
      </HStack>
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>
          {question}
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle('#FFE5E0')]}>
          {cta}
        </Text>
      </VStack>
    </VStack>
  );
};

export const QuestionWidget = createWidget('QuestionWidget', QuestionWidgetLayout);
export default QuestionWidget;
