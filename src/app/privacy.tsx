import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, ImageBackground, Linking } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { ContactEmailLink } from '../components/ContactEmailLink';
import { openContactEmail } from '../lib/contact';
import { useTopInset } from '@/hooks/useTopInset';

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: '#FFF5F2' },
  scroll: { flex: 1, padding: 20, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  titleContainer: { flex: 1, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  pageTitle: { fontSize: 16, fontWeight: '800', color: '#2A1A1A', textAlign: 'center' },
  lastUpdated: { fontSize: 12, color: '#A99693', marginBottom: 20, fontStyle: 'italic' },
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#4A3B39', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#5a4a48', lineHeight: 22 },
});
export default function PrivacyScreen() {
  const topInset = useTopInset();
  return (
    <ImageBackground
      source={require('../../assets/images/settings_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <ScrollView style={[styles.scroll, { paddingTop: topInset + 12 }]} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }}>
            <ArrowLeft color="#2A1A1A" size={24} />
          </Pressable>
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>Politique de Confidentialité</Text>
          </View>
        </View>

        <Animated.View entering={FadeInUp.duration(500)} style={styles.card}>
          <Text style={styles.lastUpdated}>Dernière mise à jour : 6 août 2026</Text>

          <Section title="1. Qui sommes-nous ?">
            NousDeux est une application permettant à deux partenaires de répondre ensemble à des questions quotidiennes.{'\n\n'}
            Responsable du traitement : NousDeux (projet personnel). Pour nous contacter, veuillez vous référer à la section 10 en bas de cette page.
          </Section>

          <Section title="2. Données collectées">
            Dans le cadre du fonctionnement de l'application, nous collectons :{'\n\n'}
            • <B>Données d'identification Google</B> : adresse e-mail, UID Firebase (fourni automatiquement lors de la connexion via Google).{'\n\n'}
            • <B>Profil utilisateur</B> : pseudo choisi, âge, photo de profil (optionnelle, encodée en base64 et stockée dans Firebase).{'\n\n'}
            • <B>Données de couple</B> : date d'anniversaire du couple, identifiant du couple (anonyme), code de synchronisation.{'\n\n'}
            • <B>Réponses aux questions</B> : vos réponses sont <B>chiffrées de bout en bout</B> (AES-256-GCM) avant d'être envoyées sur nos serveurs. Ni NousDeux, ni Firebase, ni aucun administrateur ne peut les lire.{'\n\n'}
            • <B>Données de progression</B> : index de question atteint, identifiants de questions vues.
          </Section>

          <Section title="3. Finalité du traitement">
            Les données sont utilisées exclusivement pour :{'\n\n'}
            • Permettre la synchronisation entre partenaires{'\n'}
            • Afficher votre profil et celui de votre partenaire{'\n'}
            • Gérer la progression dans les questions{'\n'}
            • Calculer la série de jours consécutifs (streak)
          </Section>

          <Section title="4. Hébergement & transfert hors UE">
            Vos données sont hébergées sur <B>Firebase (Google LLC)</B>, dont les serveurs sont situés aux États-Unis. Google LLC est certifié dans le cadre du mécanisme de transfert UE–États-Unis (Data Privacy Framework) et offre des garanties adéquates au sens du RGPD.{'\n\n'}
            En utilisant NousDeux, vous acceptez ce transfert.
          </Section>

          <Section title="5. Durée de conservation">
            Vos données sont conservées tant que votre compte est actif.{'\n\n'}
            En cas de suppression de compte via Paramètres → Zone Danger → Supprimer le compte, toutes vos données personnelles et vos réponses sont supprimées définitivement dans un délai de 30 jours.
          </Section>

          <Section title="6. Vos droits (RGPD)">
            Vous disposez des droits suivants :{'\n\n'}
            • <B>Droit d'accès</B> : vous pouvez consulter vos données dans l'application (profil, réponses).{'\n\n'}
            • <B>Droit de rectification</B> : vous pouvez modifier vos données dans Paramètres.{'\n\n'}
            • <B>Droit à l'effacement</B> : vous pouvez supprimer votre compte et toutes vos données via Paramètres → Zone Danger.{'\n\n'}
            • <B>Droit à la portabilité</B> : vous pouvez demander l'export de vos données.{'\n\n'}
            • <B>Droit d'opposition</B> : vous pouvez cesser d'utiliser l'application à tout moment.{'\n\n'}
            Pour exercer l'un de ces droits, vous pouvez nous écrire directement via le bouton de contact en section 10 ci-dessous.
          </Section>

          <Section title="7. Sécurité">
            Vos réponses aux questions sont protégées par un chiffrement <B>AES-256-GCM de bout en bout</B>. La clé de chiffrement est dérivée localement sur votre appareil et n'est jamais transmise à nos serveurs. Seuls vous et votre partenaire pouvez déchiffrer vos réponses.{'\n\n'}
            La communication avec Firebase est sécurisée via TLS/HTTPS.
          </Section>

          <Section title="8. Mineurs">
            NousDeux est destinée aux personnes âgées d'au moins 16 ans. Si vous avez connaissance qu'un mineur de moins de 16 ans utilise l'application, veuillez nous contacter.
          </Section>

          <Section title="9. Modifications">
            Cette politique peut être mise à jour. En cas de modification substantielle, nous vous en informerons lors de votre prochaine connexion.
          </Section>

          <Section
            title="10. Contact & réclamation"
            action={<ContactEmailLink label="nousdeux.app.contact@gmail.com" subject="Contact & Réclamation NousDeux" />}
          >
            Pour toute question relative à la protection de vos données ou l'exercice de vos droits, vous pouvez nous contacter directement ci-dessus.{'\n\n'}
            Vous avez également le droit d'introduire une réclamation auprès de la <B>CNIL</B> (Commission Nationale de l'Informatique et des Libertés) : www.cnil.fr
          </Section>
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

function Section({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children ? <Text style={styles.sectionBody}>{children}</Text> : null}
      {action}
    </View>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '700' }}>{children}</Text>;
}
