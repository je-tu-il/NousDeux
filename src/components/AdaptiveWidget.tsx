import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Heart, CheckCircle2, Clock, Sparkles, MessageCircle, Calendar } from 'lucide-react-native';
import { WidgetPayload, WidgetSize, WidgetType, WidgetPlatform, getWidgetTheme } from '../lib/widgets';

interface AdaptiveWidgetProps {
  type: WidgetType;
  size: WidgetSize;
  platform?: WidgetPlatform;
  data: WidgetPayload;
  onPress?: () => void;
}

export default function AdaptiveWidget({
  type,
  size,
  platform = 'ios',
  data,
  onPress,
}: AdaptiveWidgetProps) {
  const theme = getWidgetTheme(data.themeId);

  // Dimensions adaptées au format
  const isSmall = size === 'small';
  const isMedium = size === 'medium';
  const isLarge = size === 'large';

  const containerStyle = [
    styles.baseContainer,
    platform === 'ios' ? styles.iosContainer : styles.androidContainer,
    isSmall && styles.sizeSmall,
    isMedium && styles.sizeMedium,
    isLarge && styles.sizeLarge,
  ];

  return (
    <Pressable onPress={onPress} style={containerStyle}>
      <LinearGradient
        colors={theme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        {/* Effet reflet / glass */}
        <View style={styles.glassShine} pointerEvents="none" />

        {type === 'streak' ? (
          <StreakWidgetContent size={size} data={data} theme={theme} platform={platform} />
        ) : (
          <QuestionWidgetContent size={size} data={data} theme={theme} platform={platform} />
        )}
      </LinearGradient>
    </Pressable>
  );
}

// ——— CONTENU DU WIDGET SÉRIE DE JOURS (STREAK) ——————————————————————————————
function StreakWidgetContent({
  size,
  data,
  theme,
  platform,
}: {
  size: WidgetSize;
  data: WidgetPayload;
  theme: ReturnType<typeof getWidgetTheme>;
  platform: WidgetPlatform;
}) {
  const todayDone = data.bothAnswered;

  // 1 Case (Small)
  if (size === 'small') {
    return (
      <View style={styles.smallContent}>
        <View style={styles.topRow}>
          <Text style={[styles.appBadge, { color: theme.textColor }]}>NousDeux</Text>
          <Text style={{ fontSize: 13 }}>{theme.emoji}</Text>
        </View>

        <View style={styles.centerStreakSmall}>
          <Text style={styles.flameIcon}>🔥</Text>
          <Text style={[styles.streakNumberSmall, { color: theme.textColor }]}>
            {data.streak}
          </Text>
          <Text style={[styles.streakLabelSmall, { color: theme.accentColor }]}>
            JOURS
          </Text>
        </View>

        <View style={[styles.statusPillSmall, { backgroundColor: theme.cardBg }]}>
          {todayDone ? (
            <>
              <CheckCircle2 color="#4ADE80" size={11} />
              <Text style={[styles.statusTextSmall, { color: '#E2FBE8' }]}>Validé</Text>
            </>
          ) : data.partnerAnswered && !data.userAnswered ? (
            <>
              <Heart color="#FF4B72" size={11} fill="#FF4B72" />
              <Text style={[styles.statusTextSmall, { color: '#FFD2CC' }]}>💌 À toi !</Text>
            </>
          ) : data.userAnswered ? (
            <>
              <Clock color="#FDE047" size={11} />
              <Text style={[styles.statusTextSmall, { color: '#FEF9C3' }]}>⏳ Partenaire</Text>
            </>
          ) : (
            <>
              <Clock color="#FDE047" size={11} />
              <Text style={[styles.statusTextSmall, { color: '#FEF9C3' }]}>En cours</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  // Rectangle (Medium)
  if (size === 'medium') {
    return (
      <View style={styles.mediumContent}>
        {/* Colonne gauche : Flamme & Jours */}
        <View style={styles.mediumLeftCol}>
          <View style={styles.streakBadgeRow}>
            <Text style={{ fontSize: 26, marginRight: 4 }}>🔥</Text>
            <View>
              <Text style={[styles.streakNumberMed, { color: theme.textColor }]}>
                {data.streak}
              </Text>
              <Text style={[styles.streakSubMed, { color: theme.accentColor }]}>
                jours de flamme
              </Text>
            </View>
          </View>

          <View style={[styles.statusChipMed, { backgroundColor: theme.cardBg }]}>
            {todayDone ? (
              <Text style={[styles.statusChipText, { color: '#86EFAC' }]}>
                ✅ Flamme entretenue
              </Text>
            ) : data.partnerAnswered && !data.userAnswered ? (
              <Text style={[styles.statusChipText, { color: '#FFD2CC', fontWeight: '800' }]}>
                💌 {data.partnerPseudo || 'Partenaire'} a répondu !
              </Text>
            ) : data.userAnswered ? (
              <Text style={[styles.statusChipText, { color: '#FEF08A' }]}>
                ⏳ En attente de {data.partnerPseudo || 'ton partenaire'}
              </Text>
            ) : (
              <Text style={[styles.statusChipText, { color: '#FEF08A' }]}>
                ⏳ Question à compléter
              </Text>
            )}
          </View>
        </View>

        {/* Colonne droite : Avatars du couple & mini timeline */}
        <View style={styles.mediumRightCol}>
          <View style={styles.avatarCoupleRow}>
            {/* Avatar 1 */}
            <View style={styles.avatarBorder}>
              {data.userAvatar ? (
                <Image source={{ uri: data.userAvatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{(data.userPseudo || 'M')[0]}</Text>
                </View>
              )}
            </View>

            {/* Cœur animé au milieu */}
            <View style={styles.heartBridge}>
              <Heart color="#FF4B72" fill="#FF4B72" size={14} />
            </View>

            {/* Avatar 2 */}
            <View style={styles.avatarBorder}>
              {data.partnerAvatar ? (
                <Image source={{ uri: data.partnerAvatar }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: '#FF8A80' }]}>
                  <Text style={styles.avatarInitial}>{(data.partnerPseudo || 'P')[0]}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 7 Jours de la semaine dots */}
          <View style={styles.weekDotsRow}>
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, idx) => (
              <View key={idx} style={styles.dayDotContainer}>
                <View
                  style={[
                    styles.dayDot,
                    idx < 6 || todayDone
                      ? { backgroundColor: '#4ADE80' }
                      : { backgroundColor: 'rgba(255,255,255,0.3)' },
                  ]}
                />
                <Text style={styles.dayDotText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // 4 Cases (Large)
  return (
    <View style={styles.largeContent}>
      {/* Header */}
      <View style={styles.largeHeader}>
        <View>
          <Text style={[styles.coupleNamesLarge, { color: theme.textColor }]}>
            {data.userPseudo} & {data.partnerPseudo}
          </Text>
          <Text style={[styles.coupleSubLarge, { color: theme.accentColor }]}>
            Ensemble depuis {data.daysTogether} jours
          </Text>
        </View>
        <Text style={{ fontSize: 24 }}>{theme.emoji}</Text>
      </View>

      {/* Carte centrale Streak */}
      <View style={[styles.streakCenterCard, { backgroundColor: theme.cardBg }]}>
        <Text style={{ fontSize: 44, marginBottom: 4 }}>🔥</Text>
        <Text style={[styles.streakNumberLarge, { color: theme.textColor }]}>
          {data.streak}
        </Text>
        <Text style={[styles.streakLabelLarge, { color: theme.accentColor }]}>
          JOURS CONSÉCUTIFS
        </Text>
      </View>

      {/* Statut quotidien */}
      <View style={[styles.largeStatusBox, { backgroundColor: 'rgba(0,0,0,0.14)' }]}>
        <View style={styles.statusLine}>
          <Text style={{ color: theme.textColor, fontWeight: '600', fontSize: 13 }}>
            Statut du jour :
          </Text>
          <Text
            style={{
              color: todayDone
                ? '#86EFAC'
                : data.partnerAnswered && !data.userAnswered
                ? '#FFD2CC'
                : '#FDE047',
              fontWeight: '700',
              fontSize: 13,
            }}
          >
            {todayDone
              ? '✅ Validé par les deux'
              : data.partnerAnswered && !data.userAnswered
              ? `💌 ${data.partnerPseudo || 'Partenaire'} a répondu ! À toi de jouer ✨`
              : data.userAnswered
              ? `⏳ En attente de ${data.partnerPseudo || 'ton partenaire'}`
              : '⏳ En attente de vos réponses'}
          </Text>
        </View>

        <Text style={[styles.footerHintLarge, { color: theme.accentColor }]}>
          Touchez pour ouvrir NousDeux et débloquer des récompenses !
        </Text>
      </View>
    </View>
  );
}

// ——— CONTENU DU WIDGET QUESTION DU JOUR ——————————————————————————————————————
function QuestionWidgetContent({
  size,
  data,
  theme,
  platform,
}: {
  size: WidgetSize;
  data: WidgetPayload;
  theme: ReturnType<typeof getWidgetTheme>;
  platform: WidgetPlatform;
}) {
  const isDone = data.bothAnswered;

  // 1 Case (Small)
  if (size === 'small') {
    return (
      <View style={styles.smallContent}>
        <View style={styles.topRow}>
          <Text style={[styles.appBadge, { color: theme.textColor }]}>Question</Text>
          <MessageCircle color={theme.accentColor} size={13} />
        </View>

        <View style={styles.questionCenterSmall}>
          <Text
            style={[styles.questionTextSmall, { color: theme.textColor }]}
            numberOfLines={3}
          >
            {data.todayQuestion}
          </Text>
        </View>

        <View style={[styles.statusPillSmall, { backgroundColor: theme.cardBg }]}>
          {isDone ? (
            <Text style={[styles.statusTextSmall, { color: '#86EFAC' }]}>✅ Répondu</Text>
          ) : data.partnerAnswered && !data.userAnswered ? (
            <Text style={[styles.statusTextSmall, { color: '#FFD2CC', fontWeight: '800' }]}>
              💌 {data.partnerPseudo || 'Partenaire'} a répondu !
            </Text>
          ) : data.userAnswered ? (
            <Text style={[styles.statusTextSmall, { color: '#FDE047' }]}>⏳ Partenaire</Text>
          ) : (
            <Text style={[styles.statusTextSmall, { color: '#FFD2CC' }]}>✍️ À toi de jouer</Text>
          )}
        </View>
      </View>
    );
  }

  // Rectangle (Medium)
  if (size === 'medium') {
    return (
      <View style={styles.mediumContent}>
        {/* Colonne gauche : Encart Question & Avatars */}
        <View style={[styles.mediumLeftCol, { flex: 0.38 }]}>
          <View style={[styles.categoryTag, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.categoryTagText, { color: theme.textColor }]}>
              {data.categoryName || 'Quotidien'}
            </Text>
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <View style={styles.avatarCoupleRow}>
              <View style={styles.avatarBorderSmall}>
                {data.userAvatar ? (
                  <Image source={{ uri: data.userAvatar }} style={styles.avatarImgSmall} />
                ) : (
                  <View style={styles.avatarPlaceholderSmall}>
                    <Text style={styles.avatarInitialSmall}>{(data.userPseudo || 'M')[0]}</Text>
                  </View>
                )}
              </View>
              <Heart color="#FF4B72" fill="#FF4B72" size={10} style={{ marginHorizontal: 2 }} />
              <View style={styles.avatarBorderSmall}>
                {data.partnerAvatar ? (
                  <Image source={{ uri: data.partnerAvatar }} style={styles.avatarImgSmall} />
                ) : (
                  <View style={[styles.avatarPlaceholderSmall, { backgroundColor: '#FF8A80' }]}>
                    <Text style={styles.avatarInitialSmall}>{(data.partnerPseudo || 'P')[0]}</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={[styles.qStatSub, { color: theme.accentColor }]}>
              {isDone
                ? 'Complété'
                : data.partnerAnswered && !data.userAnswered
                ? '💌 À toi !'
                : data.userAnswered
                ? 'En attente'
                : 'À remplir'}
            </Text>
          </View>
        </View>

        {/* Colonne droite : Question complète */}
        <View style={[styles.mediumRightCol, { flex: 0.62, justifyContent: 'center' }]}>
          <Text
            style={[styles.questionTextMed, { color: theme.textColor }]}
            numberOfLines={3}
          >
            "{data.todayQuestion}"
          </Text>

          <View style={[styles.actionPromptMed, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.actionPromptText, { color: theme.textColor }]}>
              {isDone
                ? 'Voir les réponses ›'
                : data.partnerAnswered && !data.userAnswered
                ? `💌 ${data.partnerPseudo || 'Partenaire'} a répondu ! Répondre ›`
                : data.userAnswered
                ? `En attente de ${data.partnerPseudo || 'ton partenaire'} ›`
                : 'Répondre maintenant ›'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // 4 Cases (Large)
  return (
    <View style={styles.largeContent}>
      {/* Header */}
      <View style={styles.largeHeader}>
        <View style={[styles.categoryTag, { backgroundColor: theme.cardBg }]}>
          <Text style={[styles.categoryTagText, { color: theme.textColor }]}>
            ✨ {data.categoryName || 'Question du Jour'}
          </Text>
        </View>
        <Text style={{ fontSize: 20 }}>{theme.emoji}</Text>
      </View>

      {/* Intitulé de la question */}
      <View style={[styles.questionCardLarge, { backgroundColor: theme.cardBg }]}>
        <Text style={[styles.questionQuoteLarge, { color: theme.textColor }]}>
          "{data.todayQuestion}"
        </Text>
      </View>

      {/* Détails des réponses des 2 partenaires */}
      <View style={styles.answersStatusRowLarge}>
        <View style={[styles.partnerStatusBox, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
          <Text style={[styles.partnerNameText, { color: theme.textColor }]}>
            {data.userPseudo} (Toi)
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: data.userAnswered ? '#86EFAC' : '#FDE047' }}>
            {data.userAnswered ? '✅ Répondu' : '⏳ En attente'}
          </Text>
        </View>

        <View style={[styles.partnerStatusBox, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
          <Text style={[styles.partnerNameText, { color: theme.textColor }]}>
            {data.partnerPseudo}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: data.partnerAnswered ? '#86EFAC' : '#FDE047' }}>
            {data.partnerAnswered ? '💌 A répondu !' : '⏳ En attente'}
          </Text>
        </View>
      </View>

      {/* Footer interactif */}
      <View style={[styles.largeStatusBox, { backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 8 }]}>
        <Text style={[styles.footerHintLarge, { color: theme.textColor, textAlign: 'center' }]}>
          {isDone
            ? '🎉 Vos deux réponses sont débloquées ! Ouvrez l’app pour les lire.'
            : data.partnerAnswered && !data.userAnswered
            ? `💌 ${data.partnerPseudo || 'Ton partenaire'} a répondu ! Touche ici pour répondre et voir sa réponse ✨`
            : data.userAnswered
            ? `⏳ Tu as répondu ! En attente de la réponse de ${data.partnerPseudo || 'ton partenaire'} 💕`
            : 'Touchez le widget pour répondre et garder votre flamme active.'}
        </Text>
      </View>
    </View>
  );
}

// ——— STYLES RESPONSIVES POUR IPHONE & SAMSUNG ——————————————————————————————
const styles = StyleSheet.create({
  baseContainer: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
  // Rayon de bordure iOS (WidgetKit Apple Standard: ~22px / ~28px)
  iosContainer: {
    borderRadius: 24,
  },
  // Rayon de bordure Android / Samsung One UI: ~18px
  androidContainer: {
    borderRadius: 18,
  },

  // 1 Case (Small: 158 x 158)
  sizeSmall: {
    width: 158,
    height: 158,
  },
  // Rectangle (Medium: 338 x 158)
  sizeMedium: {
    width: 338,
    height: 158,
  },
  // 4 Cases (Large: 338 x 338)
  sizeLarge: {
    width: 338,
    height: 338,
  },

  gradientBackground: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomLeftRadius: 60,
    borderBottomRightRadius: 60,
  },

  // ——— Small Styles ———
  smallContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  centerStreakSmall: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameIcon: {
    fontSize: 28,
    marginBottom: -2,
  },
  streakNumberSmall: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
    letterSpacing: -1,
  },
  streakLabelSmall: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  questionCenterSmall: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  questionTextSmall: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },

  // ——— Medium Styles ———
  mediumContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mediumLeftCol: {
    flex: 0.48,
    height: '100%',
    justifyContent: 'space-between',
  },
  streakBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakNumberMed: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 30,
  },
  streakSubMed: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusChipMed: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  mediumRightCol: {
    flex: 0.52,
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarCoupleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: '#FF9A8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  heartBridge: {
    marginHorizontal: -4,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotsRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  dayDotContainer: {
    alignItems: 'center',
    gap: 2,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayDotText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '700',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  avatarBorderSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  avatarImgSmall: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholderSmall: {
    flex: 1,
    backgroundColor: '#FF9A8B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialSmall: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10,
  },
  qStatSub: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },
  questionTextMed: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 8,
  },
  actionPromptMed: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionPromptText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ——— Large Styles ———
  largeContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  largeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coupleNamesLarge: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  coupleSubLarge: {
    fontSize: 11,
    fontWeight: '600',
  },
  streakCenterCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    marginVertical: 8,
  },
  streakNumberLarge: {
    fontSize: 54,
    fontWeight: '900',
    lineHeight: 56,
    letterSpacing: -2,
  },
  streakLabelLarge: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  largeStatusBox: {
    padding: 10,
    borderRadius: 14,
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footerHintLarge: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionCardLarge: {
    padding: 16,
    borderRadius: 18,
    marginVertical: 8,
    minHeight: 100,
    justifyContent: 'center',
  },
  questionQuoteLarge: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  answersStatusRowLarge: {
    flexDirection: 'row',
    gap: 8,
  },
  partnerStatusBox: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 2,
  },
  partnerNameText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
